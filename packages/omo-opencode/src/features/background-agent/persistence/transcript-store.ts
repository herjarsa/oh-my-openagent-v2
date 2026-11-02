import { existsSync, mkdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { log, writeFileAtomically } from "../../../shared"
import type { BackgroundOutputMessage } from "../../../shared/background-output-message"

import { getProjectStoreDir } from "./paths"
import { PERSISTED_TASK_RECORD_SCHEMA_VERSION, type PersistedTaskTranscript } from "./record"

const TRANSCRIPT_FILE_MODE = 0o600
const STORE_DIR_MODE = 0o700

export function capTranscriptMessages(
  messages: BackgroundOutputMessage[],
  maxBytes: number,
): { messages: BackgroundOutputMessage[]; truncated: boolean } {
  if (maxBytes <= 0) return { messages, truncated: false }
  const size = (candidate: BackgroundOutputMessage[]): number =>
    Buffer.byteLength(JSON.stringify(candidate), "utf8")
  if (size(messages) <= maxBytes) return { messages, truncated: false }

  let low = 0
  let high = messages.length
  let best: BackgroundOutputMessage[] = []
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const candidate = messages.slice(messages.length - mid)
    if (size(candidate) <= maxBytes) {
      best = candidate
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return { messages: best, truncated: true }
}

export function writeTaskTranscript(
  taskId: string,
  messages: BackgroundOutputMessage[],
  maxBytes: number,
  root: string,
  projectDirectory: string,
): boolean {
  const capped = capTranscriptMessages(messages, maxBytes)
  const payload: PersistedTaskTranscript = {
    schemaVersion: PERSISTED_TASK_RECORD_SCHEMA_VERSION,
    taskId,
    messages: capped.messages,
    messagesTruncated: capped.truncated,
  }
  const dir = getProjectStoreDir(root, projectDirectory)
  mkdirSync(dir, { recursive: true, mode: STORE_DIR_MODE })
  const filePath = path.join(dir, `${taskId}.transcript.json`)
  writeFileAtomically(filePath, `${JSON.stringify(payload)}\n`, { mode: TRANSCRIPT_FILE_MODE })
  return capped.truncated
}

export function readTaskTranscript(
  taskId: string,
  root: string,
  projectDirectory: string,
): PersistedTaskTranscript | undefined {
  const filePath = path.join(getProjectStoreDir(root, projectDirectory), `${taskId}.transcript.json`)
  if (!existsSync(filePath)) return undefined
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf-8"))
    if (typeof parsed !== "object" || parsed === null) return undefined
    const candidate = parsed as Partial<PersistedTaskTranscript>
    if (candidate.schemaVersion !== PERSISTED_TASK_RECORD_SCHEMA_VERSION) return undefined
    if (!Array.isArray(candidate.messages)) return undefined
    return {
      schemaVersion: PERSISTED_TASK_RECORD_SCHEMA_VERSION,
      taskId: typeof candidate.taskId === "string" ? candidate.taskId : taskId,
      messages: candidate.messages,
      messagesTruncated: candidate.messagesTruncated === true,
    }
  } catch (error) {
    log("[background-agent] Failed to read persisted task transcript:", { taskId, error: String(error) })
    return undefined
  }
}
