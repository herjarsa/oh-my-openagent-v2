import { describe, expect, test } from "bun:test"

import type { PluginInput } from "@opencode-ai/plugin"

import { unsafeTestValue } from "../../../../../test-support/unsafe-test-value"
import { COMMIT_QUALITY_WARNING_TAG, createCommitQualityGuardHook, type CommitQualityGit } from "./hook"

type CommitQualityGuardHook = ReturnType<typeof createCommitQualityGuardHook>
type ToolExecuteBefore = NonNullable<CommitQualityGuardHook["tool.execute.before"]>
type BeforeInput = Parameters<ToolExecuteBefore>[0]
type BeforeOutput = Parameters<ToolExecuteBefore>[1]
type ToolExecuteAfter = NonNullable<CommitQualityGuardHook["tool.execute.after"]>
type AfterInput = Parameters<ToolExecuteAfter>[0]
type AfterOutput = Parameters<ToolExecuteAfter>[1]

function createGit(staged: Record<string, string>): CommitQualityGit & { shown: string[] } {
  const shown: string[] = []
  return {
    shown,
    stagedPaths: () => Object.keys(staged),
    stagedContent: (_cwd: string, filePath: string): string | null => {
      shown.push(filePath)
      return staged[filePath] ?? null
    },
  }
}

function createFixture(staged: Record<string, string>, command = "git commit") {
  const git = createGit(staged)
  const hook = createCommitQualityGuardHook(unsafeTestValue<PluginInput>({ directory: "/repo" }), git)
  const beforeInput: BeforeInput = { tool: "bash", sessionID: "ses_commit", callID: "call_commit" }
  const beforeOutput: BeforeOutput = { args: { command } }
  const afterInput: AfterInput = {
    tool: "bash",
    sessionID: "ses_commit",
    callID: "call_commit",
    args: { command },
  }
  const afterOutput: AfterOutput = { title: "bash", output: "commit done", metadata: {} }
  return {
    git,
    hook,
    afterOutput,
    async runBefore(): Promise<void> {
      await hook["tool.execute.before"](beforeInput, beforeOutput)
    },
    async runAfter(): Promise<void> {
      await hook["tool.execute.after"](afterInput, afterOutput)
    },
  }
}

