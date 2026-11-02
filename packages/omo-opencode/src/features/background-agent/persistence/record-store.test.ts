import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { getProjectHash, getProjectStoreDir, getRecordPath, getTranscriptPath } from "./paths"
import type { PersistedTaskRecord } from "./record"
import {
  deleteTaskRecord,
  listTaskRecords,
  readTaskRecord,
  sweepExpiredTaskRecords,
  writeTaskRecord,
} from "./record-store"
import { capTranscriptMessages, readTaskTranscript, writeTaskTranscript } from "./transcript-store"

const createdRoots: string[] = []

function createRoot(): string {
  const root = join(tmpdir(), `omo-bg-store-${crypto.randomUUID()}`)
  createdRoots.push(root)
  return root
}

function createRecord(overrides: Partial<PersistedTaskRecord> = {}): PersistedTaskRecord {
  return {
    schemaVersion: 1,
    taskId: "bg_aaa11111",
    parentSessionId: "ses_parent",
    parentMessageId: "msg_parent",
    sessionId: "ses_child",
    projectDirectory: "/tmp/project",
    description: "first task",
    agent: "explore",
    status: "completed",
    createdAt: "2026-10-22T10:00:00.000Z",
    startedAt: "2026-10-22T10:00:01.000Z",
    completedAt: "2026-10-22T10:05:00.000Z",
    updatedAt: "2026-10-22T10:05:00.000Z",
    result: "the final output",
    persistedAt: "2026-10-22T10:05:00.000Z",
    deleteAfter: "2026-10-23T10:05:00.000Z",
    expiresAt: "2026-10-29T10:05:00.000Z",
    ...overrides,
  }
}

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
})

describe("persistence paths", () => {
  test("#given the same directory #when the project hash is computed twice #then both hashes match", () => {
    // given
    const directory = join(tmpdir(), "Some-Project")

    // when
    const first = getProjectHash(directory)
    const second = getProjectHash(directory)

    // then
    expect(first).toBe(second)
    expect(first).toHaveLength(16)
  })

  test("#given a directory with mixed case #when the project hash is computed #then the hash is case insensitive", () => {
    // given
    const directory = join(tmpdir(), "Some-Project")

    // when
    const lower = getProjectHash(directory.toLowerCase())
    const upper = getProjectHash(directory.toUpperCase())

    // then
    expect(lower).toBe(upper)
  })

  test("#given a project directory #when both paths are built #then they sit under the root", () => {
    // given
    const root = createRoot()
    const project = join(tmpdir(), "project")

    // when
    const recordPath = getRecordPath(root, project, "bg_aaa11111")
    const transcriptPath = getTranscriptPath(root, project, "bg_aaa11111")

    // then
    expect(recordPath.startsWith(root)).toBe(true)
    expect(recordPath.endsWith("bg_aaa11111.json")).toBe(true)
    expect(transcriptPath.endsWith("bg_aaa11111.transcript.json")).toBe(true)
    expect(getProjectStoreDir(root, project).startsWith(root)).toBe(true)
  })
})

