import { describe, expect, it } from "bun:test"
import { tool as v1ToolFactory } from "@opencode-ai/plugin/tool"
import type { LoadedSkill } from "../features/opencode-skill-loader/types"
import { createSkillTool } from "../tools/skill/tools"
import {
  convertArgsToJsonSchema,
  registerV1Tools,
  type V1AskIdentity,
  type V1AskInput,
  type V2ToolDefinition,
} from "./tool-bridge-register"

describe("convertArgsToJsonSchema", () => {
  it("#given a zod raw shape #when converted #then properties and required map over", () => {
    // when
    const schema = convertArgsToJsonSchema({
      pattern: v1ToolFactory.schema.string().describe("regex"),
      include: v1ToolFactory.schema.string().optional(),
    })

    // then
    expect(schema["type"]).toBe("object")
    expect(schema["$schema"]).toBeUndefined()
    const properties = schema["properties"] as Record<string, unknown>
    expect(Object.keys(properties).sort()).toEqual(["include", "pattern"])
    expect(schema["required"]).toEqual(["pattern"])
  })

  it("#given a broken shape #when converted #then it falls back without throwing", () => {
    // when
    const schema = convertArgsToJsonSchema(null)

    // then
    expect(schema["type"]).toBe("object")
  })
})

describe("registerV1Tools", () => {
  it("#given V1 definitions #when registered #then they land on the editor with adapted execute", async () => {
    // given
    const added: V2ToolDefinition[] = []
    const tools = {
      echo: v1ToolFactory({
        description: "echo",
        args: { text: v1ToolFactory.schema.string() },
        execute: async (args) => `got:${args.text}`,
      }),
    }

    // when
    const result = registerV1Tools({ add: (tool) => void added.push(tool) }, tools, { directory: "C:\\x" })

    // then
    expect(result).toEqual({ registered: ["echo"], failed: [] })
    expect(added[0]?.input).toMatchObject({ type: "object" })
    const out = (await added[0]?.execute({ text: "hi" }, { sessionID: "ses-1" })) as { content: string }
    expect(out.content).toBe("got:hi")
  })

  it("#given a throwing execute #when run #then it surfaces as error content", async () => {
    // given
    const added: V2ToolDefinition[] = []
    const tools = {
      boom: v1ToolFactory({
        description: "boom",
        args: {},
        execute: async () => {
          throw new Error("kaput")
        },
      }),
    }
    registerV1Tools({ add: (tool) => void added.push(tool) }, tools, { directory: "C:\\x" })

    // when
    const out = (await added[0]?.execute({}, {})) as { content: string; metadata: { error: boolean } }

    // then
    expect(out.content).toContain("kaput")
    expect(out.metadata.error).toBe(true)
  })

  it("#given no permission bridge #when a tool asks #then the historical V2 gap is named", async () => {
    // given
    const added: V2ToolDefinition[] = []
    const tools = {
      asks: v1ToolFactory({
        description: "asks",
        args: {},
        execute: async (_args, ctx) => {
          await ctx.ask({ permission: "skill", patterns: ["x"], always: ["x"], metadata: {} })
          return "never"
        },
      }),
    }
    registerV1Tools({ add: (tool) => void added.push(tool) }, tools, { directory: "C:\\x" })

    // when
    const out = (await added[0]?.execute({}, {})) as { content: string; metadata: { error: boolean } }

    // then
    expect(out.content).toContain("interactive ask() has no V2 equivalent")
    expect(out.metadata.error).toBe(true)
  })

  it("#given a permission bridge #when a tool asks #then the V2 permission sees the request and the tool continues", async () => {
    // given
    const added: V2ToolDefinition[] = []
    const seen: Array<{ input: V1AskInput; identity: V1AskIdentity }> = []
    const tools = {
      asks: v1ToolFactory({
        description: "asks",
        args: {},
        execute: async (_args, ctx) => {
          await ctx.ask({
            permission: "skill",
            patterns: ["lazy-skill"],
            always: ["lazy-skill"],
            metadata: { skill: "lazy-skill" },
          })
          return "loaded"
        },
      }),
    }
    registerV1Tools({ add: (tool) => void added.push(tool) }, tools, {
      directory: "C:\\x",
      ask: async (input, identity) => void seen.push({ input, identity }),
    })

    // when
    const out = (await added[0]?.execute(
      {},
      { sessionID: "ses-9", messageID: "msg-9", agent: "sisyphus-junior", id: "call-9" },
    )) as { content: string }

    // then
    expect(out.content).toBe("loaded")
    expect(seen).toEqual([
      {
        input: {
          permission: "skill",
          patterns: ["lazy-skill"],
          always: ["lazy-skill"],
          metadata: { skill: "lazy-skill" },
        },
        identity: { sessionID: "ses-9", messageID: "msg-9", agent: "sisyphus-junior", callID: "call-9" },
      },
    ])
  })

  it("#given the real skill tool #when a skill loads through the bridge #then the body arrives", async () => {
    // given
    const added: V2ToolDefinition[] = []
    const asserted: V1AskInput[] = []
    const lazySkill: LoadedSkill = {
      name: "lazy-skill",
      definition: {
        name: "lazy-skill",
        description: "Test skill lazy-skill",
        template: "BODY-OF-LAZY-SKILL",
      },
      scope: "config",
    }
    const skillTool = createSkillTool({ skills: [lazySkill], commands: [] })
    registerV1Tools({ add: (tool) => void added.push(tool) }, { skill: skillTool }, {
      directory: "C:\\x",
      ask: async (input) => void asserted.push(input),
    })

    // when
    const out = (await added[0]?.execute(
      { name: "lazy-skill" },
      { sessionID: "ses-1", messageID: "msg-1", agent: "sisyphus", id: "call-1" },
    )) as { content: string }

    // then
    expect(asserted[0]).toEqual({
      permission: "skill",
      patterns: ["lazy-skill"],
      always: ["lazy-skill"],
      metadata: { skill: "lazy-skill" },
    })
    expect(out.content).toContain("BODY-OF-LAZY-SKILL")
  })
})
