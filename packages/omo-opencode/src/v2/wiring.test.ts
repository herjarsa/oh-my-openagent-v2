import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Context } from "@opencode/plugin/promise/plugin"
import { createGoalController } from "../hooks/goal/controller"
import { definition } from "./definition"

const createdDirs: string[] = []

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop() as string
    rmSync(dir, { recursive: true, force: true })
  }
})

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "goal-wiring-test-"))
  createdDirs.push(dir)
  return dir
}

describe("v2 wiring", () => {
  test("given staged project config and active goal #when setup runs #then it dispatches continuation, registers tools/command, and auto-starts via prompt hook", async () => {
    // given: a staged project with goal enabled + auto_start
    const dir = freshDir()
    mkdirSync(join(dir, ".omo"), { recursive: true })
    writeFileSync(
      join(dir, ".omo", "omo.jsonc"),
      `{"goal":{"enabled":true,"auto_start":true}}`,
      "utf-8",
    )
    // Isolate the config loader from ambient machine state: with HOME and
    // USERPROFILE pointed at an empty dir, the only config layer is the
    // staged project file, exactly like CI runners with no user config.
    // A leftover user-layer config (or a leaked HOME from an earlier test
    // file in the same process) must not be able to change this result.
    const fakeHome = freshDir()
    const savedHome = process.env.HOME
    const savedUserProfile = process.env.USERPROFILE
    process.env.HOME = fakeHome
    process.env.USERPROFILE = fakeHome
    try {
      createGoalController({ projectDir: dir }).setGoal("ses_w1", "Wire the plugin")

      // given: fakes capturing every registration the real setup() performs
      const captured: Array<{ sessionID: string; text: string }> = []
      const hooks: Record<string, (input: never) => Promise<unknown>> = {}
      const toolsAdded: Array<{ name: string }> = []
      const commandsAdded: Array<{ name: string }> = []
      const fake = {
        location: { directory: dir },
        event: {
          async *subscribe(): AsyncIterable<unknown> {
            yield { type: "session.idle", properties: { sessionID: "ses_w1" } }
          },
        },
        session: {
          prompt: async (input: { sessionID: string; text: string }) => {
            captured.push(input)
            return {}
          },
          hook: async (name: string, cb: (input: never) => Promise<unknown>) => {
            hooks[name] = cb
            return { dispose: async () => {} }
          },
        },
        tool: {
          transform: async (cb: (editor: { add: (t: { name: string }) => void }) => void) => {
            const added: Array<{ name: string }> = []
            cb({ add: (t: { name: string }) => { added.push(t) } })
            toolsAdded.push(...added)
            return { dispose: async () => {} }
          },
        },
        command: {
          transform: async (cb: (editor: { add: (d: { name: string }) => void }) => void) => {
            const added: Array<{ name: string }> = []
            cb({ add: (d: { name: string }) => { added.push(d) } })
            commandsAdded.push(...added)
            return { dispose: async () => {} }
          },
        },
      }

      // when: the real setup() wires everything against the fakes
      const cleanup = await definition.setup(fake as unknown as Context)
      await new Promise((resolve) => setTimeout(resolve, 300))
      await cleanup?.()

      // then: continuation dispatched through ctx.session.prompt with the goal objective
      expect(captured.length).toBeGreaterThanOrEqual(1)
      expect(captured.some((c) => c.sessionID === "ses_w1" && c.text.includes("Wire the plugin"))).toBe(true)

      // then: goal tools registered
      const toolNames = toolsAdded.map((t) => t.name)
      expect(toolNames).toContain("create_goal")
      expect(toolNames).toContain("update_goal")
      expect(toolNames).toContain("get_goal")

      // then: goal command registered
      expect(commandsAdded.map((c) => c.name)).toContain("goal")

      // when: a first prompt arrives on a fresh session through the real hook path
      expect(typeof hooks["prompt"]).toBe("function")
      await hooks["prompt"]({
        sessionID: "ses_w2",
        messageID: "msg_1",
        prompt: { text: "Hello world" },
        delivery: "steer",
      } as never)

      // then: auto-start created an active goal for the new session
      const goal = createGoalController({ projectDir: dir }).getGoal("ses_w2")
      expect(goal?.status).toBe("active")
    } finally {
      if (savedHome === undefined) delete process.env.HOME
      else process.env.HOME = savedHome
      if (savedUserProfile === undefined) delete process.env.USERPROFILE
      else process.env.USERPROFILE = savedUserProfile
    }
  })
})
