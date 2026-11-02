---
name: prompt-optimizer
description: Analyze draft prompts, detect intent and missing context, match ECC commands, skills, and agents, and output a ready-to-paste optimized prompt with diagnosis and rationale â€” advisory only, never executes the task. Use when the user says 'optimize prompt', 'improve my prompt', 'rewrite this prompt', 'help me prompt', ä¼˜åŒ–prompt, æ”¹è¿›prompt, æ€Žä¹ˆå†™prompt, or å¸®æˆ‘ä¼˜åŒ–è¿™ä¸ªæŒ‡ä»¤; not for requests to optimize code or performance.
metadata:
  origin: community
  author: YannJY02
  version: "1.0.0"
---

# Prompt Optimizer

Analyze a draft prompt, critique it, match it to ECC ecosystem components,
and output a complete optimized prompt the user can paste and run.

## When to Use

- User says "optimize this prompt", "improve my prompt", "rewrite this prompt"
- User says "help me write a better prompt for..."
- User says "what's the best way to ask Claude Code to..."
- User says "ä¼˜åŒ–prompt", "æ”¹è¿›prompt", "æ€Žä¹ˆå†™prompt", "å¸®æˆ‘ä¼˜åŒ–è¿™ä¸ªæŒ‡ä»¤"
- User pastes a draft prompt and asks for feedback or enhancement
- User says "I don't know how to prompt for this"
- User says "how should I use ECC for..."
- User explicitly invokes `/prompt-optimize`

### Do Not Use When

- User wants the task done directly (just execute it)
- User says "ä¼˜åŒ–ä»£ç ", "ä¼˜åŒ–æ€§èƒ½", "optimize this code", "optimize performance" â€” these are refactoring tasks, not prompt optimization
- User is asking about ECC configuration (use `configure-ecc` instead)
- User wants a skill inventory (use `skill-stocktake` instead)
- User says "just do it" or "ç›´æŽ¥åš"

## How It Works

**Advisory only â€” do not execute the user's task.**

Do NOT write code, create files, run commands, or take any implementation
action. Your ONLY output is an analysis plus an optimized prompt.

If the user says "just do it", "ç›´æŽ¥åš", or "don't optimize, just execute",
do not switch into implementation mode inside this skill. Tell the user this
skill only produces optimized prompts, and instruct them to make a normal
task request if they want execution instead.

Run this 6-phase pipeline sequentially. Present results using the Output Format below.

### Analysis Pipeline

### Phase 0: Project Detection

Before analyzing the prompt, detect the current project context:

1. Check if a `CLAUDE.md` exists in the working directory â€” read it for project conventions
2. Detect tech stack from project files:
   - `package.json` â†’ Node.js / TypeScript / React / Next.js
   - `go.mod` â†’ Go
   - `pyproject.toml` / `requirements.txt` â†’ Python
   - `Cargo.toml` â†’ Rust
   - `build.gradle` / `pom.xml` â†’ Java / Kotlin (then check for `quarkus` in build file â†’ Quarkus, or `spring-boot` â†’ Spring Boot)
   - `Package.swift` â†’ Swift
   - `Gemfile` â†’ Ruby
   - `composer.json` â†’ PHP
   - `*.csproj` / `*.sln` â†’ .NET
   - `Makefile` / `CMakeLists.txt` â†’ C / C++
   - `cpanfile` / `Makefile.PL` â†’ Perl
3. Note detected tech stack for use in Phase 3 and Phase 4

If no project files are found (e.g., the prompt is abstract or for a new project),
skip detection and flag "tech stack unknown" in Phase 4.

### Phase 1: Intent Detection

Classify the user's task into one or more categories:

