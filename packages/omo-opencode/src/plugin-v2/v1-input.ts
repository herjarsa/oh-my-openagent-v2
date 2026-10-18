import type { $ as BunShell } from "bun"
import type { PluginInput } from "@opencode-ai/plugin"
import type { Plugin as V2Plugin } from "@opencode/plugin"

export type V2Context = V2Plugin.Context

export function v2LocationDirectory(ctx: V2Context): string {
  const location = (ctx as unknown as { location?: { directory?: unknown } }).location
  return typeof location?.directory === "string" && location.directory.length > 0
    ? location.directory
    : process.cwd()
}

function v2LocationProject(ctx: V2Context): unknown {
  const location = (ctx as unknown as { location?: { project?: unknown } }).location
  return location?.project ?? null
}

/**
 * Bun's shell handle without a top-level `bun` import: the dist bundle must
 * stay loadable under plain node, so no `= globalThis.Bun` destructure may
 * remain at module scope (see shared/dist-bundle-bun-globals.test.ts).
 * Under the real V2 host (bun runtime) this returns the live `$`;
 * elsewhere (plain node) it is undefined — a documented fallback, this
 * builder never throws.
 */
function bunShell(): BunShell | undefined {
  if (typeof globalThis.Bun === "undefined") return undefined
  return globalThis.Bun.$
}

/**
 * Build the V1 `PluginInput` for the V2 setup context.
 * - `client`: the V1ClientAdapter (never null — OMO's factory has no
 *   null-client tolerance, unlike meta-governor's).
 * - `serverUrl`: undefined — `initLiveServerRoute` treats that as
 *   "live wake routing unavailable" and every dispatch falls back to the
 *   in-process adapter client. No dummy URL, no doomed probes.
 * - `$`: bun's real shell handle.
 * - `experimental_workspace.register`: no-op (no V2 equivalent surface).
 * Never throws: every field has a fallback.
 */
export function buildV1Input(ctx: V2Context, client: unknown): PluginInput {
  const directory = v2LocationDirectory(ctx)
  const input = {
    client,
    project: v2LocationProject(ctx),
    directory,
    worktree: directory,
    experimental_workspace: {
      register(): void {
        // No-op: V2 exposes no V1 workspace registry at setup time.
      },
    },
    serverUrl: undefined,
    $: bunShell(),
  }
  return input as unknown as PluginInput
}
