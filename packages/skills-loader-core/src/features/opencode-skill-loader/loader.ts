import { join, dirname } from "path"
import { existsSync } from "node:fs"
import { getHomeDirectory } from "@oh-my-opencode/utils"
import { sharedSkillsRootPath } from "@oh-my-opencode/shared-skills"
import {
  findProjectAgentsSkillDirs,
  findProjectClaudeSkillDirs,
  findProjectOpencodeSkillDirs,
  getClaudeConfigDir,
  getOpenCodeSkillDirs,
} from "../../shared"
import {
  type CommandDefinition,
} from "@oh-my-opencode/claude-code-compat-core/claude-code-command-loader/types"
import { matchSkillByName } from "../../tools/skill/skill-matcher"
import type { LoadedSkill } from "./types"
import { skillsToCommandDefinitionRecord } from "./skill-definition-record"
import { deduplicateSkillsByName } from "./skill-deduplication"
import { loadSkillsFromDir } from "./skill-directory-loader"

export async function loadUserSkills(): Promise<Record<string, CommandDefinition>> {
  const userSkillsDir = join(getClaudeConfigDir(), "skills")
  const skills = await loadSkillsFromDir({ skillsDir: userSkillsDir, scope: "user" })
  return skillsToCommandDefinitionRecord(skills)
}

export async function loadProjectSkills(directory?: string): Promise<Record<string, CommandDefinition>> {
  const projectSkillDirs = findProjectClaudeSkillDirs(directory ?? process.cwd())
  const allSkills = await Promise.all(
    projectSkillDirs.map((skillsDir) => loadSkillsFromDir({ skillsDir, scope: "project" })),
  )
  return skillsToCommandDefinitionRecord(deduplicateSkillsByName(allSkills.flat()))
}

export async function loadOpencodeGlobalSkills(): Promise<Record<string, CommandDefinition>> {
  const skillDirs = getOpenCodeSkillDirs({ binary: "opencode" })
  const allSkills = await Promise.all(
    skillDirs.map(skillsDir => loadSkillsFromDir({ skillsDir, scope: "opencode" }))
  )
  return skillsToCommandDefinitionRecord(deduplicateSkillsByName(allSkills.flat()))
}

export async function loadOpencodeProjectSkills(directory?: string): Promise<Record<string, CommandDefinition>> {
  const opencodeProjectSkillDirs = findProjectOpencodeSkillDirs(
    directory ?? process.cwd(),
  )
  const allSkills = await Promise.all(
    opencodeProjectSkillDirs.map((skillsDir) =>
      loadSkillsFromDir({ skillsDir, scope: "opencode-project" }),
    ),
  )
  return skillsToCommandDefinitionRecord(deduplicateSkillsByName(allSkills.flat()))
}

export async function loadProjectAgentsSkills(directory?: string): Promise<Record<string, CommandDefinition>> {
  const agentsProjectSkillDirs = findProjectAgentsSkillDirs(directory ?? process.cwd())
  const allSkills = await Promise.all(
    agentsProjectSkillDirs.map((skillsDir) => loadSkillsFromDir({ skillsDir, scope: "project" })),
  )
  return skillsToCommandDefinitionRecord(deduplicateSkillsByName(allSkills.flat()))
}

export async function loadGlobalAgentsSkills(homeDirectory: string = getHomeDirectory()): Promise<Record<string, CommandDefinition>> {
  const agentsGlobalDir = join(homeDirectory, ".agents", "skills")
  const skills = await loadSkillsFromDir({ skillsDir: agentsGlobalDir, scope: "user" })
  return skillsToCommandDefinitionRecord(skills)
}

export interface DiscoverSkillsOptions {
  includeClaudeCodePaths?: boolean
  directory?: string
  eccProfiles?: string[]
  disabledSkills?: Set<string>
}

