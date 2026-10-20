/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { findMissingPayloadPaths } from "./npm-payload-required-paths.mjs"

const requiredRuntimePath = "packages/shared-skills/index.mjs"

describe("npm payload required paths", () => {
  test("#given a payload without a required runtime path #when it is checked #then the missing path is reported", () => {
    // given
    const packedPaths = ["package.json"]

    // when
    const missing = findMissingPayloadPaths(packedPaths, [requiredRuntimePath])

    // then
    expect(missing).toEqual([requiredRuntimePath])
  })

  test("#given a payload carrying every required runtime path #when it is checked #then nothing is reported", () => {
    // given
    const packedPaths = ["package.json", requiredRuntimePath]

    // when
    const missing = findMissingPayloadPaths(packedPaths, [requiredRuntimePath])

    // then
    expect(missing).toEqual([])
  })
})
