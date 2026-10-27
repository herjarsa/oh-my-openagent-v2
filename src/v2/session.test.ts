import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createGoalController } from "../hooks/goal/controller"
import { applyParsedGoalCommand, handleGoalPromptText } from "./session"

const createdDirs: string[] = []

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop() as string
    rmSync(dir, { recursive: true, force: true })
  }
})

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "goal-session-test-"))
  createdDirs.push(dir)
  return dir
}

describe("v2 session goal prompt", () => {
  test("given goal command with auto-start off #when handled #then sets goal and returns goal-command", () => {
    // given: a controller with both auto-start flags disabled
    const dir = freshDir()
    const controller = createGoalController({ projectDir: dir })
    // when: an explicit /goal command arrives (not a first message)
    const result = handleGoalPromptText(
      { controller, defaultModeGoal: false, goalAutoStart: false },
      { sessionID: "ses_1", text: "/goal Ship it", isFirst: false },
    )
    // then: the command wins regardless of flags and the goal is stored
    expect(result).toEqual({ handled: "goal-command", objective: "Ship it" })
    expect(controller.getGoal("ses_1")?.objective).toBe("Ship it")
  })

  test("given first message with auto-start on #when handled #then auto-starts the goal", () => {
    // given: goalAutoStart enabled and no goal yet
    const dir = freshDir()
    const controller = createGoalController({ projectDir: dir })
    // when: the first message arrives
    const result = handleGoalPromptText(
      { controller, defaultModeGoal: false, goalAutoStart: true },
      { sessionID: "ses_1", text: "Build X", isFirst: true },
    )
    // then: the message text becomes the goal
    expect(result).toEqual({ handled: "auto-started", objective: "Build X" })
    expect(controller.getGoal("ses_1")?.objective).toBe("Build X")
  })

  test("given existing goal on second message #when handled #then returns none and keeps goal", () => {
    // given: a stored goal from an earlier message
    const dir = freshDir()
    const controller = createGoalController({ projectDir: dir })
    controller.setGoal("ses_1", "Original goal")
    // when: a later message arrives with flags on
    const result = handleGoalPromptText(
      { controller, defaultModeGoal: true, goalAutoStart: true },
      { sessionID: "ses_1", text: "Keep going", isFirst: false },
    )
    // then: nothing happens and the stored goal is untouched
    expect(result).toEqual({ handled: "none" })
    expect(controller.getGoal("ses_1")?.objective).toBe("Original goal")
  })

  test("given first message with no flags #when handled #then returns none", () => {
    // given: both auto-start flags disabled
    const dir = freshDir()
    const controller = createGoalController({ projectDir: dir })
    // when: the first message arrives
    const result = handleGoalPromptText(
      { controller, defaultModeGoal: false, goalAutoStart: false },
      { sessionID: "ses_1", text: "Build X", isFirst: true },
    )
    // then: no goal is created
    expect(result).toEqual({ handled: "none" })
    expect(controller.getGoal("ses_1")).toBeNull()
  })

  test("given active goal #when pause then clear applied #then status flips and goal is removed", () => {
    // given: an active goal
    const dir = freshDir()
    const controller = createGoalController({ projectDir: dir })
    controller.setGoal("ses_1", "Ship it")
    // when: pause is applied
    const paused = applyParsedGoalCommand(controller, "ses_1", "pause")
    // then: the stored goal reports paused
    expect(controller.getGoal("ses_1")?.status).toBe("paused")
    expect(JSON.parse(paused).status).toBe("paused")
    // when: clear is applied
    const cleared = applyParsedGoalCommand(controller, "ses_1", "clear")
    // then: the goal is gone
    expect(cleared).toBe("Goal cleared.")
    expect(controller.getGoal("ses_1")).toBeNull()
  })
})
