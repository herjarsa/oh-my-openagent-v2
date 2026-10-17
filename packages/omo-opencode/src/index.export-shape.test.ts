import { describe, expect, it } from "bun:test"
import pluginModule, { omoPlugin } from "./index"

describe("oh-my-openagent plugin export shape", () => {
  it("keeps default module and named server exports aligned", () => {
    // given
    const defaultServer = pluginModule.server

    // when
    const namedServer = omoPlugin

    // then
    expect(typeof defaultServer).toBe("function")
    expect(namedServer).toBe(defaultServer)
  })

  it("exposes the OpenCode 2 id + setup entry beside the V1 server entry (fork keeps full bridge)", () => {
    const definition = pluginModule as unknown as Record<string, unknown>
    expect(definition["id"]).toBe("oh-my-openagent")
    expect(typeof definition["server"]).toBe("function")
    expect(typeof definition["setup"]).toBe("function")
  })
})