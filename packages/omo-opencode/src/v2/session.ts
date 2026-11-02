import { parseGoalCommand } from "../hooks/goal/command-arguments"
import type { GoalController } from "../hooks/goal/controller"

export type GoalPromptDeps = {
  readonly controller: GoalController
  /** Mirrors v1 chat-message.ts: pluginConfig.default_mode?.goal */
  readonly defaultModeGoal: boolean
  /** Mirrors v1 chat-message.ts: pluginConfig.goal?.auto_start */
  readonly goalAutoStart: boolean
}

export type GoalPromptInput = {
  readonly sessionID: string
  readonly text: string
  /** True for the first observed prompt of the session (tracked by the caller). */
  readonly isFirst: boolean
}

export type GoalPromptResult =
  | { readonly handled: "goal-command"; readonly objective: string }
  | { readonly handled: "auto-started"; readonly objective: string }
  | { readonly handled: "none" }

function splitGoalCommand(trimmed: string): string | null | undefined {
  const lower = trimmed.toLowerCase()
  if (lower === "/goal") return undefined
  if (!lower.startsWith("/goal")) return null
  const sep = trimmed.charAt(5)
  const isSpace = sep === " " || sep === "\t" || sep === "\n" || sep === "\r"
  if (!isSpace) return null
  return trimmed.slice(5).trim()
}

/**
 * Mirrors v1 src/plugin/chat-message.ts goal block:
 * - "/goal <objective>" with non-empty args sets the goal immediately.
 * - Otherwise, on the first message, auto-starts when
 *   (default_mode.goal || goal.auto_start) and the text is 1..2000 chars.
 * Pure: first-message tracking is the caller's job.
 */
export function handleGoalPromptText(deps: GoalPromptDeps, input: GoalPromptInput): GoalPromptResult {
  const trimmed = input.text.trim()
  const args = splitGoalCommand(trimmed)
  if (args !== null && args !== undefined && args.length > 0) {
    deps.controller.setGoal(input.sessionID, args)
    return { handled: "goal-command", objective: args }
  }
  if (input.isFirst && (deps.defaultModeGoal || deps.goalAutoStart)) {
    if (trimmed.length > 0 && trimmed.length <= 2000) {
      deps.controller.setGoal(input.sessionID, trimmed)
      return { handled: "auto-started", objective: trimmed }
    }
  }
  return { handled: "none" }
}

export function applyParsedGoalCommand(
  controller: GoalController,
  sessionID: string,
  rawArgs: string,
): string {
  const parsed = parseGoalCommand(rawArgs)
  switch (parsed.kind) {
    case "show": {
      return JSON.stringify(controller.getGoal(sessionID))
    }
    case "clear": {
      controller.clearGoal(sessionID)
      return "Goal cleared."
    }
    case "setStatus": {
      if (parsed.status === "paused") controller.pauseGoal(sessionID)
      else controller.resumeGoal(sessionID)
      return JSON.stringify(controller.getGoal(sessionID))
    }
    case "setObjective": {
      controller.setGoal(sessionID, parsed.objective)
      return JSON.stringify(controller.getGoal(sessionID))
    }
  }
}
