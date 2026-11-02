/**
 * Commit quality checks ported from ECC's pre-commit hook
 * (MIT: affaan-m/ECC scripts/hooks/pre-bash-commit-quality.js).
 *
 * Pilot scope: static checks only (no linter subprocesses). Linters
 * (ESLint/Pylint/golint) belong to CI, not to the tool-call hot path:
 * spawning them synchronously would stall every `git commit` issued
 * by an agent for up to 30s and depends on repo-local binaries.
 */

export type StagedFile = {
  readonly path: string
  readonly content: string
}

export type ContentIssue = {
  readonly type: "console-log" | "debugger" | "todo" | "secret"
  readonly line: number
  readonly message: string
  readonly severity: "warning" | "error" | "info"
}

export type CommitQualityResult = {
  /** Non-null when the commit must be blocked. */
  readonly block: string | null
  /** Non-blocking findings surfaced after the tool call. */
  readonly warnings: string[]
}

const CHECKABLE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".rs"] as const

export function shouldCheckFile(filePath: string): boolean {
  return CHECKABLE_EXTENSIONS.some((ext) => filePath.endsWith(ext))
}

export function isGitCommitCommand(command: string): boolean {
  return command.includes("git commit")
}

export function shouldSkipCommitCheck(command: string): boolean {
  return command.includes("--amend") || command.includes("--no-verify")
}

/**
 * Whole-value placeholder suppression for the generic api-key rules.
 * Deliberately narrow: must NOT suppress real high-entropy secrets.
 */
export function isPlaceholderSecret(value: string): boolean {
  const v = (value || "").trim()
  if (v.length === 0) return true
  if (/^process\.env\.[A-Za-z0-9_]+$/.test(v)) return true
  if (/^\$\{[^}]*\}$/.test(v)) return true
  if (/^<[^<>]*>$/.test(v)) return true
  if (/^(REPLACE_ME|CHANGE_?ME|YOUR[_-]?API[_-]?KEY|YOUR[_-]?KEY[_-]?HERE|API[_-]?KEY|SECRET|TOKEN|KEY|TODO|TBD|FIXME|XXX+)$/i.test(v)) return true
  return false
}

type SecretPattern = {
  readonly name: string
  readonly pattern: RegExp
  readonly valueGroup?: number
}

const SECRET_PATTERNS: readonly SecretPattern[] = [
  { name: "Anthropic API key", pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/ },
  { name: "OpenAI API key", pattern: /sk-[a-zA-Z0-9]{20,}/ },
  { name: "GitHub PAT", pattern: /ghp_[a-zA-Z0-9]{36}/ },
  { name: "AWS Access Key", pattern: /AKIA[A-Z0-9]{16}/ },
  { name: "API key", pattern: /api[_-]?key\s*[=:]\s*['"]([^'"]+)['"]/i, valueGroup: 1 },
  {
    name: "API key",
    pattern: /api[_-]?key\s*[=:]\s*(?!['"])((?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{12,})/i,
    valueGroup: 1,
  },
]

function isCommentLine(trimmed: string): boolean {
  return trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")
}

export function findContentIssues(filePath: string, content: string): ContentIssue[] {
  const issues: ContentIssue[] = []
  const lines = content.split("\n")

  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmed = line.trim()

    if (line.includes("console.log") && !isCommentLine(trimmed)) {
      issues.push({
        type: "console-log",
        line: lineNum,
        message: `console.log found at line ${lineNum}`,
        severity: "warning",
      })
    }

    if (/\bdebugger\b/.test(line) && !isCommentLine(trimmed)) {
      issues.push({
        type: "debugger",
        line: lineNum,
        message: `debugger statement at line ${lineNum}`,
        severity: "error",
      })
    }

    const todoMatch = line.match(/(?:\/\/|#)\s*(TODO|FIXME):?\s*(\S.*)/)
    if (todoMatch && !todoMatch[2].match(/#\d+|issue/i)) {
      issues.push({
        type: "todo",
        line: lineNum,
        message: `TODO/FIXME without issue reference at line ${lineNum}: "${todoMatch[2].trim()}"`,
        severity: "info",
      })
    }

    for (const { name, pattern, valueGroup } of SECRET_PATTERNS) {
      const secretMatch = line.match(pattern)
      if (secretMatch && !(valueGroup !== undefined && isPlaceholderSecret(secretMatch[valueGroup] ?? ""))) {
        issues.push({
          type: "secret",
          line: lineNum,
          message: `Potential ${name} exposed at line ${lineNum}`,
          severity: "error",
        })
      }
    }
  })

  return issues
}

const COMMIT_MESSAGE_RE =
  /(?:-m|--message)[=\s]+(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^"']+?)\s*$)/

export function extractCommitMessage(command: string): string | null {
  const messageMatch = command.match(COMMIT_MESSAGE_RE)
  if (!messageMatch) return null
  return messageMatch[1] ?? messageMatch[2] ?? messageMatch[3] ?? null
}

const CONVENTIONAL_COMMIT_RE = /^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?:\s*.+/

export function validateCommitMessage(message: string): string[] {
  const warnings: string[] = []
  const isConventional = CONVENTIONAL_COMMIT_RE.test(message)

  if (!isConventional) {
    warnings.push(
      "Commit message does not follow conventional commit format. Use format: type(scope): description (e.g. \"feat(auth): add login flow\")",
    )
  }
  if (message.length > 72) {
    warnings.push(
      `Commit message too long (${message.length} chars, max 72). Keep the first line under 72 characters.`,
    )
  }
  if (isConventional) {
    const afterColon = message.split(":")[1]
    if (afterColon && /^[A-Z]/.test(afterColon.trim())) {
      warnings.push("Subject should start with lowercase after type. Use lowercase for the first letter of the subject.")
    }
  }
  if (message.endsWith(".")) {
    warnings.push("Commit message should not end with a period. Remove the trailing period.")
  }
  return warnings
}

export function evaluateCommitQuality(
  command: string,
  staged: readonly StagedFile[],
): CommitQualityResult {
  const errors: string[] = []
  const warnings: string[] = []

  for (const file of staged) {
    for (const issue of findContentIssues(file.path, file.content)) {
      const entry = `${file.path}:${issue.line}: ${issue.message}`
      if (issue.severity === "error") {
        errors.push(entry)
      } else {
        warnings.push(entry)
      }
    }
  }

  const message = extractCommitMessage(command)
  if (message !== null) {
    warnings.push(...validateCommitMessage(message))
  }

  if (errors.length > 0) {
    return {
      block: [
        "[commit-quality-guard] Commit blocked by pre-commit quality check:",
        ...errors.map((entry) => `  ERROR ${entry}`),
        "Fix the issues above before committing, or bypass with: git commit --no-verify",
      ].join("\n"),
      warnings,
    }
  }
  return { block: null, warnings }
}