describe("commit-quality-guard", () => {
  test("ignores non-bash tools", async () => {
    // given a write tool call
    const fixture = createFixture({ "src/a.ts": "debugger\n" })
    const input: BeforeInput = { tool: "write", sessionID: "ses_commit", callID: "call_commit" }

    // when the before hook runs then it does not throw and shows nothing
    await fixture.hook["tool.execute.before"](input, { args: { filePath: "src/a.ts" } })
    expect(fixture.git.shown).toEqual([])
  })

  test("ignores bash commands that are not git commit", async () => {
    // given
    const fixture = createFixture({ "src/a.ts": "debugger\n" }, "git push origin main")

    // when then
    await fixture.runBefore()
    expect(fixture.git.shown).toEqual([])
  })

  test("skips amend and no-verify commits", async () => {
    // given staged secrets that would otherwise block
    const staged = { "src/a.ts": "const key = `sk-ant-abcdefghijklmnopqrstuvwxyz123456`;\n" }

    // when amend then allowed
    await createFixture(staged, "git commit --amend -m \"fix: stuff\"").runBefore()

    // when no-verify then allowed
    await createFixture(staged, "git commit --no-verify -m \"fix: stuff\"").runBefore()
  })

  test("blocks a staged secret", async () => {
    // given
    const fixture = createFixture({
      "src/auth.ts": "const key = `sk-ant-abcdefghijklmnopqrstuvwxyz123456`;\n",
    })

    // when then it throws naming the file and line
    const attempt = fixture.runBefore()
    await expect(attempt).rejects.toThrow("src/auth.ts:1")
    await expect(attempt).rejects.toThrow("Anthropic API key")
  })

  test("blocks a debugger statement", async () => {
    // given
    const fixture = createFixture({ "src/a.ts": "function f() {\n  debugger\n}\n" })

    // when then
    await expect(fixture.runBefore()).rejects.toThrow("debugger statement at line 2")
  })

  test("does not flag placeholders or commented debug calls", async () => {
    // given an obvious placeholder and a commented console.log
    const fixture = createFixture({
      "src/a.ts": "const apiKey = \"REPLACE_ME\";\n// console.log(\"old\")\n",
    })

    // when then no block and no warnings to flush
    await fixture.runBefore()
    await fixture.runAfter()
    expect(fixture.afterOutput.output).toBe("commit done")
  })

  test("warns about console.log and flushes the warning after the call", async () => {
    // given
    const fixture = createFixture({ "src/a.ts": "console.log(\"debug\");\n" })

    // when the commit is allowed
    await fixture.runBefore()

    // then the after hook appends the warning block
    await fixture.runAfter()
    expect(fixture.afterOutput.output).toContain(`<${COMMIT_QUALITY_WARNING_TAG}>`)
    expect(fixture.afterOutput.output).toContain("src/a.ts:1: console.log found at line 1")
  })

  test("warns about TODO without issue reference", async () => {
    // given
    const fixture = createFixture({ "src/a.ts": "// TODO: refactor this\n" })

    // when
    await fixture.runBefore()
    await fixture.runAfter()

    // then
    expect(fixture.afterOutput.output).toContain("TODO/FIXME without issue reference")
  })

  test("accepts TODO with an issue reference", async () => {
    // given
    const fixture = createFixture({ "src/a.ts": "// TODO(#123): refactor this\n" })

    // when then clean
    await fixture.runBefore()
    await fixture.runAfter()
    expect(fixture.afterOutput.output).toBe("commit done")
  })

  test("warns about non-conventional commit messages", async () => {
    // given
    const fixture = createFixture({ "src/a.ts": "const ok = 1;\n" }, "git commit -m \"wip stuff.\"")

    // when
    await fixture.runBefore()
    await fixture.runAfter()

    // then format and trailing-period warnings are surfaced
    expect(fixture.afterOutput.output).toContain("conventional commit format")
    expect(fixture.afterOutput.output).toContain("trailing period")
  })

  test("warns about long subjects and uppercase after type", async () => {
    // given a 70-char subject starting with an uppercase letter
    const subject = "Update " + "x".repeat(64)
    const fixture = createFixture(
      { "src/a.ts": "const ok = 1;\n" },
      `git commit -m "feat(auth): ${subject}"`,
    )

    // when
    await fixture.runBefore()
    await fixture.runAfter()

    // then
    expect(fixture.afterOutput.output).toContain("72")
    expect(fixture.afterOutput.output).toContain("lowercase")
  })

  test("accepts a clean conventional commit silently", async () => {
    // given
    const fixture = createFixture(
      { "src/a.ts": "export const ok = 1;\n" },
      "git commit -m \"feat(auth): add login flow\"",
    )

    // when then no warnings are appended
    await fixture.runBefore()
    await fixture.runAfter()
    expect(fixture.afterOutput.output).toBe("commit done")
  })

  test("skips non-checkable extensions without reading their content", async () => {
    // given a markdown file that git reports as staged
    const fixture = createFixture({ "docs/notes.md": "sk-ant-abcdefghijklmnopqrstuvwxyz123456" })

    // when then allowed and git show was never called
    await fixture.runBefore()
    expect(fixture.git.shown).toEqual([])
    await fixture.runAfter()
    expect(fixture.afterOutput.output).toBe("commit done")
  })

  test("allows commits with no staged files", async () => {
    // given
    const fixture = createFixture({})

    // when then
    await fixture.runBefore()
    await fixture.runAfter()
    expect(fixture.afterOutput.output).toBe("commit done")
  })

  test("leaves after-output untouched when there is nothing pending", async () => {
    // given a hook that never saw a commit
    const fixture = createFixture({ "src/a.ts": "const ok = 1;\n" })

    // when then
    await fixture.runAfter()
    expect(fixture.afterOutput.output).toBe("commit done")
  })

  test("does not duplicate the warning block", async () => {
    // given warnings already present in the tool output
    const fixture = createFixture({ "src/a.ts": "console.log(\"x\");\n" })
    await fixture.runBefore()
    fixture.afterOutput.output = `done\n<${COMMIT_QUALITY_WARNING_TAG}>\nold\n</${COMMIT_QUALITY_WARNING_TAG}>`

    // when then
    await fixture.runAfter()
    expect(fixture.afterOutput.output).not.toContain("console.log found")
  })
})