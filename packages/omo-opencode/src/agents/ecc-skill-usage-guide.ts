import type { AvailableSkill } from "./dynamic-agent-prompt-types"

const ECC_SKILL_TRIGGERS: Readonly<Record<string, string>> = {
  "tdd-workflow": "Implementing features/fixes - write tests first, then code.",
  "verification-loop": "Before claiming a task is complete - run verification.",
  "security-review": "Security-sensitive changes or before shipping.",
  "e2e-testing": "UI/flow changes - exercise the real surface.",
  "eval-harness": "Assessing quality/robustness of a change.",
  "deep-research": "Complex investigation or unfamiliar territory.",
  "architecture-decision-records": "When an architecture decision is made.",
  "codebase-onboarding": "Entering an unfamiliar codebase.",
  "context-budget": "When context/token budget is tight.",
  "conventional-commit-review": "Before committing - commit quality check (also enforced by hook).",
  "git-workflow": "Git operations and branching.",
  "continuous-learning": "Capturing learnings from the session.",
  "strategic-compact": "When compacting context.",
  "iterative-retrieval": "Iterative search/refinement loops.",
  "production-audit": "Production-readiness checks before shipping.",
  "delivery-gate": "Delivery quality gate.",
  "agent-self-evaluation": "Reviewing your own work before reporting done.",
}

export function buildEccSkillUsageGuide(availableSkills: AvailableSkill[], allowedSkills?: readonly string[]): string {
  const allowedSet = allowedSkills ? new Set(allowedSkills) : null
  const eccSkills = availableSkills.filter((skill) => skill.ecc === true && (!allowedSet || allowedSet.has(skill.name)))
  if (eccSkills.length === 0) return ""

  const availableNames = new Set(eccSkills.map((skill) => skill.name))
  const rows: string[] = []
  for (const [name, trigger] of Object.entries(ECC_SKILL_TRIGGERS)) {
    if (availableNames.has(name)) {
      rows.push("- `" + name + "` - " + trigger)
    }
  }

  if (rows.length === 0) {
    for (const skill of eccSkills) {
      rows.push("- `" + skill.name + "` - " + (skill.description || "ECC skill available on demand."))
    }
  }

  return "### ECC Skill Usage (PROACTIVE - use, don't just list)\n\nThe following Everything Claude Code (ECC) skills are available. **Invoke them proactively** at the matching moment rather than waiting to be asked - they encode battle-tested workflows:\n\n" + rows.join("\n") + "\n\n> These are capabilities, not suggestions. When a trigger matches, load the skill via the `skill` tool and follow it. ECC rules (common + typescript) are also auto-injected into context when reading/editing files."
}