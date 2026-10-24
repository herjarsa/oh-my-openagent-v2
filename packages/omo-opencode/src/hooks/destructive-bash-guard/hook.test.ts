import { describe, expect, test } from "bun:test"

import type { PluginInput } from "@opencode-ai/plugin"

import { unsafeTestValue } from "../../../../../test-support/unsafe-test-value"
import { detectDestructiveCommand } from "./destructive"
import { createDestructiveBashGuardHook } from "./hook"

type GuardHook = ReturnType<typeof createDestructiveBashGuardHook>
type BeforeInput = Parameters<NonNullable<GuardHook["tool.execute.before"]>>[0]
type BeforeOutput = Parameters<NonNullable<GuardHook["tool.execute.before"]>>[1]

function runBefore(command: string, tool = "bash") {
  const hook = createDestructiveBashGuardHook(unsafeTestValue<PluginInput>({ directory: "/repo" }))
  const input: BeforeInput = { tool, sessionID: "ses_dbg", callID: "call_dbg" }
  const output: BeforeOutput = { args: { command } }
  return hook["tool.execute.before"](input, output)
}

describe("destructive-bash-guard", () => {
  test("blocks recursive force deletes", () => {
    // given
    expect(detectDestructiveCommand("rm -rf /tmp/build")).not.toBeNull()
    expect(detectDestructiveCommand("sudo rm -fr ./dist")).not.toBeNull()
    expect(detectDestructiveCommand("rm -r -f .")).not.toBeNull()
  })

  test("allows safe removes", () => {
    // given
    expect(detectDestructiveCommand("rm README.md")).toBeNull()
    expect(detectDestructiveCommand("rm -rf")).toBeNull()
    expect(detectDestructiveCommand("ls -la")).toBeNull()
  })

  test("blocks history-destroying git", () => {
    // given
    expect(detectDestructiveCommand("git reset --hard HEAD")).not.toBeNull()
    expect(detectDestructiveCommand("git clean -fdx")).not.toBeNull()
    expect(detectDestructiveCommand("git checkout -- src/index.ts")).not.toBeNull()
    expect(detectDestructiveCommand("git push origin --force")).not.toBeNull()
    expect(detectDestructiveCommand("git branch -D old-feature")).not.toBeNull()
    expect(detectDestructiveCommand("git stash drop")).not.toBeNull()
    expect(detectDestructiveCommand("git restore src/index.ts")).not.toBeNull()
  })

  test("allows safe git", () => {
    // given
    expect(detectDestructiveCommand("git status")).toBeNull()
    expect(detectDestructiveCommand("git push origin --force-with-lease")).toBeNull()
    expect(detectDestructiveCommand("git commit -m \"drop table\"")).toBeNull()
    expect(detectDestructiveCommand("git -c core.hooksPath=/dev/null status")).toBeNull()
    expect(detectDestructiveCommand("git restore --staged src/index.ts")).toBeNull()
  })

  test("blocks raw disk writes and formats", () => {
    // given
    expect(detectDestructiveCommand("dd if=/dev/zero of=/dev/sda")).not.toBeNull()
    expect(detectDestructiveCommand("sudo mkfs.ext4 /dev/sdb1")).not.toBeNull()
  })

  test("blocks powershell recursive force remove", () => {
    // given
    expect(detectDestructiveCommand("Remove-Item -Recurse -Force C:\\temp")).not.toBeNull()
    expect(detectDestructiveCommand("Remove-Item C:\\temp\\file.txt")).toBeNull()
  })

  test("ignores quoted prose and comments", () => {
    // given destructive words inside quotes are data, not commands
    expect(detectDestructiveCommand("echo \"rm -rf /\"")).toBeNull()
    expect(detectDestructiveCommand("git commit -m 'reset --hard'")).toBeNull()
    expect(detectDestructiveCommand("# rm -rf /tmp")).toBeNull()
  })

  test("catches destructive commands chained after safe ones", () => {
    // given
    expect(detectDestructiveCommand("ls -la; rm -rf build")).not.toBeNull()
    expect(detectDestructiveCommand("VAR=1 git reset --hard")).not.toBeNull()
  })

  test("throws with a restating message on block", async () => {
    // when then
    await expect(runBefore("rm -rf /tmp/x")).rejects.toThrow("BLOCKED")
    await expect(runBefore("rm -rf /tmp/x")).rejects.toThrow("non-destructive path")
  })

  test("ignores non-bash tools and empty commands", async () => {
    // when then
    await runBefore("rm -rf /tmp/x", "write")
    await runBefore("ls", "bash")
  })
})