| Category | Signal Words | Example |
|----------|-------------|---------|
| New Feature | build, create, add, implement, åˆ›å»º, å®žçŽ°, æ·»åŠ  | "Build a login page" |
| Bug Fix | fix, broken, not working, error, ä¿®å¤, æŠ¥é”™ | "Fix the auth flow" |
| Refactor | refactor, clean up, restructure, é‡æž„, æ•´ç† | "Refactor the API layer" |
| Research | how to, what is, explore, investigate, æ€Žä¹ˆ, å¦‚ä½• | "How to add SSO" |
| Testing | test, coverage, verify, æµ‹è¯•, è¦†ç›–çŽ‡ | "Add tests for the cart" |
| Review | review, audit, check, å®¡æŸ¥, æ£€æŸ¥ | "Review my PR" |
| Documentation | document, update docs, æ–‡æ¡£ | "Update the API docs" |
| Infrastructure | deploy, CI, docker, database, éƒ¨ç½², æ•°æ®åº“ | "Set up CI/CD pipeline" |
| Design | design, architecture, plan, è®¾è®¡, æž¶æž„ | "Design the data model" |

### Phase 2: Scope Assessment

If Phase 0 detected a project, use codebase size as a signal. Otherwise, estimate
from the prompt description alone and mark the estimate as uncertain.

| Scope | Heuristic | Orchestration |
|-------|-----------|---------------|
| TRIVIAL | Single file, < 50 lines | Direct execution |
| LOW | Single component or module | Single command or skill |
| MEDIUM | Multiple components, same domain | Command chain + /verify |
| HIGH | Cross-domain, 5+ files | /plan first, then phased execution |
| EPIC | Multi-session, multi-PR, architectural shift | Use blueprint skill for multi-session plan |

### Phase 3: ECC Component Matching

Map intent + scope + tech stack (from Phase 0) to specific ECC components.

#### By Intent Type

| Intent | Commands | Skills | Agents |
|--------|----------|--------|--------|
| New Feature | /plan, /tdd, /code-review, /verify | tdd-workflow, verification-loop | planner, tdd-guide, code-reviewer |
| Bug Fix | /tdd, /build-fix, /verify | tdd-workflow | tdd-guide, build-error-resolver |
| Refactor | /refactor-clean, /code-review, /verify | verification-loop | refactor-cleaner, code-reviewer |
| Research | /plan | search-first, iterative-retrieval | â€” |
| Testing | /tdd, /e2e, /test-coverage | tdd-workflow, e2e-testing | tdd-guide, e2e-runner |
| Review | /code-review | security-review | code-reviewer, security-reviewer |
| Documentation | /update-docs, /update-codemaps | â€” | doc-updater |
| Infrastructure | /plan, /verify | docker-patterns, deployment-patterns, database-migrations | architect |
| Design (MEDIUM-HIGH) | /plan | â€” | planner, architect |
| Design (EPIC) | â€” | blueprint (invoke as skill) | planner, architect |

#### By Tech Stack

| Tech Stack | Skills to Add | Agent |
|------------|--------------|-------|
| Python / Django | django-patterns, django-tdd, django-security, django-verification, python-patterns, python-testing | python-reviewer |
| Go | golang-patterns, golang-testing | go-reviewer, go-build-resolver |
| Spring Boot / Java | springboot-patterns, springboot-tdd, springboot-security, springboot-verification, java-coding-standards, jpa-patterns | java-reviewer |
| Quarkus / Java | quarkus-patterns, quarkus-tdd, quarkus-security, quarkus-verification, java-coding-standards, jpa-patterns | java-reviewer |
| Kotlin / Android | kotlin-coroutines-flows, compose-multiplatform-patterns, android-clean-architecture | kotlin-reviewer |
| TypeScript / React | frontend-patterns, backend-patterns, coding-standards | code-reviewer |
| Swift / iOS | swiftui-patterns, swift-concurrency-6-2, swift-actor-persistence, swift-protocol-di-testing | code-reviewer |
| PostgreSQL | postgres-patterns, database-migrations | database-reviewer |
| Perl | perl-patterns, perl-testing, perl-security | code-reviewer |
| C++ | cpp-coding-standards, cpp-testing | code-reviewer |
| Other / Unlisted | coding-standards (universal) | code-reviewer |

