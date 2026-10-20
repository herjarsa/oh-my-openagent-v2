import { homedir } from "node:os"
import { join } from "node:path"
import { MESSAGE_STORAGE } from "../../shared/opencode-storage-paths"

/**
 * Resolves the OpenCode session-transcript directory used as the
 * sessionsDirectory input for stale-work reconciliation. Mirrors the
 * MESSAGE_STORAGE convention the background-agent and hook-message-injector
 * features already use. Never throws: when the directory cannot be resolved,
 * the best-known default is returned, and the reconciliation itself tolerates
 * a missing directory.
 */
export function resolveOpencodeSessionsDirectory(): string {
  try {
    if (typeof MESSAGE_STORAGE === "string" && MESSAGE_STORAGE.length > 0) {
      return MESSAGE_STORAGE
    }
  } catch {
    // Fall through to the best-known default below.
  }
  try {
    return join(homedir(), ".local", "share", "opencode", "storage", "message")
  } catch {
    // homedir() can throw in exotic environments; keep a relative fallback.
    return join(".local", "share", "opencode", "storage", "message")
  }
}
