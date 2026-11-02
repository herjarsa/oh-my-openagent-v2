import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { PluginInput } from "@opencode-ai/plugin"
import { createGoalHook } from "./index"
import { writeGoal } from "./store"
import type { Goal } from "./types"

function makePluginInput(): PluginInput {
  return {
    directory: mkdtempSync(join(tmpdir(), "goal-hook-")),
    client: {
      session: {
        messages: Object.assign(
          async () => ({ data: [] }),
          { create: async () => ({ id: "msg-1" }) },
        ),
        get: async () => ({ data: { id: "s1" } }),
        status: async () => ({ data: {} }),
        promptAsync: async () => ({ data: { info: { id: "msg-2" } } }),
      },
    },
  } as unknown as PluginInput
}

function storeRef(projectDir: string, sessionID: string) {
  return { baseDir: join(projectDir, ".omo", "goal"), sessionID }
}

function ageGoal(
  hook: ReturnType<typeof createGoalHook>,
  projectDir: string,
  sessionID: string,
  ageSeconds: number,
  overrides: Partial<Goal> = {},
): void {
  const goal = hook.getGoal(sessionID)
  if (goal === null) {
    throw new Error(`goal ${sessionID} not found`)
  }
  const at = Math.trunc(Date.now() / 1000) - ageSeconds
  writeGoal(storeRef(projectDir, sessionID), {
    ...goal,
    createdAt: Math.min(goal.createdAt, at),
    updatedAt: at,
    lastStartedAt: at,
    ...overrides,
  })
}

describe("createGoalHook", () => {
  test("setGoal and getGoal round trip", () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })

    const goal = hook.setGoal("s1", "Ship it")

    expect(goal.objective).toBe("Ship it")
    expect(hook.getGoal("s1")?.objective).toBe("Ship it")
  })

  test("clearGoal removes goal", () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })
    hook.setGoal("s1", "Ship it")

    hook.clearGoal("s1")

    expect(hook.getGoal("s1")).toBeNull()
  })

  test("session.deleted clears goal", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })
    hook.setGoal("s1", "Ship it")

    await hook.event({ event: { type: "session.deleted", properties: { sessionID: "s1" } } })

    expect(hook.getGoal("s1")).toBeNull()
  })

  test("session.idle injects continuation for active goal", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })
    hook.setGoal("s1", "Ship it")

    await hook.event({ event: { type: "session.idle", properties: { sessionID: "s1" } } })

    // No crash; injection is best-effort.
    expect(hook.getGoal("s1")?.status).toBe("active")
  })

  test("session.idle accounts elapsed time on the active goal", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })
    const goal = hook.setGoal("account-1", "Ship it")
    const now = Math.trunc(Date.now() / 1000)
    writeGoal(storeRef(ctx.directory, "account-1"), {
      ...goal,
      lastStartedAt: now - 60,
      lastAccountedAt: undefined,
    })

    await hook.event({ event: { type: "session.idle", properties: { sessionID: "account-1" } } })

    expect(hook.getGoal("account-1")?.timeUsedSeconds).toBeGreaterThanOrEqual(60)
  })

  test("session.idle skips paused goal", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })
    hook.setGoal("s1", "Ship it")
    hook.pauseGoal("s1")

    await hook.event({ event: { type: "session.idle", properties: { sessionID: "s1" } } })

    expect(hook.getGoal("s1")?.status).toBe("paused")
  })

  test("event without sessionID is ignored", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })
    hook.setGoal("s1", "Ship it")

    await hook.event({ event: { type: "session.idle", properties: {} } })

    expect(hook.getGoal("s1")?.status).toBe("active")
  })
})

describe("recoverActiveGoals", () => {
  test("resumes a fresh active goal when the session exists", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, {
      projectDir: ctx.directory,
      getSessionExists: async () => true,
    })
    hook.setGoal("recover-fresh", "Ship it")

    const result = await hook.recoverActiveGoals()

    expect(result.resumed).toEqual(["recover-fresh"])
    expect(hook.getGoal("recover-fresh")?.resumeCount).toBe(1)
  })

  test("skips a stale goal without touching it", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, {
      projectDir: ctx.directory,
      getSessionExists: async () => true,
    })
    hook.setGoal("recover-stale", "Ship it")
    ageGoal(hook, ctx.directory, "recover-stale", 60 * 60)

    const result = await hook.recoverActiveGoals()

    expect(result.resumed).toEqual([])
    expect(result.pruned).toEqual([])
    expect(hook.getGoal("recover-stale")?.status).toBe("active")
  })

  test("prunes a stale goal whose session is gone", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, {
      projectDir: ctx.directory,
      getSessionExists: async () => false,
    })
    hook.setGoal("recover-orphan", "Ship it")
    ageGoal(hook, ctx.directory, "recover-orphan", 25 * 60 * 60)

    const result = await hook.recoverActiveGoals()

    expect(result.pruned).toEqual(["recover-orphan"])
    expect(hook.getGoal("recover-orphan")).toBeNull()
  })

  test("does not resume a fresh goal when the session is missing", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, {
      projectDir: ctx.directory,
      getSessionExists: async () => false,
    })
    hook.setGoal("recover-missing", "Ship it")

    const result = await hook.recoverActiveGoals()

    expect(result.resumed).toEqual([])
    expect(result.pruned).toEqual([])
    expect(hook.getGoal("recover-missing")?.status).toBe("active")
  })

  test("honors resumeOnStart=false", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, {
      projectDir: ctx.directory,
      resumeOnStart: false,
      getSessionExists: async () => true,
    })
    hook.setGoal("recover-disabled", "Ship it")

    const result = await hook.recoverActiveGoals()

    expect(result.resumed).toEqual([])
    expect(hook.getGoal("recover-disabled")?.resumeCount).toBe(0)
  })

  test("stops after the startup resume cap", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, {
      projectDir: ctx.directory,
      getSessionExists: async () => true,
    })
    hook.setGoal("recover-cap", "Ship it")
    ageGoal(hook, ctx.directory, "recover-cap", 0, { resumeCount: 3 })

    const result = await hook.recoverActiveGoals()

    expect(result.resumed).toEqual([])
    expect(hook.getGoal("recover-cap")?.resumeCount).toBe(3)
  })

  test("is idempotent within one process", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, {
      projectDir: ctx.directory,
      getSessionExists: async () => true,
    })
    hook.setGoal("recover-once", "Ship it")

    const first = await hook.recoverActiveGoals()
    const second = await hook.recoverActiveGoals()

    expect(first.resumed).toEqual(["recover-once"])
    expect(second.resumed).toEqual([])
    expect(hook.getGoal("recover-once")?.resumeCount).toBe(1)
  })

  test("treats a failing session lookup as unknown and never prunes", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, {
      projectDir: ctx.directory,
      getSessionExists: async () => {
        throw new Error("session store unavailable")
      },
    })
    hook.setGoal("recover-error", "Ship it")
    ageGoal(hook, ctx.directory, "recover-error", 25 * 60 * 60)

    const result = await hook.recoverActiveGoals()

    expect(result.resumed).toEqual([])
    expect(result.pruned).toEqual([])
    expect(hook.getGoal("recover-error")?.status).toBe("active")
  })
})
