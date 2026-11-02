import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { PluginInput } from "@opencode-ai/plugin"

import { unsafeTestValue } from "../../../../../test-support/unsafe-test-value"
import { createConfigProtectionGuardHook } from "./hook"
import { isProtectedName } from "./protection"

type GuardHook = ReturnType<typeof createConfigProtectionGuardHook>
type BeforeInput = Parameters<NonNullable<GuardHook["tool.execute.before"]>>[0]
type BeforeOutput = Parameters<NonNullable<GuardHook["tool.execute.before"]>>[1]

describe("config-protection-guard", () => {
  test("matches protected basenames case-insensitively", () => {
    // given canonical and qualified config names
    expect(isProtectedName("eslint.config.js")).toBe(true)
    expect(isProtectedName(".ESLINTRC.JS")).toBe(true)
    expect(isProtectedName("prettier.config.shared.cjs")).toBe(true)
    expect(isProtectedName(".prettierrc.base.json")).toBe(true)
    expect(isProtectedName(".eslintignore")).toBe(true)
  })

  test("ignores ordinary source and build files", () => {
    // given
    expect(isProtectedName("index.ts")).toBe(false)
    expect(isProtectedName("vite.config.ts")).toBe(false)
    expect(isProtectedName("tsconfig.json")).toBe(false)
    expect(isProtectedName("pyproject.toml")).toBe(false)
    expect(isProtectedName("playwright.config.ts")).toBe(false)
  })

  test("blocks modifying an existing protected config", async () => {
    // given an existing eslint config
    const directory = mkdtempSync(join(tmpdir(), "cpg-"))
    try {
      const filePath = join(directory, "eslint.config.js")
      writeFileSync(filePath, "export default [];\n", "utf-8")
      const hook = createConfigProtectionGuardHook(unsafeTestValue<PluginInput>({ directory }))
      const input: BeforeInput = { tool: "write", sessionID: "ses_cpg", callID: "call_cpg" }
      const output: BeforeOutput = { args: { filePath } }

      // when then it throws naming the file
      await expect(hook["tool.execute.before"](input, output)).rejects.toThrow("eslint.config.js")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("allows first-time creation of a protected config", async () => {
    // given a path that does not exist yet
    const directory = mkdtempSync(join(tmpdir(), "cpg-"))
    try {
      const hook = createConfigProtectionGuardHook(unsafeTestValue<PluginInput>({ directory }))
      const input: BeforeInput = { tool: "write", sessionID: "ses_cpg", callID: "call_cpg" }
      const output: BeforeOutput = { args: { filePath: join(directory, ".prettierrc.json") } }

      // when then no throw
      await hook["tool.execute.before"](input, output)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("ignores non-write tools and unprotected files", async () => {
    // given
    const hook = createConfigProtectionGuardHook(unsafeTestValue<PluginInput>({ directory: "/repo" }))
    const base: BeforeInput = { tool: "bash", sessionID: "ses_cpg", callID: "call_cpg" }

    // when then
    await hook["tool.execute.before"](base, { args: { command: "ls" } })
    await hook["tool.execute.before"](
      { ...base, tool: "write" },
      { args: { filePath: "/repo/src/index.ts" } },
    )
  })
})