import type { BackgroundTaskConfig } from "../../../config/schema"

import { getPersistenceRoot } from "./paths"

export const DEFAULT_RESULT_RETENTION_MS = 604_800_000
export const DEFAULT_COMPLETED_SESSION_RETENTION_MS = 86_400_000
export const DEFAULT_MAX_TRANSCRIPT_BYTES = 20_971_520

export interface ResultPersistenceConfig {
  enabled: boolean
  root: string
  retentionMs: number
  completedSessionRetentionMs: number
  maxTranscriptBytes: number
}

export function resolveResultPersistenceConfig(config: BackgroundTaskConfig | undefined): ResultPersistenceConfig {
  const persistence = config?.resultPersistence
  return {
    enabled: persistence?.enabled ?? true,
    root: getPersistenceRoot(persistence?.root),
    retentionMs: persistence?.retentionMs ?? DEFAULT_RESULT_RETENTION_MS,
    completedSessionRetentionMs:
      persistence?.completedSessionRetentionMs ?? DEFAULT_COMPLETED_SESSION_RETENTION_MS,
    maxTranscriptBytes: persistence?.maxTranscriptBytes ?? DEFAULT_MAX_TRANSCRIPT_BYTES,
  }
}
