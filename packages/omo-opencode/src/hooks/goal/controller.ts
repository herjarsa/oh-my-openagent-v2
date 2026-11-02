import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { clearGoal, createGoal, listGoals as listGoalsFromStore, readGoal, updateGoal } from "./store"
import type { Goal, GoalStatus, TokenUsageSnapshot } from "./types"
import { validateObjective } from "./validation"

export type GoalControllerOptions = {
  readonly projectDir: string
}

export type TuiLoopSnapshot = {
  readonly version: 1
  readonly activeGoalId: string | undefined
  readonly goals: readonly {
    readonly id: string
    readonly title: string
    readonly status: "in_progress" | "complete"
    readonly successCriteria: readonly []
  }[]
}

export type GoalController = ReturnType<typeof createGoalController>

export function createGoalController(options: GoalControllerOptions) {
  const { projectDir } = options
  const baseDir = join(projectDir, ".omo", "goal")

  const storeRef = (sessionID: string) => ({ baseDir, sessionID })
  const tuiMirrorPath = (sessionID: string) =>
    join(projectDir, ".omo", "ulw-loop", sessionID, "goals.json")

  const writeTuiMirror = (sessionID: string, goal: Goal | null): void => {
    const path = tuiMirrorPath(sessionID)
    const snapshot: TuiLoopSnapshot = {
      version: 1,
      activeGoalId: goal?.id,
      goals: goal === null
        ? []
        : [{
            id: goal.id,
            title: goal.objective,
            status: goalStatusForTui(goal.status),
            successCriteria: [],
          }],
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8")
  }

  return {
    setGoal(sessionID: string, rawObjective: string): Goal {
      const objective = validateObjective(rawObjective)
      const ref = storeRef(sessionID)
      clearGoal(ref)
      const goal = createGoal(ref, objective)
      writeTuiMirror(sessionID, goal)
      return goal
    },

    getGoal(sessionID: string): Goal | null {
      return readGoal(storeRef(sessionID))
    },

    listGoals(): Goal[] {
      return listGoalsFromStore(baseDir)
    },

    listActiveGoals(): Goal[] {
      return listGoalsFromStore(baseDir).filter((goal) => goal.status === "active")
    },

    pauseGoal(sessionID: string): Goal | null {
      const goal = updateGoal(storeRef(sessionID), { status: "paused" })
      if (goal !== null) writeTuiMirror(sessionID, goal)
      return goal
    },

    resumeGoal(sessionID: string): Goal | null {
      const goal = updateGoal(storeRef(sessionID), { status: "active" })
      if (goal !== null) writeTuiMirror(sessionID, goal)
      return goal
    },

    clearGoal(sessionID: string): boolean {
      const ref = storeRef(sessionID)
      const existed = readGoal(ref) !== null
      clearGoal(ref)
      writeTuiMirror(sessionID, null)
      return existed
    },

    markComplete(sessionID: string): Goal | null {
      const goal = updateGoal(storeRef(sessionID), { status: "complete" })
      if (goal !== null) writeTuiMirror(sessionID, goal)
      return goal
    },

    /**
     * Claim a startup resume for a goal: bump the resume counter and refresh the
     * start timestamp. The caller dispatches first and marks only on success.
     */
    markResumed(sessionID: string): Goal | null {
      const ref = storeRef(sessionID)
      const goal = readGoal(ref)
      if (goal === null) {
        return null
      }
      const updated = updateGoal(ref, {
        resumeCount: (goal.resumeCount ?? 0) + 1,
        lastStartedAt: nowSeconds(),
      })
      if (updated !== null) writeTuiMirror(sessionID, updated)
      return updated
    },

    accountUsage(
      sessionID: string,
      usage: TokenUsageSnapshot,
      elapsedSeconds: number,
      snapshot?: { readonly sessionTokenTotal?: number; readonly accountedAt?: number },
    ): Goal | null {
      const ref = storeRef(sessionID)
      const goal = readGoal(ref)
      if (goal === null || goal.status !== "active") {
        return goal
      }
      const tokenDelta = Math.max(0, usage.input) + Math.max(0, usage.output)
      const updated = updateGoal(ref, {
        tokensUsed: goal.tokensUsed + tokenDelta,
        timeUsedSeconds: goal.timeUsedSeconds + Math.max(0, elapsedSeconds),
        lastAccountedAt: snapshot?.accountedAt ?? nowSeconds(),
        ...(snapshot?.sessionTokenTotal !== undefined
          ? { lastAccountedTokens: snapshot.sessionTokenTotal }
          : {}),
      })
      if (updated !== null) writeTuiMirror(sessionID, updated)
      return updated
    },

    updateTui(sessionID: string): void {
      writeTuiMirror(sessionID, readGoal(storeRef(sessionID)))
    },
  }
}

export function goalStatusForTui(status: GoalStatus): "in_progress" | "complete" {
  return status === "complete" ? "complete" : "in_progress"
}

function nowSeconds(): number {
  return Math.trunc(Date.now() / 1000)
}
