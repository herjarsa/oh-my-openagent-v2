# Background Task Durability — Design

**Date:** 2026-10-22
**Status:** Approved (design), pending spec review
**Target release:** 0.1.10
**Scope:** `packages/omo-opencode/src/features/background-agent/`, `packages/omo-opencode/src/tools/background-task/`

## 1. Problem

A background task's result is not durable. Three concrete defects, all reproduced against the
0.1.9 source:

1. **The result dies with the child session.** `background_output` reads the output from the child
   session over the SDK (`task-result-format.ts:13-142`, `full-session-format.ts:34-169`). The child
   session is deleted 10 minutes after completion (`manager.ts:2395-2405`), so the output becomes
   unreachable even though the task itself is still known in memory.
2. **The task record dies with the process.** `BackgroundTask.result` is declared
   (`types.ts:59`) but never assigned. The only copies of a finished task live in
   `this.tasks`, the in-memory `completedTaskArchive`, and a `globalThis` registry capped at 100
   entries (`task-registry.ts:99-125`). None of them survive a restart, and `getTask`
   (`manager.ts:1079-1081`) has no disk fallback.
3. **The completion notification lies about the batch.** `allComplete` and `remainingCount` are
   computed from `pendingByParent` and `completedTaskSummaries` (`manager.ts:2679-2702`), both
   in-memory and cleared aggressively — `clearTaskHistoryWhenParentTasksGone` drops them as soon as
   no live task remains (`manager.ts:2357-2362`). A task removed from memory before its sibling
   finished silently disappears from the "ALL BACKGROUND TASKS COMPLETE" list, so the parent is
   told the batch is done while one of its results is already unreachable.

A fourth, separate defect — `client.session.list is not a function` against the pinned
`@opencode-ai/sdk@1.18.31` (`session-manager/sdk-storage.ts:47`) — breaks the `session_read` /
`session_info` / `session_search` fallback that the not-found message advertises. **The SDK
upgrade is out of scope for this change** and stays a separate task.

### What already exists and is not enough

`background_task.taskCleanupDelayMs` already exists (`config/schema/background-task.ts:26`, min
60000). Raising it does not fix the problem:

- Terminal tasks are pruned from `this.tasks` after 30 minutes regardless
  (`TERMINAL_TASK_TTL_MS`, `task-poller.ts:49-61`). The delayed-removal timer then finds no task
  and returns early, so the child session is **never deleted** — the retention leak.
- The task metadata still lives only in memory.
- `background_output` still reads the output from the session, so a live-but-orphaned session is
  the only thing keeping the result reachable.

Raising the delay is a mitigation, not a fix, and it trades one defect for a leak.

## 2. Goals

| # | Goal | Observable |
|---|------|------------|
| G1 | The final output of a terminal background task survives the child session, a plugin restart, and the 10-minute cleanup | `background_output(task_id)` returns the output ≥ 24 h after completion and after a process restart |
| G2 | `full_session=true` keeps working after the child session is deleted | The transcript renders from the persisted copy |
| G3 | The completion notification reports every task the parent launched, and says which of them are recoverable | The "ALL BACKGROUND TASKS COMPLETE" body lists each task with `[recoverable]` / `[unrecoverable]` |
| G4 | The child session is retained for a configurable window and then deleted deterministically, even across restarts | The session is gone after the retention window; no orphan session leaks |

## 3. Non-goals

- **Upgrading the pinned OpenCode SDK.** `client.session.list` stays broken; the not-found message
  is reworded to stop advertising it as the primary escape hatch.
- **Rehydrating tasks that were still running when the process died.** The ledger is written at
  terminal transitions only (see §5.1). A task killed by a process restart is not recovered.
- **Persisting the task prompt.** The prompt can contain the whole instruction; it is not written
  to disk.
- **Cross-project or cross-worktree result lookup.** Records are scoped to the project directory
  that launched the task.
- **Persisting the OpenCode session itself.** The transcript copy is a read-only snapshot for
  result recovery, not a session.
