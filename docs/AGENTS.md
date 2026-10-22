# docs/ — User-Facing Documentation

**Generated:** 2026-08-24 / f3642fcda

## OVERVIEW

31 tracked Markdown files across 7 subdirectories (guide 7, reference 18, examples 3 JSONC, legal 2, templates 1, troubleshooting 1, superpowers/specs 1) + root files. Categorized by audience: user-facing guides + reference, troubleshooting, legal. The web site at packages/web/ consumes some of these (via `web-deploy.yml` triggers).

## WHERE TO LOOK

| Audience / Task | Location |
|------|----------|
| New users — what is this? | docs/guide/overview.md |
| Installing the plugin | docs/guide/installation.md |
| Installing the compiled binary | docs/guide/binary-install.md |
| How agents collaborate | docs/guide/orchestration.md |
| Picking the right model per agent | docs/guide/agent-model-matching.md |
| Team Mode (opt-in multi-agent) | docs/guide/team-mode.md |
| Temporary BTW side conversations | docs/guide/btw.md |
| Configuration field reference | docs/reference/configuration.md |
| Harness-neutral `omo.json` config reference | docs/reference/omo-json.md |
| Feature-by-feature reference | docs/reference/features.md |
| CLI command reference | docs/reference/cli.md |
| Known issues & workarounds | docs/reference/known-issues.md |
| `prompt_async_gate` deep-dive | docs/reference/prompt-async-gate-rfc.md |
| Dated design specs (internal, pre-implementation) | docs/superpowers/specs/ |
| Shared core multi-PR extraction QA | docs/reference/shared-core-multi-pr.md |
| Re-export shim inventory | docs/reference/re-export-shim-inventory.md |
| Release process | docs/reference/release-process.md |
| GitHub PR evidence attachments | docs/reference/github-attachment-upload.md |
| Rules-injector cross-module comparison | docs/reference/rules-injection-cross-module-comparison.md |
| mass-ULW dag protocol (events, catch-up, overflow) | docs/reference/mass-ulw-protocol.md |
| Monitor tool reference | docs/reference/monitor.md |
| Web-terminal visual QA helper | docs/reference/web-terminal-visual-qa.md |
| Sample configs | docs/examples/ (default, coding-focused, planning-focused) |
| Privacy & ToS | docs/legal/ |
| Manifesto | docs/manifesto.md |
| Refreshing the model-capabilities cache | docs/model-capabilities-maintenance.md |
| Ollama troubleshooting | docs/troubleshooting/ollama.md |
| Copyable project rules template | docs/templates/AGENTS.md.example |

## STRUCTURE

```
docs/
├── manifesto.md                              # The "why" — referenced from README
├── model-capabilities-maintenance.md         # How model-capabilities cache is refreshed
├── guide/                                    # User-facing tutorial-style guides (7 files)
├── reference/                                # API / config / CLI reference (18 files)
├── superpowers/specs/                        # Dated design specs (internal, pre-implementation)
├── examples/                                 # Sample JSONC configs (3 files)
├── legal/                                    # privacy-policy.md + terms-of-service.md
├── templates/
│   └── AGENTS.md.example                     # Copyable OMO project rules template
└── troubleshooting/
    └── ollama.md
```

## CONVENTIONS

- **User-facing language only in `guide/` and `reference/`.** No `OmO` internal jargon without explanation.
- **Path links** use the `file://` scheme so OpenCode renders them in TUI. Use absolute paths.
- **No HTML.** Markdown only. No `<details>` / `<summary>` (causes rendering issues in some terminals).
- **Code blocks** use language fences. Use `jsonc` for config snippets to preserve comments.
- **Visual QA evidence** must come from the real-pty + xterm.js flow (`script/qa/web-terminal-visual-qa.mjs`). NEVER use `tmux capture-pane` for color/visual/CJK evidence; tmux is boot-smoke only.
- **Docs touching `packages/web/` re-trigger the web CI** via `web-ci.yml`.

## ANTI-PATTERNS

- Never add a doc to `guide/` or `reference/` without a `WHERE TO LOOK` entry above.
- Never paste agent-facing system prompts here. Those live in `packages/omo-opencode/src/agents/` or `packages/skills-loader-core/src/features/builtin-skills/`.
- Never document changing config keys without also updating `packages/omo-opencode/src/config/schema/` and re-running `bun run build:schema`.
