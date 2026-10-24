import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "bun:test"

import { createRuleScanCache, findRuleFiles } from "./index"

let testRoot: string | null = null

function createTestRoot(name: string): string {
  testRoot = join(tmpdir(), `${name}-${Date.now()}-${Math.random()}`)
  mkdirSync(testRoot, { recursive: true })
  return testRoot
}

afterEach(() => {
  if (testRoot) {
    rmSync(testRoot, { recursive: true, force: true })
    testRoot = null
  }
})

function findWithEccRoot(projectRoot: string, currentFile: string, eccRulesRoot: string | null | undefined) {
  return findRuleFiles(projectRoot, join(tmpdir(), "no-home-rules-here"), currentFile, {
    skipClaudeUserRules: true,
    ...(eccRulesRoot === undefined ? {} : { eccRulesRoot }),
  })
}

describe("vendored ECC rules", () => {
  it("#given an ECC rules root #when finding rule files #then ECC candidates load as global plugin-bundled-ecc", () => {
    // given
    const root = createTestRoot("ecc-rules-on")
    mkdirSync(join(root, ".git"))
    mkdirSync(join(root, "src"), { recursive: true })
    const eccRoot = join(root, "ecc-rules")
    mkdirSync(join(eccRoot, "common"), { recursive: true })
    mkdirSync(join(eccRoot, "typescript"), { recursive: true })
    writeFileSync(join(eccRoot, "common", "security.md"), "# security")
    writeFileSync(join(eccRoot, "typescript", "testing.md"), "# testing")
    const currentFile = join(root, "src", "index.ts")
    writeFileSync(currentFile, "export {}")

    // when
    const candidates = findWithEccRoot(root, currentFile, eccRoot)
    const eccCandidates = candidates.filter((candidate) => candidate.source === "plugin-bundled-ecc")

    // then
    expect(eccCandidates).toHaveLength(2)
    for (const candidate of eccCandidates) {
      expect(candidate.isGlobal).toBe(true)
    }
    expect(eccCandidates.map((candidate) => candidate.relativePath).sort()).toEqual([
      "common/security.md",
      "typescript/testing.md",
    ])
  })

  it("#given no ECC rules root #when finding rule files #then no ECC candidates load", () => {
    // given
    const root = createTestRoot("ecc-rules-off")
    mkdirSync(join(root, ".git"))
    mkdirSync(join(root, "src"), { recursive: true })
    const currentFile = join(root, "src", "index.ts")
    writeFileSync(currentFile, "export {}")

    // when
    const withoutOption = findWithEccRoot(root, currentFile, undefined)
    const withNull = findWithEccRoot(root, currentFile, null)

    // then
    expect(withoutOption.some((candidate) => candidate.source === "plugin-bundled-ecc")).toBe(false)
    expect(withNull.some((candidate) => candidate.source === "plugin-bundled-ecc")).toBe(false)
  })

  it("#given a missing ECC rules root #when finding rule files #then discovery skips it without failing", () => {
    // given
    const root = createTestRoot("ecc-rules-missing")
    mkdirSync(join(root, ".git"))
    mkdirSync(join(root, "src"), { recursive: true })
    const currentFile = join(root, "src", "index.ts")
    writeFileSync(currentFile, "export {}")

    // when then no throw, no ECC candidates
    const candidates = findWithEccRoot(root, currentFile, join(root, "does-not-exist"))
    expect(candidates.some((candidate) => candidate.source === "plugin-bundled-ecc")).toBe(false)
  })
})