export async function discoverAllSkills(directory?: string): Promise<LoadedSkill[]> {
  const [opencodeProjectSkills, opencodeGlobalSkills, sharedSkills, projectSkills, userSkills, agentsProjectSkills, agentsGlobalSkills, eccSkills] =
    await Promise.all([
      discoverOpencodeProjectSkills(directory),
      discoverOpencodeGlobalSkills(),
      discoverSharedSkills(),
      discoverProjectClaudeSkills(directory),
      discoverUserClaudeSkills(),
      discoverProjectAgentsSkills(directory),
      discoverGlobalAgentsSkills(),
      discoverEccSkills(),
    ])

  return deduplicateSkillsByName([
    ...opencodeProjectSkills,
    ...opencodeGlobalSkills,
    ...projectSkills,
    ...agentsProjectSkills,
    ...userSkills,
    ...agentsGlobalSkills,
    ...sharedSkills,
    ...eccSkills,
  ])
}

export function eccSkillsRootPath(): string | undefined {
  try {
    const parent = dirname(sharedSkillsRootPath())
    const candidate = join(parent, "ecc-skills")
    return existsSync(candidate) ? candidate : undefined
  } catch {
    return undefined
  }
}

export function eccAgentsRootPath(): string | undefined {
  try {
    const parent = dirname(sharedSkillsRootPath())
    const candidate = join(parent, "ecc-agents")
    return existsSync(candidate) ? candidate : undefined
  } catch {
    return undefined
  }
}

export function eccRulesRootPath(): string | undefined {
  try {
    const parent = dirname(sharedSkillsRootPath())
    const candidate = join(parent, "ecc-rules")
    return existsSync(candidate) ? candidate : undefined
  } catch {
    return undefined
  }
}

export function eccCommandsRootPath(): string | undefined {
  try {
    const parent = dirname(sharedSkillsRootPath())
    const candidate = join(parent, "ecc-commands")
    return existsSync(candidate) ? candidate : undefined
  } catch {
    return undefined
  }
}

export const ECC_PROFILES: Record<string, string[] | null> = {
  // NOTE: upstream ECC restructured debugging/code-review/refactor-clean out of
  // existence; those capabilities stay covered by OMO shared skills
  // (debugging, review-work, refactor), which load unconditionally. This list
  // only names skills present under packages/shared-skills/ecc-skills.
  core: [
    "tdd-workflow",
    "verification-loop",
    "security-review",
    "e2e-testing",
    "eval-harness",
    "deep-research",
    "architecture-decision-records",
    "codebase-onboarding",
    "context-budget",
    "conventional-commit-review",
    "git-workflow",
    "continuous-learning",
    "strategic-compact",
    "iterative-retrieval",
    "production-audit",
    "delivery-gate",
    "agent-self-evaluation",
  ],
  all: null,
}

export const DEFAULT_ECC_PROFILES: readonly string[] = ["core"]

/**
 * Resolve the effective ECC profiles. undefined means "not configured" and
 * falls back to the core profile so the agent sees the curated set without
 * any config. An explicit empty array disables ECC skills entirely.
 */
export function resolveEccProfiles(profiles?: readonly string[]): string[] {
  if (profiles === undefined) return [...DEFAULT_ECC_PROFILES]
  return [...profiles]
}

