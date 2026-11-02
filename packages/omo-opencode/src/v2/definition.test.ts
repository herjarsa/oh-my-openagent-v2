import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createGoalController } from "../hooks/goal/controller"
import { definition, runBridge, type BridgeContext } from "./definition"

const createdDirs: string[] = []

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop() as string
    rmSync(dir, { recursive: true, force: true })
  }
})

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "goal-bridge-test-"))
  createdDirs.push(dir)
  return dir
}

function ctxWithEvents(dir: string, events: unknown[]): BridgeContext {
  return {
    location: { directory: dir },
    event: {
      async *subscribe(): AsyncIterable<unknown> {
        for (const event of events) {
          yield event
        }
      },
    },
  }
}

describe("v2 definition", () => {
  test("given the module #when inspected #then it exposes id and setup", () => {
    // given: the ported v2 definition
    // when: reading its shape (what the OpenCode v2 loader validates)
    // then
    expect(typeof definition.id).toBe("string")
    expect(definition.id.length).toBeGreaterThan(0)
    expect(typeof definition.setup).toBe("function")
  })

  test("given active goal and session.idle #when bridge runs #then it logs the reactivation", async () => {
    // given
    const dir = freshDir()
    createGoalController({ projectDir: dir }).setGoal("ses_1", "Ship the feature")
    const seen: string[] = []
    const original = console.log
    console.log = (message?: unknown) => {
      seen.push(String(message))
    }
    try {
      // when
      const cleanup = await runBridge(ctxWithEvents(dir, [{ type: "session.idle", properties: { sessionID: "ses_1" } }]))
      await new Promise((resolve) => setTimeout(resolve, 50))
      cleanup()
    } finally {
      console.log = original
    }
    // then
    expect(seen.some((line) => line.includes("[goal-bridge active]") && line.includes("ses_1"))).toBe(true)
    expect(seen.some((line) => line.includes("[goal-bridge] plugin setup ok"))).toBe(true)
  })

  test("given unknown events #when bridge runs #then it ignores them and cleanup works", async () => {
    // given
    const dir = freshDir()
    const ctx = ctxWithEvents(dir, [{ nope: true }, { type: "", properties: {} }])
    // when
    const cleanup = await runBridge(ctx)
    await new Promise((resolve) => setTimeout(resolve, 50))
    // then: no throw, cleanup is safe to call twice
    cleanup()
    cleanup()
  })
})

