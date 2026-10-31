import { describe, expect, it } from "bun:test"
import { buildEccSkillUsageGuide } from "./ecc-skill-usage-guide"
import type { AvailableSkill } from "./dynamic-agent-prompt-types"

describe("buildEccSkillUsageGuide", () => {
  it("returns empty when no ECC skills", () => {
    const skills: AvailableSkill[] = [
      { name: "foo", description: "d", location: "plugin" },
    ]
    expect(buildEccSkillUsageGuide(skills)).toBe("")
  })

  it("renders guide for available ECC skills", () => {
    const skills: AvailableSkill[] = [
      { name: "verification-loop", description: "d", location: "plugin", ecc: true },
      { name: "tdd-workflow", description: "d", location: "plugin", ecc: true },
    ]
    const out = buildEccSkillUsageGuide(skills)
    expect(out).toContain("ECC Skill Usage")
    expect(out).toContain("verification-loop")
    expect(out).toContain("tdd-workflow")
  })
})