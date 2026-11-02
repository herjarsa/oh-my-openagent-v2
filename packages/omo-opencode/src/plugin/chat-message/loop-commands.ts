import type { OhMyOpenCodeConfig } from "../../config"

import { AUTO_SLASH_COMMAND_TAG_OPEN } from "../../hooks/auto-slash-command/constants"
import { parseGoalCommand } from "../../hooks/goal/command-arguments"
import { log } from "../../shared"
import { extractPromptText } from "./prompt-text"
import type { ChatMessageHooks, ChatMessageHandlerOutput, ChatMessageInput } from "./types"

function explicitGoalArguments(promptText: string): string | undefined {
  const match = /^\/goal(?:\s+([\s\S]*))?$/i.exec(promptText.trim())
  return match === null ? undefined : (match[1] ?? "").trim()
}

export function handleGoalMessage(args: {
  readonly hooks: ChatMessageHooks
  readonly input: ChatMessageInput
  readonly output: ChatMessageHandlerOutput
  readonly isFirstMessage: boolean
  readonly pluginConfig: OhMyOpenCodeConfig
  readonly nativeGoalCommand: boolean
}): void {
  const { hooks, input, output, isFirstMessage, pluginConfig, nativeGoalCommand } = args
  if (!hooks.goal || nativeGoalCommand) {
    return
  }

  const promptText = extractPromptText(output.parts)
  if (promptText.includes(AUTO_SLASH_COMMAND_TAG_OPEN)) {
    return
  }

  const explicitArguments = explicitGoalArguments(promptText)
  const parsed = parseGoalCommand(explicitArguments ?? promptText)
  const autoStart = isFirstMessage
    && pluginConfig.default_mode?.goal === true
    && pluginConfig.goal?.auto_start === true

  switch (parsed.kind) {
    case "setObjective":
      if (explicitArguments === undefined && !autoStart) {
        break
      }
      if (parsed.objective.length > 0) {
        hooks.goal.setGoal(input.sessionID, parsed.objective)
        log("[chat-message] Goal set", {
          sessionID: input.sessionID,
          objective: parsed.objective,
          source: explicitArguments === undefined ? "auto-start" : "explicit-command",
        })
      }
      break
    case "setStatus":
      if (parsed.status === "paused") {
        hooks.goal.pauseGoal(input.sessionID)
        log("[chat-message] Goal paused", { sessionID: input.sessionID })
      } else {
        hooks.goal.resumeGoal(input.sessionID)
        log("[chat-message] Goal resumed", { sessionID: input.sessionID })
      }
      break
    case "clear":
      hooks.goal.clearGoal(input.sessionID)
      log("[chat-message] Goal cleared", { sessionID: input.sessionID })
      break
    case "show":
      // No side effect; the goal is surfaced by TUI mirror and tools.
      break
    default:
      break
  }
}
