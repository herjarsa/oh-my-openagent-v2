import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"

import { log, writeFileAtomically } from "../../../shared"

import { getProjectStoreDir } from "./paths"
import { isPersistedTaskRecord, type PersistedTaskRecord } from "./record"

const RECORD_FILE_MODE = 0o600
const STORE_DIR_MODE = 0o700
const RECORD_SUFFIX = ".json"
const TRANSCRIPT_SUFFIX = ".transcript.json"

function ensureStoreDir(root: string, projectDirectory: string): string {
  const dir = getProjectStoreDir(root, projectDirectory)
  mkdirSync(dir, { recursive: true, mode: STORE_DIR_MODE })
  return dir
}

export function writeTaskRecord(record: PersistedTaskRecord, root: string, projectDirectory: string): void {
  const dir = ensureStoreDir(root, projectDirectory)
  const filePath = path.join(dir, `${record.taskId}${RECORD_SUFFIX}`)
  writeFileAtomically(filePath, `${JSON.stringify(record, null, 2)}\n`, { mode: RECORD_FILE_MODE })
}

export function readTaskRecord(
  taskId: string,
  root: string,
  projectDirectory: string,
): PersistedTaskRecord | undefined {
  const filePath = path.join(getProjectStoreDir(root, projectDirectory), `${taskId}${RECORD_SUFFIX}`)
  if (!existsSync(filePath)) return undefined
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf-8"))
    if (!isPersistedTaskRecord(parsed)) return undefined
    return parsed
  } catch (error) {
    log("[background-agent] Failed to read persisted task record:", { taskId, error: String(error) })
    return undefined
  }
}

export function listTaskRecords(root: string, projectDirectory: string): PersistedTaskRecord[] {
  const dir = getProjectStoreDir(root, projectDirectory)
  if (!existsSync(dir)) return []
  const records: PersistedTaskRecord[] = []
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(RECORD_SUFFIX) || entry.endsWith(TRANSCRIPT_SUFFIX)) continue
    const taskId = entry.slice(0, -RECORD_SUFFIX.length)
    const record = readTaskRecord(taskId, root, projectDirectory)
    if (record) records.push(record)
  }
  return records
}

export function deleteTaskRecord(taskId: string, root: string, projectDirectory: string): void {
  rmSync(path.join(getProjectStoreDir(root, projectDirectory), `${taskId}${RECORD_SUFFIX}`), { force: true })
}

export function deleteTaskTranscript(taskId: string, root: string, projectDirectory: string): void {
  rmSync(path.join(getProjectStoreDir(root, projectDirectory), `${taskId}${TRANSCRIPT_SUFFIX}`), { force: true })
}

export function sweepExpiredTaskRecords(
  root: string,
  projectDirectory: string,
  now: number,
): string[] {
  const removed: string[] = []
  for (const record of listTaskRecords(root, projectDirectory)) {
    if (Date.parse(record.expiresAt) > now) continue
    deleteTaskRecord(record.taskId, root, projectDirectory)
    deleteTaskTranscript(record.taskId, root, projectDirectory)
    removed.push(record.taskId)
  }
  return removed
}
