import { describe, expect, test } from "bun:test"
import { GoalConfigSchema } from "./goal"

describe("GoalConfigSchema", () => {
  test("defaults enabled and auto_start to false", () => {
    const result = GoalConfigSchema.parse({})

    expect(result.enabled).toBe(false)
    expect(result.auto_start).toBe(false)
    expect(result.default_max_iterations).toBe(100)
    expect(result.resume_on_start).toBe(true)
    expect(result.resume_window_minutes).toBe(30)
  })

  test("parses explicit goal config", () => {
    const result = GoalConfigSchema.parse({
      enabled: true,
      auto_start: true,
      default_max_iterations: 50,
      resume_on_start: false,
      resume_window_minutes: 120,
    })

    expect(result.enabled).toBe(true)
    expect(result.auto_start).toBe(true)
    expect(result.default_max_iterations).toBe(50)
    expect(result.resume_on_start).toBe(false)
    expect(result.resume_window_minutes).toBe(120)
  })

  test("rejects out-of-range max iterations", () => {
    expect(() => GoalConfigSchema.parse({ default_max_iterations: 0 })).toThrow()
    expect(() => GoalConfigSchema.parse({ default_max_iterations: 1001 })).toThrow()
  })

  test("rejects out-of-range resume window", () => {
    expect(() => GoalConfigSchema.parse({ resume_window_minutes: 0 })).toThrow()
    expect(() => GoalConfigSchema.parse({ resume_window_minutes: 10081 })).toThrow()
    expect(() => GoalConfigSchema.parse({ resume_window_minutes: 30.5 })).toThrow()
  })
})
