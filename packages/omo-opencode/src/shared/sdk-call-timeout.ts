// Hard ceiling on how long an SDK call is allowed to block. Without it, a stuck
// OpenCode RPC (observed when `session.processor` enters an "Aborted process"
// loop) would leave the caller pending forever. The background_output tool and
// the background-agent manager both need the same ceiling.
export const DEFAULT_SDK_CALL_TIMEOUT_MS = 5_000

let sdkCallTimeoutMsForTesting: number | undefined

export function _setSdkCallTimeoutMsForTesting(value: number | undefined): void {
  sdkCallTimeoutMsForTesting = value
}

export function getSdkCallTimeoutMs(): number {
  return sdkCallTimeoutMsForTesting ?? DEFAULT_SDK_CALL_TIMEOUT_MS
}

export class SdkCallTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`[background-output] session.messages timed out after ${timeoutMs}ms`)
    this.name = "SdkCallTimeoutError"
  }
}

export function withSdkCallTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return operation
  }
  let timeoutID: ReturnType<typeof globalThis.setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutID = globalThis.setTimeout(
      () => reject(new SdkCallTimeoutError(timeoutMs)),
      timeoutMs,
    )
  })
  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeoutID !== undefined) clearTimeout(timeoutID)
  })
}