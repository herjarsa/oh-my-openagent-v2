import { Plugin } from "@opencode/plugin"
import type { Context } from "@opencode/plugin/promise/plugin"
import { loadPluginConfig } from "../plugin-config"
import type { OhMyOpenCodeConfig } from "../config"
import { createGoalController, type GoalController } from "../hooks/goal/controller"
import { normalizeEvent } from "./event-bridge"
import { handleGoalPromptText } from "./session"
import { registerGoalTools } from "./tools"
import { registerGoalCommand } from "./commands"
import { buildStructuredContinuation } from "./continuation"

export type BridgeContext = {
  readonly location: { readonly directory: string }
  readonly event: {
    subscribe(options?: { readonly signal?: AbortSignal }): AsyncIterable<unknown>
  }
  readonly session?: { prompt: (input: { sessionID: string; text: string }) => Promise<unknown> }
  readonly options?: { enabled?: boolean; maxIterations?: number; maxStalls?: number; maxQuietCycles?: number; minDispatchIntervalMs?: number }
}

export const COMPLETION_PATTERNS: readonly string[] = [
  "goal complete",
  "goal achieved",
  "task complete",
  "task is complete",
  "all done",
  "work is complete",
  "work complete",
  "nothing left to do",
  "no further action",
  "objetivo cumplido",
  "objetivo completado",
  "tarea completa",
  "tarea completada",
  "trabajo completado",
  "todo terminado",
  "he terminado",
  "completado",
  "terminado",
]

// Limitation: plain lowercase substring matching, so negations ("no he terminado")
// and quoted instructions can false-positive. The only consequence is that the
// text does not reset the no-progress counter; no goal state changes on this path.
export function looksLikeCompletionChatter(text: string): boolean {
  const lowered = text.toLowerCase()
  return COMPLETION_PATTERNS.some((pattern) => lowered.includes(pattern))
}

