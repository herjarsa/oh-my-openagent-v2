import type { BackgroundManager } from "../../features/background-agent"
import type {
  BackgroundOutputMessage,
  BackgroundOutputMessagesResult,
} from "../../shared/background-output-message"

export type {
  BackgroundOutputMessage,
  BackgroundOutputMessagesResult,
} from "../../shared/background-output-message"

export type BackgroundOutputClient = {
  session: {
    messages: (args: { path: { id: string } }) => Promise<BackgroundOutputMessagesResult>
  }
}

export type BackgroundCancelClient = {
  session: {
    abort: (args: { path: { id: string } }) => Promise<unknown>
  }
}

export type BackgroundOutputManager = Pick<BackgroundManager, "getTask">