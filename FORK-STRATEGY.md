# Fork strategy — soft-fork + train propio

Decision: mantener soft-fork con release train propio. No hard-fork por ahora.

Base: upstream `v5.0.0-beta.90` (`05dcba64b`). Pinned a propósito — no perseguir cada beta. Rebase mensual o bajo demanda (ver `V2-PORT.md`).

## Train propio

- Rama: `chore/fork-npm-publish` tracking `fork/chore/fork-npm-publish`.
- Push a `fork` (`herjarsa/oh-my-openagent-v2`), nunca a `origin` salvo contrib puntual.
- Publish en tags `v2-*`, sin merge a `dev`. Workflow: `publish-fork.yml` (necesita `NPM_TOKEN` en CI).
- npm: `@herjarsa/oh-my-openagent-v2`, versionado propio desde `0.1.0`. Reemplaza a upstream, no instalar ambos: mismo plugin id y estado `~/.omo` (ver `FORK-NOTICE.md`).

## Sync selectivo con upstream

- Upstream sigue activo en V2 bridge (`#9389`, `#9391`, SDK `2.0.16`, running `2.0.22`). Se usa como referencia, no como bloqueante.
- Recon matrix fuente de verdad: `V2-HOOK-MAP.md` + `V2-PORT.md`.
- Contribuir de vuelta solo docs/GAPs aislados con test, coste cero si se ignoran. Patrón actual: `V2-9391-GAP-CONTRIB.md` (items 2 y 6 de `#9391`: `command.execute.before` veto vs observe, `autocontinue` necesita diseño).
- Cherry-pick bajo demanda, nunca merge completo de `dev` upstream.

## Lo que se queda en el fork

Fixes empíricos del host V2 (no esperar a que upstream los acepte):

- `829854b63`: prompt text como flat string (host 2.0.19 rechaza objeto).
- `42421e0e0`: tolerar ausencia de `app.agents` en cliente V2.
- `95a8389` / `d0c1458`: nombres agent display-name vs config-key (`Sisyphus-Junior` -> `sisyphus-junior`) + retry.
- `delegate-task`: supervisión child, resume por keyword/stall, fail-fast sin progreso.
- `background-agent`: reintento y routing a V2 host.

## Remanentes upstream intencionales

`package.json` aún apunta a upstream (`repository`, `bugs`, `author`, `omowright: github:code-yeongyu/...`). Intencional en soft-fork. Cambiar solo en hard-fork.

## Reglas operativas

- Cachés locales nunca se commitean: `.codegraph/`, `graphify-out/`, `NUL` (ver `.gitignore`).
- Evidencia QA local bajo `.omo/evidence/`, resumida en el PR, nunca commiteada (`#8703`).
- Cada cambio V2: actualizar `V2-HOOK-MAP.md` si toca mapeo, y `V2-PORT.md` si cambia fase/scope.

## Cuándo hacer hard-fork

Solo si: upstream archiva opencode, cambia licencia de forma que bloquee, o el sync cuesta más que mantener solo. Entonces: cambiar `repository/bugs/homepage/author`, decidir licencia, renombrar bins, quitar deps `github:code-yeongyu/*`, y documentarlo aquí.
