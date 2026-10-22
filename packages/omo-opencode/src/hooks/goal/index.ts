import type { PluginInput } from "@opencode-ai/plugin"
import { dispatchInternalPrompt, isInternalPromptDispatchAccepted } from "../shared/prompt-async-gate"
import { createGoalController, type GoalController } from "./controller"
import { buildContinuationPrompt } from "./prompt"
import type { Goal } from "./types"

export type GoalHookOptions = {
  readonly projectDir: string
  readonly autoStart?: boolean
  readonly ultrawork?: boolean
  readonly getSessionExists?: (sessionID: string) => Promise<boolean>
  /** Resume active goals when the plugin starts after a crash or restart (default: true). */
  readonly resumeOnStart?: boolean
  /** Only resume goals updated within this many minutes (default: 30). */
  readonly resumeWindowMinutes?: number
}

export type GoalRecoveryResult = {
  readonly scanned: number
  readonly resumed: readonly string[]
  readonly pruned: readonly string[]
  readonly skipped: number
}

export type GoalHook = {
  readonly setGoal: (sessionID: string, objective: string) => Goal
  readonly getGoal: (sessionID: string) => Goal | null
  readonly pauseGoal: (sessionID: string) => Goal | null
  readonly resumeGoal: (sessionID: string) => Goal | null
  readonly clearGoal: (sessionID: string) => boolean
  readonly markComplete: (sessionID: string) => Goal | null
  readonly recoverActiveGoals: () => Promise<GoalRecoveryResult>
  readonly event: (input: { event: { type: string; properties?: unknown } }) => Promise<void>
}

const HOOK_NAME = "goal"
const MAX_STARTUP_RESUMES = 3
const STALE_PRUNE_SECONDS = 24 * 60 * 60
const DEFAULT_RESUME_WINDOW_MINUTES = 30

function getSessionIDFromEvent(properties: unknown): string | undefined {
  if (typeof properties === "object" && properties !== null) {
    const maybe = (properties as { sessionID?: string }).sessionID
    if (typeof maybe === "string") return maybe
    const maybeId = (properties as { id?: string }).id
    if (typeof maybeId === "string") return maybeId
  }
  return undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined
}

function tokenTotalOf(value: unknown): number | undefined {
  const record = asRecord(value)
  if (record === undefined) return undefined
  const nestedData = asRecord(record["data"])
  const tokens = asRecord(record["tokens"]) ?? (nestedData === undefined ? undefined : asRecord(nestedData["tokens"]))
  if (tokens === undefined) return undefined
  const input = tokens["input"]
  const output = tokens["output"]
  if (typeof input !== "number" || typeof output !== "number") return undefined
  return input + output
}

