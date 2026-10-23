import { createHash } from "node:crypto"
import path from "node:path"

import { getOmoDataDir } from "../../../shared"

export const PERSISTENCE_ROOT_DIRNAME = "delegations"

export function normalizeProjectDirectory(directory: string): string {
  return path.resolve(directory).replace(/\\/g, "/").toLowerCase()
}

export function getProjectHash(directory: string): string {
  return createHash("sha256").update(normalizeProjectDirectory(directory)).digest("hex").slice(0, 16)
}

export function getPersistenceRoot(rootOverride?: string): string {
  return (
    rootOverride ??
    process.env.OMO_RESULT_PERSISTENCE_ROOT ??
    path.join(getOmoDataDir(), PERSISTENCE_ROOT_DIRNAME)
  )
}

export function getProjectStoreDir(root: string, projectDirectory: string): string {
  return path.join(root, getProjectHash(projectDirectory))
}

export function getRecordPath(root: string, projectDirectory: string, taskId: string): string {
  return path.join(getProjectStoreDir(root, projectDirectory), `${taskId}.json`)
}

export function getTranscriptPath(root: string, projectDirectory: string, taskId: string): string {
  return path.join(getProjectStoreDir(root, projectDirectory), `${taskId}.transcript.json`)
}
