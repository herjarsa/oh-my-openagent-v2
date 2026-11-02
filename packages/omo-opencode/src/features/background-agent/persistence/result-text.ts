import type { BackgroundOutputMessage } from "../../../shared/background-output-message"

function getTimeString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

/**
 * Extracts the text of a task result from a transcript. This mirrors the live
 * background_output path exactly: only assistant and tool messages contribute,
 * they are ordered by their message time, and text, reasoning, and tool_result
 * blocks are joined with a blank line. A result read from the persisted store
 * therefore matches the one read from a live session.
 */
export function extractTaskResultText(messages: BackgroundOutputMessage[]): string {
  const relevantMessages = messages.filter(
    (message) => message.info?.role === "assistant" || message.info?.role === "tool",
  )
  const sortedMessages = [...relevantMessages].sort((a, b) =>
    getTimeString(a.info?.time).localeCompare(getTimeString(b.info?.time)),
  )

  const extracted: string[] = []
  for (const message of sortedMessages) {
    for (const part of message.parts ?? []) {
      if ((part.type === "text" || part.type === "reasoning") && part.text) {
        extracted.push(part.text)
        continue
      }

      if (part.type === "tool_result") {
        const toolResult = part as { content?: string | Array<{ type: string; text?: string }> }
        if (typeof toolResult.content === "string" && toolResult.content) {
          extracted.push(toolResult.content)
          continue
        }

        if (Array.isArray(toolResult.content)) {
          for (const block of toolResult.content) {
            if ((block.type === "text" || block.type === "reasoning") && block.text) {
              extracted.push(block.text)
            }
          }
        }
      }
    }
  }
  return extracted.filter((text) => text.length > 0).join("\n\n")
}