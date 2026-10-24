/**
 * Ad-hoc documentation filename warning ported from ECC (MIT:
 * affaan-m/ECC scripts/hooks/doc-file-warning.js).
 *
 * Warn-only, never blocks: impulse files (NOTES.md, TODO.txt, ...) at the
 * repo root rot fast. Structured directories (docs/, skills/, ...) are
 * always allowed. Surfaced via tool.execute.after so the model sees it
 * in the Write result instead of failing the call.
 */

const ADHOC_FILENAMES = /^(NOTES|TODO|SCRATCH|TEMP|DRAFT|BRAINSTORM|SPIKE|DEBUG|WIP)\.(md|txt)$/
const STRUCTURED_DIRS = /(^|\/)(docs|\.claude|\.github|commands|skills|benchmarks|templates|\.history|memory)\//
export const DOC_FILE_WARNING_TAG = "doc-file-warning"

export function isSuspiciousDocPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/")
  const basename = normalized.split("/").pop() ?? ""
  if (!/\.(md|txt)$/.test(basename)) return false
  if (!ADHOC_FILENAMES.test(basename)) return false
  if (STRUCTURED_DIRS.test(normalized)) return false
  return true
}

function resolveFilePath(args: Record<string, unknown> | undefined): string | null {
  if (!args) return null
  const raw = args.filePath ?? args.path ?? args.file_path
  return typeof raw === "string" ? raw : null
}

export function createDocFileWarningHook() {
  return {
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string; args?: Record<string, unknown> },
      output: { title: string; output: string; metadata: unknown },
    ): Promise<void> => {
      if (typeof output.output !== "string") return
      const filePath = resolveFilePath(input.args)
      if (!filePath || !isSuspiciousDocPath(filePath)) return
      if (output.output.includes(`<${DOC_FILE_WARNING_TAG}>`)) return
      output.output = [
        output.output,
        "",
        `<${DOC_FILE_WARNING_TAG}>`,
        `Ad-hoc documentation filename detected: ${filePath}. Prefer a structured path (docs/, skills/, .github/, benchmarks/, templates/).`,
        `</${DOC_FILE_WARNING_TAG}>`,
      ].join("\n")
    },
  }
}