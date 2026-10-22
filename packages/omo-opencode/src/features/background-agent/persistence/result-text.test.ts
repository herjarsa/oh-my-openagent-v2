import { describe, expect, test } from "bun:test"

import type { BackgroundOutputMessage } from "../../../shared/background-output-message"

import { extractTaskResultText } from "./result-text"

describe("result text extraction", () => {
  test("#given one assistant message with text and reasoning #when the text is extracted #then both blocks are kept in order", () => {
    // given
    const messages: BackgroundOutputMessage[] = [
      {
        info: { role: "assistant" },
        parts: [
          { type: "reasoning", text: "hidden reasoning" },
          { type: "text", text: "the visible answer" },
        ],
      },
    ]

    // when
    const text = extractTaskResultText(messages)

    // then
    expect(text).toBe("hidden reasoning\n\nthe visible answer")
  })

  test("#given a tool result message and an assistant message #when the text is extracted #then both are joined in order", () => {
    // given
    const messages: BackgroundOutputMessage[] = [
      { info: { role: "tool" }, parts: [{ type: "tool_result", content: "ran fine" }] },
      { info: { role: "assistant" }, parts: [{ type: "text", text: "done" }] },
    ]

    // when
    const text = extractTaskResultText(messages)

    // then
    expect(text).toBe("ran fine\n\ndone")
  })

  test("#given no extractable text #when the text is extracted #then an empty string is returned", () => {
    // given
    const messages: BackgroundOutputMessage[] = [
      { info: { role: "user" }, parts: [{ type: "text", text: "a user note" }] },
    ]

    // when
    const text = extractTaskResultText(messages)

    // then
    expect(text).toBe("")
  })
})