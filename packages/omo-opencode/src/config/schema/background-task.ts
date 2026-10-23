import { z } from "zod"

const CircuitBreakerConfigSchema = z.object({
  enabled: z.boolean().optional(),
  maxToolCalls: z.number().int().min(10).optional(),
  consecutiveThreshold: z.number().int().min(5).optional(),
})

export const BackgroundTaskConfigSchema = z.object({
  defaultConcurrency: z.number().min(0).optional(),
  providerConcurrency: z.record(z.string(), z.number().min(0)).optional(),
  modelConcurrency: z.record(z.string(), z.number().min(0)).optional(),
  maxDepth: z.number().int().min(1).optional(),
  maxLiveDescendantsPerRoot: z.number().int().min(0).optional(),
  /** Stale timeout in milliseconds - interrupt tasks with no activity for this duration (default: 180000 = 3 minutes, minimum: 60000 = 1 minute) */
  staleTimeoutMs: z.number().min(60000).optional(),
  /** Timeout for tasks that never received any progress update, falling back to startedAt (default: 1800000 = 30 minutes, minimum: 60000 = 1 minute) */
  messageStalenessTimeoutMs: z.number().min(60000).optional(),
  /** Durable store for terminal background task results. Survives restarts and session deletion. */
  resultPersistence: z.object({
    /** Whether results are written to the durable store (default: true) */
    enabled: z.boolean().optional(),
    /** Store root override. Default: ~/.local/share/oh-my-opencode/delegations */
    root: z.string().optional(),
    /** How long a persisted record and its transcript are kept, in milliseconds (default: 604800000 = 7 days, minimum: 3600000 = 1 hour) */
    retentionMs: z.number().min(3_600_000).optional(),
    /** How long the child session is kept after completion, in milliseconds (default: 86400000 = 24 hours, minimum: 60000 = 1 minute) */
    completedSessionRetentionMs: z.number().min(60_000).optional(),
    /** Size cap for the persisted transcript, in bytes. Oldest messages are dropped first (default: 20971520 = 20 MB, minimum: 1048576 = 1 MB) */
    maxTranscriptBytes: z.number().min(1_048_576).optional(),
  }).optional(),
  /** Absolute TTL for non-terminal tasks in milliseconds (default: 1800000 = 30 minutes, minimum: 300000 = 5 minutes). Tasks exceeding this age from their last activity (or startedAt if no progress) are pruned. */
  taskTtlMs: z.number().min(300000).optional(),
  /** Timeout for tasks whose session has completely disappeared from the status registry (default: 60000 = 1 minute, minimum: 10000 = 10 seconds). When a session is gone (likely crashed), this shorter timeout is used instead of the normal stale timeout. */
  sessionGoneTimeoutMs: z.number().min(10000).optional(),
  /** Delay before removing completed/cancelled/errored tasks from memory in milliseconds (default: 600000 = 10 minutes, minimum: 60000 = 1 minute). */
  taskCleanupDelayMs: z.number().min(60000).optional(),
  syncPollTimeoutMs: z.number().min(60000).optional(),
  /** Maximum tool calls per subagent task before circuit breaker triggers (default: 200, minimum: 10). Prevents runaway loops from burning unlimited tokens. */
  maxToolCalls: z.number().int().min(10).optional(),
  circuitBreaker: CircuitBreakerConfigSchema.optional(),
})

export type BackgroundTaskConfig = z.infer<typeof BackgroundTaskConfigSchema>
