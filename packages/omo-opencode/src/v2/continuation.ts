import { buildContinuationPrompt } from "../hooks/goal/prompt"
import type { Goal } from "../hooks/goal/types"

export function buildStructuredContinuation(goal: Goal): string {
  const lines: string[] = ["Active goal state (factual, do not re-derive):"]
  const iterationLine =
    `- Status: ${goal.status} | iteration ${goal.iteration}/${goal.maxIterations} | stalls ${goal.stallCount}` +
    (typeof goal.pauseReason === "string" && goal.pauseReason.length > 0 ? ` | last pause: ${goal.pauseReason}` : "")
  lines.push(iterationLine)
  lines.push(`- Tokens used: ${goal.tokensUsed} | time: ${goal.timeUsedSeconds}s`)
  if (goal.childSessionIDs.length > 0) {
    lines.push(`- Delegated child sessions: ${goal.childSessionIDs.join(", ")} (check each with get_goal before duplicating their work)`)
  }
  lines.push("- Next: pick the single most-blocked requirement, act on it, and report concrete evidence. If blocked with no path forward after this cycle, say so explicitly instead of stalling silently.")
  return lines.join("\n") + "\n\n" + buildContinuationPrompt(goal)
}
