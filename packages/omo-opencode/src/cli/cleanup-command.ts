import { Option, type Command } from "commander"
import { cleanup, resolveCleanupPlatform } from "./cleanup"
import type { CleanupOptions } from "./cleanup"

type CleanupCommandOptions = {
  readonly platform?: CleanupOptions["platform"]
  readonly project?: CleanupOptions["project"]
  readonly json?: CleanupOptions["json"]
}

type CleanupRootCommandOptions = {
  readonly platform?: CleanupOptions["platform"]
}

export { resolveCleanupPlatform }

export function configureCleanupCommand(program: Command): void {
  program
    .command("cleanup")
    .alias("uninstall")
    .description("Clean managed plugin state (OpenCode-only)")
    .addOption(new Option("--platform <platform>", "Cleanup target platform: opencode").choices(["opencode"]))
      .option("--project <path>", "Project directory to inspect")
    .option("--json", "Output structured JSON result")
    .addHelpText("after", `
Examples:
  $ bunx oh-my-openagent cleanup
  $ bunx oh-my-openagent cleanup --platform=opencode
  $ bunx oh-my-openagent cleanup --project /path/to/project
`)
    .action(async (options: CleanupCommandOptions) => {
      const rootOptions = program.opts<CleanupRootCommandOptions>()
      const platform = resolveCleanupPlatform({ platform: options.platform ?? rootOptions.platform })
      const exitCode = await cleanup({
        platform,
          project: options.project,
        json: options.json ?? false,
      })
      process.exit(exitCode)
    })
}
