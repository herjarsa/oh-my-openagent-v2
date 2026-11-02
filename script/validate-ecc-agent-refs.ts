import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve, basename, extname } from "node:path"

const baseDir = resolve(import.meta.dir, "..", "packages", "shared-skills")
const eccAgentsDir = join(baseDir, "ecc-agents")
const eccCommandsDir = join(baseDir, "ecc-commands")
const eccSkillsDir = join(baseDir, "ecc-skills")

const BUILTINS = new Set([
  "build",
  "sisyphus",
  "oracle",
  "prometheus",
  "atlas",
  "hephaestus",
  "sisyphus-junior",
  "plan",
  "explore",
  "librarian",
])

const agentNames = new Set<string>(BUILTINS)

for (const name of readdirSync(eccAgentsDir)) {
  const full = join(eccAgentsDir, name)
  let st
  try {
    st = statSync(full)
  } catch {
    continue
  }
  if (!st.isFile()) continue
  if (extname(name) !== ".md") continue
  agentNames.add(basename(name, ".md"))
}

function frontmatter(content: string): string {
  const text = content.replace(/^\uFEFF/, "")
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return m ? m[1] : ""
}

function extractAgent(fm: string): string | null {
  const m = fm.match(/agent:\s*(\S+)/)
  return m ? m[1] : null
}

const errors: string[] = []
let commandCount = 0
let skillCount = 0

for (const name of readdirSync(eccCommandsDir)) {
  const full = join(eccCommandsDir, name)
  let st
  try {
    st = statSync(full)
  } catch {
    continue
  }
  if (!st.isFile()) continue
  if (extname(name) !== ".md") continue
  commandCount++
  const content = readFileSync(full, "utf8")
  const agent = extractAgent(frontmatter(content))
  if (agent && !agentNames.has(agent)) {
    errors.push(`Command ${name}: agent '${agent}' does not resolve`)
  }
}

for (const name of readdirSync(eccSkillsDir)) {
  const dir = join(eccSkillsDir, name)
  let st
  try {
    st = statSync(dir)
  } catch {
    continue
  }
  if (!st.isDirectory()) continue
  const skillFile = join(dir, "SKILL.md")
  let sfSt
  try {
    sfSt = statSync(skillFile)
  } catch {
    continue
  }
  if (!sfSt.isFile()) continue
  skillCount++
  const content = readFileSync(skillFile, "utf8")
  const agent = extractAgent(frontmatter(content))
  if (agent && !agentNames.has(agent)) {
    errors.push(`Skill ${name}: agent '${agent}' does not resolve`)
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(e)
  process.exit(1)
}

console.log(`OK: all agent references resolve (${commandCount} commands, ${skillCount} skills checked)`)
process.exit(0)