- **Wiring `session_read` to the persisted transcript.** `session_read` still serves the live
  OpenCode session, so it works for the 24-hour retention window and stops working once the child
  session is deleted. The recovery path for a deleted child session is
  `background_output(full_session=true)`.

## 4. Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Scope | Full fix now; SDK upgrade separate | The three defects share one root cause: no durable state |
| Store root | `~/.local/share/oh-my-opencode/delegations/` (XDG data dir) | Runtime state outside the repo. `.omo/` is not git-ignored, so writing there dirties the working tree on every task |
| Layout | Flat per project: `<root>/<projectHash>/<taskId>.json` | `background_output` only receives a task ID. A per-parent subdirectory would require an index to resolve an ID; the record carries `parentSessionId` and the notification filters by parent |
| Content | Final output + full transcript | `background_output` and `background_output(full_session=true)` must keep working after the child session is gone |
| Session retention | 24 h, configurable | Long enough to read a result the next morning; bounded so sessions do not accumulate forever |
| Record retention | 7 days, configurable | The output is the product; the snapshot is not |
| Ledger semantics | Terminal tasks only | A launch-time record would require reconciling orphaned `running` records after a restart, which is a rehydration feature, not a durability fix |
| Notification counts | Live tasks + terminal records | Honest about what is known; the count of tasks that vanished mid-flight is unknowable without launch records |
## 5. Architecture

### 5.1 Durable store

**Location.** Two files per task under `getOmoDataDir()/delegations/<projectHash>/`:

- `<taskId>.json` — the record: metadata and the extracted result text.
- `<taskId>.transcript.json` — the raw transcript, read only when a full session is requested.

The split is deliberate: the record is small and is read on every `getTask` miss, while the
transcript can be tens of megabytes. Parsing a 20 MB JSON on every lookup would put the
transcript in the hot path of a tool call.

- `getOmoDataDir()` is a new sibling of `getDataDir()` / `getOmoOpenCodeCacheDir()` in
  `shared/data-path.ts`: `resolveXdgDataDir(CACHE_DIR_NAME)`, i.e. `~/.local/share/oh-my-opencode`
  on every platform, honouring `XDG_DATA_HOME`.
- `projectHash` is `sha256(normalize(directory)).slice(0, 16)`, where `normalize` resolves the
  path, converts separators to `/`, and lowercases it (Windows case-insensitivity). The hash keeps
  the path short and free of separators; the original directory is stored inside the record.
- The root is overridable via config for tests and for users who want the store elsewhere.

**Record.** `PersistedTaskRecord`, `schemaVersion: 1`:

```ts
interface PersistedTaskRecord {
  schemaVersion: 1
  taskId: string
  parentSessionId: string
  parentMessageId?: string
  sessionId?: string
  projectDirectory: string
  description: string
  agent: string
  category?: string
  status: "completed" | "error" | "cancelled" | "interrupt"
  createdAt: string
  startedAt?: string
  completedAt?: string
  updatedAt: string
  error?: string
  attempts?: PersistedAttempt[]
  result?: string
  messages?: unknown[]
  messagesTruncated?: boolean
  persistedAt: string
  deleteAfter: string
  expiresAt: string
  sessionDeletedAt?: string
  persistenceError?: string
}
```

- Dates are ISO strings. `attempts` mirrors `BackgroundTaskAttempt` with ISO dates, revived to
  `Date` when the record is turned back into a `BackgroundTask`.
- `result` is the extracted result text (assistant and tool text), not a formatted document. The
  tool layer renders the document, so the live path and the persisted path share one extractor and
  one formatter.
- The transcript lives in the sidecar file `<taskId>.transcript.json`
  (`{ schemaVersion, taskId, messages, messagesTruncated }`), never in the record. The record
  keeps `messagesTruncated` so the caller can tell a truncated transcript from a complete one.
- `deleteAfter` = `completedAt + completedSessionRetentionMs`; `expiresAt` = `completedAt + retentionMs`.

**Write discipline.**