### Phase 4: Missing Context Detection

Scan the prompt for missing critical information. Check each item and mark
whether Phase 0 auto-detected it or the user must supply it:

- [ ] **Tech stack** â€” Detected in Phase 0, or must user specify?
- [ ] **Target scope** â€” Files, directories, or modules mentioned?
- [ ] **Acceptance criteria** â€” How to know the task is done?
- [ ] **Error handling** â€” Edge cases and failure modes addressed?
- [ ] **Security requirements** â€” Auth, input validation, secrets?
- [ ] **Testing expectations** â€” Unit, integration, E2E?
- [ ] **Performance constraints** â€” Load, latency, resource limits?
- [ ] **UI/UX requirements** â€” Design specs, responsive, a11y? (if frontend)
- [ ] **Database changes** â€” Schema, migrations, indexes? (if data layer)
- [ ] **Existing patterns** â€” Reference files or conventions to follow?
- [ ] **Scope boundaries** â€” What NOT to do?

**If 3+ critical items are missing**, ask the user up to 3 clarification
questions before generating the optimized prompt. Then incorporate the
answers into the optimized prompt.

### Phase 5: Workflow & Model Recommendation

Determine where this prompt sits in the development lifecycle:

```
Research â†’ Plan â†’ Implement (TDD) â†’ Review â†’ Verify â†’ Commit
```

For MEDIUM+ tasks, always start with /plan. For EPIC tasks, use blueprint skill.

**Model recommendation** (include in output):

| Scope | Recommended Model | Rationale |
|-------|------------------|-----------|
| TRIVIAL-LOW | Sonnet 5 | Fast, cost-efficient for simple tasks |
| MEDIUM | Sonnet 5 | Best coding model for standard work |
| HIGH | Sonnet 5 (main) + Opus 5 (planning) | Opus for architecture, Sonnet for implementation |
| EPIC | Opus 5 (blueprint) + Sonnet 5 (execution) | Deep reasoning for multi-session planning |

**Multi-prompt splitting** (for HIGH/EPIC scope):

For tasks that exceed a single session, split into sequential prompts:
- Prompt 1: Research + Plan (use search-first skill, then /plan)
- Prompt 2-N: Implement one phase per prompt (each ends with /verify)
- Final Prompt: Integration test + /code-review across all phases
- Use /save-session and /resume-session to preserve context between sessions

---

## Output Format

Present your analysis in this exact structure. Respond in the same language
as the user's input.

### Section 1: Prompt Diagnosis

**Strengths:** List what the original prompt does well.

**Issues:**

| Issue | Impact | Suggested Fix |
|-------|--------|---------------|
| (problem) | (consequence) | (how to fix) |

**Needs Clarification:** Numbered list of questions the user should answer.
If Phase 0 auto-detected the answer, state it instead of asking.

### Section 2: Recommended ECC Components

| Type | Component | Purpose |
|------|-----------|---------|
| Command | /plan | Plan architecture before coding |
| Skill | tdd-workflow | TDD methodology guidance |
| Agent | code-reviewer | Post-implementation review |
| Model | Sonnet 5 | Recommended for this scope |

### Section 3: Optimized Prompt â€” Full Version

Present the complete optimized prompt inside a single fenced code block.
The prompt must be self-contained and ready to copy-paste. Include:
- Clear task description with context
- Tech stack (detected or specified)
- /command invocations at the right workflow stages
- Acceptance criteria
- Verification steps
- Scope boundaries (what NOT to do)

For items that reference blueprint, write: "Use the blueprint skill to..."
(not `/blueprint`, since blueprint is a skill, not a command).

### Section 4: Optimized Prompt â€” Quick Version

A compact version for experienced ECC users. Vary by intent type:

