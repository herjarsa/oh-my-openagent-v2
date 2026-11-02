import {
  DEFAULT_SDK_CALL_TIMEOUT_MS,
  SdkCallTimeoutError,
  _setSdkCallTimeoutMsForTesting,
  getSdkCallTimeoutMs,
  withSdkCallTimeout,
} from "../../shared/sdk-call-timeout"

export const DEFAULT_BACKGROUND_OUTPUT_FETCH_TIMEOUT_MS = DEFAULT_SDK_CALL_TIMEOUT_MS
export const getBackgroundOutputFetchTimeoutMs = getSdkCallTimeoutMs
export const _setBackgroundOutputFetchTimeoutMsForTesting = _setSdkCallTimeoutMsForTesting

export class BackgroundOutputFetchTimeoutError extends SdkCallTimeoutError {}

export { withSdkCallTimeout }