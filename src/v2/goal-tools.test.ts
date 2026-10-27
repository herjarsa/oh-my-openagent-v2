import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { CommandDefinition, CommandEditor, CommandInvocation } from "@opencode/plugin/promise/command"
import type { Info, ToolContext, ToolEditor } from "@opencode/plugin/promise/tool"
import { createGoalController } from "../hooks/goal/controller"
import { registerGoalCommand } from "./commands"
import { registerGoalTools } from "./tools"

const createdDirs: string[] = []

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop() as string
    rmSync(dir, { recursive: true, force: true })
  }
})

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "goal-tools-test-"))
  createdDirs.push(dir)
  return dir
}

function fakeContext(sessionID = "ses_ctx"): ToolContext {
  return { sessionID } as unknown as ToolContext
}

function setupTools() {
  const controller = createGoalController({ projectDir: freshDir() })
  const added: Info[] = []
  const editor = {
    add(def: Info): void {
      added.push(def)
    },
  } as unknown as ToolEditor
  registerGoalTools(editor, { controller })
  const byName = (name: string): Info => added.find((tool) => tool.name === name) as Info
  return { controller, byName }
}

describe("v2 goal tools", () => {
  test("given context sessionID #when create_goal executes #then goal is created", async () => {
    // given: registered tools and a context-bound session
    const { byName } = setupTools()
    // when: create_goal executes with an objective and no explicit session_id
    const result = await byName("create_goal").execute({ objective: "Ship it" }, fakeContext())
    // then: the response content contains the objective
    expect(String(result.content)).toContain("Ship it")
  })

  test("given active goal #when update_goal complete without evidence #then evidence error is returned", async () => {
    // given: an active goal created through create_goal
    const { byName, controller } = setupTools()
    await byName("create_goal").execute({ objective: "Ship it" }, fakeContext())
    // when: update_goal requests complete with no evidence argument
    const result = await byName("update_goal").execute({ status: "complete" }, fakeContext())
    // then: the evidence-required error is returned and the goal stays active
    expect(String(result.content)).toContain("completion evidence is required")
    expect(controller.getGoal("ses_ctx")?.status).toBe("active")
  })

  test("given active goal #when update_goal complete with evidence #then goal is complete", async () => {
    // given: an active goal created through create_goal
    const { byName, controller } = setupTools()
    await byName("create_goal").execute({ objective: "Ship it" }, fakeContext())
    // when: update_goal requests complete with evidence
    const result = await byName("update_goal").execute(
      { status: "complete", evidence: "bun test green, verified command output" },
      fakeContext(),
    )
    // then: the response reports complete status and the stored goal is complete
    expect(String(result.content)).toContain("complete")
    expect(controller.getGoal("ses_ctx")?.status).toBe("complete")
  })

  test("given no goal #when get_goal executes #then null goal JSON is returned", async () => {
    // given: registered tools and a session with no stored goal
    const { byName } = setupTools()
    // when: get_goal executes for the empty session
    const result = await byName("get_goal").execute({}, fakeContext("ses_empty"))
    // then: the response JSON carries a null goal
    expect(String(result.content)).toContain("\"goal\": null")
  })

  test("given active goal #when goal command executes with pause #then goal is paused", async () => {
    // given: an active goal and a registered goal command
    const controller = createGoalController({ projectDir: freshDir() })
    controller.setGoal("ses_cmd", "Ship it")
    const added: CommandDefinition[] = []
    const editor = {
      add(def: CommandDefinition): void {
        added.push(def)
      },
    } as unknown as CommandEditor
    registerGoalCommand(editor, { controller })
    // when: the command executes with prompt text pause
    const invocation = {
      sessionID: "ses_cmd",
      prompt: { text: "pause" },
      delivery: "steer",
    } as unknown as CommandInvocation
    await added[0].execute(invocation)
    // then: the stored goal is paused
    expect(controller.getGoal("ses_cmd")?.status).toBe("paused")
  })
})

