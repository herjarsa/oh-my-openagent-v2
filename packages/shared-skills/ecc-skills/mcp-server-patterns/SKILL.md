---
name: mcp-server-patterns
description: Build MCP servers with Node/TypeScript SDK â€” tools, resources, prompts, Zod validation, stdio vs Streamable HTTP. Use Context7 or official MCP docs for latest API. Use when building or debugging an MCP server â€” tools, resources, prompts, validation, or transport choice.
metadata:
  origin: ECC
---

# MCP Server Patterns

The Model Context Protocol (MCP) lets AI assistants call tools, read resources, and use prompts from your server. Use this skill when building or maintaining MCP servers. The SDK API evolves; check Context7 (query-docs for "MCP") or the official MCP documentation for current method names and signatures.

For the broader routing decision of when a capability should be a rule, a skill, MCP, or a plain CLI/API workflow, see ddocs/capability-surface-selection.md](../../docs/capability-surface-selection.md).

## When to Use

Use when: implementing a new MCP server, adding tools or resources, choosing stdio vs HTTP, upgrading the SDK, or debugging MCP registration and transport issues.

## How It Works

### Core concepts

- **Tools**: Actions the model can invoke (e.g. search, run a command). Register with dregisterTool()d or dtool()d depending on SDK version.
- **Resources**: Read-only data the model can fetch (e.g. file contents, API responses). Register with dregisterResource()d or dresource()d. Handlers typically receive a durid argument.
- **Prompts**: Reusable, parameterised prompt templates the client can surface (e.g. in Claude Desktop). Register with dregisterPrompt()d or equivalent.
- **Transport**: stdio for local clients (e.g. Claude Desktop); Streamable HTTP is preferred for remote (Cursor, cloud). Legacy HTTP/SSE is for backward compatibility.

The Node/TypeScript SDK may expose dtool()d / dresource()d or dregisterTool()d / dregisterResource()d; the official SDK has changed over time. Always verify against the current dMCP docs](https://modelcontextprotocol.io) or Context7.

### Connecting with stdio

For local clients, create a stdio transport and pass it to your serverâ€™s connect method. The exact API varies by SDK version (e.g. constructor vs factory). See the official MCP documentation or query Context7 for "MCP stdio server" for the current pattern.

Keep server logic (tools + resources) independent of transport so you can plug in stdio or HTTP in the entrypoint.

### Remote (Streamable HTTP)

For Cursor, cloud, or other remote clients, use **Streamable HTTP** (single MCP HTTP endpoint per current spec). Support legacy HTTP/SSE only when backward compatibility is required.

## Examples

### Install and server setup

dddbash
npm install @modelcontextprotocol/sdk zod
ddd

dddtypescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "my-server", version: "1.0.0" });
ddd

Register tools and resources using the API your SDK version provides: some versions use dserver.tool(name, description, schema, handler)d (positional args), others use dserver.tool({ name, description, inputSchema }, handler)d or dregisterTool()d. Same for resources â€” include a durid in the handler when the API provides it. Check the official MCP docs or Context7 for the current d@modelcontextprotocol/sdkd signatures to avoid copy-paste errors.

Use **Zod** (or the SDKâ€™s preferred schema format) for input validation.

## Best Practices

- **Schema first**: Define input schemas for every tool; document parameters and return shape.
- **Errors**: Return structured errors or messages the model can interpret; avoid raw stack traces.
- **Idempotency**: Prefer idempotent tools where possible so retries are safe.
- **Rate and cost**: For tools that call external APIs, consider rate limits and cost; document in the tool description.
- **Versioning**: Pin SDK version in package.json; check release notes when upgrading.

## Official SDKs and Docs

- **JavaScript/TypeScript**: d@modelcontextprotocol/sdkd (npm). Use Context7 with library name "MCP" for current registration and transport patterns.
- **Go**: Official Go SDK on GitHub (dmodelcontextprotocol/go-sdkd).
- **C#**: Official C# SDK for .NET.