describe("record store", () => {
  test("#given a written record #when it is read back #then every field survives", () => {
    // given
    const root = createRoot()
    const record = createRecord()
    writeTaskRecord(record, root, record.projectDirectory)

    // when
    const read = readTaskRecord(record.taskId, root, record.projectDirectory)

    // then
    expect(read?.taskId).toBe(record.taskId)
    expect(read?.parentSessionId).toBe(record.parentSessionId)
    expect(read?.result).toBe("the final output")
    expect(read?.status).toBe("completed")
  })

  test("#given a written record #when the store directory is listed #then no temporary file is left behind", () => {
    // given
    const root = createRoot()
    const record = createRecord()
    writeTaskRecord(record, root, record.projectDirectory)

    // when
    const entries = readdirSync(getProjectStoreDir(root, record.projectDirectory))

    // then
    expect(entries.filter((entry) => entry.endsWith(".tmp"))).toHaveLength(0)
  })

  test("#given a corrupt record file #when it is read #then undefined is returned and nothing throws", () => {
    // given
    const root = createRoot()
    const record = createRecord()
    mkdirSync(getProjectStoreDir(root, record.projectDirectory), { recursive: true })
    const recordPath = getRecordPath(root, record.projectDirectory, record.taskId)
    writeFileSync(recordPath, "{ not json", "utf-8")

    // when
    const read = readTaskRecord(record.taskId, root, record.projectDirectory)

    // then
    expect(read).toBeUndefined()
  })

  test("#given a record with a foreign schema version #when it is read #then undefined is returned", () => {
    // given
    const root = createRoot()
    const record = createRecord({ schemaVersion: 99 })
    writeTaskRecord(record, root, record.projectDirectory)

    // when
    const read = readTaskRecord(record.taskId, root, record.projectDirectory)

    // then
    expect(read).toBeUndefined()
  })

  test("#given records from two parents #when the store is listed #then both parents come back", () => {
    // given
    const root = createRoot()
    writeTaskRecord(createRecord({ taskId: "bg_aaa11111", parentSessionId: "ses_one" }), root, "/tmp/project")
    writeTaskRecord(createRecord({ taskId: "bg_bbb22222", parentSessionId: "ses_two" }), root, "/tmp/project")

    // when
    const records = listTaskRecords(root, "/tmp/project")

    // then
    expect(records.map((entry) => entry.parentSessionId).sort()).toEqual(["ses_one", "ses_two"])
  })

  test("#given an expired record and a live record #when the store is swept #then only the expired one is removed", () => {
    // given
    const root = createRoot()
    writeTaskRecord(createRecord({ taskId: "bg_old11111", expiresAt: "2026-10-01T00:00:00.000Z" }), root, "/tmp/project")
    writeTaskRecord(createRecord({ taskId: "bg_new22222", expiresAt: "2027-01-01T00:00:00.000Z" }), root, "/tmp/project")

    // when
    const removed = sweepExpiredTaskRecords(root, "/tmp/project", Date.parse("2026-10-22T12:00:00.000Z"))

    // then
    expect(removed).toEqual(["bg_old11111"])
    expect(readTaskRecord("bg_new22222", root, "/tmp/project")).toBeDefined()
  })

  test("#given a record #when it is deleted #then it is gone from the store", () => {
    // given
    const root = createRoot()
    const record = createRecord()
    writeTaskRecord(record, root, record.projectDirectory)

    // when
    deleteTaskRecord(record.taskId, root, record.projectDirectory)

    // then
    expect(readTaskRecord(record.taskId, root, record.projectDirectory)).toBeUndefined()
  })
})

describe("transcript store", () => {
  test("#given a transcript under the cap #when it is written #then nothing is truncated", () => {
    // given
    const root = createRoot()
    const messages = [{ id: "m1", info: { role: "assistant" }, parts: [{ type: "text", text: "hello" }] }]

    // when
    const truncated = writeTaskTranscript("bg_aaa11111", messages, 1024 * 1024, root, "/tmp/project")
    const read = readTaskTranscript("bg_aaa11111", root, "/tmp/project")

    // then
    expect(truncated).toBe(false)
    expect(read?.messages).toHaveLength(1)
    expect(read?.messagesTruncated).toBe(false)
  })

  test("#given a transcript over the cap #when it is capped #then the oldest messages are dropped and the flag is set", () => {
    // given
    const messages = Array.from({ length: 50 }, (_, index) => ({
      id: `m${index}`,
      info: { role: 'assistant' },
      parts: [{ type: 'text', text: 'x'.repeat(1000) }],
    }))

    // when
    const capped = capTranscriptMessages(messages, 5000)

    // then
    expect(capped.truncated).toBe(true)
    expect(capped.messages.length).toBeLessThan(messages.length)
    expect(capped.messages[capped.messages.length - 1]?.id).toBe("m49")
  })
})
