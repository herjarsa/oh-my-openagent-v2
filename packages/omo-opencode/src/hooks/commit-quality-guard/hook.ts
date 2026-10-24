import { spawnSync } from "node:child_process"

import type { PluginInput } from "@opencode-ai/plugin"

import { log } from "../../shared/logger"
import {
  evaluateCommitQuality,
  isGitCommitCommand,
  shouldCheckFile,
  shouldSkipCommitCheck,
} from "./commit-quality"

export type CommitQualityGit = {
  stagedPaths: (cwd: string) => string[]
  stagedContent: (cwd: string, filePath: string) => string | null
}

const MAX_PENDING_WARNINGS = 256
export const COMMIT_QUALITY_WARNING_TAG = "commit-quality-warning"

function runGit(cwd: string, args: readonly string[]): { status: number | null; stdout: string } {
  try {
    const result = spawnSync("git", [...args], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    return {
      status: result.status,
      stdout: typeof result.stdout === "string" ? result.stdout : "",
    }
  } catch (error) {
    log("[commit-quality-guard] git invocation failed", {
      cwd,
      args,
      error: error instanceof Error ? error.message : String(error),
    })
    return { status: null, stdout: "" }
  }
}

function defaultGit(): CommitQualityGit {
  return {
    stagedPaths(cwd: string): string[] {
      const result = runGit(cwd, ["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
      if (result.status !== 0) return []
      return result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    },
    stagedContent(cwd: string, filePath: string): string | null {
      const result = runGit(cwd, ["show", `:${filePath}`])
      if (result.status !== 0) return null
      return result.stdout
    },
  }
}

function nonBlankString(value: unknown): string | null {
  if (typeof value !== "string") return null
  return value.trim().length > 0 ? value : null
}

function resolveCwd(ctx: PluginInput, args: Record<string, unknown>): string {
  return nonBlankString(args.cwd) ?? ctx.directory
}

export function createCommitQualityGuardHook(ctx: PluginInput, git?: CommitQualityGit) {
  const gitClient = git ?? defaultGit()
  const pendingWarnings = new Map<string, string[]>()
  const pendingOrder: string[] = []

  function stashWarnings(callID: string, warnings: string[]): void {
    if (callID.length === 0) {
      log("[commit-quality-guard] Warnings dropped: empty callID", { sessionID: ctx.directory })
      return
    }
    if (pendingWarnings.size >= MAX_PENDING_WARNINGS && pendingOrder.length > 0) {
      const oldest = pendingOrder.shift()
      if (oldest !== undefined) pendingWarnings.delete(oldest)
    }
    pendingWarnings.set(callID, warnings)
    pendingOrder.push(callID)
  }

  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ): Promise<void> => {
      if (input.tool.trim().toLowerCase() !== "bash") return
      const command = output.args.command
      if (typeof command !== "string") return
      if (!isGitCommitCommand(command)) return
      if (shouldSkipCommitCheck(command)) return

      const cwd = resolveCwd(ctx, output.args)
      const staged = gitClient
        .stagedPaths(cwd)
        .filter(shouldCheckFile)
        .map((filePath) => ({ path: filePath, content: gitClient.stagedContent(cwd, filePath) ?? "" }))

      if (staged.length === 0) return

      const result = evaluateCommitQuality(command, staged)
      if (result.block !== null) {
        log("[commit-quality-guard] Commit blocked", {
          sessionID: input.sessionID,
          callID: input.callID,
          files: staged.map((file) => file.path),
        })
        throw new Error(result.block)
      }
      if (result.warnings.length > 0) {
        stashWarnings(input.callID, result.warnings)
      }
    },

    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string; args?: Record<string, unknown> },
      output: { title: string; output: string; metadata: unknown },
    ): Promise<void> => {
      if (typeof output.output !== "string") return
      const warnings = pendingWarnings.get(input.callID)
      if (!warnings || warnings.length === 0) return
      pendingWarnings.delete(input.callID)
      if (output.output.includes(`<${COMMIT_QUALITY_WARNING_TAG}>`)) return
      output.output = [
        output.output,
        "",
        `<${COMMIT_QUALITY_WARNING_TAG}>`,
        ...warnings,
        `</${COMMIT_QUALITY_WARNING_TAG}>`,
      ].join("\n")
    },
  }
}