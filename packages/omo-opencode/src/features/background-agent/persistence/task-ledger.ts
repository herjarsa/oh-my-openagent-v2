import type { PersistedTaskRecord } from "./record"

export class TaskLedger {
  private readonly records = new Map<string, PersistedTaskRecord>()
  private readonly taskIdsByParent = new Map<string, Set<string>>()

  get size(): number {
    return this.records.size
  }

  upsert(record: PersistedTaskRecord): void {
    const previous = this.records.get(record.taskId)
    if (previous && previous.parentSessionId !== record.parentSessionId) {
      this.taskIdsByParent.get(previous.parentSessionId)?.delete(record.taskId)
    }
    this.records.set(record.taskId, record)
    const taskIds = this.taskIdsByParent.get(record.parentSessionId) ?? new Set<string>()
    taskIds.add(record.taskId)
    this.taskIdsByParent.set(record.parentSessionId, taskIds)
  }

  get(taskId: string): PersistedTaskRecord | undefined {
    return this.records.get(taskId)
  }

  getByParentSession(parentSessionId: string): PersistedTaskRecord[] {
    const taskIds = this.taskIdsByParent.get(parentSessionId)
    if (!taskIds) return []
    const records: PersistedTaskRecord[] = []
    for (const taskId of taskIds) {
      const record = this.records.get(taskId)
      if (record) records.push(record)
    }
    return records
  }

  remove(taskId: string): void {
    const record = this.records.get(taskId)
    if (!record) return
    this.records.delete(taskId)
    const taskIds = this.taskIdsByParent.get(record.parentSessionId)
    taskIds?.delete(taskId)
    if (taskIds?.size === 0) {
      this.taskIdsByParent.delete(record.parentSessionId)
    }
  }

  populateFrom(records: Iterable<PersistedTaskRecord>): void {
    for (const record of records) {
      this.upsert(record)
    }
  }
}

export interface TaskLedgerSummary {
  knownTaskIds: string[]
  completedTaskIds: string[]
  recoverableTaskIds: string[]
  unrecoverableTaskIds: string[]
  inProgressTaskIds: string[]
}

export interface TaskLedgerSummaryInput {
  liveTaskIds: string[]
  persistedRecords: PersistedTaskRecord[]
  summaryTaskIds: string[]
}

function isRecoverable(record: PersistedTaskRecord): boolean {
  if (record.persistenceError !== undefined) return false
  return Boolean(record.result) || record.hasTranscript === true
}

export function buildTaskLedgerSummary(input: TaskLedgerSummaryInput): TaskLedgerSummary {
  const known = new Set<string>()
  const completed = new Set<string>()
  const recoverable = new Set<string>()
  const unrecoverable = new Set<string>()
  const inProgress = new Set<string>()

  for (const taskId of input.liveTaskIds) {
    known.add(taskId)
    inProgress.add(taskId)
  }
  for (const taskId of input.summaryTaskIds) {
    known.add(taskId)
  }
  for (const record of input.persistedRecords) {
    known.add(record.taskId)
    inProgress.delete(record.taskId)
    completed.add(record.taskId)
    if (isRecoverable(record)) {
      recoverable.add(record.taskId)
    } else {
      unrecoverable.add(record.taskId)
    }
  }

  return {
    knownTaskIds: [...known],
    completedTaskIds: [...completed],
    recoverableTaskIds: [...recoverable],
    unrecoverableTaskIds: [...unrecoverable],
    inProgressTaskIds: [...inProgress],
  }
}