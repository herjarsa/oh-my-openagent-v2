import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const REPOSITORY_ROOT = repositoryRootFromMetaUrl(import.meta.url)
const OLD_MODEL_ID = ["gpt-5.4", "mini"].join("-")
const OLD_DISPLAY_NAME = ["GPT 5.4", "Mini"].join(" ")

describe("GPT Mini reference audit", () => {
  test("repository root decodes a platform-native file URL", () => {
    // given
    const repositoryDir = join(tmpdir(), "gpt mini audit")
    const scriptUrl = pathToFileURL(join(repositoryDir, "script", "audit.test.ts")).href

    // when
    const root = repositoryRootFromMetaUrl(scriptUrl)

    // then
    expect(root).toBe(`${repositoryDir}${sep}`)
  })

  test("tracked shipped files no longer reference the retired GPT Mini model", async () => {
    // given
    const files = await trackedFilesReferencingRetiredModel()

    // when
    const matches: string[] = []
    for (const file of files) {
      const path = `${REPOSITORY_ROOT}${file}`
      if (!existsSync(path)) continue
      if (!(await stat(path)).isFile()) continue
      const content = await readFile(path, "utf8")
      if (content.toLowerCase().includes(OLD_MODEL_ID) || content.includes(OLD_DISPLAY_NAME)) {
        matches.push(file)
      }
    }

    // then
    expect(matches).toEqual([])
  }, 60_000)
})

/**
 * Tracked files that mention the retired model id or display name.
 *
 * The audit covers every tracked shipped file, so the candidate set is resolved with `git grep`,
 * which reads the tracked tree natively and reports only the files that mention the retired model.
 * The model id is matched case-insensitively and the display name case-sensitively, exactly like
 * the content check that runs afterwards.
 */
async function trackedFilesReferencingRetiredModel(): Promise<string[]> {
  const candidates = new Set<string>()

  for (const [literal, ignoreCase] of [[OLD_MODEL_ID, true], [OLD_DISPLAY_NAME, false]] as const) {
    const args = ["grep", "-F", "-l", "-a"]
    if (ignoreCase) args.push("-i")
    args.push("-e", literal)

    const process = Bun.spawn(["git", ...args], {
      cwd: REPOSITORY_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ])
    if (exitCode !== 0 && exitCode !== 1) {
      throw new Error(`git grep failed: ${stderr.trim()}`)
    }

    for (const file of stdout.split("\n").map((line) => line.trim()).filter((line) => line.length > 0)) {
      candidates.add(file)
    }
  }

  return [...candidates].filter((file) => !file.startsWith(".omo/evidence/")).toSorted()
}

function repositoryRootFromMetaUrl(metaUrl: string): string {
  return fileURLToPath(new URL("../", metaUrl))
}
