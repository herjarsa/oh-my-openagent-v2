/**
 * Linter/formatter config protection ported from ECC (MIT:
 * affaan-m/ECC scripts/hooks/config-protection.js).
 *
 * Agents under quality pressure prefer weakening the linter config over
 * fixing the code. This guard blocks modifications to existing linter
 * configs while still allowing first-time creation (legitimate bootstrap).
 * Fail-closed: any stat error other than ENOENT is treated as "exists".
 */

const PROTECTED_FILES: ReadonlySet<string> = new Set([
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  ".prettierrc",
  ".prettierrc.js",
  ".prettierrc.cjs",
  ".prettierrc.json",
  ".prettierrc.yml",
  ".prettierrc.yaml",
  "prettier.config.js",
  "prettier.config.cjs",
  "prettier.config.mjs",
  "biome.json",
  "biome.jsonc",
  ".biome.json",
  ".biome.jsonc",
  ".ruff.toml",
  "ruff.toml",
  ".shellcheckrc",
  ".stylelintrc",
  ".stylelintrc.json",
  ".stylelintrc.yml",
  ".stylelintrc.yaml",
  ".stylelintrc.js",
  ".stylelintrc.cjs",
  ".stylelintrc.mjs",
  "stylelint.config.js",
  "stylelint.config.cjs",
  "stylelint.config.mjs",
  "stylelint.config.ts",
  "stylelint.config.mts",
  "stylelint.config.cts",
  ".markdownlint.json",
  ".markdownlint.jsonc",
  ".markdownlint.yaml",
  ".markdownlint.yml",
  ".markdownlint.cjs",
  ".markdownlint.mjs",
  ".markdownlintrc",
  ".markdownlint-cli2.jsonc",
  ".markdownlint-cli2.yaml",
  ".markdownlint-cli2.cjs",
  ".markdownlint-cli2.mjs",
  ".eslintignore",
  ".prettierignore",
  ".stylelintignore",
  ".markdownlintignore",
])

const PROTECTED_PATTERNS: readonly RegExp[] = [
  /^(eslint|prettier|stylelint|commitlint|oxlint)\.config(\.[A-Za-z0-9_-]+)*\.(js|mjs|cjs|ts|mts|cts)$/i,
  /^\.(eslintrc|prettierrc|stylelintrc|markdownlintrc)(\.[A-Za-z0-9_-]+)*\.(js|cjs|mjs|json|jsonc|yml|yaml|toml)$/i,
]

export function isProtectedName(basename: string): boolean {
  const lower = basename.toLowerCase()
  return (
    PROTECTED_FILES.has(basename) ||
    PROTECTED_FILES.has(lower) ||
    PROTECTED_PATTERNS.some((pattern) => pattern.test(basename))
  )
}