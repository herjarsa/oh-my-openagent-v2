import { lstatSync } from "node:fs"

import type { PluginInput } from "@opencode-ai/plugin"

import { log } from "../../shared/logger"
import { isProtectedName } from "./protection"

const WRITE_TOOLS = new Set(["write", "edit", "multiedit"])

function resolveFilePath(args: Record<string, unknown>): string | undefined {
  const raw = args.filePath ?? args.path ?? args.file_path
  return typeof raw === "string" ? raw : undefined
}

function pathExists(targetPath: string): boolean {
  try {
    lstatSync(targetPath)
    return true
  } catch (error) {
    const code =
      error !== null && typeof error === "object" && "code" in error
        ? (error as { code?: unknown }).code
        : undefined
    if (code === "ENOENT") return false
    return true
  }
}

export function createConfigProtectionGuardHook(_ctx: PluginInput) {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ): Promise<void> => {
      if (!WRITE_TOOLS.has(input.tool.trim().toLowerCase())) return
      const filePath = resolveFilePath(output.args)
      if (!filePath) return
      const basename = filePath.replace(/\\/g, "/").split("/").pop() ?? ""
      if (!isProtectedName(basename)) return
      if (!pathExists(filePath)) return

      log("[config-protection-guard] Blocked linter config modification", {
        sessionID: input.sessionID,
        callID: input.callID,
        filePath,
      })
      throw new Error(
        `[config-protection-guard] BLOCKED: Modifying ${basename} is not allowed. ` +
          "Fix the source code to satisfy linter/formatter rules instead of weakening the config. " +
          "If this is a legitimate config change, disable the config-protection-guard hook temporarily (disabled_hooks).",
      )
    },
  }
}