| Intent | Quick Pattern |
|--------|--------------|
| New Feature | `/plan [feature]. /tdd to implement. /code-review. /verify.` |
| Bug Fix | `/tdd â€” write failing test for [bug]. Fix to green. /verify.` |
| Refactor | `/refactor-clean [scope]. /code-review. /verify.` |
| Research | `Use search-first skill for [topic]. /plan based on findings.` |
| Testing | `/tdd [module]. /e2e for critical flows. /test-coverage.` |
| Review | `/code-review. Then use security-reviewer agent.` |
| Docs | `/update-docs. /update-codemaps.` |
| EPIC | `Use blueprint skill for "[objective]". Execute phases with /verify gates.` |

### Section 5: Enhancement Rationale

| Enhancement | Reason |
|-------------|--------|
| (what was added) | (why it matters) |

### Footer

> Not what you need? Tell me what to adjust, or make a normal task request
> if you want execution instead of prompt optimization.

---

## Examples

### Trigger Examples

- "Optimize this prompt for ECC"
- "Rewrite this prompt so Claude Code uses the right commands"
- "å¸®æˆ‘ä¼˜åŒ–è¿™ä¸ªæŒ‡ä»¤"
- "How should I prompt ECC for this task?"

### Example 1: Vague Chinese Prompt (Project Detected)

**User input:**
```
å¸®æˆ‘å†™ä¸€ä¸ªç”¨æˆ·ç™»å½•é¡µé¢
```

**Phase 0 detects:** `package.json` with Next.js 15, TypeScript, Tailwind CSS

**Optimized Prompt (Full):**
```
ä½¿ç”¨é¡¹ç›®çŽ°æœ‰æŠ€æœ¯æ ˆï¼ˆNext.js 15 + TypeScript + Tailwind CSSï¼‰å®žçŽ°ç”¨æˆ·ç™»å½•é¡µé¢ã€‚

æŠ€æœ¯è¦æ±‚ï¼š
- æ²¿ç”¨é¡¹ç›®çŽ°æœ‰çš„ç»„ä»¶ç»“æž„å’Œè·¯ç”±çº¦å®š
- è¡¨å•éªŒè¯ä½¿ç”¨é¡¹ç›®ä¸­å·²æœ‰çš„éªŒè¯æ–¹æ¡ˆï¼ˆæ£€æŸ¥æ˜¯å¦å·²ç”¨ Zod/Yup/å…¶ä»–ï¼‰
- è®¤è¯æ–¹å¼ï¼šæ²¿ç”¨é¡¹ç›®çŽ°æœ‰è®¤è¯æ–¹æ¡ˆï¼ˆå¦‚æ— ï¼Œé»˜è®¤ JWTï¼‰
- åŒ…å«ï¼šé‚®ç®±/å¯†ç ç™»å½•è¡¨å•ã€è¡¨å•éªŒè¯ã€é”™è¯¯æç¤ºã€åŠ è½½çŠ¶æ€ã€å“åº”å¼å¸ƒå±€

å·¥ä½œæµï¼š
1. /plan å…ˆè§„åˆ’ç»„ä»¶ç»“æž„å’Œè®¤è¯æµç¨‹ï¼Œå‚è€ƒçŽ°æœ‰é¡µé¢çš„æ¨¡å¼
2. /tdd æµ‹è¯•å…ˆè¡Œï¼šç¼–å†™ç™»å½•è¡¨å•çš„å•å…ƒæµ‹è¯•å’Œè®¤è¯æµç¨‹çš„é›†æˆæµ‹è¯•
3. å®žçŽ°ç™»å½•é¡µé¢å’Œè®¤è¯é€»è¾‘
4. /code-review å®¡æŸ¥å®žçŽ°
5. /verify éªŒè¯æ‰€æœ‰æµ‹è¯•é€šè¿‡ä¸”é¡µé¢æ­£å¸¸æ¸²æŸ“

å®‰å…¨è¦æ±‚ï¼š
- å¯†ç ä¸æ˜Žæ–‡ä¼ è¾“
- é˜²æ­¢æš´åŠ›ç ´è§£ï¼ˆrate limitingï¼‰
- XSS é˜²æŠ¤
- CSRF token

éªŒæ”¶æ ‡å‡†ï¼š
- æ‰€æœ‰æµ‹è¯•é€šè¿‡ï¼Œè¦†ç›–çŽ‡ 80%+
- é¡µé¢åœ¨ç§»åŠ¨ç«¯å’Œæ¡Œé¢ç«¯æ­£å¸¸æ¸²æŸ“
- ç™»å½•æˆåŠŸè·³è½¬åˆ° dashboardï¼Œå¤±è´¥æ˜¾ç¤ºé”™è¯¯ä¿¡æ¯

ä¸è¦åšï¼š
- ä¸è¦å®žçŽ°æ³¨å†Œé¡µé¢
- ä¸è¦å®žçŽ°å¿˜è®°å¯†ç åŠŸèƒ½
- ä¸è¦ä¿®æ”¹çŽ°æœ‰çš„è·¯ç”±ç»“æž„
```