- Atomic: `writeFileAtomically` (`shared/write-file-atomically.ts`), file mode `0600`, directories
  created with `0700`.
- One writer per task (the manager that owns it). Readers see either the previous file or the new
  one, never a partial write.
- A record is written once per terminal transition and updated in place (e.g. `sessionDeletedAt`).

**Size cap.** `maxTranscriptBytes` (default 20 MB). When the serialized transcript exceeds the cap,
the oldest messages are dropped, `messagesTruncated: true` is set, and the record keeps the
`result` (which is derived before truncation) intact.

**Read path.** `readTaskRecord(taskId, directory)` returns `undefined` for a missing, unreadable,
corrupt, or wrong-`schemaVersion` file. A corrupt file never throws into the tool layer; it is
logged once and treated as absent. `readTaskTranscript(taskId, directory)` does the same for the
sidecar.

**Index.** The manager keeps `Map<parentSessionId, Map<taskId, PersistedTaskRecord>>` in memory.
The startup reconciliation populates it from the store, every write updates it, and the hourly
sweep refreshes it. The notification ledger and the `getTask` disk fallback read the index, so
neither re-scans the directory.

### 5.2 Lifecycle

**`finalizeTerminalTask(task)`** — one helper, called from every terminal transition (completion,
error, cancellation, interruption, stale-prune, crash):

1. If persistence is disabled → schedule the legacy session deletion at `taskCleanupDelayMs` and
   return.
2. Skip if a record for this task already carries the same `status` and `completedAt` (idempotent
   across retries and duplicate notifications).
3. Fetch the transcript: `client.session.messages({ path: { id: task.sessionId } })` guarded by
   `withSdkCallTimeout` / `getBackgroundOutputFetchTimeoutMs()`. A failure is not fatal: the record
   is written without `result` / `messages`, and `persistenceError` records why.
4. Derive `result` from the transcript with the shared extractor
   (`persistence/result-text.ts`) and write the transcript to the sidecar file. The tool layer
   formats the document, so the live path and the persisted path produce the same text.
5. Write the record atomically. On failure: log it, set `persistenceError`, and **do not throw** —
   the notification still goes out, and the task is reported as not recoverable.
6. Set `task.result` so in-memory callers see the output.
7. Schedule the session deletion.

**Timer split.** Today `scheduleTaskRemoval` (`manager.ts:2364-2410`) both evicts the task from
memory and deletes the child session. That coupling is what produces the leak. After this change:

| Timer | Delay | Effect |
|-------|-------|--------|
| `scheduleTaskRemoval` (existing) | `taskCleanupDelayMs` (default 10 min) | Evicts from `this.tasks`, archives to the in-memory archive and the global registry, clears notifications. **Does not delete the session.** |
| `scheduleSessionDeletion` (new) | `completedSessionRetentionMs` (default 24 h) | Reads the record, and when `deleteAfter` has passed, deletes the child session if `client.session.delete` exists, then stamps `sessionDeletedAt`. Independent of `this.tasks`. |

The session-deletion delay is measured from `completedAt` (`max(0, completedAt + retention - now)`),
so a task that completed 23 hours ago is cleaned up in one hour, not 24.

**Reconciliation on startup.** `reconcilePersistedTasks()` runs once when the manager starts and
then hourly (an `unref()`ed interval, cleared by `shutdown()`):

- Records with `expiresAt` in the past → delete the file.
- Records with `deleteAfter` in the past and no `sessionDeletedAt` → delete the child session (if
  the SDK exposes `session.delete`), stamp `sessionDeletedAt`.
- Records with `deleteAfter` in the future → re-arm the session-deletion timer.
- A record whose `persistenceError` is set → left alone; the session is still deleted on schedule.

**Ordering with the existing prune.** `pruneStaleTasksAndNotifications` keeps its 30-minute
terminal TTL for `this.tasks`; it is now only a memory backstop, because the memory timer already
fires at 10 minutes and the session timer is independent.

### 5.3 Read path

