#!/usr/bin/env bun
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = fileURLToPath(new URL("..", import.meta.url))

export const SKILL_CONTENT_SOURCE_ROOT = join(repoRoot, "packages", "shared-skills")
export const SKILL_CONTENT_DIST_ROOT = join(repoRoot, "dist")

/**
 * Content roots copied next to `dist/skills`.
 *
 * Bundled entry points (`dist/index.js`, `dist/cli/index.js`, `dist/cli-node/index.js`) probe
 * `dist/skills` through `sharedSkillsRootPath()`, and the ECC resolvers
 * (`eccSkillsRootPath`/`eccAgentsRootPath`/`eccCommandsRootPath`) take that path's parent. Every
 * content root therefore has to land at `dist/<name>`, otherwise the published package resolves
 * `dist/ecc-*` to nothing and ships ECC content that never loads.
 *
 * Discovery is dynamic so a new `ecc-*` content root ships without editing this list.
 */
export function discoverSkillContentRoots(sourceRoot: string): string[] {
  const names = readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (entry.name === "skills" || entry.name.startsWith("ecc-")))
    .map((entry) => entry.name)
  return names.sort((a, b) => a.localeCompare(b))
}

export function copySkillContentRoots(
  sourceRoot: string,
  distRoot: string,
  roots: string[] = discoverSkillContentRoots(sourceRoot),
): string[] {
  const copied: string[] = []
  for (const name of roots) {
    const source = join(sourceRoot, name)
    if (!existsSync(source)) continue
    const destination = join(distRoot, name)
    rmSync(destination, { recursive: true, force: true })
    cpSync(source, destination, { recursive: true })
    copied.push(name)
  }
  return copied
}

function main() {
  const copied = copySkillContentRoots(SKILL_CONTENT_SOURCE_ROOT, SKILL_CONTENT_DIST_ROOT)
  if (copied.length === 0) {
    throw new Error(`no skill content roots found under ${SKILL_CONTENT_SOURCE_ROOT}`)
  }
  console.log(`\u2713 skill content assets copied to ${SKILL_CONTENT_DIST_ROOT}: ${copied.join(", ")}`)
}

if (import.meta.main) main()