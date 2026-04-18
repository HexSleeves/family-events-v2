import { describe, expect, it } from "vitest"
import { evaluateAccessState, HOME_PATH, isPublicPath } from "./access-control"
import type { UserAccess } from "@/lib/types"

function accessRow(overrides: Partial<UserAccess> = {}): UserAccess {
  return {
    user_id: "user-1",
    is_enabled: true,
    enabled_at: "2026-04-17T00:00:00.000Z",
    disabled_at: null,
    disabled_reason: null,
    created_at: "2026-04-17T00:00:00.000Z",
    updated_at: "2026-04-17T00:00:00.000Z",
    ...overrides,
  }
}

describe("evaluateAccessState", () => {
  it("treats visitors without a session as signed out", () => {
    expect(evaluateAccessState(null, null)).toEqual({
      isAllowed: false,
      shouldSignOut: false,
      reason: "signed-out",
    })
  })

  it("allows users with an enabled access row", () => {
    expect(evaluateAccessState({ user: { id: "user-1" } }, accessRow())).toEqual({
      isAllowed: true,
      shouldSignOut: false,
      reason: "allowed",
    })
  })

  it("forces sign-out when the access row is missing", () => {
    expect(evaluateAccessState({ user: { id: "user-1" } }, null)).toEqual({
      isAllowed: false,
      shouldSignOut: true,
      reason: "missing-access",
    })
  })

  it("forces sign-out when the access row is disabled", () => {
    expect(
      evaluateAccessState(
        { user: { id: "user-1" } },
        accessRow({
          is_enabled: false,
          disabled_at: "2026-04-17T01:00:00.000Z",
          disabled_reason: "beta closed",
        })
      )
    ).toEqual({
      isAllowed: false,
      shouldSignOut: true,
      reason: "disabled",
    })
  })
})

describe("isPublicPath", () => {
  it("allows only marketing and auth routes", () => {
    expect(isPublicPath("/")).toBe(true)
    expect(isPublicPath("/sign-in")).toBe(true)
    expect(isPublicPath("/sign-up")).toBe(true)
    expect(isPublicPath("/explore")).toBe(false)
    expect(isPublicPath("/events/abc")).toBe(false)
    expect(isPublicPath("/admin")).toBe(false)
  })

  it("keeps the authenticated landing page off the public allowlist", () => {
    expect(HOME_PATH).toBe("/home")
    expect(isPublicPath(HOME_PATH)).toBe(false)
  })
})
