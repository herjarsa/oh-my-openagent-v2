import type { AgentName, AgentOverrideConfig, AgentOverrides, BuiltinCommandName, HookName, McpName, OhMyOpenCodeConfig } from "./config"
import type { ConfigLoadError } from "./shared/config-errors"
import { definition as v2Definition } from "./v2/definition"

export default v2Definition

export type { AgentName, AgentOverrideConfig, AgentOverrides, BuiltinCommandName, HookName, McpName, OhMyOpenCodeConfig }

export type { ConfigLoadError }