export function createGoalHook(ctx: PluginInput, options: GoalHookOptions): GoalHook {
  const controller: GoalController = createGoalController({ projectDir: options.projectDir })
  const inFlightContinuations = new Set<string>()
  const recoveredSessions = new Set<string>()

  async function readSessionTokenTotal(sessionID: string): Promise<number | undefined> {
    try {
      const response: unknown = await ctx.client.session.get({ path: { id: sessionID } })
      const total = tokenTotalOf(asRecord(response)?.["data"])
      if (total !== undefined) return total
    } catch (error) {
      console.warn(`[${HOOK_NAME}] session token lookup failed`, error)
    }

    try {
      const response: unknown = await ctx.client.session.messages({ path: { id: sessionID } })
      const data = asRecord(response)?.["data"]
      if (!Array.isArray(data)) return undefined
      let total = 0
      let found = false
      for (const item of data) {
        const info = asRecord(asRecord(item)?.["info"])
        if (info?.["role"] !== "assistant") continue
        const tokens = asRecord(info["tokens"])
        if (tokens === undefined) continue
        const input = tokens["input"]
        const output = tokens["output"]
        if (typeof input !== "number" || typeof output !== "number") continue
        total += input + output
        found = true
      }
      return found ? total : undefined
    } catch (error) {
      console.warn(`[${HOOK_NAME}] session message token lookup failed`, error)
      return undefined
    }
  }

  async function accountSessionUsage(sessionID: string): Promise<void> {
    const goal = controller.getGoal(sessionID)
    if (goal === null || goal.status !== "active") {
      return
    }
    const now = nowSeconds()
    const lastAccountedAt = goal.lastAccountedAt ?? goal.lastStartedAt ?? goal.createdAt
    const elapsedSeconds = Math.max(0, now - lastAccountedAt)
    const sessionTokenTotal = await readSessionTokenTotal(sessionID)
    const tokenDelta = sessionTokenTotal !== undefined && goal.lastAccountedTokens !== undefined
      ? Math.max(0, sessionTokenTotal - goal.lastAccountedTokens)
      : 0
    controller.accountUsage(
      sessionID,
      { input: tokenDelta, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: tokenDelta },
      elapsedSeconds,
      {
        ...(sessionTokenTotal !== undefined ? { sessionTokenTotal } : {}),
        accountedAt: now,
      },
    )
  }

  async function dispatchContinuation(goal: Goal, source: string): Promise<boolean> {
    const promptText = buildContinuationPrompt(goal)
    const promptResult = await dispatchInternalPrompt({
      mode: "async",
      client: ctx.client,
      sessionID: goal.sessionID,
      source: `${HOOK_NAME}:${source}`,
      settleMs: 150,
      queueBehavior: "defer",
      input: {
        path: { id: goal.sessionID },
        body: {
          parts: [{ type: "text", text: promptText }],
        },
      },
    })
    if (promptResult.status === "unavailable") {
      console.warn(`[${HOOK_NAME}] continuation dispatch unavailable`, {
        sessionID: goal.sessionID,
        source,
      })
      return false
    }
    if (promptResult.status === "failed" && !isInternalPromptDispatchAccepted(promptResult)) {
      // Log only; the dispatch may still have been accepted by another route.
      // eslint-disable-next-line no-console
      console.warn(`[${HOOK_NAME}] continuation dispatch failed`, promptResult.error)
      return false
    }
    return true
  }

  async function handleSessionIdle(sessionID: string): Promise<void> {
    const goal = controller.getGoal(sessionID)
    if (goal === null || goal.status !== "active") {
      return
    }
    if (inFlightContinuations.has(sessionID)) {
      return
    }
    inFlightContinuations.add(sessionID)
    try {
      try {
        await accountSessionUsage(sessionID)
      } catch (error) {
        console.warn(`[${HOOK_NAME}] usage accounting failed`, { sessionID, error })
      }
      const current = controller.getGoal(sessionID) ?? goal
      await dispatchContinuation(current, "idle-continuation")
    } finally {
      inFlightContinuations.delete(sessionID)
    }
  }

  async function handleSessionDeleted(sessionID: string): Promise<void> {
    controller.clearGoal(sessionID)
  }

  async function sessionExistsForRecovery(sessionID: string): Promise<boolean | undefined> {
    const getSessionExists = options.getSessionExists
    if (getSessionExists === undefined) {
      return undefined
    }
    try {
      return await getSessionExists(sessionID)
    } catch (error) {
      console.warn(`[${HOOK_NAME}] startup recovery session lookup failed`, { sessionID, error })
      return undefined
    }
  }

  async function recoverActiveGoals(): Promise<GoalRecoveryResult> {
    const allGoals = controller.listGoals()
    const activeGoals = allGoals.filter((goal) => goal.status === "active")

    if (options.resumeOnStart === false) {
      return { scanned: allGoals.length, resumed: [], pruned: [], skipped: activeGoals.length }
    }
    if (options.getSessionExists === undefined) {
      console.warn(`[${HOOK_NAME}] startup recovery skipped: session existence check is not wired`)
      return { scanned: allGoals.length, resumed: [], pruned: [], skipped: activeGoals.length }
    }

    const now = nowSeconds()
    const windowMinutes = options.resumeWindowMinutes ?? DEFAULT_RESUME_WINDOW_MINUTES
    const windowSeconds = Math.max(1, windowMinutes) * 60
    const resumed: string[] = []
    const pruned: string[] = []
    let skipped = 0

    for (const goal of activeGoals) {
      const ageSeconds = Math.max(0, now - goal.updatedAt)

      if (ageSeconds > windowSeconds) {
        // Outside the resume window: never resurrect stale work. Only clean
        // goals that are old enough and whose session content is definitively gone.
        if (ageSeconds >= STALE_PRUNE_SECONDS) {
          const exists = await sessionExistsForRecovery(goal.sessionID)
          if (exists === false) {
            controller.clearGoal(goal.sessionID)
            pruned.push(goal.sessionID)
            continue
          }
        }
        skipped += 1
        continue
      }

      if (recoveredSessions.has(goal.sessionID)) {
        skipped += 1
        continue
      }
      if ((goal.resumeCount ?? 0) >= MAX_STARTUP_RESUMES) {
        skipped += 1
        continue
      }

      const exists = await sessionExistsForRecovery(goal.sessionID)
      if (exists !== true) {
        // Unknown or missing session: leave the goal untouched for a later run.
        skipped += 1
        continue
      }

      recoveredSessions.add(goal.sessionID)
      try {
        await accountSessionUsage(goal.sessionID)
        const current = controller.getGoal(goal.sessionID) ?? goal
        const accepted = await dispatchContinuation(current, "startup-recovery")
        if (!accepted) {
          skipped += 1
          continue
        }
        controller.markResumed(goal.sessionID)
        resumed.push(goal.sessionID)
      } catch (error) {
        console.warn(`[${HOOK_NAME}] startup recovery failed for session`, {
          sessionID: goal.sessionID,
          error,
        })
        skipped += 1
      }
    }

    return { scanned: allGoals.length, resumed, pruned, skipped }
  }

  return {
    setGoal: controller.setGoal,
    getGoal: controller.getGoal,
    pauseGoal: controller.pauseGoal,
    resumeGoal: controller.resumeGoal,
    clearGoal: controller.clearGoal,
    markComplete: controller.markComplete,
    recoverActiveGoals,

    event: async (input) => {
      const { event } = input
      const sessionID = getSessionIDFromEvent(event.properties)
      if (sessionID === undefined) {
        return
      }
      switch (event.type) {
        case "session.idle":
          await handleSessionIdle(sessionID)
          break
        case "session.deleted":
          await handleSessionDeleted(sessionID)
          break
        default:
          break
      }
    },
  }
}

function nowSeconds(): number {
  return Math.trunc(Date.now() / 1000)
}
