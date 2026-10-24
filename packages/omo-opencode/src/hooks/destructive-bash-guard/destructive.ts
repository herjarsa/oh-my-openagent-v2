/**
 * Lean destructive-bash detection inspired by ECC GateGuard (MIT:
 * affaan-m/ECC scripts/hooks/gateguard-fact-force.js).
 *
 * The full GateGuard is a 2600-line system with ~10 lib dependencies
 * (subshell exploders, sudo/env unwrappers, SQL clients, find -exec).
 * This guard captures the failures that actually hurt — recursive force
 * deletes, history-destroying git, disk writes — in ~100 lines with zero
 * dependencies. Quote-aware: quoted prose ("rm -rf /" inside a commit
 * message or echo) never triggers.
 */

export function stripQuotedStrings(input: string): string {
  return input.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""')
}

export function splitSegments(input: string): string[] {
  return stripQuotedStrings(input)
    .split(/;|\||&&|\n/)
    .map((segment) => segment.replace(/(^|\s)#.*$/, "$1").trim())
    .filter((segment) => segment.length > 0)
}

function basenameToken(token: string): string {
  return token
    .replace(/^.*[\\/]/, "")
    .replace(/\.exe$/i, "")
    .toLowerCase()
}

function shortFlags(token: string): string {
  if (!token.startsWith("-") || token.startsWith("--") || token.length < 2) return ""
  return token.slice(1)
}

function unwrapLeadWrappers(tokens: string[]): string[] {
  let rest = tokens.slice()
  for (let depth = 0; depth < 5; depth++) {
    const first = rest[0]
    if (first === undefined) return []
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(first)) {
      rest = rest.slice(1)
      continue
    }
    const base = basenameToken(first)
    if (base === "sudo" || base === "doas" || base === "env") {
      rest = rest.slice(1)
      continue
    }
    return rest
  }
  return rest
}

function hasShortFlag(tokens: string[], letters: string): boolean {
  return tokens.some((token) => {
    if (token.startsWith("--")) return token === "--recursive" ? letters.includes("r") : token === "--force" ? letters.includes("f") : false
    const flags = shortFlags(token)
    return flags.length > 0 && [...letters].some((letter) => flags.includes(letter))
  })
}

function isDestructiveRm(argv: string[]): boolean {
  if (basenameToken(argv[0] ?? "") !== "rm") return false
  const operands = argv.slice(1)
  if (!operands.some((token) => !token.startsWith("-"))) return false
  return hasShortFlag(operands, "rR") && hasShortFlag(operands, "f")
}

function findGitSubcommand(tokens: string[]): { command: string; rest: string[] } | null {
  if (basenameToken(tokens[0] ?? "") !== "git") return null
  let index = 1
  while (index < tokens.length) {
    const token = tokens[index] ?? ""
    if (token === "-c" || token === "-C") {
      index += 2
      continue
    }
    if (token.startsWith("-")) {
      index += 1
      continue
    }
    return { command: token.toLowerCase(), rest: tokens.slice(index + 1) }
  }
  return null
}

function isDestructiveGit(argv: string[]): string | null {
  const sub = findGitSubcommand(argv)
  if (!sub) return null
  const { command, rest } = sub
  if (command === "reset" && rest.includes("--hard")) return "git reset --hard discards uncommitted work"
  if (command === "clean" && rest.some((t) => t === "--force" || (shortFlags(t).length > 0 && shortFlags(t).includes("f")))) {
    return "git clean -f deletes untracked files"
  }
  if (command === "checkout" && rest.some((t) => t === "--" || t === ".")) {
    return "git checkout --/. discards working-tree changes"
  }
  if (command === "push" && rest.includes("--force") && !rest.includes("--force-with-lease")) {
    return "git push --force rewrites shared history (use --force-with-lease, or disable the destructive-bash-guard hook)"
  }
  if (command === "branch" && rest.some((t) => shortFlags(t).includes("D"))) {
    return "git branch -D deletes a branch even when unmerged"
  }
  if (command === "stash" && (rest[0] === "drop" || rest[0] === "clear")) {
    return `git stash ${rest[0]} destroys stashed work`
  }
  if (command === "restore" && !rest.includes("--staged")) {
    return "git restore without --staged overwrites the working tree"
  }
  return null
}

function isDestructiveDd(argv: string[]): boolean {
  if (basenameToken(argv[0] ?? "") !== "dd") return false
  return argv.slice(1).some((operand) => /^(?:if|of)=/i.test(operand))
}

function isDestructiveRemoveItem(argv: string[]): boolean {
  if (basenameToken(argv[0] ?? "") !== "remove-item") return false
  const flags = argv.slice(1).map((t) => t.toLowerCase())
  const hasRecurse = flags.some((t) => t === "-recurse" || t.startsWith("-recurse"))
  const hasForce = flags.some((t) => t === "-force" || t.startsWith("-force"))
  return hasRecurse && hasForce
}

function detectSegment(segment: string): string | null {
  const tokens = segment.split(/\s+/).filter((token) => token.length > 0)
  const argv = unwrapLeadWrappers(tokens)
  if (argv.length === 0) return null
  if (isDestructiveRm(argv)) return "rm with recursive + force flags deletes files irreversibly"
  const gitReason = isDestructiveGit(argv)
  if (gitReason) return gitReason
  if (isDestructiveDd(argv)) return "dd with if=/of= writes raw disk data"
  if (basenameToken(argv[0] ?? "").startsWith("mkfs")) return "mkfs formats a filesystem"
  if (isDestructiveRemoveItem(argv)) return "Remove-Item -Recurse -Force deletes files irreversibly"
  return null
}

export function detectDestructiveCommand(command: string): string | null {
  for (const segment of splitSegments(command)) {
    const reason = detectSegment(segment)
    if (reason) return reason
  }
  return null
}