import * as z from "zod"

// Harness-neutral shape of the Goal subsystem section. Bounds mirror the
// plugin-side GoalConfigSchema so a top-level "goal" block survives config
// loading with identical validation on every harness.
export const OmoGoalSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  auto_start: z.boolean().default(true),
  default_max_iterations: z.number().min(1).max(1000).default(100),
  resume_on_start: z.boolean().default(true),
  resume_window_minutes: z.number().int().min(1).max(10080).default(30),
  require_completion_evidence: z.boolean().default(true),
  inherit_to_children: z.boolean().default(true),
  max_stalls: z.number().min(1).max(10).default(3),
}).strict()

export const OmoGoalSettingsLayerSchema = z.object({
  enabled: z.boolean().optional(),
  auto_start: z.boolean().optional(),
  default_max_iterations: z.number().min(1).max(1000).optional(),
  resume_on_start: z.boolean().optional(),
  resume_window_minutes: z.number().int().min(1).max(10080).optional(),
  require_completion_evidence: z.boolean().optional(),
  inherit_to_children: z.boolean().optional(),
  max_stalls: z.number().min(1).max(10).optional(),
}).strict()

export type OmoGoalSettings = z.infer<typeof OmoGoalSettingsSchema>
export type OmoGoalSettingsLayer = z.infer<typeof OmoGoalSettingsLayerSchema>
