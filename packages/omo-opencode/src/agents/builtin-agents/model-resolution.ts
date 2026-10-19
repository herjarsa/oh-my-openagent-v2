import { resolveModelPipeline } from "../../shared"
import { transformModelForProvider } from "../../shared/provider-model-id-transform"

export function applyModelResolution(input: {
  uiSelectedModel?: string
  userModel?: string
  requirement?: { fallbackChain?: { providers: string[]; model: string; variant?: string }[] }
  availableModels: Set<string>
  systemDefaultModel?: string
}) {
  const { uiSelectedModel, userModel, requirement, availableModels, systemDefaultModel } = input
  return resolveModelPipeline({
    intent: { uiSelectedModel, userModel },
    constraints: { availableModels },
    policy: { fallbackChain: requirement?.fallbackChain, systemDefaultModel },
  })
}

export function getFirstFallbackModel(requirement?: {
  fallbackChain?: { providers: string[]; model: string; variant?: string }[]
}) {
  const entry = requirement?.fallbackChain?.[0]
  if (!entry || entry.providers.length === 0) return undefined
  const provider = entry.providers[0]
  const transformedModel = transformModelForProvider(provider, entry.model)
  return {
    model: `${provider}/${transformedModel}`,
    provenance: "provider-fallback" as const,
    variant: entry.variant,
  }
}

/**
 * Primary model from an agent override.
 * Users write `models: [...]` (array) far more often than `model` (singular);
 * the registration path only honored the singular form, silently dropping the
 * array and falling through to hardcoded chains. The first entry wins.
 */
export function primaryOverrideModel(override?: { model?: unknown; models?: unknown }): string | undefined {
  if (!override) return undefined
  if (typeof override.model === "string" && override.model.length > 0) return override.model
  const models = override.models
  if (Array.isArray(models)) {
    for (const entry of models) {
      if (typeof entry === "string" && entry.length > 0) return entry
      if (entry !== null && typeof entry === "object" && typeof (entry as { model?: unknown }).model === "string") {
        const m = (entry as { model: string }).model
        if (m.length > 0) return m
      }
    }
  }
  return undefined
}
