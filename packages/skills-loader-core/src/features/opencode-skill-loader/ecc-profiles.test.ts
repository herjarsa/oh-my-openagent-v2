import { describe, expect, test } from "bun:test"

import {
  DEFAULT_ECC_PROFILES,
  ECC_PROFILES,
  discoverEccSkills,
  resolveEccProfiles,
} from "./loader"

describe("resolveEccProfiles", () => {
  test("defaults to core when not configured", () => {
    // given no configured profiles
    // when
    const resolved = resolveEccProfiles(undefined)

    // then the agent sees the curated set without any config
    expect(resolved).toEqual(["core"])
    expect(DEFAULT_ECC_PROFILES).toEqual(["core"])
  })

  test("respects explicit configuration including off", () => {
    // given
    // when then an explicit empty array disables ECC entirely
    expect(resolveEccProfiles([])).toEqual([])
    // and explicit profiles pass through untouched
    expect(resolveEccProfiles(["all"])).toEqual(["all"])
    expect(resolveEccProfiles(["core", "all"])).toEqual(["core", "all"])
  })
})

describe("discoverEccSkills default", () => {
  test("loads the core set without configuration", async () => {
    // given no profiles configured
    // when
    const skills = await discoverEccSkills(undefined)

    // then the core profile resolves to its curated names
    const names = skills.map((skill) => skill.name).sort()
    expect(names).toEqual([...(ECC_PROFILES["core"] ?? [])].sort())
    expect(skills.length).toBeGreaterThan(0)
  })

  test("loads nothing when explicitly disabled", async () => {
    // given an explicit empty profile list
    // when
    const skills = await discoverEccSkills([])

    // then
    expect(skills).toEqual([])
  })
})