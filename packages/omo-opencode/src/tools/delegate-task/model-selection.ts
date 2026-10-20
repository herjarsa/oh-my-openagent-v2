import {
  resolveModelForDelegateTask as resolveModelForDelegateTaskCore,
  type DelegateModelResolutionInput,
  type DelegateModelResolutionResult,
} from "@oh-my-opencode/delegate-core"
import {
  fuzzyMatchModel,
  normalizeModel,
  parseModelString,
  parseVariantFromModelID,
} from "@oh-my-opencode/model-core"
import * as connectedProvidersCache from "../../shared/connected-providers-cache"
import { log } from "../../shared/logger"

export type { DelegateModelResolutionInput, DelegateModelResolutionResult }

/**
 * Resolve the model the user configured - OpenCode delegation path only.
 *
 * The user owns the model and the provider: a configured model is never swapped for another
 * entry of the chain. The chain in omo.jsonc stays the RUNTIME fallback (the background agent
 * retries the next rung when the request fails), so a primary that is not reachable fails over
 * instead of being replaced up front.
 *
 * A configured model the plugin's catalog does know is still normalized through the
 * provider-hinted fuzzy match, so a loosely written id keeps resolving to the real one.
 */
function resolveConfiguredModel(input: DelegateModelResolutionInput): DelegateModelResolutionResult | undefined {
  const userModel = normalizeModel(input.userModel)
  if (!userModel) return undefined

  const parsedFull = parseModelString(userModel)
  const parsedVariantOnly = parsedFull ? undefined : parseVariantFromModelID(userModel)
  const baseModel = parsedFull ? `${parsedFull.providerID}/${parsedFull.modelID}` : parsedVariantOnly?.modelID
  if (!baseModel) return undefined

  const variant = parsedFull?.variant ?? parsedVariantOnly?.variant
  const providerHint = parsedFull ? [parsedFull.providerID] : undefined

  if (input.availableModels.size > 0) {
    const match = fuzzyMatchModel(baseModel, new Set(input.availableModels), providerHint)
    if (match) {
      return variant === undefined ? { model: match } : { model: match, variant }
    }
    log("[delegate-task] configured model is outside the plugin catalog; using it verbatim (the runtime fallback chain covers failures)", { model: baseModel })
  }

  return variant === undefined ? { model: baseModel } : { model: baseModel, variant }
}

export function resolveModelForDelegateTask(input: DelegateModelResolutionInput): DelegateModelResolutionResult {
  const configured = resolveConfiguredModel(input)
  if (configured !== undefined) {
    return configured
  }

  const connectedProviders = input.availableModels.size === 0
    ? connectedProvidersCache.readConnectedProvidersCache()
    : null

  return resolveModelForDelegateTaskCore(input, {
    connectedProviders,
    hasProviderModelsCache: connectedProvidersCache.hasProviderModelsCache(),
    hasConnectedProvidersCache: connectedProvidersCache.hasConnectedProvidersCache(),
    log,
  })
}