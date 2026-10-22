import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { PluginInput } from "@opencode-ai/plugin"

import { BackgroundManager } from "./manager"
import type { BackgroundTask } from "./types"

type ManagerInternals = {
  finalizeTerminalTask: (task: BackgroundTask) => Promise<void>
  taskLedger: {
    getByParentSession: (parentSessionId: string) => Array<{ taskId: string; result?: string; persistenceError?: string }>
  }
  tasks: Map<string, BackgroundTask>
  completedTaskArchive: Map<string, BackgroundTask>
}

const createdRoots: string[] = []

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
  Reflect.set(globalThis, "__omoBackgroundTaskRegistry", {
    activeTasks: new Map(),
    completedTasks: new Map(),
  })
})

function createManager(overrides: Record<string, unknown> = {}): BackgroundManager {
  const root = mkdtempSync(join(tmpdir(), "omo-bg-manager-"))
  createdRoots.push(root)
  const client = {
    session: {
      abort: async () => ({ data: true }),
      messages: async () => ({
        data: [
          {
            info: { role: "assistant", id: "msg-1" },
            parts: [{ type: "text", text: "the persisted answer" }],
          },
        ],
      }),
      ...overrides,
    },
  }
  const ctx: PluginInput = {
    client: client as PluginInput["client"],
    project: {} as PluginInput["project"],
    directory: tmpdir(),
    worktree: tmpdir(),
    serverUrl: new URL("http://localhost"),
    $: {} as PluginInput["$"],
  }
  return new BackgroundManager({
    pluginContext: ctx,
    config: { resultPersistence: { root } },
  })
}

function createCompletedTask(): BackgroundTask {
  return {
    id: "bg_aaa11111",
    parentSessionId: "ses_parent",
    parentMessageId: "msg_parent",
    sessionId: "ses_child",
    description: "the task description",
    prompt: "do the work",
    agent: "explore",
    status: "completed",
    queuedAt: new Date("2026-10-22T10:00:00.000Z"),
    startedAt: new Date("2026-10-22T10:00:01.000Z"),
    completedAt: new Date("2026-10-22T10:05:00.000Z"),
  }
}

function internals(manager: BackgroundManager): ManagerInternals {
  return manager as unknown as ManagerInternals
}

function findRecordPath(root: string, taskId: string): string | undefined {
  for (const entry of readdirSync(root)) {
    const projectDir = join(root, entry)
    const candidate = join(projectDir, `${taskId}.json`)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

describe("BackgroundManager persistence", () => {
  test("#given a completed task #when it is finalized #then the record and the transcript sidecar are written", async () => {
    // given
    const manager = createManager()
    const task = createCompletedTask()

    // when
    await internals(manager).finalizeTerminalTask(task)

    // then
    const recordPath = findRecordPath(tmpRootFor(manager), task.id)
    expect(recordPath).toBeDefined()
    const record = JSON.parse(readFileSync(recordPath as string, "utf-8")) as {
      result?: string
      hasTranscript?: boolean
      status?: string
    }
    expect(record.status).toBe("completed")
    expect(record.result).toBe("the persisted answer")
    expect(record.hasTranscript).toBe(true)
    const transcriptPath = (recordPath as string).replace(/\.json$/, ".transcript.json")
    expect(existsSync(transcriptPath)).toBe(true)
  })

  test("#given a finalized task #when the memory maps are cleared #then getTask still returns it from the store", async () => {
    // given
    const manager = createManager()
    const task = createCompletedTask()
    await internals(manager).finalizeTerminalTask(task)

    // when
    internals(manager).tasks.clear()
    internals(manager).completedTaskArchive.clear()
    Reflect.set(globalThis, "__omoBackgroundTaskRegistry", {
      activeTasks: new Map(),
      completedTasks: new Map(),
    })
    const recovered = manager.getTask(task.id)

    // then
    expect(recovered).toBeDefined()
    expect(recovered?.persisted).toBe(true)
    expect(recovered?.result).toBe("the persisted answer")
    expect(recovered?.prompt).toBe("")
  })

  test("#given a session.messages call that rejects #when the task is finalized #then the record is written without a result and nothing throws", async () => {
    // given
    const manager = createManager({
      messages: async () => {
        throw new Error("session not found")
      },
    })
    const task = createCompletedTask()

    // when
    await internals(manager).finalizeTerminalTask(task)

    // then
    const recordPath = findRecordPath(tmpRootFor(manager), task.id)
    expect(recordPath).toBeDefined()
    const record = JSON.parse(readFileSync(recordPath as string, "utf-8")) as {
      result?: string
      hasTranscript?: boolean
    }
    expect(record.result).toBeUndefined()
    expect(record.hasTranscript).toBeUndefined()
  })

  test("#given a finalized task #when the ledger is queried by parent #then the record is listed with its result", async () => {
    // given
    const manager = createManager()
    const task = createCompletedTask()

    // when
    await internals(manager).finalizeTerminalTask(task)
    const records = internals(manager).taskLedger.getByParentSession("ses_parent")

    // then
    expect(records).toHaveLength(1)
    expect(records[0]?.taskId).toBe("bg_aaa11111")
    expect(records[0]?.result).toBe("the persisted answer")
    expect(records[0]?.persistenceError).toBeUndefined()
  })

  test("#given a task that is not terminal #when it is finalized #then nothing is written", async () => {
    // given
    const manager = createManager()
    const task: BackgroundTask = { ...createCompletedTask(), status: "running", completedAt: undefined }

    // when
    await internals(manager).finalizeTerminalTask(task)

    // then
    expect(findRecordPath(tmpRootFor(manager), task.id)).toBeUndefined()
    expect(internals(manager).taskLedger.getByParentSession("ses_parent")).toHaveLength(0)
  })
})

function tmpRootFor(manager: BackgroundManager): string {
  const config = (manager as unknown as { config?: { resultPersistence?: { root?: string } } }).config
  return config?.resultPersistence?.root as string
}