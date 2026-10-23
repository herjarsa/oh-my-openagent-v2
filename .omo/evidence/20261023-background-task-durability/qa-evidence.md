# QA evidence: durable background task results (2026-10-23)

Branch: `fix/background-task-durability`. Reported bug: `background_output("bg_edd4d92f")`
answered `Task not found` after the child session was gone, while `bg_b31f123a` worked
only while its session lived.

## Expected impact and change scope

- `background_output` and `background_output(full_session=true)` now serve terminal task
  results from the durable store after the child session is deleted or the plugin
  restarts, and say where the output came from.
- The child session is kept 24h (`completedSessionRetentionMs`) instead of dying with
  the 10-minute memory cleanup; records live 7 days (`retentionMs`).
- The completion notification counts every launched task (`**Known tasks:** N (X completed,
  Y recoverable, Z in progress)`) with `[recoverable]` / `[unrecoverable]` markers.
- `background_task.resultPersistence` configures the store; `enabled: false` restores
  the old behaviour. `background_cancel` and the launch path are unchanged.

## How this was verified (no live LLM available in this environment)

The opencode QA skill (`opencode run`, `serve` + fake-LLM) was mapped first: `serve` in
installed opencode v2.1.4 no longer serves `/doc` or the v1 session routes the skill
scripts expect (both return the web app), and the skill''s Responses-API fake gets
ECONNRESET with no request logged, so a live-LLM run is not reproducible here. The
real-model fallback also fails in a sandbox (`provider.no-route` for deepseek with a
copied auth.json). Instead `qa-durability.ts` (bun, in this dir) drives the real
production code with an isolated store (`OMO_RESULT_PERSISTENCE_ROOT` under `%TEMP%`):

- writes two terminal records + transcripts with the real `record-store` /
  `transcript-store` writers (atomic write, mode 0600 requested);
- simulates the restart by reading only from disk (`readTaskRecord` /
  `readTaskTranscript`, the same fallback `BackgroundManager.getTask` uses);
- calls the real `createBackgroundOutput` tool with a session-gone client;
- asserts the user-visible artefacts.

## Results (`qa-run.log`, 12/12 PASS)

- `store.write` / `store.lists-both` / `store.roundtrip`: both records persist and
  read back with the final result text.
- `store.retention-order`: `deleteAfter < expiresAt`.
- `store.transcript`: sidecar transcript present per record.
- `store.mode`: Windows reports mode 666 (ACL-mapped); POSIX 0600 is requested by
  `writeTaskRecord` (`RECORD_FILE_MODE = 0o600`) and covered by unit tests.
- `store.result-holds-answer`: both stored results hold their `CHILD_ANSWER_*`.
- `readback.one` / `readback.two` (the reported bug): after the simulated restart,
  `background_output(task_id)` returns the stored answer plus
  `Source: persisted result (the child session is gone)`.
- `fullsession.persisted`: `background_output(task_id, full_session=true)` renders the
  stored transcript plus `Source: persisted transcript (the child session is gone)`.
- `notfound.names-store`: unknown `bg_` id names the `delegations` store and the
  `retentionMs` window instead of a bare `Task not found`.
- `live.cursor-unchanged`: a live session still serves the live answer with no
  recovery note (no cursor regression).
- `notification.known-tasks`: the completion text carries
  `**Known tasks:** 2 (2 completed, 2 recoverable)`.

## Artefacts in this dir

- `qa-durability.ts`: the QA script (rerunnable: `bun qa-durability.ts`).
- `qa-run.log`: full transcript of the passing run.
- `store-record-sample.json` / `store-transcript-sample.json`: on-disk record and
  transcript from the run (schema v1, no secrets).
- `fake-llm.log`, `serve.stdout.log`, `serve.stderr.log`: leftovers of the abandoned
  live-LLM attempt (documents why CLI QA was not reproducible here).

## Full-gate results (2026-10-23, Windows)

- `bun run typecheck`: clean (exit 0).
- `bun run build:schema`: clean, no diff.
- `bun test packages/omo-opencode/src/`: 8667 pass / 24 fail. Of the 24:
  - 2 were time bombs in the new `manager.persistence.test.ts` retention tests
    (fixed fixture `completedAt: 2026-10-22T10:05Z` + 24h retention expired at run
    time). Fixed the same day by using dates relative to `Date.now()`; the area
    suite is now 852/852 (background-agent + background-task tools).
  - 1 `TimeoutOverflowWarning` from the new reconcile-on-construct path when a
    test mocks `Date.now()` to ~100s and the shared hermetic store holds real-ms
    records. Fixed the same day by clamping the session-deletion timer to the
    32-bit `setTimeout` range in `armSessionDeletionTimer` (production delays are
    at most 24h, behaviour unchanged).
  - The remaining 22 (posthog/telemetry capture, tmux config, bun-spawn-shim
    stdin, spawnWithTimeout, sweepWorktrees, findProjectRoot, index.telemetry
    timing and others listed in the full log) fail identically in isolation,
    do not import any changed module, and match the plan's known pre-existing
    Windows failures; the Ubuntu CI gate in `publish-fork.yml` (typecheck +
    both test shards + build) is the arbiter.