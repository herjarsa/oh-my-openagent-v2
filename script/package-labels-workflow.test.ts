/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"

describe("Package label workflow", () => {
  test("#given repository automation #when inspected #then labels are derived per packages/ directory from PR diffs", async () => {
    // given
    const workflow = await readFile(".github/workflows/package-labels.yml", "utf8")

    // when / then
    expect(workflow).toContain("pull_request_target:")
    expect(workflow).toContain("issues:")

    expect(workflow).toContain("OPENCODE_LABEL: opencode")
    expect(workflow).toContain('ensure_label "$OPENCODE_LABEL"')

    expect(workflow).toContain('gh pr diff "$PR_NUMBER" --name-only')
    expect(workflow).toContain('pkg="${1#packages/}"')
    expect(workflow).toContain('pkg="${pkg%%/*}"')
    expect(workflow).toContain('omo-opencode) printf \'%s\\n\' "$OPENCODE_LABEL"')
    expect(workflow).toContain('oh-my-opencode-*) printf \'%s\\n\' "$OPENCODE_LABEL"')
    expect(workflow).toContain('*) printf \'%s\\n\' "$pkg"')
    expect(workflow).toContain("ensure_package_label")
    expect(workflow).toContain('gh pr edit "$PR_NUMBER" "${add_args[@]}"')
    expect(workflow).toContain('gh issue edit "$ISSUE_NUMBER" "${add_args[@]}"')

    expect(workflow).not.toContain("package.json) return 0")
    expect(workflow).not.toContain("bin/*) return 0")
    expect(workflow).not.toContain("publish.yml) return 0")
    expect(workflow).not.toContain("actions/checkout")

    // The fork ships the OpenCode edition only: the retired LazyCodex label vocabulary
    // and its Codex edition branch must not come back.
    expect(workflow).not.toContain("lazycodex")
    expect(workflow).not.toContain("LAZYCODEX")
    expect(workflow).not.toContain("GENERATED_LABEL")
    expect(workflow).not.toContain("omo-codex")
  })
})