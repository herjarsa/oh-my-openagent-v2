import { describe, expect, test } from "bun:test"
import { GoalSchema } from "../hooks/goal/types"
import { buildStructuredContinuation } from "./continuation"

// given a Goal fixture with all optional state populated
const fullGoal = GoalSchema.parse({
  id: "goal-1",
  sessionID: "ses-1",
  childSessionIDs: ["ses-child-a", "ses-child-b"],
  objective: "Ship the widget with tests",
  status: "active",
  tokensUsed: 1234,
  timeUsedSeconds: 56,
  iteration: 2,
  maxIterations: 100,
  stallCount: 1,
  pauseReason: "budget",
  createdAt: 1,
  updatedAt: 2,
})

// given a Goal fixture with no pause reason and no children
const bareGoal = GoalSchema.parse({
  id: "goal-2",
  sessionID: "ses-2",
  objective: "Ship the widget with tests",
  status: "active",
  tokensUsed: 10,
  timeUsedSeconds: 5,
  createdAt: 1,
  updatedAt: 2,
})

describe("buildStructuredContinuation", () => {
  test("given full goal #when built #then state block has iteration, pause, children plus base prompt", () => {
    // when
    const text = buildStructuredContinuation(fullGoal)

    // then
    expect(text).toContain("2/100")
    expect(text).toContain("last pause: budget")
    expect(text).toContain("ses-child-a")
    expect(text).toContain("ses-child-b")
    expect(text).toContain("Ship the widget with tests")
    expect(text).toContain("completion audit")
  })

  test("given bare goal #when built #then omits pause and delegated lines", () => {
    // when
    const text = buildStructuredContinuation(bareGoal)

    // then
    expect(text).not.toContain("last pause")
    expect(text).not.toContain("Delegated")
    expect(text).toContain("Ship the widget with tests")
  })
})
