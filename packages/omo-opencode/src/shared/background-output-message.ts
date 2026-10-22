export type BackgroundOutputMessage = {
  id?: string
  info?: { role?: string; time?: string | { created?: number }; agent?: string; error?: unknown }
  parts?: Array<{
    type?: string
    text?: string
    thinking?: string
    content?: string | Array<{ type: string; text?: string }>
    output?: string
    name?: string
    tool?: string
    input?: unknown
  }>
}

export type BackgroundOutputMessagesResult =
  | { data?: BackgroundOutputMessage[]; error?: unknown }
  | BackgroundOutputMessage[]

export function isBackgroundOutputMessage(value: unknown): value is BackgroundOutputMessage {
  return typeof value === "object" && value !== null
}

export function extractBackgroundOutputMessages(value: unknown): BackgroundOutputMessage[] {
  if (Array.isArray(value)) {
    return value.filter(isBackgroundOutputMessage)
  }
  if (typeof value === "object" && value !== null && "data" in value) {
    const data = (value as { data?: unknown }).data
    if (Array.isArray(data)) {
      return data.filter(isBackgroundOutputMessage)
    }
  }
  return []
}
