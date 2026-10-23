import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeTaskRecord, readTaskRecord, listTaskRecords } from "../../../packages/omo-opencode/src/features/background-agent/persistence/record-store";
import { writeTaskTranscript, readTaskTranscript } from "../../../packages/omo-opencode/src/features/background-agent/persistence/transcript-store";
import { toBackgroundTask, type PersistedTaskRecord, type PersistedTaskTranscript } from "../../../packages/omo-opencode/src/features/background-agent/persistence/record";
import { getProjectStoreDir } from "../../../packages/omo-opencode/src/features/background-agent/persistence/paths";
import { buildBackgroundTaskNotificationText } from "../../../packages/omo-opencode/src/features/background-agent/background-task-notification-template";
import { createBackgroundOutput } from "../../../packages/omo-opencode/src/tools/background-task/create-background-output";
import type { BackgroundTask } from "../../../packages/omo-opencode/src/features/background-agent/types";

function check(name: string, cond: boolean, detail = "") {
  if (!cond) throw new Error("FAIL [" + name + "] " + detail);
  console.log("PASS [" + name + "]" + (detail ? " " + detail : ""));
}

const sandbox = mkdtempSync(path.join(tmpdir(), "omo-qa-durability-"));
const storeRoot = path.join(sandbox, "delegations");
process.env.OMO_RESULT_PERSISTENCE_ROOT = storeRoot;
const projectDir = path.join(sandbox, "project");
const now = Date.now();
const iso = (t: number) => new Date(t).toISOString();

function makeTask(id: string, answer: string): BackgroundTask {
  return {
    id, sessionId: "ses-child-" + id.slice(3, 8), parentSessionId: "ses-qa-parent",
    parentMessageId: "msg-qa-parent", description: "qa child " + id, prompt: "QA prompt " + id,
    agent: "explore", status: "completed", startedAt: new Date(now - 60000), completedAt: new Date(now),
  } as BackgroundTask;
}
function makeRecord(task: BackgroundTask, answer: string): PersistedTaskRecord {
  return {
    schemaVersion: 1, taskId: task.id, parentSessionId: task.parentSessionId,
    parentMessageId: task.parentMessageId, sessionId: task.sessionId, projectDirectory: projectDir,
    description: task.description, agent: task.agent, status: "completed",
    createdAt: iso(now - 120000), startedAt: iso(now - 60000), completedAt: iso(now),
    updatedAt: iso(now), result: answer + " from the durable store", persistedAt: iso(now),
    deleteAfter: iso(now + 60000), expiresAt: iso(now + 3600000),
  };
}
function makeTranscript(taskId: string, answer: string): PersistedTaskTranscript {
  return {
    schemaVersion: 1, taskId, messagesTruncated: false,
    messages: [{ id: "msg-1", info: { role: "assistant", time: iso(now - 30000) }, parts: [{ type: "text", text: answer + " inside the stored transcript" }] }],
  };
}

const taskOne = makeTask("bg_qaone111", "CHILD_ANSWER_ONE");
const taskTwo = makeTask("bg_qatwo222", "CHILD_ANSWER_TWO");
const recOne = makeRecord(taskOne, "CHILD_ANSWER_ONE");
const recTwo = makeRecord(taskTwo, "CHILD_ANSWER_TWO");
writeTaskRecord(recOne, storeRoot, projectDir);
writeTaskRecord(recTwo, storeRoot, projectDir);
const truncOne = writeTaskTranscript(taskOne.id, makeTranscript(taskOne.id, "CHILD_ANSWER_ONE").messages, 20971520, storeRoot, projectDir);
const truncTwo = writeTaskTranscript(taskTwo.id, makeTranscript(taskTwo.id, "CHILD_ANSWER_TWO").messages, 20971520, storeRoot, projectDir);
check("store.write", true, "truncated=" + truncOne + "/" + truncTwo);

