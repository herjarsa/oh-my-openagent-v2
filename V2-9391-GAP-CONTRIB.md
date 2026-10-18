# Contribution to #9391 known-limits — two V2 GAP findings (traced on host 2.0.16 / SDK 2.0.16, running 2.0.22)

Per maintainer direction on #9389 (Oct 12, 2026): rather than opening another
PR, these two GAP findings belong in the #9391 scaffold PR's known-limits
list. Paste-ready text for #9391 follows. No code change, no V1 behaviour
change. Source of truth for our rows: `V2-HOOK-MAP.md` rows 11 (`command.execute.before`)
and 13 (`experimental.compaction.autocontinue`) on branch `contrib/v2-bridge-9389`.

## Proposed refinement of #9391 items 2 and 6

#9391 PR description item 2 currently reads (paraphrased): "`command.execute.before`
— mapped to `ctx.shell.hook("create.before")`; pre-execution veto semantics
differ slightly."

Our host-traced finding (SDK `@opencode/plugin@2.0.16`, `dist/promise/*.d.ts`;
verified loading on 2.0.16 server, currently running 2.0.22) is stricter:

> `command.execute.before` (slash interception) — GAP. No V2 hook surface
> found on 2.0.16: `CommandEditor` exposes `add` only. OMO's own commands can
> re-register via `editor.add` with a wrapped `execute`, but interception of
> *foreign* commands is likely impossible → defer or WONT-PORT per command.
> If `ctx.shell.hook("create.before")` exists on 2.0.20, it still does not
> restore pre-execution veto semantics — keep this row as a known limit, not
> as a mapped row.

#9391 PR description item 6 currently reads (paraphrased):
"`experimental.session.compacting` — mapped to `ctx.session.hook("compaction")`;
autocontinue flag not exposed."

Our finding agrees on the verdict and adds the design surface:

> `experimental.compaction.autocontinue` — GAP. No V2 equivalent found on
> 2.0.16. Auto-resume after compaction needs a design (poll `session.wait`?
> event-watch?) or explicit deferral. The `compaction` hook itself maps
> (`output.context[]` → text SystemParts; `prompt` override has no V2 field →
> fold to system, best-effort, logged), but the autocontinue flag stays a
> known limit.

## Why keep them as limits, not mapped rows

- Veto vs. observe: `create.before`-style hooks observe creation; V1
  `command.execute.before` can veto/intercept execution. Reviewers and users
  should not expect interception of third-party slash commands on V2.
- Autocontinue is a behaviour (resume the agent after compaction), not just a
  hook mapping. Listing it as a limit prevents a silent behaviour drop for
  users who rely on it on V1.

## Host-version traces (so reviewers can re-verify)

- SDK pinned: `@opencode/plugin@2.0.16` (`V2-HOOK-MAP.md` header + `V2-PORT.md`).
  Target host 2.0.16, running 2.0.22. Re-verify `agent.d.ts` / `command.d.ts`
  on every SDK bump (V2 API churn note, `V2-HOOK-MAP.md` cross-cutting gap 6).
- Related empirical edges from the same bridge (same host family, offered as
  isolated fixes with tests, no port attached — see #9389 Oct 3 comment):
  - 2.0.19 rejects an object for prompt text — must be a flat string (`829854b63`).
  - V2 client may not expose `app.agents` — dispatch must tolerate absence (`42421e0e0`).
  - Agent names arrive config-keyed in some shapes, not display names (`95a83849b`).

## Suggested test shape on #9391 (no new rows needed)

#9391 already tracks 25 rows with pending `test.todo` entries. These two GAPs
map onto existing rows — no new rows required. Suggested row annotations:

- `test.todo("row: commands: foreign-command interception (GAP — add-only editor, no veto)")`
- `test.todo("row: compaction: autocontinue after compaction (GAP — no flag, needs design)")`

If #9391 prefers to keep its current row titles, appending `(known limit —
see #9389 herjarsa GAP findings, host 2.0.16)` to rows covering items 2 and 6
is sufficient.