### Example 2: Moderate English Prompt

**User input:**
```
Add a REST API endpoint for user profile updates with validation
```

**Phase 0 detects:** `go.mod` with Go 1.22, Chi router

**Optimized Prompt (Full):**
```
Add a REST API endpoint for user profile updates (PATCH /api/users/:id).

Tech stack: Go 1.22 + Chi router (detected from project)

Requirements:
- PATCH /api/users/:id â€” partial update of user profile
- Input validation for fields: name, email, avatar_url, bio
- Auth: require valid token, users can only update own profile
- Return 200 with updated user on success
- Return 400 with validation errors on invalid input
- Return 401/403 for auth failures
- Follow existing API patterns in the codebase

Workflow:
1. /plan the endpoint structure, middleware chain, and validation logic
2. /tdd â€” write table-driven tests for success, validation failure, auth failure, not-found
3. Implement following existing handler patterns
4. /go-review
5. /verify â€” run full test suite, confirm no regressions

Do not:
- Modify existing endpoints
- Change the database schema (use existing user table)
- Add new dependencies without checking existing ones first (use search-first skill)
```

### Example 3: EPIC Project

**User input:**
```
Migrate our monolith to microservices
```

**Optimized Prompt (Full):**
```
Use the blueprint skill to plan: "Migrate monolith to microservices architecture"

Before executing, answer these questions in the blueprint:
1. Which domain boundaries exist in the current monolith?
2. Which service should be extracted first (lowest coupling)?
3. Communication pattern: REST APIs, gRPC, or event-driven (Kafka/RabbitMQ)?
4. Database strategy: shared DB initially or database-per-service from start?
5. Deployment target: Kubernetes, Docker Compose, or serverless?

The blueprint should produce phases like:
- Phase 1: Identify service boundaries and create domain map
- Phase 2: Set up infrastructure (API gateway, service mesh, CI/CD per service)
- Phase 3: Extract first service (strangler fig pattern)
- Phase 4: Verify with integration tests, then extract next service
- Phase N: Decommission monolith

Each phase = 1 PR, with /verify gates between phases.
Use /save-session between phases. Use /resume-session to continue.
Use git worktrees for parallel service extraction when dependencies allow.

Recommended: Opus 5 for blueprint planning, Sonnet 5 for phase execution.
```

---

## Related Components

| Component | When to Reference |
|-----------|------------------|
| `configure-ecc` | User hasn't set up ECC yet |
| `skill-stocktake` | Audit which components are installed (use instead of hardcoded catalog) |
| `search-first` | Research phase in optimized prompts |
| `blueprint` | EPIC-scope optimized prompts (invoke as skill, not command) |
| `strategic-compact` | Long session context management |
| `cost-aware-llm-pipeline` | Token optimization recommendations |