describe("anti-loop", () => {
  function ctxWithBridge(
    dir: string,
    events: unknown[],
    captured: Array<{ sessionID: string; text: string }>,
    options: NonNullable<BridgeContext["options"]> = {},
  ): BridgeContext {
    return {
      location: { directory: dir },
      event: {
        async *subscribe(): AsyncIterable<unknown> {
          for (const event of events) {
            yield event
          }
        },
      },
      session: {
        prompt: async (input: { sessionID: string; text: string }) => {
          captured.push(input)
          return {}
        },
      },
      options,
    }
  }

  function idle(sessionID: string): unknown {
    return { type: "session.idle", data: { sessionID } }
  }

  function statusOf(dir: string, sessionID: string): string | undefined {
    return createGoalController({ projectDir: dir }).getGoal(sessionID)?.status
  }

  test("given active goal and wire envelope idle #when bridge runs #then prompt dispatched once with that sessionID", async () => {
    // given
    const dir = freshDir()
    createGoalController({ projectDir: dir }).setGoal("ses_wire", "Ship the feature")
    const captured: Array<{ sessionID: string; text: string }> = []
    // when
    const cleanup = await runBridge(ctxWithBridge(dir, [idle("ses_wire")], captured))
    await new Promise((resolve) => setTimeout(resolve, 150))
    cleanup()
    // then
    expect(captured.length).toBe(1)
    expect(captured[0]?.sessionID).toBe("ses_wire")
  })

  test("given repeated quiet idles #when maxQuiet reached #then pauses after exactly 2 prompts", async () => {
    // given
    const dir = freshDir()
    createGoalController({ projectDir: dir }).setGoal("ses_quiet", "Ship the feature")
    const captured: Array<{ sessionID: string; text: string }> = []
    const events = [idle("ses_quiet"), idle("ses_quiet"), idle("ses_quiet"), idle("ses_quiet")]
    // when
    const cleanup = await runBridge(ctxWithBridge(dir, events, captured, { maxQuietCycles: 2, minDispatchIntervalMs: 0 }))
    await new Promise((resolve) => setTimeout(resolve, 150))
    cleanup()
    // then
    expect(captured.length).toBe(2)
    expect(statusOf(dir, "ses_quiet")).toBe("paused")
  })

  test("given tool activity between idles #when progress resets #then pauses after exactly 3 prompts", async () => {
    // given
    const dir = freshDir()
    createGoalController({ projectDir: dir }).setGoal("ses_prog", "Ship the feature")
    const captured: Array<{ sessionID: string; text: string }> = []
    const toolCalled = { type: "session.tool.called", data: { sessionID: "ses_prog" } }
    const events = [idle("ses_prog"), toolCalled, idle("ses_prog"), idle("ses_prog"), idle("ses_prog")]
    // when
    const cleanup = await runBridge(ctxWithBridge(dir, events, captured, { maxQuietCycles: 2, minDispatchIntervalMs: 0 }))
    await new Promise((resolve) => setTimeout(resolve, 150))
    cleanup()
    // then
    expect(captured.length).toBe(3)
    expect(statusOf(dir, "ses_prog")).toBe("paused")
  })

  test("given done-chatter text #when bridge runs #then chatter never counts as progress", async () => {
    // given
    const dir = freshDir()
    createGoalController({ projectDir: dir }).setGoal("ses_chatter", "Ship the feature")
    const captured: Array<{ sessionID: string; text: string }> = []
    const chatter = { type: "session.text.ended", data: { sessionID: "ses_chatter", text: "All done, task complete. Nothing left to do." } }
    const events = [idle("ses_chatter"), chatter, idle("ses_chatter"), idle("ses_chatter")]
    // when
    const cleanup = await runBridge(ctxWithBridge(dir, events, captured, { maxQuietCycles: 2, minDispatchIntervalMs: 0 }))
    await new Promise((resolve) => setTimeout(resolve, 150))
    cleanup()
    // then
    expect(captured.length).toBe(2)
    expect(statusOf(dir, "ses_chatter")).toBe("paused")
  })

  test("given substantive text #when bridge runs #then progress keeps the goal active", async () => {
    // given
    const dir = freshDir()
    createGoalController({ projectDir: dir }).setGoal("ses_sub", "Ship the feature")
    const captured: Array<{ sessionID: string; text: string }> = []
    const substantive = { type: "session.text.ended", data: { sessionID: "ses_sub", text: "Edited foo.ts, now running tests" } }
    const events = [idle("ses_sub"), substantive, idle("ses_sub")]
    // when
    const cleanup = await runBridge(ctxWithBridge(dir, events, captured, { minDispatchIntervalMs: 0 }))
    await new Promise((resolve) => setTimeout(resolve, 150))
    cleanup()
    // then
    expect(captured.length).toBe(2)
    expect(statusOf(dir, "ses_sub")).toBe("active")
  })

  test("given back-to-back idles #when cooldown active #then second idle is skipped", async () => {
    // given
    const dir = freshDir()
    createGoalController({ projectDir: dir }).setGoal("ses_cool", "Ship the feature")
    const captured: Array<{ sessionID: string; text: string }> = []
    // when
    const cleanup = await runBridge(ctxWithBridge(dir, [idle("ses_cool"), idle("ses_cool")], captured))
    await new Promise((resolve) => setTimeout(resolve, 150))
    cleanup()
    // then
    expect(captured.length).toBe(1)
  })

  test("given v2 execution failed events #when stalls reach max #then goal pauses", async () => {
    // given
    const dir = freshDir()
    createGoalController({ projectDir: dir }).setGoal("ses_fail", "Ship the feature")
    const captured: Array<{ sessionID: string; text: string }> = []
    const failed = { type: "session.execution.failed", data: { sessionID: "ses_fail" } }
    // when
    const cleanup = await runBridge(ctxWithBridge(dir, [failed, failed, failed], captured))
    await new Promise((resolve) => setTimeout(resolve, 150))
    cleanup()
    // then
    expect(statusOf(dir, "ses_fail")).toBe("paused")
  })
})