**`BackgroundManager.getTask(id)`** gains a fourth fallback:

```
this.tasks → this.completedTaskArchive → getRegisteredBackgroundTask → persisted record on disk
```

The disk fallback reads the small record (never the transcript) and returns a `BackgroundTask` with
`status`, `sessionId`, `description`, `agent`, `category`, `error`, `attempts`, timestamps, and
`result` restored. `prompt` is empty — it was never persisted. The task is marked
`persisted: true`. The transcript is loaded separately, only when a full session is requested.

**`background_output`.**

- The task is found through `getTask`, so a persisted task is found even after a restart.
- `formatTaskResult` tries the live session first and keeps today's cursor-aware behaviour. If the
  live fetch fails (session deleted, SDK error) and the task carries a persisted `result`, it
  renders the standard result document from that text and appends a recovery note. Otherwise it
  returns today's error text.
- `formatFullSession` tries the live session first. If it fails and the record carries `messages`,
  it renders the same document from the persisted transcript, with a `Source: persisted transcript`
  line.
- `block=true` sees a persisted task as terminal and returns immediately instead of polling.
- **Lazy backfill**: if the live fetch succeeds for a record that has no `result` (the write failed
  earlier, or the process died between completion and persistence), the result is extracted and the
  record is updated in the background.

**Not-found message.** Reworded to state the store location, the retention window, and the
project scoping, and to stop sending the user to `session_read` as the primary escape hatch while
the SDK cannot serve it.

### 5.4 Notification

**Ledger.** `buildTaskLedgerSummary(parentSessionId)` merges three sources, de-duplicated by task
ID:

- `live` — tasks in `this.tasks` for the parent with status `pending` or `running`.
- `records` — the persisted records for that parent, read from the in-memory index.
- `summaries` — `completedTaskSummaries`, the in-memory fallback for tasks whose persistence
  failed.

Derived values:

```
known        = |live ∪ records ∪ summaries|
completed    = |records ∪ summaries|
recoverable  = |{r ∈ completed : r.result or r.messages present}|
inProgress   = |live|
allComplete  = live is empty AND pendingByParent holds no pending IDs
```

**Text.** `buildBackgroundTaskNotificationText` gains optional `knownCount`, `recoverableCount`,
`unrecoverableCount` and `inProgressCount` inputs (defaulted, so existing callers and tests keep
working). The body gains one line and one marker per task:

```
[ALL BACKGROUND TASKS COMPLETE]

**Known tasks:** 2 (2 completed, 2 recoverable)

**Completed:**
- `bg_aaa1111`: first task [recoverable]
- `bg_bbb2222`: second task [recoverable]
```

and in the partial case:

```
**Known tasks:** 3 (2 completed, 1 recoverable, 1 in progress)
```

The existing headers, the `[BACKGROUND TASK RESULT READY]` variant, and the
`background_output(task_id=...)` instruction line are unchanged, so the parent wake contract and the
current notification tests stay valid.

**Ordering.** The current task is persisted before the notification is built, so a task always
appears in its own completion notification. If its persistence failed, it is still listed, marked
`[unrecoverable]`.

### 5.5 Configuration

New block under `background_task` (`config/schema/background-task.ts`):

```jsonc
"background_task": {
  "resultPersistence": {
    "enabled": true,                                  // default true
    "root": null,                                     // default <omoDataDir>/delegations
    "retentionMs": 604800000,                         // 7 days, min 3 600 000
    "completedSessionRetentionMs": 86400000,          // 24 hours, min 60 000
    "maxTranscriptBytes": 20971520                    // 20 MB, min 1 048 576
  }
}
```

`taskCleanupDelayMs` keeps its meaning (eviction from memory) and is documented as no longer
controlling session deletion. With `resultPersistence.enabled: false` the plugin falls back to the
legacy behaviour: the session is deleted at `taskCleanupDelayMs` and no record is written.
## 6. Module map

**New — `packages/omo-opencode/src/features/background-agent/persistence/`**

