# OpenCode V2 port — plan (`feat/opencode-v2-port`)

Base: upstream `v5.0.0-beta.90` (`05dcba64b`). Pinned on purpose — do NOT chase
every beta. Rebase monthly or on demand only.

Target runtime: OpenCode `2.0.16` (SDK `@opencode/plugin@2.0.16`).
Pattern: dual-export like `@herjarsa/omo-meta-governor@0.50.1`
(`default = { id, setup, server }`) so one build loads on V1 (1.18.x) and V2.

## V2 API shape (verified against `@opencode/plugin@2.0.16` tarball)

- `Plugin.define({ id: string, setup: (ctx: Context) => Cleanup | void })`.
- No Hooks-object return. Everything registers inside `setup()` via domains:
  `agent, command, event, integration, mcp, model, permission, provider,
  reference, rpc, session, shell, skill, storage, tool, vcs, websearch,
  worktree` (+ `app/location/options/generate/experimental`).
- TUI config moved (`tui.json(c)` → `cli.json`); server API contracts changed
  (`ctx.client.session.messages()` → `ctx.session.context()` style).

## Phases

### Phase 0 — scaffold (this file + FORK-NOTICE.md) + recon matrix
Build the V1-hook → V2-domain mapping table first. Inputs:
- V1 surface: `packages/omo-opencode/src/plugin-interface.ts` (12 handlers),
  `src/testing/create-plugin-module.ts` (+2), `src/create-hooks.ts` (5 tiers),
  `src/plugin/tool-registry.ts`, `src/agents/`.
- V2 surface: `dist/promise/{tool,event,session,agent,command,skill}.d.ts`
  in `@opencode/plugin@2.0.16`.
- Reference implementation: `omo-meta-governor@0.50.1` `dist/v2/`.
Gate: mapping table complete, every V1 hook has a V2 target or an explicit
`WONT-PORT` + reason. No code before this is done.

### Phase 1 — module shape + dual export
- Add `@opencode/plugin@2.0.16` dep (adapter scope only).
- New `src/plugin-v2/` entry: `Plugin.define({ id, setup })`; keep
  `src/index.ts` V1 default export untouched.
- `setup()` boots the existing staged init (`createPluginModule()` internals)
  and registerscorresponding domains. V1 `server()` path must keep working.
Gate: `plugin list` on 2.0.16 shows registered ID; `agent list` on 1.18.32
still shows Sisyphus (no V1 regression).

### Phase 2 — hooks (61 dirs, biggest phase)
Port tier by tier: Session → ToolGuard → Transform → Continuation → Skill.
Each hook: V1 `(input, output)` → V2 `(event)` mutable draft or domain hook.
Gate per tier: focused `bun test` green + no new `failed to load plugin` lines
in the v2 server log.

### Phase 3 — tools (15 dirs, 12–38 defs) + skill-embedded MCPs
`ToolDefinition` → `ctx.tool` registration. Tier-1 built-in MCPs (`lsp` stdio
+ 3 remote) → `ctx.mcp`. Gate: tool smoke via `opencode run` on v2.

### Phase 4 — agents (11) + categories + config plumbing
Agent factories → `ctx.agent`; `omo.jsonc` chain untouched (shared surface).
Gate: `agent list` on v2 shows Sisyphus + co; doctor overrides > 0.

### Phase 5 — TUI/sidebar, openclaw, team-mode tmux, doctor checks
Port or explicitly defer each. Gate: full `doctor` green on v2.

### Phase 6 — QA + PR upstream
Real-surface QA per repo rule (isolated XDG sandbox, evidence under
`.omo/evidence/`). Then offer PR to upstream from this branch (zero extra
cost if ignored).

## Out of scope for this branch
- Chasing upstream betas (pinned at beta.90).
- `opencode-omniroute-plugin` / `envsitter-guard` V2 ports (separate forks;
  audit provider dependence first — primary chains are `opencode-go`/`opencode`).
- Cherry-picking the 22 archived May commits (evaluate after Phase 1; the
  team-mode relaunch fix is confirmed absent upstream).

## Upstream divergence on V2 (surveyed 2026-10-19, base pinned beta.90)

- Upstream #10439 ("load on OpenCode 2", merged 2026-10-18) is NOT a
  real port: it registers an empty plugin on the V2 host and toasts a
  notice redirecting to OmO Native ("agents, tools and hooks are not
  active here"). This fork's `plugin-v2/*` bridge IS the real
  implementation (tools + hooks live on host 2.0.x, see V2-QA-EVIDENCE).
  We lead upstream here — nothing to backport.
- Computer-use: PORTED (train v2-0.1.2, base pinned beta.90 + upstream dev
  ~2026-10-19 for this feature only). `packages/senpi-desktop-{prelude,
  protocol,engine,service,tool}` (new workspaces, vitest->bun:test),
  `omo-senpi/.../components/computer-use/` (~20 tests), `omo-config-core`
  computer schema, `omo-native` doctor/probe/skill, `senpi-task`
  child-extension-events + SessionAncestry. Typecheck green; desktop +
  component suites green except 3 `permission-child` process-relay tests
  (see gap). Engine binary NOT committed, except the linux-x64 test binary
  vendored in-repo (`native/prebuilds/linux-x64/`, force-added, sha256-verified
  against the 5.1.38 release checksums): GitHub's release-asset CDN 404s
  sustainedly from Actions egress while working elsewhere, so CI cannot fetch
  it. Other platforms: fetched at install/test time from upstream releases
  (`native/` is gitignored); fork versions resolve to the pinned upstream release
  (`FORK_PINNED_ENGINE_RELEASE`) since tags `v2-*` publish npm only.
  Upstream #10439 (empty plugin + Native toast) still not backported.
- Gap (follow-up): cross-process permission relay needs the upstream
  rpc-process generation (child `extension_event` forwarding in
  `rpc-process/handle` + manager wiring to `pi.events`). The fork's
  `RpcProcessRunner`/`handle` drops child `extension_event` lines, so
  process/nested `permission-child` relay tests get zero events while
  in-process relay passes. Requires backporting `senpi-task` rpc core
  (a generation ahead: 123 upstream-only files) - deliberately out of
  this release to protect the stable train. Also dropped:
  `acquire-errors.test.ts` EACCES case (node-ESM-only `vi.spyOn(fs)`
  technique; bun:test needs `mock.module`, behavior covered by sibling
  acquire tests).
- Watchlist (backport on symptoms only, not proactively): `rpc-seam`
  session fixes, atlas retry-runaway guard, senpi runtime bumps, bun
  1.4.3 (repo tests pin 1.4.2; CI green).
