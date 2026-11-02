import { describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  copySkillContentRoots,
  discoverSkillContentRoots,
  SKILL_CONTENT_SOURCE_ROOT,
} from "./build-shared-skills-assets"

describe("skill content assets", () => {
  test("#given the shared-skills package #when content roots are discovered #then shared skills and every ECC root are included", () => {
    // when
    const roots = discoverSkillContentRoots(SKILL_CONTENT_SOURCE_ROOT)

    // then
    expect(roots).toContain("skills")
    expect(roots).toContain("ecc-skills")
    expect(roots).toContain("ecc-agents")
    expect(roots).toContain("ecc-commands")
  })

  test("#given dist already holds a stale root #when content roots are copied #then nested files are mirrored and stale entries removed", () => {
    // given
    const workspace = mkdtempSync(join(tmpdir(), "omo-skill-assets-"))
    try {
      const source = join(workspace, "source")
      const dist = join(workspace, "dist")
      mkdirSync(join(source, "skills", "alpha"), { recursive: true })
      writeFileSync(join(source, "skills", "alpha", "SKILL.md"), "---\nname: alpha\n---\n")
      mkdirSync(join(source, "ecc-agents", "beta"), { recursive: true })
      writeFileSync(join(source, "ecc-agents", "beta", "agent.md"), "---\nname: beta\n---\n")
      mkdirSync(join(dist, "skills", "stale"), { recursive: true })
      writeFileSync(join(dist, "skills", "stale", "SKILL.md"), "stale\n")

      // when
      const copied = copySkillContentRoots(source, dist)

      // then
      expect(copied).toEqual(["ecc-agents", "skills"])
      expect(existsSync(join(dist, "skills", "alpha", "SKILL.md"))).toBe(true)
      expect(existsSync(join(dist, "skills", "stale"))).toBe(false)
      expect(existsSync(join(dist, "ecc-agents", "beta", "agent.md"))).toBe(true)
    } finally {
      rmSync(workspace, { recursive: true, force: true })
    }
  })
})