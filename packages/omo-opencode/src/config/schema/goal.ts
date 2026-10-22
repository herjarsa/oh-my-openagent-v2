import { z } from "zod"

export const GoalConfigSchema = z.object({
  /** Enable the Goal subsystem (default: false) */
  enabled: z.boolean().default(false),
  /** Master switch for automatic goal creation on the first main-session message. Requires default_mode.goal. */
  auto_start: z.boolean().default(false),
  /** Default continuation iteration cap, preserved for Ralph Loop behavioral parity (default: 100) */
  default_max_iterations: z.number().min(1).max(1000).default(100),
  /** Resume active goals when the plugin starts after a crash or restart (default: true). */
  resume_on_start: z.boolean().default(true),
  /** Only resume active goals updated within this many minutes (default: 30, max: 10080 = 7 days). */
  resume_window_minutes: z.number().int().min(1).max(10080).default(30),
})

export type GoalConfig = z.infer<typeof GoalConfigSchema>
