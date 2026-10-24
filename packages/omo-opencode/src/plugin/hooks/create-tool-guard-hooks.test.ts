import { describe, expect, test } from "bun:test"
import type { OhMyOpenCodeConfig } from "../../config"
import type { ModelCacheState } from "../../plugin-state"
import type { PluginContext } from "../types"
import { buildRulesInjectorOptions, createToolGuardHooks } from "./create-tool-guard-hooks"

const mockContext = {
  directory: "/tmp",
} as PluginContext

const mockModelCacheState = {
  anthropicContext1MEnabled: false,
  modelContextLimitsCache: new Map(),
} satisfies ModelCacheState

describe("buildRulesInjectorOptions", () => {
  test("passes the skip flag through and omits an absent ECC root", () => {
    // given hooks disabled for Claude user rules and no ECC rules vendored
    // when
    const options = buildRulesInjectorOptions({ skipClaudeUserRules: true, eccRulesRoot: null })

    // then only the skip flag is forwarded
    expect(options).toEqual({ skipClaudeUserRules: true })
  })

  test("forwards the vendored ECC rules root when ECC is enabled", () => {
    // given
    // when
    const options = buildRulesInjectorOptions({ skipClaudeUserRules: false, eccRulesRoot: "/repo/ecc-rules" })

    // then
    expect(options).toEqual({ eccRulesRoot: "/repo/ecc-rules" })
  })

  test("omits both flags when neither applies", () => {
    // given
    // when
    const options = buildRulesInjectorOptions({ skipClaudeUserRules: false, eccRulesRoot: null })

    // then
    expect(options).toEqual({})
  })
})

describe("createToolGuardHooks", () => {
  test("builds the hook set without throwing on a minimal config", () => {
    // given
    const pluginConfig = {
      claude_code: {
        hooks: false,
      },
    } as OhMyOpenCodeConfig

    // when then it assembles without throwing and exposes the injector slot
    const hooks = createToolGuardHooks({
      ctx: mockContext,
      pluginConfig,
      modelCacheState: mockModelCacheState,
      isHookEnabled: (hookName: string) => hookName === "rules-injector",
      safeHookEnabled: true,
    })
    expect(hooks).toHaveProperty("rulesInjector")
  })
})