export async function runBridge(ctx: BridgeContext): Promise<() => void> {
  const controller: GoalController = createGoalController({ projectDir: ctx.location.directory })
  // eslint-disable-next-line no-console
  console.log(`[goal-bridge] plugin setup ok, watching goals in ${ctx.location.directory}`)
  if (ctx.options?.enabled === false) {
    // eslint-disable-next-line no-console
    console.log("[goal-bridge] disabled")
    return () => {}
  }
  const abort = new AbortController()
  const inFlight = new Set<string>()
  const loops = new Map<string, { progress: boolean; quietCycles: number; dispatched: boolean; lastDispatchAt: number }>()

  function loopState(sessionID: string): { progress: boolean; quietCycles: number; dispatched: boolean; lastDispatchAt: number } {
    const existing = loops.get(sessionID)
    if (existing !== undefined) return existing
    const fresh = { progress: false, quietCycles: 0, dispatched: false, lastDispatchAt: 0 }
    loops.set(sessionID, fresh)
    return fresh
  }

  function markProgress(sessionID: string): void {
    loopState(sessionID).progress = true
  }

  async function handleIdle(sessionID: string): Promise<void> {
    const goal = controller.getGoal(sessionID)
    if (goal === null || goal.status !== "active") {
      return
    }
    const maxIterations = ctx.options?.maxIterations ?? goal.maxIterations
    if (goal.iteration >= maxIterations) {
      controller.pauseGoal(sessionID)
      controller.updateProgress(sessionID, { pauseReason: "budget" })
      return
    }
    const st = loopState(sessionID)
    const minInterval = ctx.options?.minDispatchIntervalMs ?? 10000
    if (st.dispatched && Date.now() - st.lastDispatchAt < minInterval) {
      return
    }
    if (st.dispatched && !st.progress) {
      st.quietCycles += 1
      const maxQuiet = ctx.options?.maxQuietCycles ?? 3
      if (st.quietCycles >= maxQuiet) {
        controller.pauseGoal(sessionID)
        controller.updateProgress(sessionID, { pauseReason: "stalled" })
        // eslint-disable-next-line no-console
        console.log(`[goal-bridge] pausing quiet goal session ${sessionID} after ${st.quietCycles} dispatches with no tool activity`)
        return
      }
    } else {
      st.quietCycles = 0
    }
    if (inFlight.has(sessionID)) {
      return
    }
    const progressed = controller.updateProgress(sessionID, {
      iteration: goal.iteration + 1,
      ...(goal.stallCount > 0 ? { stallCount: 0 } : {}),
    })
    if (progressed === null) {
      return
    }
    st.dispatched = true
    st.lastDispatchAt = Date.now()
    st.progress = false
    inFlight.add(sessionID)
    try {
      const promptText = buildStructuredContinuation(progressed)
      if (ctx.session !== undefined) {
        await ctx.session.prompt({ sessionID, text: promptText })
      } else {
        // eslint-disable-next-line no-console
        console.log(`[goal-bridge active] session ${sessionID} has active goal "${progressed.objective.slice(0, 80)}"`)
      }
    } finally {
      inFlight.delete(sessionID)
    }
  }

  function handleError(sessionID: string): void {
    const goal = controller.getGoal(sessionID)
    if (goal === null || goal.status !== "active") {
      return
    }
    const maxStalls = ctx.options?.maxStalls ?? 3
    const stallCount = goal.stallCount + 1
    if (stallCount >= maxStalls) {
      controller.pauseGoal(sessionID)
      controller.updateProgress(sessionID, { stallCount, pauseReason: "stalled" })
      return
    }
    controller.updateProgress(sessionID, { stallCount })
  }

  function handleDeleted(sessionID: string): void {
    const goal = controller.getGoal(sessionID)
    if (goal !== null) {
      const parentGoalID = (goal as { parentGoalID?: string }).parentGoalID
      if (typeof parentGoalID === "string" && parentGoalID.length > 0) {
        controller.markComplete(sessionID)
        return
      }
    }
    controller.clearGoal(sessionID)
  }

  const pump = (async (): Promise<void> => {
    try {
      for await (const event of ctx.event.subscribe({ signal: abort.signal })) {
        try {
          const normalized = normalizeEvent(event)
          if (normalized === undefined) continue
          const sessionID = normalized.properties.sessionID
          if (sessionID === undefined) continue
          switch (normalized.type) {
            case "session.idle":
            case "session.compacted":
            case "session.compaction.ended":
              await handleIdle(sessionID)
              break
            case "session.error":
            case "session.execution.failed":
              handleError(sessionID)
              break
            case "session.deleted":
              handleDeleted(sessionID)
              break
            case "session.tool.called":
            case "session.message.content.updated":
              markProgress(sessionID)
              break
            case "session.text.ended": {
              const text = normalized.properties.text
              if (typeof text === "string" && !looksLikeCompletionChatter(text)) {
                markProgress(sessionID)
              }
              break
            }
            default:
              break
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn("[goal-bridge] event failed", error)
        }
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        // eslint-disable-next-line no-console
        console.warn("[goal-bridge] event stream failed", error)
      }
    }
  })()
  void pump
  return () => {
    abort.abort()
  }
}

async function setup(ctx: Context): Promise<() => void> {
  const projectDir = ctx.location.directory
  let pluginConfig: OhMyOpenCodeConfig
  try {
    pluginConfig = loadPluginConfig(projectDir, ctx)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[goal] failed to load plugin config, using defaults", error)
    pluginConfig = {} as OhMyOpenCodeConfig
  }
  const enabled = pluginConfig.goal?.enabled === true
  const controller: GoalController = createGoalController({ projectDir })
  const autoStartDeps = {
    controller,
    defaultModeGoal: pluginConfig.default_mode?.goal ?? false,
    goalAutoStart: pluginConfig.goal?.auto_start ?? false,
  }

  const registrations: Array<{ dispose: () => Promise<void> }> = []
  if (enabled) {
    const seenPrompts = new Set<string>()
    registrations.push(
      await ctx.session.hook("prompt", async (input) => {
        try {
          const sessionID = String(input.sessionID)
          const isFirst = !seenPrompts.has(sessionID)
          seenPrompts.add(sessionID)
          const r = handleGoalPromptText(autoStartDeps, { sessionID, text: input.prompt.text, isFirst })
          if (r.handled !== "none") {
            // eslint-disable-next-line no-console
            console.log(`[goal] ${r.handled} session ${sessionID}`)
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn("[goal] prompt hook failed", error)
        }
      }),
    )
    registrations.push(
      await ctx.tool.transform(async (editor) => {
        registerGoalTools(editor, {
          controller,
          requireCompletionEvidence: pluginConfig.goal?.require_completion_evidence,
        })
      }),
    )
    registrations.push(
      await ctx.command.transform(async (editor) => {
        registerGoalCommand(editor, { controller })
      }),
    )
  }

  const bridgeCleanup = await runBridge({
    location: ctx.location,
    event: ctx.event,
    session: { prompt: (input: { sessionID: string; text: string }) => ctx.session.prompt(input) },
    options: {
      enabled,
      maxIterations: pluginConfig.goal?.default_max_iterations,
      maxStalls: pluginConfig.goal?.max_stalls,
    },
  })

  return async () => {
    for (const registration of registrations) {
      await registration.dispose()
    }
    bridgeCleanup()
  }
}

export const definition = Plugin.define({
  id: "oh-my-openagent",
  setup,
})