const listed = listTaskRecords(storeRoot, projectDir);
check("store.lists-both", listed.length === 2, "found=" + listed.length);
const backOne = readTaskRecord(taskOne.id, storeRoot, projectDir);
check("store.roundtrip", backOne?.result === "CHILD_ANSWER_ONE from the durable store", String(backOne?.result));
check("store.retention-order", Date.parse(backOne!.deleteAfter) < Date.parse(backOne!.expiresAt));
const txOne = readTaskTranscript(taskOne.id, storeRoot, projectDir);
check("store.transcript", (txOne?.messages.length ?? 0) === 1);
const dir = getProjectStoreDir(storeRoot, projectDir);
const modeOne = (statSync(path.join(dir, taskOne.id + ".json")).mode & 0o777).toString(8);
console.log("INFO [store.mode] record mode=" + modeOne + " (POSIX 600; Windows reports ACL-mapped modes)");
check("store.result-holds-answer", (listed.map((r) => r.result).join(" ").match(/CHILD_ANSWER_/g) ?? []).length === 2);

const goneClient = { session: { messages: async () => { throw new Error("session not found"); } } };
const liveClient = { session: { messages: async () => ({ data: [{ id: "m-live", info: { role: "assistant", time: iso(now) }, parts: [{ type: "text", text: "the live answer" }] }] }) } };
const restartedManager = {
  getTask: (id: string) => { const r = readTaskRecord(id, storeRoot, projectDir); return r ? toBackgroundTask(r) : undefined; },
  getPersistedTaskRecord: (id: string) => readTaskRecord(id, storeRoot, projectDir),
  getPersistedTaskTranscript: (id: string) => readTaskTranscript(id, storeRoot, projectDir),
};
const ctx = { sessionID: "ses-qa-parent", messageID: "msg-qa", metadata: () => {} } as never;

const tool = createBackgroundOutput(restartedManager as never, goneClient as never);
const outOne = String(await tool.execute({ task_id: taskOne.id }, ctx));
check("readback.one", outOne.includes("CHILD_ANSWER_ONE") && outOne.includes("Source: persisted result (the child session is gone)"));
const outTwo = String(await tool.execute({ task_id: taskTwo.id }, ctx));
check("readback.two", outTwo.includes("CHILD_ANSWER_TWO") && outTwo.includes("Source: persisted result"));
const outFs = String(await tool.execute({ task_id: taskOne.id, full_session: true }, ctx));
check("fullsession.persisted", outFs.includes("CHILD_ANSWER_ONE inside the stored transcript") && outFs.includes("Source: persisted transcript (the child session is gone)"));
const outNf = String(await tool.execute({ task_id: "bg_qa_missing_0001" }, ctx));
check("notfound.names-store", outNf.includes("Task not found: bg_qa_missing_0001") && outNf.includes("delegations") && outNf.includes("retentionMs"));

const liveManager = { getTask: () => taskOne, getPersistedTaskRecord: () => undefined };
const liveTool = createBackgroundOutput(liveManager as never, liveClient as never);
const outLive = String(await liveTool.execute({ task_id: taskOne.id }, ctx));
check("live.cursor-unchanged", outLive.includes("the live answer") && !outLive.includes("Source: persisted result"));

const note = buildBackgroundTaskNotificationText({
  task: { id: taskOne.id, description: taskOne.description, status: "completed", recoverable: true },
  duration: "5s", statusText: "COMPLETED", allComplete: true, remainingCount: 0,
  completedTasks: [
    { id: taskOne.id, description: taskOne.description, status: "completed", recoverable: true },
    { id: taskTwo.id, description: taskTwo.description, status: "completed", recoverable: true },
  ],
  knownCount: 2, recoverableCount: 2, unrecoverableCount: 0, inProgressCount: 0,
});
check("notification.known-tasks", note.includes("**Known tasks:** 2 (2 completed, 2 recoverable)"));

console.log("QA DURABILITY COMPLETE sandbox=" + sandbox);