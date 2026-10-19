import { afterEach, describe, expect, it } from "bun:test";
import { runComputerCode } from "../src/run/runtime";
import { DesktopService } from "../src/service/service";
import { fakeEngineFactory } from "./harness";

const services: DesktopService[] = [];
afterEach(async () => {
	await Promise.all(services.splice(0).map((service) => service.close()));
});

async function open(env: Readonly<Record<string, string>> = {}) {
	const log = fakeEngineFactory({ FAKE_ENGINE_DESKTOP: "1", ...env });
	const service = new DesktopService({ createChild: log.factory });
	services.push(service);
	await service.open({});
	const run = (code: string) => runComputerCode({
		code, timeoutMs: 5_000,
		snapshot: {
			cwd: "/work", sessionId: "observe-test", captureMaxWidth: 3840,
			captureMaxHeight: 2400, captureMaxBytes: 5_000_000, display: "active",
			readOnly: true, stopHotkey: "ctrl+alt+shift+escape", allowHostRelayOnlyStop: false,
		},
	}, { service, executeTool: async () => undefined });
	return { log, run };
}

describe("atomic window observation", { timeout: 30_000 }, () => {
	it("uses one read-tier request and emits screenshot before AX", async () => {
		// Given
		const { log, run } = await open();
		// When
		const result = await run(`
			const win = await desktop.window("101");
			return await win.observe({ all: true, maxDepth: 3, maxNodes: 12 });
		`);
		// Then
		expect(log.requests.filter((request) => request.method === "observe").map((request) => request.params)).toEqual([{
			target: "101", caps: { maxWidth: 3840, maxHeight: 2400, maxBytes: 5_000_000 },
			ax: { all: true, maxDepth: 3, maxNodes: 12 },
		}]);
		expect(log.requests.some((request) => ["capture", "ax.snapshot"].includes(request.method))).toBe(false);
		expect(result.returnValue).toMatchObject({
			target: "101", frameId: expect.any(String), coordinateWidth: 1200, coordinateHeight: 800,
			ax: "button Run [ref=e1]", nodeCount: 1, truncated: false,
		});
		expect(result.displays.map((display) => display.type)).toEqual(["text", "image", "text"]);
		expect(result.displays.at(-1)).toEqual({ type: "text", text: "button Run [ref=e1]" });
	});

	it.each(["101", "202"])("silent observe of %s retains metadata without output", async (id) => {
		const { run } = await open();
		const result = await run(`return await (await desktop.window("${id}")).observe({ silent: true });`);
		expect(result.displays).toEqual([]);
		expect(result.returnValue).toMatchObject({ ax: "button Run [ref=e1]", nodeCount: 1 });
		if (id === "202") expect(result.screenshots).toHaveLength(1);
	});

	it("refuses old-engine observe cleanly without breaking screenshot or AX", async () => {
		// Given: same ABI, but no observe method and older capture fields.
		const { log, run } = await open({ FAKE_ENGINE_PRE_OBSERVE: "1", FAKE_ENGINE_PRE_ZOOM: "1" });
		// When
		// Bun 1.3.14 stalls expect().rejects on vm-driven engine-error rejections: catch directly.
		const observeFailure = await run(`return await (await desktop.window("101")).observe();`).then(
			() => { throw new Error("expected the run to reject"); },
			(error: unknown) => error,
		);
		expect(String((observeFailure as Error)?.message ?? observeFailure)).toContain(
			"observe is unavailable in this desktop engine",
		);
		const shot = await run(`return await (await desktop.window("101")).screenshot({ silent: true });`);
		const ax = await run(`return await (await desktop.window("101")).ax();`);
		// Then
		expect(shot.returnValue).toMatchObject({ width: 1200, coordinateWidth: 1200, coordinateHeight: 800 });
		expect(ax.returnValue).toBe("button Run [ref=e1]");
		expect(log.children).toHaveLength(1);
		expect(log.kills()).toBe(0);
	});

	it("rejects malformed combined results before emitting partial output", async () => {
		const { run } = await open({ FAKE_ENGINE_BAD_OBSERVE: "1" });
		// Bun 1.3.14 stalls expect().rejects on vm-driven engine-error rejections: catch directly.
		const malformedFailure = await run(`return await (await desktop.window("101")).observe();`).then(
			() => { throw new Error("expected the run to reject"); },
			(error: unknown) => error,
		);
		expect(String((malformedFailure as Error)?.message ?? malformedFailure)).toContain(
			"malformed observe result",
		);
	});
});
