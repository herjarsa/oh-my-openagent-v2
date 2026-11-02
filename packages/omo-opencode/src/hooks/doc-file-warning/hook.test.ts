import { describe, expect, test } from "bun:test"

import { createDocFileWarningHook, DOC_FILE_WARNING_TAG, isSuspiciousDocPath } from "./hook"

type DocWarningHook = ReturnType<typeof createDocFileWarningHook>
type AfterInput = Parameters<NonNullable<DocWarningHook["tool.execute.after"]>>[0]
type AfterOutput = Parameters<NonNullable<DocWarningHook["tool.execute.after"]>>[1]

function runAfter(filePath: string, initialOutput = "written") {
  const hook = createDocFileWarningHook()
  const input: AfterInput = { tool: "write", sessionID: "ses_doc", callID: "call_doc", args: { filePath } }
  const output: AfterOutput = { title: "write", output: initialOutput, metadata: {} }
  return hook["tool.execute.after"](input, output).then(() => output)
}

describe("doc-file-warning", () => {
  test("flags ad-hoc filenames at the repo root", () => {
    // given
    expect(isSuspiciousDocPath("NOTES.md")).toBe(true)
    expect(isSuspiciousDocPath("notes/TODO.txt")).toBe(true)
    expect(isSuspiciousDocPath("C:\\repo\\WIP.md")).toBe(true)
  })

  test("allows structured locations and ordinary files", () => {
    // given
    expect(isSuspiciousDocPath("docs/NOTES.md")).toBe(false)
    expect(isSuspiciousDocPath("skills/x/SKILL.md")).toBe(false)
    expect(isSuspiciousDocPath("README.md")).toBe(false)
    expect(isSuspiciousDocPath("src/index.ts")).toBe(false)
    expect(isSuspiciousDocPath("notes.md")).toBe(false)
  })

  test("appends a warning to the write result", async () => {
    // when
    const output = await runAfter("SCRATCH.md")

    // then
    expect(output.output).toContain(`<${DOC_FILE_WARNING_TAG}>`)
    expect(output.output).toContain("docs/")
  })

  test("leaves clean writes untouched", async () => {
    // when
    const output = await runAfter("docs/design.md")

    // then
    expect(output.output).toBe("written")
  })

  test("does not duplicate the warning block", async () => {
    // when
    const output = await runAfter("NOTES.md", `done\n<${DOC_FILE_WARNING_TAG}>\nold\n</${DOC_FILE_WARNING_TAG}>`)

    // then
    expect(output.output).not.toContain("structured path")
  })
})