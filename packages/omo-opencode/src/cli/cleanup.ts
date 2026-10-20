export type CleanupPlatform = "opencode"

export interface CleanupOptions {
  readonly platform?: CleanupPlatform
  readonly project?: string
  readonly json?: boolean
}

export function resolveCleanupPlatform(
  options: { readonly platform?: CleanupOptions["platform"] },
  invocationName: string | undefined = process.env.OMO_INVOCATION_NAME,
): CleanupOptions["platform"] | undefined {
  void invocationName
  if (options.platform !== undefined) return options.platform
  return undefined
}

export async function cleanup(options: CleanupOptions): Promise<number> {
  if (options.json === true) {
    console.log(JSON.stringify({ platform: "opencode", cleaned: false }, null, 2))
    return 0
  }

  console.log("OpenCode-only cleanup: nothing to clean.")
  return 0
}