| File | Purpose |
|------|---------|
| `paths.ts` | Root resolution, project hash, path building |
| `record.ts` | `PersistedTaskRecord` type, (de)serialization, `toBackgroundTask` |
| `store.ts` | `writeTaskRecord`, `readTaskRecord`, `writeTaskTranscript`, `readTaskTranscript`, `listTaskRecords`, `deleteTaskRecord`, `sweepExpiredRecords` |
| `config.ts` | Resolved persistence config with defaults |
| `result-text.ts` | Shared extraction of the final result text from a transcript |

**New — shared**

| File | Purpose |
|------|---------|
| `shared/background-output-message.ts` | One canonical `BackgroundOutputMessage`. The type is currently duplicated with two different shapes in `tools/background-task/clients.ts` and `tools/background-task/types.ts`; both re-export the shared one |

**Modified**

| File | Change |
|------|--------|
| `features/background-agent/manager.ts` | `finalizeTerminalTask`, `scheduleSessionDeletion`, `reconcilePersistedTasks`, disk fallback in `getTask`, ledger-aware notification, session deletion removed from `scheduleTaskRemoval` |
| `features/background-agent/background-task-notification-template.ts` | Known-tasks line, recoverable markers, optional inputs |
| `features/background-agent/types.ts` | `BackgroundTask.persisted?: boolean` |
| `features/background-agent/constants.ts` | Default retention values |
| `tools/background-task/task-result-format.ts` | Persisted-result fallback |
| `tools/background-task/full-session-format.ts` | Persisted-transcript fallback |
| `tools/background-task/create-background-output.ts` | Record lookup, lazy backfill, reworded not-found message |
| `tools/background-task/clients.ts` | `BackgroundOutputManager` gains an **optional** `getPersistedTaskRecord`, so the mock managers in the existing tool tests keep compiling |
| `config/schema/background-task.ts` | `resultPersistence` block |
| `shared/data-path.ts` | `getOmoDataDir()` |

**Docs**

| File | Change |
|------|--------|
| `docs/reference/configuration.md` | The new config keys |
| `docs/reference/features.md` | Durable background task results |
| `docs/AGENTS.md` | Register `docs/superpowers/specs/` |
| `features/background-agent/AGENTS.md` | The new `persistence/` subtree |
| `tools/background-task/AGENTS.md` | The disk fallback behaviour |
| `changes.md`, `CHANGELOG.md` | 0.1.10 release notes |

## 7. Invariants

1. A terminal task's record is written **before** the completion notification is built.
2. A record's `result` is the same text the live path extracts from the same messages, and the
   persisted path renders it with the same formatter — so the first `background_output` read
   returns the same document whether the session is alive or not.
3. The child session is never deleted before `deleteAfter`, and never deleted earlier than
   `completedSessionRetentionMs` after completion — regardless of what `taskCleanupDelayMs` is.
4. A failed persistence write never breaks the completion path: the notification still goes out
   and the task is reported as `[unrecoverable]`.
5. A corrupt or missing record never throws into the tool layer; it degrades to "not found".
6. The number of tasks in the "ALL BACKGROUND TASKS COMPLETE" body equals the number of terminal
   tasks known for that parent (memory + disk), regardless of when each task was evicted.

## 8. Test plan

**Unit — `features/background-agent/persistence/store.test.ts`**

- The project hash is deterministic, case-insensitive on Windows, and contains no separators.
- Write → read round trip; the record survives as valid JSON; no `.tmp` file is left behind.
- A corrupt file, a file with a foreign `schemaVersion`, and a missing file all read as
  `undefined` without throwing.
- `listTaskRecords` returns only the records of the requested parent.
- `sweepExpiredRecords` deletes expired records and keeps the rest.
- A transcript above `maxTranscriptBytes` is truncated and flagged; the truncated transcript lives
  in the sidecar file while the record stays small.

**Manager — `features/background-agent/manager.persistence.test.ts`**

- A terminal task writes a record; `getTask` returns it after `this.tasks`, the archive, and the
  global registry are cleared.
