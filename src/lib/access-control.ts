import type { UserAccess } from "@/lib/types"

export const HOME_PATH = "/home"

const PUBLIC_PATHS = new Set(["/", "/sign-in", "/sign-up"])

export type AccessReason = "allowed" | "signed-out" | "missing-access" | "disabled"

interface SessionLike {
  user?: { id: string }
}

export function evaluateAccessState(
  session: SessionLike | null,
  access: UserAccess | null
): {
  isAllowed: boolean
  shouldSignOut: boolean
  reason: AccessReason
} {
  if (!session?.user) {
    return {
      isAllowed: false,
      shouldSignOut: false,
      reason: "signed-out",
    }
  }

  if (!access) {
    return {
      isAllowed: false,
      shouldSignOut: true,
      reason: "missing-access",
    }
  }

  if (!access.is_enabled) {
    return {
      isAllowed: false,
      shouldSignOut: true,
      reason: "disabled",
    }
  }

  return {
    isAllowed: true,
    shouldSignOut: false,
    reason: "allowed",
  }
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname)
}
