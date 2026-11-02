import type { BackgroundManager } from "../../features/background-agent"
import type {
  PersistedTaskRecord,
  PersistedTaskTranscript,
} from "../../features/background-agent/persistence/record"
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

export type BackgroundOutputManager = Pick<BackgroundManager, "getTask"> & {
  getPersistedTaskRecord?: (taskId: string) => PersistedTaskRecord | undefined
  getPersistedTaskTranscript?: (taskId: string) => PersistedTaskTranscript | undefined
  persistTaskRecord?: (record: PersistedTaskRecord) => void
}