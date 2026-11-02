import { describe, expect, test } from "bun:test"

import type { PersistedTaskRecord } from "./record"
import { TaskLedger, buildTaskLedgerSummary } from "./task-ledger"

function createRecord(
  taskId: string,
  parentSessionId: string,
  overrides: Partial<PersistedTaskRecord> = {},
): PersistedTaskRecord {
  return {
    schemaVersion: 1,
    taskId,
    parentSessionId,
    projectDirectory: "/tmp/project",
    description: taskId,
    agent: "explore",
    status: "completed",
    createdAt: "2026-10-22T10:00:00.000Z",
    completedAt: "2026-10-22T10:05:00.000Z",
    updatedAt: "2026-10-22T10:05:00.000Z",
    result: "done",
    persistedAt: "2026-10-22T10:05:00.000Z",
    deleteAfter: "2026-10-23T10:05:00.000Z",
    expiresAt: "2026-10-29T10:05:00.000Z",
    ...overrides,
  }
}

describe("TaskLedger", () => {
  test("#given persisted records from two parents #when the ledger is queried by parent #then only that parent comes back", () => {
    // given
    const ledger = new TaskLedger()
    ledger.upsert(createRecord("bg_aaa11111", "ses_one"))
    ledger.upsert(createRecord("bg_bbb22222", "ses_two"))

    // when
    const records = ledger.getByParentSession("ses_one")

    // then
    expect(records).toHaveLength(1)
    expect(records[0]?.taskId).toBe("bg_aaa11111")
  })

  test("#given the same task id twice #when the ledger is upserted #then the latest record wins", () => {
    // given
    const ledger = new TaskLedger()
    ledger.upsert(createRecord("bg_aaa11111", "ses_one"))

    // when
    ledger.upsert(createRecord("bg_aaa11111", "ses_one", { result: "updated" }))

    // then
    expect(ledger.get("bg_aaa11111")?.result).toBe("updated")
    expect(ledger.size).toBe(1)
  })

  test("#given a removed record #when the ledger is queried #then nothing is left", () => {
    // given
    const ledger = new TaskLedger()
    ledger.upsert(createRecord("bg_aaa11111", "ses_one"))

    // when
    ledger.remove("bg_aaa11111")

    // then
    expect(ledger.get("bg_aaa11111")).toBeUndefined()
    expect(ledger.getByParentSession("ses_one")).toHaveLength(0)
    expect(ledger.size).toBe(0)
  })
})

describe("buildTaskLedgerSummary", () => {
  test("#given one live and two terminal tasks #when the summary is built #then the counts split by recoverability", () => {
    // given
    const input = {
      liveTaskIds: ["bg_live11111"],
      persistedRecords: [
        createRecord("bg_done11111", "ses_one"),
        createRecord("bg_lost11111", "ses_one", { result: undefined, persistenceError: "disk full" }),
      ],
      summaryTaskIds: [] as string[],
    }

    // when
    const summary = buildTaskLedgerSummary(input)

    // then
    expect(summary.knownTaskIds.sort()).toEqual(["bg_done11111", "bg_live11111", "bg_lost11111"])
    expect(summary.recoverableTaskIds).toEqual(["bg_done11111"])
    expect(summary.unrecoverableTaskIds).toEqual(["bg_lost11111"])
    expect(summary.inProgressTaskIds).toEqual(["bg_live11111"])
    expect(summary.completedTaskIds.sort()).toEqual(["bg_done11111", "bg_lost11111"])
  })

  test("#given a task that is live and persisted at once #when the summary is built #then it is counted once and treated as terminal", () => {
    // given
    const input = {
      liveTaskIds: ["bg_aaa11111"],
      persistedRecords: [createRecord("bg_aaa11111", "ses_one")],
      summaryTaskIds: ["bg_aaa11111"] as string[],
    }

    // when
    const summary = buildTaskLedgerSummary(input)

    // then
    expect(summary.knownTaskIds).toEqual(["bg_aaa11111"])
    expect(summary.inProgressTaskIds).toEqual([])
    expect(summary.completedTaskIds).toEqual(["bg_aaa11111"])
    expect(summary.recoverableTaskIds).toEqual(["bg_aaa11111"])
  })

  test("#given a terminal record with only a transcript #when the summary is built #then it is recoverable", () => {
    // given
    const input = {
      liveTaskIds: [] as string[],
      persistedRecords: [createRecord("bg_aaa11111", "ses_one", { result: undefined, hasTranscript: true })],
      summaryTaskIds: [] as string[],
    }

    // when
    const summary = buildTaskLedgerSummary(input)

    // then
    expect(summary.recoverableTaskIds).toEqual(["bg_aaa11111"])
    expect(summary.unrecoverableTaskIds).toEqual([])
  })
})