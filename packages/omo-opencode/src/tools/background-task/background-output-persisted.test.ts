/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import type { ToolContext } from "@opencode-ai/plugin/tool"
import type { BackgroundTask } from "../../features/background-agent"
import type { PersistedTaskRecord, PersistedTaskTranscript } from "../../features/background-agent/persistence/record"
import type { BackgroundOutputClient, BackgroundOutputManager } from "./clients"
import { createBackgroundOutput } from "./create-background-output"

const mockContext = {
  sessionID: "test-session",
  messageID: "test-message",
  agent: "test-agent",
  directory: "/tmp/project",
  worktree: "/tmp/project",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
} as ToolContext

function createCompletedTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: "bg_aaa11111",
    sessionId: "ses-child",
    parentSessionId: "ses-parent",
    parentMessageId: "msg-parent",
    description: "the completed task",
    prompt: "do the work",
    agent: "explore",
    status: "completed",
    startedAt: new Date("2026-10-22T10:00:00.000Z"),
    completedAt: new Date("2026-10-22T10:05:00.000Z"),
    ...overrides,
  }
}

function createPersistedRecord(overrides: Partial<PersistedTaskRecord> = {}): PersistedTaskRecord {
  return {
    schemaVersion: 1,
    taskId: "bg_aaa11111",
    parentSessionId: "ses-parent",
    sessionId: "ses-child",
    projectDirectory: "/tmp/project",
    description: "the completed task",
    agent: "explore",
    status: "completed",
    createdAt: "2026-10-22T10:00:00.000Z",
    completedAt: "2026-10-22T10:05:00.000Z",
    updatedAt: "2026-10-22T10:05:00.000Z",
    result: "the durable answer",
    persistedAt: "2026-10-22T10:05:00.000Z",
    deleteAfter: "2026-10-23T10:05:00.000Z",
    expiresAt: "2026-10-29T10:05:00.000Z",
    ...overrides,
  }
}

function createGoneSessionClient(): BackgroundOutputClient {
  return {
    session: {
      messages: async () => {
        throw new Error("session not found")
      },
    },
  }
}

describe("background_output with a persisted task", () => {
  test("#given a persisted task whose session is gone #when background_output is called #then the persisted result is returned with a recovery note", async () => {
    // given
    const task = createCompletedTask()
    const manager: BackgroundOutputManager = {
      getTask: () => task,
      getPersistedTaskRecord: () => createPersistedRecord(),
    }
    const tool = createBackgroundOutput(manager, createGoneSessionClient())

    // when
    const output = await tool.execute({ task_id: task.id }, mockContext)

    // then
    expect(output).toContain("the durable answer")
    expect(output).toContain("Source: persisted result (the child session is gone)")
  })

  test("#given a persisted task whose session is gone #when background_output is called with full_session #then the persisted transcript is rendered", async () => {
    // given
    const task = createCompletedTask()
    const transcript: PersistedTaskTranscript = {
      schemaVersion: 1,
      taskId: task.id,
      persistedAt: "2026-10-22T10:05:00.000Z",
      messages: [
        {
          info: { role: "assistant", time: "2026-10-22T10:04:00.000Z" },
          parts: [{ type: "text", text: "the transcript answer" }],
        },
      ],
    }
    const manager: BackgroundOutputManager = {
      getTask: () => task,
      getPersistedTaskRecord: () => createPersistedRecord(),
      getPersistedTaskTranscript: () => transcript,
    }
    const tool = createBackgroundOutput(manager, createGoneSessionClient())

    // when
    const output = await tool.execute({ task_id: task.id, full_session: true }, mockContext)

    // then
    expect(output).toContain("the transcript answer")
    expect(output).toContain("Source: persisted transcript (the child session is gone)")
  })

  test("#given a persisted task #when background_output is called with block #then it returns immediately without polling", async () => {
    // given
    const task = createCompletedTask()
    let lookupCount = 0
    const manager: BackgroundOutputManager = {
      getTask: () => {
        lookupCount += 1
        return task
      },
      getPersistedTaskRecord: () => createPersistedRecord(),
    }
    const tool = createBackgroundOutput(manager, createGoneSessionClient())

    // when
    const output = await tool.execute({ task_id: task.id, block: true, timeout: 60_000 }, mockContext)

    // then
    expect(lookupCount).toBe(1)
    expect(output).toContain("the durable answer")
  })

  test("#given a live session #when background_output is called #then the cursor behaviour is unchanged", async () => {
    // given
    const task = createCompletedTask({ sessionId: "ses-live-cursor" })
    const manager: BackgroundOutputManager = {
      getTask: () => task,
      getPersistedTaskRecord: () => undefined,
    }
    const client: BackgroundOutputClient = {
      session: {
        messages: async () => ({
          data: [
            {
              id: "msg-live-1",
              info: { role: "assistant", time: "2026-10-22T10:04:00.000Z" },
              parts: [{ type: "text", text: "the live answer" }],
            },
          ],
        }),
      },
    }
    const tool = createBackgroundOutput(manager, client)

    // when
    const output = await tool.execute({ task_id: task.id }, mockContext)

    // then
    expect(output).toContain("the live answer")
    expect(output).not.toContain("Source: persisted result")
  })
})
