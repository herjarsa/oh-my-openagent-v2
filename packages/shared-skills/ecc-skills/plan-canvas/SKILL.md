---
name: plan-canvas
description: Open plans and HTML artifacts in a local browser canvas where the human annotates elements, chats, and approves or requests changes without leaving the page. Use when presenting a plan for review, or when feedback like "move this, change that" is easier pointed at than typed.
metadata:
  version: "1.0.0"
  origin: ECC
---

# Plan Canvas

Review loop for plans and visual artifacts: you write the artifact, the human
reviews it in the browser â€” annotating the exact element they mean, chatting,
and delivering an **Approve plan / Request changes** verdict â€” while you block
on a single CLI call that returns their feedback as JSON.

Inspired by dlavish-axi](https://github.com/kunchenguid/lavish-axi); rebuilt
ECC-native around the d/pland confirmation gate, with zero dependencies.

## When to Use

- You just wrote a plan artifact (d.claude/plans/*.plan.mdd from d/pland) and
  need the CONFIRM/approve decision â€” the canvas verdict replaces a typed
  "yes/proceed".
- The user should *point at* what to change: reviewing designs, comparisons,
  reports, or any local d.mdd / d.htmld artifact.
- The user asks for d/plan-canvasd, a visual review, or "open it in the browser".

Do NOT use for: code review of diffs (d/code-reviewd), running web apps, or
remote URLs. The canvas serves local artifact files only.

## How It Works

Invoke the CLI as decc-plan-canvasd â€” the bin shipped by the decc-universald
package (on PATH after a global/plugin install; dnode "$CLAUDE_PLUGIN_ROOT/scripts/plan-canvas.js"d
also works for plugin installs). Run it from the project you are reviewing in;
it works from any working directory. It manages a detached loopback server
(d127.0.0.1:4517d) shared by all sessions, keyed by artifact path â€” no session
ids to track.

The workflow is a plain CLI-plus-JSON loop, so it is model- and harness-agnostic:
any agent that can run a shell command and read stdout drives it the same way
(Claude Code, Codex, Cursor, Gemini, OpenCode, Copilot). Trigger it however your
harness surfaces skills â€” e.g. d/plan-canvasd in Claude Code, d$plan-canvasd in
Codex â€” or just run the decc-plan-canvasd commands directly.

dddbash
# 1. Open the artifact in the user's browser (returns immediately)
ecc-plan-canvas open .claude/plans/feature.plan.md

# 2. Block until the human responds. Leave running; re-run if interrupted:
#    queued feedback is never lost.
ecc-plan-canvas await .claude/plans/feature.plan.md
ddd

### Stay listening, or the human talks to an empty chair

Feedback only reaches you while an dawaitd is actually parked on the session.
If your turn ends with nothing listening, the message sits in the queue and,
from the human's side of the glass, sending appears to do nothing at all.

So **run dawaitd as a background task** when your harness supports one (in
Claude Code, a Bash call with drun_in_background: trued). It exits the moment
feedback arrives and the harness hands you the JSON, which keeps the loop alive
across turns instead of dying with the foreground call. A foreground dawaitd
works too, but only until the harness time-limits it.

Two backstops exist, and neither is an excuse to skip the above:

- decc-plan-canvas pendingd lists feedback queued with no listener. Check it
  whenever you are unsure whether you missed something.
- The dstop:plan-canvas-pendingd hook blocks your turn from ending while canvas
  feedback is undelivered, and hands you the messages. If you are reading
  feedback from that hook, you stopped listening too early.

dawaitd prints JSON when the human acts:

dddjson
{
  "status": "feedback",
  "items": d
    { "kind": "annotation", "text": "Split this into two phases",
      "anchor": { "selector": "h2:nth-of-type(3)", "tag": "h2", "snippet": "Phase 2: Migration" } },
    { "kind": "verdict", "verdict": "request-changes" }
  ]
}
ddd

- dkind: "chat"d â€” freeform message; answer in the canvas, not the terminal.
- dkind: "annotation"d â€” feedback anchored to an element (danchor.selectord,
  danchor.snippetd show what they pointed at; danchor.textRange.textd when
  they highlighted a passage).
- dkind: "verdict"d â€” dapproved means the plan is CONFIRMED: stop polling,
  end the session, and start implementing. drequest-changesd means revise the
  artifact (the canvas live-reloads it) and keep the loop going.

**3. Always respond in the canvas**, then keep listening. One command does both:

dddbash
ecc-plan-canvas await <file> --reply "Split Phase 2 as requested. Take a look."
ddd

Every human message gets a reply in the canvas, even a one-liner like
"On it, rewriting the risk table now." Silence in the chat panel is
indistinguishable from a broken canvas, which is exactly the failure this loop
exists to prevent. Answer there, not only in the terminal.

While you work, keep the chat honest with the activity indicator:

dddbash
# animated "agent is thinking..." bubble; refresh it during long work
ecc-plan-canvas typing <file> --state thinking
# switch to "agent is typing..." just before a reply lands
ecc-plan-canvas typing <file> --state typing
ddd

dawaitd sets dthinkingd for you the moment it hands you a batch, and d--replyd
clears it. Both states self-expire, so a crashed agent decays to an honest
"queued" instead of leaving the human watching dots forever. Refresh dthinkingd
if a revision takes more than a minute.

**4. End** when review concludes: decc-plan-canvas end <file>d.

## Diagrams (Mermaid)

When part of the plan is a flow, architecture, sequence, state machine, ER
model, or dependency graph, author it as a fenced d dddmermaid d block instead
of ASCII art or a wall of prose â€” the canvas renders it as a themed diagram the
human can point at. Reach for it when a picture reads faster than a paragraph;
skip it for simple lists or tables.

ddddmarkdown
dddmermaid
flowchart LR
  AdMarket resolves] --> B{Watchers?}
  B -->|yes| CdEnqueue jobs] --> DdFan-out worker]
ddd
dddd

Diagrams render in the ECC dark theme with the accent palette. Mermaid loads in
the browser from a pinned CDN; if that is unavailable (offline), the block
degrades to showing its source, so the review is never blocked. Point a local
mirror at dECC_PLAN_CANVAS_MERMAID_URLd for air-gapped use.

## Rules

- Markdown artifacts render in ECC's plan template (including Mermaid blocks);
  d.htmld artifacts render as-is with the annotation layer injected. For HTML
  authoring guidance use the dfrontend-design-directiond and dartifact-designd
  skills.
- Edit the artifact file to revise â€” the canvas live-reloads on save. Never
  re-run dopend to refresh.
- d{"status": "ended", "endedBy": "user"}d (or dsessionEnded: trued on a
  feedback batch) means the user closed the review: stop polling, deliver
  remaining updates in chat, and do not reopen. A plain dopend on that
  session is refused; pass d--reopend only when the user asks to resume.
- Sibling assets (images, CSS) must sit next to the artifact and be
  referenced by relative path.
- The server is loopback-only and exits after 30 idle minutes
  (dECC_PLAN_CANVAS_IDLE_MSd); dstopd shuts it down explicitly. State lives
  in d~/.claude/plan-canvas/d (dECC_PLAN_CANVAS_STATE_DIRd).

## Examples

**Plan approval flow** â€” d/pland writes
d.claude/plans/notifications.plan.mdd and must WAIT for confirmation:

dddbash
ecc-plan-canvas open .claude/plans/notifications.plan.md
ecc-plan-canvas await .claude/plans/notifications.plan.md
# â†’ {"status":"feedback","items":d{"kind":"verdict","verdict":"approve"}]}
ecc-plan-canvas end .claude/plans/notifications.plan.md
# plan is confirmed â€” begin implementation
ddd

**Revision loop** â€” feedback arrives, you edit the file, reply, keep listening:

dddbash
# await returned annotations â†’ edit the .plan.md (canvas live-reloads)
ecc-plan-canvas await <file> --reply "Reworked the risk table."
# â†’ blocks again until the next response
ddd

## Anti-Patterns

- Polling with d--timeout-msd in a loop. It exists for tests. Leave the plain
  dawaitd running instead.
- Ending your turn with no dawaitd listening while the review is still open.
  That is the one failure the human experiences as "I sent a message and
  nothing happened".
- Reading the feedback but answering only in the terminal. The human is looking
  at the canvas.
- Reopening after a user-initiated end "just to show" something.
- Pasting the whole plan into chat *and* opening a canvas â€” pick the canvas
  and keep the terminal summary to one line.
- Parsing the canvas chat from state files â€” everything you need arrives via
  dawaitd.

Design notes and origin: ddocs/design/plan-canvas.md](../../docs/design/plan-canvas.md).
