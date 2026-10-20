import { describe, expect, test } from "bun:test"
import { BUILD_NODES, selectBuildNodes } from "./build-nodes"

describe("build dependency graph", () => {
	test("#given the OpenCode-only fork #when scheduled #then no harness-only node remains", () => {
		const ids = BUILD_NODES.map((node) => node.id)

		expect(ids).not.toContain("senpi-plugin")
		expect(ids).not.toContain("codex-plugin")
		expect(ids).not.toContain("codex-install")
	})

	test("#given a default build #when the graph is selected #then every node is scheduled with its dependencies", () => {
		const selected = selectBuildNodes(BUILD_NODES, undefined)

		expect(selected.map((node) => node.id).sort()).toEqual(BUILD_NODES.map((node) => node.id).sort())
	})
})
