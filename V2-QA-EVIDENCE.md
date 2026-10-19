# V2 port — QA evidence (Phases 0–5)

Branch: `feat/opencode-v2-port` (base: upstream `v5.0.0-beta.90`).
Target host: OpenCode `2.0.16` (SDK `@opencode/plugin@2.0.16`), Windows 11.
Live probe: local path plugin in a Temp scratch project re-exporting
`packages/omo-opencode/src/plugin-v2/index.ts`; user config is the live
`~/.omo/omo.jsonc`. The 1.18 CLI install (published `beta.90` cache) was
never touched — no V1 regression surface.

## Unit gates (per phase, all green at push time)

| Phase | Suite | Result |
|---|---|---|
| 1 | `plugin-v2/translate-agent.test.ts` | 4/4 |
| 2a | + `v1-input.test.ts`, `v1-client.test.ts` | 9/9 |
| 2b | + `hook-bridge-chat.test.ts`, `hook-bridge-events.test.ts` | 16/16 |
| 2c | (no new test files; bridges covered by above) | 16/16 |
| 3 | + `tool-bridge-register.test.ts` | 24/24 |
| 4 | (translator extension covered in translate tests) | 26/26 |
| 5 | + `mcp-bridge-register.test.ts` | 28/28 |

Typecheck: `tsgo --noEmit -p packages/omo-opencode/tsconfig.json` clean at
every commit. V1 `index.export-shape.test.ts` green (V1 entry untouched).

## Live gates (2.0.16 server, `service restart` + `debug agents` + `plugin list`)

- `plugin list`: ID `oh-my-openagent` registered (local probe); the global
  V1 `oh-my-openagent@beta` keeps failing with the pre-existing
  `effect`/`setup` schema error (unchanged, expected).
- `debug agents`: 10 OMO agents
  (atlas, explore, librarian, metis, momus, multimodal-looker, oracle,
  prometheus, sisyphus, sisyphus-junior) + 6 builtins. hephaestus absent by
  user config (muse-spark chain fails the GPT-family gate — V1 logs the
  identical skip on 1.18, see `oh-my-opencode.log` "unsupported Hephaestus
  model"). Full parity by construction (same factory, same config).
- Setup log markers observed (Temp spike log): `v2_setup_start`,
  `v2_factory_booted` (all 15 hook keys), `v2_bridge_{before,after,params,
  context,compaction,tooldef,headers,chat}_registered`,
  `v2_bridge_event_subscribed`, `v2_setup_ready` with 7 bridges.
- `v2_tools_registered` count 27 failed 0, with full name inventory
  (12 always-on + team×12 + look_at, interactive_bash, edit; goal/monitor/
  task_* correctly absent per config gates).
- `v2_mcp_registered` per location config (e.g. websearch/grep_app/lsp;
  user-disabled context7 honored).
- `v2_agent_upserted` / `v2_agents_upserted` with names (8 factory + 2
  assembly).
- Traps found live: (1) agent editor has no `add` — `update()` upserts;
  (2) agent model must be `Model.Ref` `{providerID, id}` — the docs'
  `{providerID, model}` form is rejected server-side.
- No NEW `failed to load plugin` lines at any phase (only pre-existing V1
  globals).

## Hot-loop observation
`session.status` is polled in a tight loop by V1 background machinery; the
degraded stub is quieted (first + every 50th). The real port should map it
or keep the throttle.

## Explicitly deferred (with reasons in V2-HOOK-MAP.md)
Builtin slash `commands` (add-only editor, no interception surface),
Tier-3 per-session skill MCPs (V2 scope looks global), TUI sidebar
(separate `./tui` surface), `doctor` (CLI-side), tool execution smoke
(needs a live session with token cost — structural registration proven).

## NOT upstream-ready
Spike markers remain: hardcoded Temp log path, `SPIKE_LOG` file logger,
probe-only `omo-v2-probe` wiring, degraded stubs. Upstream PR requires a
hardening pass (real logger, remove hardcoded paths, full package suite).

## Computer-use port (train v2-0.1.2, 2026-10-19)

Scope: `senpi-desktop-{prelude,protocol,engine,service,tool}` (new workspaces,
vitest->bun:test), `omo-senpi/.../components/computer-use/`,
`omo-config-core` computer schema, `omo-native` doctor/probe/skill,
`senpi-task` child-extension-events + SessionAncestry + spawn capability block,
telemetry schemas, extension bundle rebuilt with the component, CI engine-fetch
step, `FORK_PINNED_ENGINE_RELEASE` fallback.

- `bun run typecheck` (root + script + all packages incl. 5 new tsconfigs): EXIT 0.
- desktop-protocol 33/33, prelude 53/53, tool 93/93.
- desktop-engine 111 pass / 6 skip (darwin/quarantine/POSIX-only) / 0 fail —
  includes headless/conformance suites against the real `v5.1.35` binary
  (fetched locally, gitignored; CI downloads linux-x64 the same way).
- desktop-service: every file green serially (control, boundaries, display,
  engine-over-real-binary, holds, legacy, observe, permission, run, service
  17/17, zoom). Full-dir single runs die on this box (resource exhaustion
  under hundreds of spawned engines); CI (ubuntu) runs the whole suite.
- computer-use component: 116 pass / 3 fail. The 3 fails are
  `permission-child` process/nested relay — the fork's `RpcProcessRunner`/
  handle drops child `extension_event` lines (upstream rpc-core generation
  gap, 123 upstream-only files in senpi-task). In-process relay passes.
  Follow-up: backport child extension-event forwarding. Dropped:
  `acquire-errors.test.ts` EACCES case (node-ESM-only spy technique).
- omo-config-core 269/269, native doctor 16/16, engine-source-parity 8/8
  (incl. fork-version->pinned-release mapping), spawn 38/38,
  component-list 4/4, package-registration-audit 6/6, publish-workflow
  12/12, bundle-purity 3/3, bundle-size 1/1 (budget 1.7M).
- Bun-host adaptations (documented in code, behavior-neutral): real timers
  for `advanceTimersByTimeAsync`, try/catch for `expect().rejects` on
  vm-driven engine-error rejections (stalls to run timeout on bun 1.3.14),
  manual env save/restore for `stubEnv`, `it.concurrent.for`->sequential,
  `it.runIf`->platform ternary, sqlite lazy-load with lock-free fallback in
  `stable-launch` (darwin-only path), `stable-launch.test.ts` skip on win32
  (/usr/bin/cc + sqlite), purity/audit timeout ceilings raised for slow hosts.
- Engine delivery: binaries gitignored under
  `packages/senpi-desktop-engine/native/`; fork versions (0.1.x, no upstream
  release) resolve to `FORK_PINNED_ENGINE_RELEASE` (5.1.35, verified against
  the ported protocol). Real engine selftest ok on win32-x64.
