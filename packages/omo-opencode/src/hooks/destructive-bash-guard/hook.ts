import type { PluginInput } from "@opencode-ai/plugin"

import { log } from "../../shared/logger"
import { detectDestructiveCommand } from "./destructive"

export function createDestructiveBashGuardHook(_ctx: PluginInput) {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ): Promise<void> => {
      if (input.tool.trim().toLowerCase() !== "bash") return
      const command = output.args.command
      if (typeof command !== "string" || command.trim().length === 0) return
      const reason = detectDestructiveCommand(command)
      if (!reason) return

      log("[destructive-bash-guard] Blocked destructive command", {
        sessionID: input.sessionID,
        callID: input.callID,
        reason,
      })
      throw new Error(
        `[destructive-bash-guard] BLOCKED: ${reason}. ` +
          "Restate the goal and choose a non-destructive path. " +
          "If destruction is truly intended, disable the destructive-bash-guard hook temporarily (disabled_hooks).",
      )
    },
  }
}