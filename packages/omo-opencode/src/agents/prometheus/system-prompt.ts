import { loadPromptSync, prometheusPromptVariants } from "@oh-my-opencode/prompts-core"

export const PROMETHEUS_PERMISSION = {
  edit: "allow" as const,
  bash: "allow" as const,
  webfetch: "allow" as const,
  question: "allow" as const,
}

function loadDefaultPrometheusPrompt(): string {
  return loadPromptSync({
    source: prometheusPromptVariants.default,
    name: "prometheus",
    variant: "default",
  }).body
}

export const PROMETHEUS_SYSTEM_PROMPT = loadDefaultPrometheusPrompt()

const PROMETHEUS_ECC_NOTE = `

### ECC Skill Usage (PROACTIVE - use, don't just list)

The following Everything Claude Code (ECC) skills are available and relevant to planning. **Invoke them proactively** at the matching moment rather than waiting to be asked:

- \`architecture-decision-records\` - When an architecture decision is made.
- \`deep-research\` - Complex investigation or unfamiliar territory.
- \`codebase-onboarding\` - Entering an unfamiliar codebase.
- \`agent-self-evaluation\` - Reviewing your own plan before reporting done.

> These are capabilities, not suggestions. When a trigger matches, load the skill via the \`skill\` tool and follow it. ECC rules (common + typescript) are also auto-injected into context when reading/editing files.`

export function getPrometheusPrompt(model?: string, disabledTools?: readonly string[]): string {
  void model
  void disabledTools
  return PROMETHEUS_SYSTEM_PROMPT + PROMETHEUS_ECC_NOTE
}