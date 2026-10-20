import { afterEach, describe, expect, spyOn, test } from "bun:test"
import type { CategoryConfig } from "../../config/schema"
import * as connectedProvidersCache from "../../shared/connected-providers-cache"
import { unsafeTestValue } from "../../../../../test-support/unsafe-test-value"
import { resolveCategoryExecution } from "./category-resolver"
import type { ExecutorContext } from "./executor-types"
import type { DelegateTaskArgs } from "./types"

const CATEGORY_NAME = "verifier"
const MODEL_PROVIDER = "test-provider"

const args: DelegateTaskArgs = {
  category: CATEGORY_NAME,
  prompt: "Verify the configured category model chain.",
  description: "Category model availability regression",
  run_in_background: false,
  load_skills: [],
}

const cacheSpies: Array<{ mockRestore: () => void }> = []

afterEach(() => {
  for (const cacheSpy of cacheSpies.splice(0)) {
    cacheSpy.mockRestore()
  }
})

function createExecutorContext(
  category: CategoryConfig,
  availableModelIDs: string[],
): ExecutorContext {
  cacheSpies.push(
    spyOn(connectedProvidersCache, "readProviderModelsCache").mockReturnValue({
      models: { [MODEL_PROVIDER]: availableModelIDs },
      connected: [MODEL_PROVIDER],
      updatedAt: "2026-08-18T00:00:00.000Z",
    }),
  )
  cacheSpies.push(
    spyOn(connectedProvidersCache, "readConnectedProvidersCache").mockReturnValue([MODEL_PROVIDER]),
  )

  return {
    client: unsafeTestValue({}),
    manager: unsafeTestValue({}),
    directory: "/tmp/issue-6972",
    userCategories: { [CATEGORY_NAME]: category },
    sisyphusJuniorModel: undefined,
  }
}

describe("category canonical model availability", () => {
  test("keeps the configured primary even when the plugin catalog does not know it", async () => {
    // given
    const executorContext = createExecutorContext(
      {
        models: [
          `${MODEL_PROVIDER}/missing-primary`,
          `${MODEL_PROVIDER}/available-second`,
          `${MODEL_PROVIDER}/missing-middle`,
          `${MODEL_PROVIDER}/available-fourth`,
          `${MODEL_PROVIDER}/available-fifth`,
        ],
      },
      ["available-second", "available-fourth", "available-fifth"],
    )

    // when
    const result = await resolveCategoryExecution(args, executorContext, undefined, "system/default")

    // then
    expect(result.error).toBeUndefined()
    expect(result.actualModel).toBe(`${MODEL_PROVIDER}/missing-primary`)
    expect(result.categoryModel).toMatchObject({
      providerID: MODEL_PROVIDER,
      modelID: "missing-primary",
    })
    expect(result.fallbackChain).toEqual([
      { providers: [MODEL_PROVIDER], model: "available-second", variant: undefined },
      { providers: [MODEL_PROVIDER], model: "missing-middle", variant: undefined },
      { providers: [MODEL_PROVIDER], model: "available-fourth", variant: undefined },
      { providers: [MODEL_PROVIDER], model: "available-fifth", variant: undefined },
    ])
  })

  test("keeps a configured fuzzy near-miss by resolving it to the available model id", async () => {
    // given
    const executorContext = createExecutorContext(
      { models: [`${MODEL_PROVIDER}/model-5.4`] },
      ["model-5.4-preview"],
    )

    // when
    const result = await resolveCategoryExecution(args, executorContext, undefined, "system/default")

    // then
    expect(result.error).toBeUndefined()
    expect(result.actualModel).toBe(`${MODEL_PROVIDER}/model-5.4-preview`)
    expect(result.categoryModel).toMatchObject({
      providerID: MODEL_PROVIDER,
      modelID: "model-5.4-preview",
    })
  })

  test("preserves the configured primary entry settings and keeps the fallback entry settings in the chain", async () => {
    // given
    const executorContext = createExecutorContext(
      {
        models: [
          `${MODEL_PROVIDER}/missing-primary`,
          {
            model: `${MODEL_PROVIDER}/available-second`,
            reasoning: "high",
            temperature: 0.3,
          },
        ],
      },
      ["available-second"],
    )

    // when
    const result = await resolveCategoryExecution(args, executorContext, undefined, "system/default")

    // then
    expect(result.error).toBeUndefined()
    expect(result.actualModel).toBe(`${MODEL_PROVIDER}/missing-primary`)
    expect(result.categoryModel).toMatchObject({
      providerID: MODEL_PROVIDER,
      modelID: "missing-primary",
    })
    expect(result.fallbackChain).toHaveLength(1)
    expect(result.fallbackChain[0]).toMatchObject({
      providers: [MODEL_PROVIDER],
      model: "available-second",
      reasoning: "high",
      temperature: 0.3,
    })
  })

  test("keeps the configured chain when no entry is known to the plugin catalog", async () => {
    // given
    const configuredModels = [
      `${MODEL_PROVIDER}/missing-primary`,
      `${MODEL_PROVIDER}/missing-fallback`,
    ]
    const executorContext = createExecutorContext({ models: configuredModels }, ["unrelated-model"])

    // when
    const result = await resolveCategoryExecution(args, executorContext, undefined, "system/default")

    // then: the user configured these models, so they are used as configured; the runtime
    // fallback chain is what handles a request that the provider cannot serve.
    expect(result.error).toBeUndefined()
    expect(result.actualModel).toBe(configuredModels[0])
    expect(result.categoryModel).toMatchObject({
      providerID: MODEL_PROVIDER,
      modelID: "missing-primary",
    })
    expect(result.fallbackChain).toEqual([
      { providers: [MODEL_PROVIDER], model: "missing-fallback", variant: undefined },
    ])
  })

})
