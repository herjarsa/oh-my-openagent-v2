import { describe, expect, test } from "bun:test"
import { normalizeEvent } from "./event-bridge"

describe("normalizeEvent", () => {
  test("given flat v2 event with sessionID #when normalized #then keeps type and sessionID", () => {
    // given
    const event = { type: "session.idle", properties: { sessionID: "ses_1" } }
    // when
    const result = normalizeEvent(event)
    // then
    expect(result?.type).toBe("session.idle")
    expect(result?.properties.sessionID).toBe("ses_1")
  })
  test("given v2 event with id instead of sessionID #when normalized #then uses id", () => {
    // given
    const event = { type: "session.error", properties: { id: "ses_2" } }
    // when
    const result = normalizeEvent(event)
    // then
    expect(result?.properties.sessionID).toBe("ses_2")
  })
  test("given v2 event with nested session object #when normalized #then finds sessionID", () => {
    // given
    const event = { type: "tool.execute.after", session: { sessionID: "ses_3" } }
    // when
    const result = normalizeEvent(event)
    // then
    expect(result?.type).toBe("tool.execute.after")
    expect(result?.properties.sessionID).toBe("ses_3")
  })
  test("given event without type #when normalized #then returns undefined", () => {
    // given
    const event = { properties: { sessionID: "ses_4" } }
    // when
    const result = normalizeEvent(event)
    // then
    expect(result).toBeUndefined()
  })
  test("given non-object input #when normalized #then returns undefined", () => {
    expect(normalizeEvent(null)).toBeUndefined()
    expect(normalizeEvent(42)).toBeUndefined()
    expect(normalizeEvent("session.idle")).toBeUndefined()
  })
})