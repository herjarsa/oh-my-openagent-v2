import { Schema } from "effect"
import type { Info, ToolContext, ToolEditor } from "@opencode/plugin/promise/tool"
import type { GoalController } from "../hooks/goal/controller"
import { GoalToolResponseSchema } from "../hooks/goal/types"

export type GoalToolsDeps = {
  readonly controller: GoalController
  /** Default true: reject update_goal status complete without evidence. Mirrors v1. */
  readonly requireCompletionEvidence?: boolean
}

function formatResponse(goal: ReturnType<GoalController["getGoal"]>): string {
  return JSON.stringify(GoalToolResponseSchema.parse({ goal }), null, 2)
}

function targetSessionID(inputSessionID: unknown, context: ToolContext): string | undefined {
  if (typeof inputSessionID === "string" && inputSessionID.length > 0) return inputSessionID
  const fromContext = context.sessionID
  return typeof fromContext === "string" && fromContext.length > 0 ? fromContext : undefined
}

// Workspace effect (4.0.6) Codec is nominally incompatible with the plugin
// effect (4.0.1) ValueSchema, so schemas cross the boundary via Info input
// and execute bodies narrow the decoded payload with the Args types below.
type CreateGoalArgs = {
  readonly objective: string
  readonly session_id?: string | undefined
}

type UpdateGoalArgs = {
  readonly status?: "active" | "paused" | "complete" | undefined
  readonly objective?: string | undefined
  readonly session_id?: string | undefined
  readonly evidence?: string | undefined
}

type GetGoalArgs = {
  readonly session_id?: string | undefined
}

const CreateGoalInput = Schema.Struct({
  objective: Schema.String,
  session_id: Schema.optional(Schema.String),
}) as unknown as Info["input"]

const UpdateGoalInput = Schema.Struct({
  status: Schema.optional(Schema.Literals(["active", "paused", "complete"])),
  objective: Schema.optional(Schema.String),
  session_id: Schema.optional(Schema.String),
  evidence: Schema.optional(Schema.String),
}) as unknown as Info["input"]

const GetGoalInput = Schema.Struct({
  session_id: Schema.optional(Schema.String),
}) as unknown as Info["input"]

export function registerGoalTools(editor: ToolEditor, deps: GoalToolsDeps): void {
  const requireEvidence = deps.requireCompletionEvidence !== false
  editor.add({
    name: "create_goal",
    description: "Create or replace the active goal for the current session. Use this when the user asks you to set a goal, or when you decide a new high-level outcome is needed. The goal persists across turns. The objective should be concise (under 2000 characters) and describe the desired outcome, not a single action.",
    input: CreateGoalInput,
    execute: async (input, context) => {
      const args = input as CreateGoalArgs
      const sessionID = targetSessionID(args.session_id, context)
      if (sessionID === undefined) return { content: "Error: no session_id available" }
      const goal = deps.controller.setGoal(sessionID, args.objective)
      return { content: formatResponse(goal) }
    },
  })
  editor.add({
    name: "update_goal",
    description: "Update the active goal for the current session. Use this to pause, resume, complete, or change the objective of the current goal. When you believe the goal has been achieved, call update_goal with status complete.",
    input: UpdateGoalInput,
    execute: async (input, context) => {
      const args = input as UpdateGoalArgs
      const sessionID = targetSessionID(args.session_id, context)
      if (sessionID === undefined) return { content: "Error: no session_id available" }
      if (args.objective !== undefined) deps.controller.setGoal(sessionID, args.objective)
      if (args.status === "paused") deps.controller.pauseGoal(sessionID)
      else if (args.status === "active") deps.controller.resumeGoal(sessionID)
      else if (args.status === "complete") {
        if (requireEvidence && (args.evidence === undefined || args.evidence.trim().length === 0)) {
          return { content: "Error: completion evidence is required. Describe what was verified and where (files, tests, command output) in the evidence argument." }
        }
        deps.controller.markComplete(sessionID)
      }
      return { content: formatResponse(deps.controller.getGoal(sessionID)) }
    },
  })
  editor.add({
    name: "get_goal",
    description: "Read the active goal for the current session. Returns the current objective, status, and usage accounting. Returns null if no goal is active.",
    input: GetGoalInput,
    execute: async (input, context) => {
      const args = input as GetGoalArgs
      const sessionID = targetSessionID(args.session_id, context)
      if (sessionID === undefined) return { content: "Error: no session_id available" }
      return { content: formatResponse(deps.controller.getGoal(sessionID)) }
    },
  })
}

