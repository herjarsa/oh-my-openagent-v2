export const PLUGIN_NAME = "oh-my-openagent"
export const LEGACY_PLUGIN_NAME = "oh-my-opencode"
export const PUBLISHED_PACKAGE_NAME = "oh-my-openagent"
// Fork release name: the soft-fork publishes the root as a scoped package,
// so doctor/update probes must also recognize fork-named installs.
export const FORK_PACKAGE_NAME = "@herjarsa/oh-my-openagent-v2"
export const ACCEPTED_PACKAGE_NAMES = [PLUGIN_NAME, LEGACY_PLUGIN_NAME, FORK_PACKAGE_NAME]
export const LOG_FILENAME = "oh-my-opencode.log"
export const CACHE_DIR_NAME = "oh-my-opencode"
