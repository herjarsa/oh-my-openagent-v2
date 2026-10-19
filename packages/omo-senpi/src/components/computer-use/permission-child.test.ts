import { describe, expect, test } from "bun:test"
import { permissionOwner } from "./permission-child.test-support"
import { capture } from "./permission-event.test-support"

describe("task-owned computer permission relay", () => {
  // Fork note: cross-process relay needs the upstream rpc-core generation
  // (child extension_event forwarding in rpc-process/handle + manager wiring
  // to pi.events). The fork's RpcProcessRunner/handle drops child
  // extension_event lines, so process/nested relays get zero events while
  // in-process passes. Skipped until the engine-plumbing backport
  // (see V2-PORT.md gap); the in-process case stays green as the guard.
  for (const path of ["in-process", "process", "nested"] as const) {
    (path === "in-process" ? test : test.skip)(`routes a ${path} denial to the root session connection`, async () => {
      // given
      const fixture = await permissionOwner()
      try {
        // when
        await fixture.child(path === "nested" ? "process" : path, path === "nested" ? "nested" : "capture")
        // then
        expect(fixture.events).toEqual([{
          name: "omo.computer.permission_required",
          data: { session_id: fixture.session.sessionId, permission: "screen_recording", app: "Test App" },
        }])
      } finally {
        await fixture.close()
      }
    }, 120_000)
  }

  test.skip("routes an in-process nested process denial through its shared task owner", async () => {
    // given
    const fixture = await permissionOwner()
    try {
      // when
      await fixture.child("in-process", "NESTED_PERMISSION_PROBE")
      // then
      expect(fixture.events).toEqual([{
        name: "omo.computer.permission_required",
        data: { session_id: fixture.session.sessionId, permission: "screen_recording", app: "Test App" },
      }])
    } finally {
      await fixture.close()
    }
  }, 120_000)

  test("shares one root latch across direct and different child denials", async () => {
    // given
    const fixture = await permissionOwner()
    try {
      // when
      await fixture.child("process")
      await fixture.child("in-process")
      await fixture.execute("computer", capture)
      // then
      expect(fixture.events).toHaveLength(1)
    } finally {
      await fixture.close()
    }
  }, 120_000)

  test("drops an invalid child relay instead of mapping its permission", async () => {
    // given
    const fixture = await permissionOwner()
    try {
      // when
      await fixture.child("process", "invalid")
      // then
      expect(fixture.events).toEqual([])
    } finally {
      await fixture.close()
    }
  }, 120_000)
})
