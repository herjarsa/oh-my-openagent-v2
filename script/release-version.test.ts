import { expect, test } from "bun:test"
import { resolveReleaseVersion } from "./release-version.mjs"

test("LazyCodex-only numbers cannot consume the next omo number", () => {
  expect(resolveReleaseVersion("5.0.0-beta.62.lazycodex.1", true)).toEqual({ version: "5.0.0-beta.62.lazycodex.1", distTag: "beta" })
  expect(resolveReleaseVersion("5.0.0-beta.63", false)).toEqual({ version: "5.0.0-beta.63", distTag: "beta" })
  expect(() => resolveReleaseVersion("5.0.0-beta.63", true)).toThrow()
  expect(() => resolveReleaseVersion("5.0.0-beta.62.lazycodex.1", false)).toThrow()
})

test("stable-base LazyCodex releases never advance latest; omo channel mapping stays unchanged", () => {
  expect(resolveReleaseVersion("5.0.0-lazycodex.1", true).distTag).toBe("lazycodex")
  expect(resolveReleaseVersion("5.0.0", false).distTag).toBe("")
  expect(resolveReleaseVersion("5.0.0-rc.2.lazycodex.3", true).distTag).toBe("rc")
})

test("reserved identifier cannot escape the namespace through malformed versions", () => {
  for (const version of ["5.0.0", "5.0.0-beta.1", "5.0.0-beta.1.lazycodex", "5.0.0-beta.1.lazycodex.0", "5.0.0-beta.1.lazycodex.01", "5.0.0-beta.lazycodex.1.extra", "05.0.0-lazycodex.1", "5.0.0-beta.01.lazycodex.1", "5.0.0-latest.lazycodex.1"]) {
    expect(() => resolveReleaseVersion(version, true)).toThrow()
  }
  for (const version of ["5.0.0-lazycodex.1", "5.0.0-beta.lazycodex.1", "5.0.0-beta.lazycodex"]) {
    expect(() => resolveReleaseVersion(version, false)).toThrow()
  }
})