- `scheduleTaskRemoval` evicts from memory **without** deleting the child session.
- The session-deletion timer fires at the retention delay and calls `client.session.delete`.
- The session-deletion timer still fires after the task has been evicted from `this.tasks`.
- A failed persistence write is logged, does not throw, and the task is reported as not
  recoverable.
- `reconcilePersistedTasks` deletes expired records, deletes overdue sessions, and re-arms future
  timers.

**Tool — `tools/background-task/background-output-persisted.test.ts`**

- `background_output` with `client.session.messages` rejecting returns the persisted result plus
  the recovery note.
- `full_session=true` with the session gone renders the persisted transcript.
- `block=true` on a persisted terminal task returns immediately.
- With a live session, the cursor behaviour is unchanged (no regression).

**Notification — extend `features/background-agent/background-task-notification-template.test.ts`**

- The known-tasks line and the recoverable / unrecoverable markers.
- Two tasks where one was evicted from memory before the other completed: both are listed, the
  evicted one is `[recoverable]`.
- A failed persistence write yields `[unrecoverable]`.

**Existing suites — update, do not delete**

- `task-completion-cleanup.test.ts` asserts on the cleanup timer; the session deletion moves to its
  own timer, so the assertions are updated to the new split while keeping their intent.
- `manager.test.ts` and `task-poller.test.ts` must stay green unchanged.

## 9. Manual QA (real surface)

1. Launch two background tasks from a live parent session. Wait past `taskCleanupDelayMs`. Call
   `background_output(task_id)` for both → both return their output.
2. Restart the OpenCode process. Call `background_output(task_id)` again → the output is still
   returned (this is the reported bug, reproduced and fixed).
3. Delete the child session (or wait for the retention window) and call
   `background_output(task_id, full_session=true)` → the transcript is rendered from the persisted
   copy.
4. Inspect `<omoDataDir>/delegations/<projectHash>/<taskId>.json` → the schema matches §5.1, the
   file mode is `0600`, and `result` holds the final output. The transcript sits in the sidecar
   file next to it.
5. Notification: two tasks, one evicted before the other completes → the parent wake carries both
   task IDs and the recoverable markers.
6. `background_output` for an unknown ID → the not-found message names the store, the retention
   window, and the project scoping.

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Disk growth from transcripts | 20 MB cap per task, 7-day retention, hourly sweep, configurable root and caps |
| Transcripts can contain secrets or tool output | File mode `0600`, directories `0700`, no prompt persisted, retention bounded, config to disable |
| `client.session.delete` may not exist in the OpenCode 2 contract | The session is not deleted; the output stays durable and the sweep retries. The plugin already guards the call with a `typeof === "function"` check |
| 24-hour session retention increases OpenCode's own session storage | Configurable; the session is still deleted on schedule, just later than before |
| A crash before the terminal write loses the output | Accepted: the ledger is terminal-only by decision. A future launch-time record would close this, at the cost of reconciling orphaned `running` records |
| Cross-worktree lookups fail | Records are scoped to the launch directory by design; the not-found message states this |
| The pinned SDK still lacks `session.list` | Out of scope; the not-found message stops advertising `session_read` as the primary path |
| The store root is not writable (sandboxed environment) | The write failure is logged, the task is reported as `[unrecoverable]`, and the plugin keeps working with the legacy session lifetime |

## 11. Rollout

- Ship as **0.1.10** (patch). New config keys default to the durable behaviour; users can restore
  the legacy behaviour with `background_task.resultPersistence.enabled: false`.
- `taskCleanupDelayMs` keeps its key and its memory-cleanup meaning; the change of meaning for
  session deletion is documented in `docs/reference/configuration.md`.
- CI on Ubuntu is the gate. The local Windows `src/index.telemetry.test.ts` timing failure is
  pre-existing and unrelated.

## 12. Open items

None. The path layout, content, retention, and notification semantics were decided with the
requester; the SDK upgrade is explicitly a separate task.