import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import {
  evaluateAccessState,
  getSessionExpiryTimeoutMs,
  isSessionExpired,
} from "@/lib/access-control"
import type { UserAccess, UserProfile } from "@/lib/types"

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  access: UserAccess | null
  isAdmin: boolean
  isEnabled: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const expiryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function resetAuthState() {
    if (expiryTimeoutRef.current) {
      clearTimeout(expiryTimeoutRef.current)
      expiryTimeoutRef.current = null
    }
    setSession(null)
    setUser(null)
    setProfile(null)
    setAccess(null)
  }

  async function forceSignOut() {
    await supabase.auth.signOut()
    resetAuthState()
  }

  function scheduleSessionExpiry(sessionValue: Session | null) {
    if (expiryTimeoutRef.current) {
      clearTimeout(expiryTimeoutRef.current)
      expiryTimeoutRef.current = null
    }

    const timeoutMs = getSessionExpiryTimeoutMs(sessionValue)
    if (timeoutMs === null) {
      return
    }

    expiryTimeoutRef.current = setTimeout(() => {
      void forceSignOut().finally(() => setIsLoading(false))
    }, timeoutMs)
  }

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return (data ?? null) as UserProfile | null
  }

  async function fetchAccess(userId: string): Promise<UserAccess | null> {
    const { data, error } = await supabase
      .from("user_access")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return (data ?? null) as UserAccess | null
  }

  async function claimPendingInviteAccess() {
    const { error } = await supabase.rpc("claim_pending_invite_access")
    if (error) {
      throw error
    }
  }

  function accessErrorMessage(reason: ReturnType<typeof evaluateAccessState>["reason"]) {
    if (reason === "disabled") {
      return "Your account has been disabled."
    }

    if (reason === "missing-access") {
      return "Your account does not have access yet."
    }

    return "Sign in required."
  }

  async function syncSession(sessionValue: Session | null) {
    if (!sessionValue?.user) {
      resetAuthState()
      return
    }

    if (isSessionExpired(sessionValue)) {
      await forceSignOut()
      throw new Error("Session expired")
    }

    try {
      setSession(sessionValue)
      setUser(sessionValue.user)
      scheduleSessionExpiry(sessionValue)

      await claimPendingInviteAccess().catch(() => {})

      const [profileData, accessData] = await Promise.all([
        fetchProfile(sessionValue.user.id),
        fetchAccess(sessionValue.user.id),
      ])

      const accessState = evaluateAccessState({ user: { id: sessionValue.user.id } }, accessData)
      if (!accessState.isAllowed) {
        await forceSignOut()
        throw new Error(accessErrorMessage(accessState.reason))
      }

      setProfile(profileData)
      setAccess(accessData)
    } catch (error) {
      resetAuthState()
      throw error
    }
  }

  async function refreshProfile() {
    if (!session) {
      return
    }

    await syncSession(session)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncSession(session)
        .catch(() => {})
        .finally(() => setIsLoading(false))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoading(true)
      void syncSession(session)
        .catch(() => {})
        .finally(() => setIsLoading(false))
    })

    return () => {
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current)
      }
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.session) {
      try {
        await syncSession(data.session)
      } catch (authError) {
        return {
          error: authError instanceof Error ? authError : new Error("Sign in failed"),
        }
      }
    }
    return { error }
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })

    if (!error && data.session) {
      try {
        await syncSession(data.session)
      } catch (authError) {
        return {
          error: authError instanceof Error ? authError : new Error("Sign up failed"),
        }
      }
    }

    return { error }
  }

  async function signOut() {
    await forceSignOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        access,
        isAdmin: profile?.role === "admin",
        isEnabled: access?.is_enabled === true,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
