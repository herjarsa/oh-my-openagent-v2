import type { BackgroundOutputMessage } from "../../../shared/background-output-message"
import type { BackgroundTask, BackgroundTaskAttempt } from "../types"

export const PERSISTED_TASK_RECORD_SCHEMA_VERSION = 1

export type PersistedTaskStatus = "completed" | "error" | "cancelled" | "interrupt"

export interface PersistedAttempt {
  attemptId: string
  attemptNumber: number
  sessionId?: string
  providerId?: string
  modelId?: string
  variant?: string
  status: string
  error?: string
  startedAt?: string
  completedAt?: string
}

export interface PersistedTaskRecord {
  schemaVersion: number
  taskId: string
  parentSessionId: string
  parentMessageId?: string
  sessionId?: string
  projectDirectory: string
  description: string
  agent: string
  category?: string
  status: PersistedTaskStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  updatedAt: string
  error?: string
  attempts?: PersistedAttempt[]
  result?: string
  messagesTruncated?: boolean
  hasTranscript?: boolean
  persistedAt: string
  deleteAfter: string
  expiresAt: string
  sessionDeletedAt?: string
  persistenceError?: string
}

export interface PersistedTaskTranscript {
  schemaVersion: number
  taskId: string
  messages: BackgroundOutputMessage[]
  messagesTruncated: boolean
}

export function isPersistedTaskStatus(status: string): status is PersistedTaskStatus {
  return status === "completed" || status === "error" || status === "cancelled" || status === "interrupt"
}

export function isPersistedTaskRecord(value: unknown): value is PersistedTaskRecord {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<PersistedTaskRecord>
  if (candidate.schemaVersion !== PERSISTED_TASK_RECORD_SCHEMA_VERSION) return false
  return typeof candidate.taskId === "string" && typeof candidate.parentSessionId === "string"
}

export function toPersistedAttempts(
  attempts: BackgroundTaskAttempt[] | undefined,
): PersistedAttempt[] | undefined {
  if (!attempts) return undefined
  return attempts.map((attempt) => ({
    attemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    ...(attempt.sessionId !== undefined ? { sessionId: attempt.sessionId } : {}),
    ...(attempt.providerId !== undefined ? { providerId: attempt.providerId } : {}),
    ...(attempt.modelId !== undefined ? { modelId: attempt.modelId } : {}),
    ...(attempt.variant !== undefined ? { variant: attempt.variant } : {}),
    status: attempt.status,
    ...(attempt.error !== undefined ? { error: attempt.error } : {}),
    ...(attempt.startedAt ? { startedAt: attempt.startedAt.toISOString() } : {}),
    ...(attempt.completedAt ? { completedAt: attempt.completedAt.toISOString() } : {}),
  }))
}

export function reviveAttempts(attempts: PersistedAttempt[] | undefined): BackgroundTaskAttempt[] | undefined {
  if (!attempts) return undefined
  return attempts.map((attempt) => ({
    attemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    ...(attempt.sessionId !== undefined ? { sessionId: attempt.sessionId } : {}),
    ...(attempt.providerId !== undefined ? { providerId: attempt.providerId } : {}),
    ...(attempt.modelId !== undefined ? { modelId: attempt.modelId } : {}),
    ...(attempt.variant !== undefined ? { variant: attempt.variant } : {}),
    status: attempt.status as BackgroundTaskAttempt["status"],
    ...(attempt.error !== undefined ? { error: attempt.error } : {}),
    ...(attempt.startedAt ? { startedAt: new Date(attempt.startedAt) } : {}),
    ...(attempt.completedAt ? { completedAt: new Date(attempt.completedAt) } : {}),
  }))
}

export function toBackgroundTask(record: PersistedTaskRecord): BackgroundTask {
  return {
    id: record.taskId,
    parentSessionId: record.parentSessionId,
    parentMessageId: record.parentMessageId ?? "",
    description: record.description,
    prompt: "",
    agent: record.agent,
    ...(record.category !== undefined ? { category: record.category } : {}),
    status: record.status,
    ...(record.sessionId !== undefined ? { sessionId: record.sessionId } : {}),
    queuedAt: new Date(record.createdAt),
    ...(record.startedAt ? { startedAt: new Date(record.startedAt) } : {}),
    ...(record.completedAt ? { completedAt: new Date(record.completedAt) } : {}),
    ...(record.result !== undefined ? { result: record.result } : {}),
    ...(record.error !== undefined ? { error: record.error } : {}),
    ...(record.attempts ? { attempts: reviveAttempts(record.attempts) } : {}),
    persisted: true,
  }
}
