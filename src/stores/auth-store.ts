import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { useShallow } from "zustand/react/shallow"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import {
  evaluateAccessState,
  getSessionExpiryTimeoutMs,
  isSessionExpired,
} from "@/lib/access-control"
import { clearSentryUserContext, setSentryUserContext } from "@/lib/sentry"
import type { UserAccess, UserProfile } from "@/lib/types"

// Module-level ref replaces useRef — store is a module-level singleton
let expiryTimer: ReturnType<typeof setTimeout> | null = null

interface AuthStore {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  access: UserAccess | null
  isLoading: boolean

  _resetAuthState: () => void
  _syncSession: (session: Session | null) => Promise<void>
  initAuth: () => () => void
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set, get) => ({
      session: null,
      user: null,
      profile: null,
      access: null,
      isLoading: true,

      _resetAuthState() {
        if (expiryTimer) {
          clearTimeout(expiryTimer)
          expiryTimer = null
        }
        set({ session: null, user: null, profile: null, access: null })
        clearSentryUserContext()
      },

      async _syncSession(sessionValue) {
        if (!sessionValue?.user) {
          get()._resetAuthState()
          return
        }

        if (isSessionExpired(sessionValue)) {
          await supabase.auth.signOut()
          get()._resetAuthState()
          throw new Error("Session expired")
        }

        if (expiryTimer) {
          clearTimeout(expiryTimer)
          expiryTimer = null
        }
        const timeoutMs = getSessionExpiryTimeoutMs(sessionValue)
        if (timeoutMs !== null) {
          expiryTimer = setTimeout(() => {
            void supabase.auth
              .signOut()
              .finally(() => {
                get()._resetAuthState()
                set({ isLoading: false })
              })
          }, timeoutMs)
        }

        try {
          set({ session: sessionValue, user: sessionValue.user })

          await supabase.rpc("claim_pending_invite_access").catch(() => {})

          const [profileResult, accessResult] = await Promise.all([
            supabase
              .from("user_profiles")
              .select("*")
              .eq("id", sessionValue.user.id)
              .maybeSingle(),
            supabase
              .from("user_access")
              .select("*")
              .eq("user_id", sessionValue.user.id)
              .maybeSingle(),
          ])

          if (profileResult.error) throw profileResult.error
          if (accessResult.error) throw accessResult.error
          const profile = (profileResult.data ?? null) as UserProfile | null
          const access = (accessResult.data ?? null) as UserAccess | null

          const accessState = evaluateAccessState(
            { user: { id: sessionValue.user.id } },
            access
          )
          if (!accessState.isAllowed) {
            await supabase.auth.signOut()
            get()._resetAuthState()
            throw new Error(
              accessState.reason === "disabled"
                ? "Your account has been disabled."
                : accessState.reason === "missing-access"
                  ? "Your account does not have access yet."
                  : "Sign in required."
            )
          }

          set({ profile, access })
          setSentryUserContext({
            id: sessionValue.user.id,
            role: profile?.role,
            accessEnabled: access?.is_enabled,
          })
        } catch (error) {
          get()._resetAuthState()
          throw error
        }
      },

      initAuth() {
        let destroyed = false
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (destroyed) return
          get()
            ._syncSession(session)
            .catch(() => {})
            .finally(() => set({ isLoading: false }))
        })

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "TOKEN_REFRESHED" && !session) {
            get()._resetAuthState()
            return
          }
          set({ isLoading: true })
          void get()
            ._syncSession(session)
            .catch(() => {})
            .finally(() => set({ isLoading: false }))
        })

        return () => {
          destroyed = true
          if (expiryTimer) clearTimeout(expiryTimer)
          subscription.unsubscribe()
        }
      },

      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (!error && data.session) {
          try {
            await get()._syncSession(data.session)
          } catch (authError) {
            return {
              error: authError instanceof Error ? authError : new Error("Sign in failed"),
            }
          }
        }
        return { error }
      },

      async signUp(email, password, displayName) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        })
        if (!error && data.session) {
          try {
            await get()._syncSession(data.session)
          } catch (authError) {
            return {
              error: authError instanceof Error ? authError : new Error("Sign up failed"),
            }
          }
        }
        return { error }
      },

      async signOut() {
        await supabase.auth.signOut()
        get()._resetAuthState()
      },

      async refreshProfile() {
        const { session } = get()
        if (!session) return
        await get()._syncSession(session)
      },
    }),
    { name: "auth" }
  )
)

export function useAuth() {
  return useAuthStore(
    useShallow((s) => ({
      session: s.session,
      user: s.user,
      profile: s.profile,
      access: s.access,
      isAdmin: s.profile?.role === "admin",
      isEnabled: s.access?.is_enabled === true,
      isLoading: s.isLoading,
      signIn: s.signIn,
      signUp: s.signUp,
      signOut: s.signOut,
      refreshProfile: s.refreshProfile,
    }))
  )
}
