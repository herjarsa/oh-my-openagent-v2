import type { CommandEditor, CommandInvocation } from "@opencode/plugin/promise/command"
import type { GoalController } from "../hooks/goal/controller"
import { applyParsedGoalCommand } from "./session"

export type GoalCommandDeps = {
  readonly controller: GoalController
}

function stripCommandPrefix(text: string): string {
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()
  if (lower === "/goal") return ""
  if (lower.startsWith("/goal")) {
    const sep = trimmed.charAt(5)
    if (sep === " " || sep === "\t" || sep === "\n" || sep === "\r") return trimmed.slice(5).trim()
  }
  return trimmed
}

export function registerGoalCommand(editor: CommandEditor, deps: GoalCommandDeps): void {
  editor.add({
    name: "goal",
    description: "Show, set, pause, resume, or clear the session goal. Args: pause | resume | clear | <objective>. Empty args shows the current goal.",
    execute: async (input: CommandInvocation) => {
      const result = applyParsedGoalCommand(deps.controller, input.sessionID, stripCommandPrefix(input.prompt.text))
      // eslint-disable-next-line no-console
      console.log(`[goal-command] ${result}`)
    },
  })
}

