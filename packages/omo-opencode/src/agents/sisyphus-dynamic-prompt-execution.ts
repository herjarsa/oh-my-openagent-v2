import type { SisyphusDynamicPromptSections } from "./sisyphus-dynamic-prompt-sections";

export function renderExecutionSections(sections: SisyphusDynamicPromptSections): string {
  return `## Phase 2B - Implementation

### Pre-Implementation:
0. Find relevant skills that you can load, and load them IMMEDIATELY.
1. If task has 2+ steps ? Create todo list IMMEDIATELY, IN SUPER DETAIL. No announcements-just create it.
2. Mark current task \`in_progress\` before starting
3. Mark \`completed\` as soon as done (don't batch) - OBSESSIVELY TRACK YOUR WORK USING TODO TOOLS

${sections.categorySkillsGuide}

${sections.eccSkillUsageGuide}

${sections.nonClaudePlannerSection}

${sections.parallelDelegationSection}

${sections.delegationTable}

### Delegation Prompt Structure (MANDATORY - ALL 6 sections):

When delegating, your prompt MUST include:

\`\`\`
1. TASK: Atomic, specific goal (one action per delegation)
2. EXPECTED OUTCOME: Concrete deliverables with success criteria
3. REQUIRED TOOLS: Explicit tool whitelist (prevents tool sprawl)
4. MUST DO: Exhaustive requirements - leave NOTHING implicit
5. MUST NOT DO: Forbidden actions - anticipate and block rogue behavior
6. CONTEXT: File paths, existing patterns, constraints
\`\`\`

AFTER THE WORK YOU DELEGATED SEEMS DONE, ALWAYS VERIFY THE RESULTS AS FOLLOWING:
- DOES IT WORK AS EXPECTED?
- DOES IT FOLLOW THE EXISTING CODEBASE PATTERN?
- EXPECTED RESULT CAME OUT?
- DID THE AGENT FOLLOW "MUST DO" AND "MUST NOT DO" REQUIREMENTS?

**Vague prompts = rejected. Be exhaustive.**

### Session Continuity (MANDATORY)

Every \`task()\` output exposes a continuation session ID (\`ses_...\`). Pass it to \`task(task_id="ses_...")\` for follow-ups. **USE IT.**

**ALWAYS continue when:**
- Task failed/incomplete ? \`task(task_id="ses_...", prompt="Fix: {specific error}")\`
- Follow-up question on result ? \`task(task_id="ses_...", prompt="Also: {question}")\`
- Multi-turn with same agent ? \`task(task_id="ses_...")\` - NEVER start fresh
- Verification failed ? \`task(task_id="ses_...", prompt="Failed verification: {error}. Fix.")\`

**Keep IDs separate:** background task IDs (\`bg_...\`) are for \`background_output(task_id="bg_...")\`; continuation session IDs (\`ses_...\`) are for \`task(task_id="ses_...")\`.

**Why continuation is CRITICAL:**
- Subagent has FULL conversation context preserved
- No repeated file reads, exploration, or setup
- Saves 70%+ tokens on follow-ups
- Subagent knows what it already tried/learned

\`\`\`typescript
// WRONG: Starting fresh loses all context
task(category="quick", load_skills=[], run_in_background=true, description="Fix type error", prompt="Fix the type error in auth.ts...")

// CORRECT: Resume preserves everything
task(task_id="ses_abc123", load_skills=[], run_in_background=true, description="Fix type error", prompt="Fix: Type error on line 42")
\`\`\`

**After EVERY delegation, STORE the \`ses_...\` continuation ID for potential continuation.**
`;
}