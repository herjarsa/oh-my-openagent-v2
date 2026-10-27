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
