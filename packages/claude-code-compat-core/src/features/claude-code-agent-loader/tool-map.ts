/**
 * Maps Claude Code tool names (as used in ECC agent frontmatter: `tools: Read, Grep, ...`)
 * to OpenCode tool names. Names not present in the map are lowercased and passed through,
 * which already covers the common case (Read -> read, Grep -> grep, ...).
 *
 * MCP tools follow Claude's `mcp__<server>__<tool>` convention and are mapped to
 * OpenCode's `<server>_<tool>` convention (underscores, hyphens -> underscores).
 */
const CLAUDE_TO_OPENCODE_TOOL: Readonly<Record<string, string>> = {
  Read: "read",
  Write: "write",
  Edit: "edit",
  MultiEdit: "multi_edit",
  Grep: "grep",
  Glob: "glob",
  Bash: "bash",
  Task: "task",
  WebFetch: "webfetch",
  WebSearch: "websearch",
  LS: "ls",
  NotebookRead: "read",
  NotebookEdit: "edit",
  AskUserQuestion: "question",
};

export function mapClaudeToolName(claudeTool: string): string {
  const trimmed = claudeTool.trim();
  if (trimmed.length === 0) return trimmed;

  const direct = CLAUDE_TO_OPENCODE_TOOL[trimmed];
  if (direct) return direct;

  const mcpMatch = /^mcp__(.+?)__(.+)$/.exec(trimmed);
  if (mcpMatch) {
    const server = mcpMatch[1].replace(/-/g, "_");
    const tool = mcpMatch[2].replace(/-/g, "_");
    return `${server}_${tool}`.toLowerCase();
  }

  return trimmed.toLowerCase();
}

export function mapClaudeTools(claudeTools: string | string[]): string[] {
  const items = Array.isArray(claudeTools)
    ? claudeTools
    : claudeTools.split(",").map((t) => t.trim()).filter(Boolean);
  return items.map(mapClaudeToolName);
}
