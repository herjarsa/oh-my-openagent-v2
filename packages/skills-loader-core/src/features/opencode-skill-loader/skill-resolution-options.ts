import type { BrowserAutomationProvider, GitMasterConfig } from "../../types"

export interface SkillResolutionOptions {
	gitMasterConfig?: GitMasterConfig
	browserProvider?: BrowserAutomationProvider
	disabledSkills?: Set<string>
	teamModeEnabled?: boolean
	/** ECC skill profiles. Undefined = core default (agent sees the curated set). Explicit [] disables ECC skills. */
	eccProfiles?: string[]
	/** Project directory to discover project-level skills from. Falls back to process.cwd() if not provided. */
	directory?: string
}