export async function discoverEccSkills(
  profiles?: string[],
  disabledSkills?: Set<string>,
): Promise<LoadedSkill[]> {
  const root = eccSkillsRootPath()
  if (!root) return []
  const effective = resolveEccProfiles(profiles)
  if (effective.length === 0) return []

  const allSkills = await loadSkillsFromDir({ skillsDir: root, scope: "shared" })
  const allowed = new Set<string>()
  let includeAll = false
  for (const profile of effective) {
    const spec = ECC_PROFILES[profile]
    if (spec === null) {
      includeAll = true
      break
    }
    if (Array.isArray(spec)) {
      for (const name of spec) allowed.add(name)
    }
  }
  if (!includeAll && allowed.size === 0) return []

  const filtered = includeAll
    ? allSkills
    : allSkills.filter((skill) => allowed.has(skill.name))

  if (!disabledSkills || disabledSkills.size === 0) return filtered
  return filtered.filter((s) => !disabledSkills.has(s.name) && ![...disabledSkills].some(d => d.toLowerCase() === s.name.toLowerCase()))
}
export async function discoverSkills(options: DiscoverSkillsOptions = {}): Promise<LoadedSkill[]> {
  const { includeClaudeCodePaths = true, directory } = options

  const [opencodeProjectSkills, opencodeGlobalSkills, sharedSkills, eccSkills] = await Promise.all([
    discoverOpencodeProjectSkills(directory),
    discoverOpencodeGlobalSkills(),
    discoverSharedSkills(),
    discoverEccSkills(options?.eccProfiles, options?.disabledSkills),
  ])

  if (!includeClaudeCodePaths) {
    return deduplicateSkillsByName([
      ...opencodeProjectSkills,
      ...opencodeGlobalSkills,
      ...sharedSkills,
      ...eccSkills,
    ])
  }

  const [projectSkills, userSkills, agentsProjectSkills, agentsGlobalSkills] = await Promise.all([
    discoverProjectClaudeSkills(directory),
    discoverUserClaudeSkills(),
    discoverProjectAgentsSkills(directory),
    discoverGlobalAgentsSkills(),
  ])

  return deduplicateSkillsByName([
    ...opencodeProjectSkills,
    ...opencodeGlobalSkills,
    ...projectSkills,
    ...agentsProjectSkills,
    ...userSkills,
    ...agentsGlobalSkills,
    ...sharedSkills,
    ...eccSkills,
  ])
}

export async function getSkillByName(name: string, options: DiscoverSkillsOptions = {}): Promise<LoadedSkill | undefined> {
  const skills = await discoverSkills(options)
  return matchSkillByName(skills, name)
}

export async function discoverUserClaudeSkills(): Promise<LoadedSkill[]> {
  const userSkillsDir = join(getClaudeConfigDir(), "skills")
  return loadSkillsFromDir({ skillsDir: userSkillsDir, scope: "user" })
}

export async function discoverProjectClaudeSkills(directory?: string): Promise<LoadedSkill[]> {
  const projectSkillDirs = findProjectClaudeSkillDirs(directory ?? process.cwd())
  const allSkills = await Promise.all(
    projectSkillDirs.map((skillsDir) => loadSkillsFromDir({ skillsDir, scope: "project" })),
  )
  return deduplicateSkillsByName(allSkills.flat())
}

export async function discoverOpencodeGlobalSkills(): Promise<LoadedSkill[]> {
  const skillDirs = getOpenCodeSkillDirs({ binary: "opencode" })
  const allSkills = await Promise.all(
    skillDirs.map(skillsDir => loadSkillsFromDir({ skillsDir, scope: "opencode" }))
  )
  return deduplicateSkillsByName(allSkills.flat())
}

export async function discoverOpencodeProjectSkills(directory?: string): Promise<LoadedSkill[]> {
  const opencodeProjectSkillDirs = findProjectOpencodeSkillDirs(
    directory ?? process.cwd(),
  )
  const allSkills = await Promise.all(
    opencodeProjectSkillDirs.map((skillsDir) =>
      loadSkillsFromDir({ skillsDir, scope: "opencode-project" }),
    ),
  )
  return deduplicateSkillsByName(allSkills.flat())
}

export async function discoverSharedSkills(): Promise<LoadedSkill[]> {
  return loadSkillsFromDir({ skillsDir: sharedSkillsRootPath(), scope: "shared" })
}

export async function discoverProjectAgentsSkills(directory?: string): Promise<LoadedSkill[]> {
  const agentsProjectSkillDirs = findProjectAgentsSkillDirs(directory ?? process.cwd())
  const allSkills = await Promise.all(
    agentsProjectSkillDirs.map((skillsDir) => loadSkillsFromDir({ skillsDir, scope: "project" })),
  )
  return deduplicateSkillsByName(allSkills.flat())
}

export async function discoverGlobalAgentsSkills(homeDirectory: string = getHomeDirectory()): Promise<LoadedSkill[]> {
  const agentsGlobalDir = join(homeDirectory, ".agents", "skills")
  return loadSkillsFromDir({ skillsDir: agentsGlobalDir, scope: "user" })
}
