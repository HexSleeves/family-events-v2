# Zustand State Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace React useState/useContext with Zustand across the app, deleting `AuthContext` and `AppContext` and replacing them with stores that re-export the same hook names so call sites are unchanged.

**Architecture:** Four Zustand stores (`auth-store`, `app-store`, `admin-store`, `explore-store`) replace all client-side UI state. Auth and app stores export `useAuth()`/`useApp()` wrappers with identical APIs to the old context hooks, so the 25 call sites only need their import paths changed. Admin and explore stores are consumed directly with `useAdminStore`/`useExploreStore` selectors.

**Tech Stack:** Zustand 5 (`create`, `devtools`, `persist`, `useShallow`), Vitest, TypeScript.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/stores/auth-store.ts` | session, user, profile, access, auth lifecycle, `useAuth()` wrapper |
| Create | `src/stores/app-store.ts` | selectedCityId (persisted), `useApp()` wrapper |
| Create | `src/stores/admin-store.ts` | admin UI state, scrapingSourceIds |
| Create | `src/stores/explore-store.ts` | explore filter state |
| Create | `src/stores/admin-store.test.ts` | unit tests for admin store actions |
| Create | `src/stores/explore-store.test.ts` | unit tests for explore store actions |
| Modify | `src/App.tsx` | remove `AuthProvider`/`AppProvider`, add `useAuthInit` effect |
| Modify | `src/hooks/use-admin-toast.ts` | update `useAuth` import path |
| Modify | `src/components/auth/protected-route.tsx` | update `useAuth` import path |
| Modify | `src/components/auth/public-only-route.tsx` | update `useAuth` import path |
| Modify | `src/components/favorite-button.tsx` | update `useAuth` import path |
| Modify | `src/layouts/admin-layout.tsx` | update `useAuth` import path |
| Modify | `src/layouts/app-layout.tsx` | update `useAuth`/`useApp` import paths |
| Modify | `src/pages/map-view.tsx` | update `useAuth`/`useApp` import paths |
| Modify | `src/pages/dashboard.tsx` | update `useAuth`/`useApp` import paths |
| Modify | `src/pages/auth/sign-in.tsx` | update `useAuth` import path |
| Modify | `src/pages/auth/sign-up.tsx` | update `useAuth` import path |
| Modify | `src/pages/my-events.tsx` | update `useAuth` import path |
| Modify | `src/pages/profile.tsx` | update `useAuth`/`useApp` import paths |
| Modify | `src/pages/saturday-plan.tsx` | update `useAuth`/`useApp` import paths |
| Modify | `src/pages/calendar-view.tsx` | update `useAuth`/`useApp` import paths |
| Modify | `src/pages/event-detail.tsx` | update `useAuth` import path |
| Modify | `src/pages/explore.tsx` | replace useState with `useExploreStore`, update `useApp`/`useAuth` imports |
| Modify | `src/pages/admin/admin-events.tsx` | replace useState with `useAdminStore` |
| Modify | `src/pages/admin/admin-access.tsx` | replace `query` useState with `useAdminStore`, update `useAuth` import |
| Modify | `src/pages/admin/admin-sources.tsx` | replace `scrapingSourceIds` useState with `useAdminStore` |
| Delete | `src/contexts/auth-context.tsx` | replaced by auth-store |
| Delete | `src/contexts/app-context.tsx` | replaced by app-store |

---

### Task 1: Install Zustand

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install the package**

```bash
npm install zustand
```

Expected: `zustand` appears in `package.json` dependencies. No build errors.

- [ ] **Step 2: Verify import works**

Run a quick typecheck to confirm the package resolves:

```bash
npx tsc --noEmit 2>&1 | head -5
```

Expected: No errors about missing `zustand` module (existing errors unrelated to this task are fine).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install zustand"
```

---

### Task 2: Create auth-store.ts

**Files:**
- Create: `src/stores/auth-store.ts`

Context: `src/contexts/auth-context.tsx` is a 257-line React Context that owns session, user, profile, access, and the full Supabase auth lifecycle (getSession, onAuthStateChange, expiry timeout, profile/access fetching, Sentry context). This task moves all of that into a Zustand store. The `expiryTimeoutRef` (previously a `useRef`) becomes a module-level variable — stores live outside React, so module scope is the equivalent. The store exports a `useAuth()` wrapper function with the exact same API as the old `useAuth()` hook from the context, so none of the 17 call sites need to change their destructuring.

- [ ] **Step 1: Create `src/stores/auth-store.ts`**

```ts
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
        void supabase.auth.getSession().then(({ data: { session } }) => {
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
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "auth-store"
```

Expected: no errors in `auth-store.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/stores/auth-store.ts
git commit -m "feat: add auth-store (Zustand) replacing AuthContext"
```

---

### Task 3: Migrate all auth consumers + wire initAuth into App.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/hooks/use-admin-toast.ts`
- Modify: `src/components/auth/protected-route.tsx`
- Modify: `src/components/auth/public-only-route.tsx`
- Modify: `src/components/favorite-button.tsx`
- Modify: `src/layouts/admin-layout.tsx`
- Modify: `src/layouts/app-layout.tsx`
- Modify: `src/pages/map-view.tsx`
- Modify: `src/pages/dashboard.tsx`
- Modify: `src/pages/auth/sign-in.tsx`
- Modify: `src/pages/auth/sign-up.tsx`
- Modify: `src/pages/my-events.tsx`
- Modify: `src/pages/profile.tsx`
- Modify: `src/pages/saturday-plan.tsx`
- Modify: `src/pages/calendar-view.tsx`
- Modify: `src/pages/explore.tsx`
- Modify: `src/pages/event-detail.tsx`
- Modify: `src/pages/admin/admin-access.tsx`
- Delete: `src/contexts/auth-context.tsx`

Context: `useAuth` is currently imported from `@/contexts/auth-context` in 17 files. After this task every import reads `@/stores/auth-store` instead. `AuthProvider` is removed from `App.tsx` and replaced with a `useEffect` that calls `useAuthStore.getState().initAuth()`. The `_syncSession` and `initAuth` methods are prefixed with `_` to signal they're internal; consumers only call `useAuth()`.

- [ ] **Step 1: Update `src/App.tsx`**

Replace the auth-related imports and provider:

```ts
// Remove these lines:
import { AuthProvider } from "@/contexts/auth-context"
import { useAuth } from "@/contexts/auth-context"

// Add these lines:
import { useEffect } from "react"
import { useAuth, useAuthStore } from "@/stores/auth-store"
```

Add an auth init effect. In `App.tsx`, add a new component just before `RootLandingRoute` or at the top of the file:

```tsx
function AuthInit() {
  useEffect(() => useAuthStore.getState().initAuth(), [])
  return null
}
```

Replace `<AuthProvider>` wrapping the entire tree with `<AuthInit />` placed as the first child inside `<QueryClientProvider>`:

```tsx
export default function App() {
  return (
    <ThemeProvider storageKey="family-events-theme">
      <QueryClientProvider client={queryClient}>
        <AuthInit />
        <BrowserRouter>
          {/* ... rest unchanged ... */}
        </BrowserRouter>
        <Toaster richColors position="bottom-right" />
        {ReactQueryDevtools ? (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </ThemeProvider>
  )
}
```

Remove the closing `</AuthProvider>` that currently wraps `<BrowserRouter>` through `<Toaster>`.

- [ ] **Step 2: Update the 16 remaining `useAuth` consumers**

For each file below, change the import from `@/contexts/auth-context` to `@/stores/auth-store`. The destructuring and usage inside each file is unchanged.

```
src/hooks/use-admin-toast.ts
src/components/auth/protected-route.tsx
src/components/auth/public-only-route.tsx
src/components/favorite-button.tsx
src/layouts/admin-layout.tsx
src/layouts/app-layout.tsx        (has both useAuth and useApp — only update useAuth here)
src/pages/map-view.tsx             (has both — only update useAuth here)
src/pages/dashboard.tsx            (has both — only update useAuth here)
src/pages/auth/sign-in.tsx
src/pages/auth/sign-up.tsx
src/pages/my-events.tsx
src/pages/profile.tsx              (has both — only update useAuth here)
src/pages/saturday-plan.tsx        (has both — only update useAuth here)
src/pages/calendar-view.tsx        (has both — only update useAuth here)
src/pages/explore.tsx              (has both — only update useAuth here)
src/pages/event-detail.tsx
src/pages/admin/admin-access.tsx
```

In each file, the only change is the import line. For example:

```ts
// Before
import { useAuth } from "@/contexts/auth-context"

// After
import { useAuth } from "@/stores/auth-store"
```

- [ ] **Step 3: Delete `src/contexts/auth-context.tsx`**

```bash
rm src/contexts/auth-context.tsx
```

- [ ] **Step 4: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: no errors referencing `auth-context` or the auth store. Fix any errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: migrate all auth consumers to auth-store, delete AuthContext"
```

---

### Task 4: Create app-store.ts + migrate all app consumers

**Files:**
- Create: `src/stores/app-store.ts`
- Modify: `src/App.tsx`
- Modify: `src/layouts/app-layout.tsx`
- Modify: `src/pages/map-view.tsx`
- Modify: `src/pages/dashboard.tsx`
- Modify: `src/pages/profile.tsx`
- Modify: `src/pages/saturday-plan.tsx`
- Modify: `src/pages/calendar-view.tsx`
- Modify: `src/pages/explore.tsx`
- Delete: `src/contexts/app-context.tsx`

Context: `AppContext` owns `selectedCityId` (persisted to localStorage as `"family-events-city"`) plus `cities`/`isCitiesLoading` which come from TanStack Query. The store owns only `selectedCityId`; the `useApp()` wrapper composes the store with `useCities()` to reconstruct the same shape returned by the old context hook. The Zustand `persist` middleware replaces the manual `useEffect + localStorage` in `AppContext` — use storage key `"family-events-app"` (a new key; users re-select city once on migration).

- [ ] **Step 1: Create `src/stores/app-store.ts`**

```ts
import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import { useShallow } from "zustand/react/shallow"
import type { City } from "@/lib/types"
import { useCities } from "@/hooks/use-cities"

interface AppStore {
  selectedCityId: string | null
  setSelectedCityId: (id: string | null) => void
}

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set) => ({
        selectedCityId: null,
        setSelectedCityId: (id) => set({ selectedCityId: id }),
      }),
      {
        name: "family-events-app",
        partialize: (s) => ({ selectedCityId: s.selectedCityId }),
      }
    ),
    { name: "app" }
  )
)

export function useApp() {
  const { selectedCityId, setSelectedCityId } = useAppStore(
    useShallow((s) => ({
      selectedCityId: s.selectedCityId,
      setSelectedCityId: s.setSelectedCityId,
    }))
  )
  const { data: cities = [], isLoading: isCitiesLoading } = useCities()
  const selectedCity = cities.find((c) => c.id === selectedCityId) ?? cities[0] ?? null

  return {
    selectedCity,
    setSelectedCity: (city: City | null) => setSelectedCityId(city?.id ?? null),
    cities,
    isCitiesLoading,
  }
}
```

- [ ] **Step 2: Update `src/App.tsx`**

Remove `AppProvider` import and both `<AppProvider>` wrapper instances (they wrap `<AppLayout>` in `RootLandingRoute` and in the `ProtectedRoute` block). No replacement needed — `useApp()` now reads directly from the store without a provider.

```ts
// Remove this line entirely:
import { AppProvider } from "@/contexts/app-context"
```

In `RootLandingRoute`, remove the `<AppProvider>` wrapper:

```tsx
// Before
return (
  <AppProvider>
    <AppLayout>
      <DashboardPage />
    </AppLayout>
  </AppProvider>
)

// After
return (
  <AppLayout>
    <DashboardPage />
  </AppLayout>
)
```

In the `ProtectedRoute` block, remove the `<AppProvider>` wrapper around `<AppLayout />`:

```tsx
// Before
<Route
  element={
    <AppProvider>
      <AppLayout />
    </AppProvider>
  }
>

// After
<Route element={<AppLayout />}>
```

- [ ] **Step 3: Update the 7 remaining `useApp` consumers**

For each file, change the import from `@/contexts/app-context` to `@/stores/app-store`. Destructuring and usage are unchanged.

```
src/layouts/app-layout.tsx
src/pages/map-view.tsx
src/pages/dashboard.tsx
src/pages/profile.tsx
src/pages/saturday-plan.tsx
src/pages/calendar-view.tsx
src/pages/explore.tsx
```

In each file:

```ts
// Before
import { useApp } from "@/contexts/app-context"

// After
import { useApp } from "@/stores/app-store"
```

- [ ] **Step 4: Delete `src/contexts/app-context.tsx`**

```bash
rm src/contexts/app-context.tsx
```

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: no errors. Fix any before proceeding.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add app-store (Zustand) replacing AppContext, migrate consumers"
```

---

### Task 5: Create admin-store.ts with tests + migrate admin-events.tsx

**Files:**
- Create: `src/stores/admin-store.ts`
- Create: `src/stores/admin-store.test.ts`
- Modify: `src/pages/admin/admin-events.tsx`

Context: `admin-events.tsx` has 5 `useState` calls: `keyword`, `statusFilter`, `selectedEventId`, `editingTagIds`, `selectedIds`. The `selectedIds` is a `Set<string>` — Zustand handles it by producing a new `Set` on each mutation (same as the existing `setSelectedIds` pattern using `new Set(prev)`). `cityFilter` comes from `useCityFilter()` (URL search params) and is NOT migrated.

- [ ] **Step 1: Write the failing test at `src/stores/admin-store.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest"
import { useAdminStore } from "./admin-store"

function resetStore() {
  useAdminStore.setState({
    keyword: "",
    statusFilter: "all",
    selectedEventId: null,
    editingTagIds: [],
    selectedIds: new Set(),
    accessQuery: "",
    scrapingSourceIds: new Set(),
  })
}

describe("useAdminStore", () => {
  beforeEach(resetStore)

  describe("selectedIds", () => {
    it("toggleSelectedId adds id when not present", () => {
      useAdminStore.getState().toggleSelectedId("a")
      expect(useAdminStore.getState().selectedIds.has("a")).toBe(true)
    })

    it("toggleSelectedId removes id when already present", () => {
      useAdminStore.getState().toggleSelectedId("a")
      useAdminStore.getState().toggleSelectedId("a")
      expect(useAdminStore.getState().selectedIds.has("a")).toBe(false)
    })

    it("clearSelectedIds empties the set", () => {
      useAdminStore.getState().toggleSelectedId("a")
      useAdminStore.getState().toggleSelectedId("b")
      useAdminStore.getState().clearSelectedIds()
      expect(useAdminStore.getState().selectedIds.size).toBe(0)
    })

    it("setSelectedIds replaces the entire set", () => {
      useAdminStore.getState().toggleSelectedId("a")
      useAdminStore.getState().setSelectedIds(new Set(["x", "y"]))
      const ids = useAdminStore.getState().selectedIds
      expect(ids.has("a")).toBe(false)
      expect(ids.has("x")).toBe(true)
      expect(ids.has("y")).toBe(true)
    })
  })

  describe("scrapingSourceIds", () => {
    it("addScrapingId adds the id", () => {
      useAdminStore.getState().addScrapingId("src-1")
      expect(useAdminStore.getState().scrapingSourceIds.has("src-1")).toBe(true)
    })

    it("removeScrapingId removes the id", () => {
      useAdminStore.getState().addScrapingId("src-1")
      useAdminStore.getState().removeScrapingId("src-1")
      expect(useAdminStore.getState().scrapingSourceIds.has("src-1")).toBe(false)
    })

    it("removeScrapingId on missing id is a no-op", () => {
      useAdminStore.getState().removeScrapingId("nope")
      expect(useAdminStore.getState().scrapingSourceIds.size).toBe(0)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/stores/admin-store.test.ts
```

Expected: FAIL — `admin-store` module not found.

- [ ] **Step 3: Create `src/stores/admin-store.ts`**

```ts
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { Event } from "@/lib/types"

type EventStatus = Event["status"]

interface AdminStore {
  keyword: string
  statusFilter: EventStatus | "all"
  selectedEventId: string | null
  editingTagIds: string[]
  selectedIds: Set<string>
  accessQuery: string
  scrapingSourceIds: Set<string>

  setKeyword: (k: string) => void
  setStatusFilter: (s: EventStatus | "all") => void
  setSelectedEventId: (id: string | null) => void
  setEditingTagIds: (ids: string[]) => void
  toggleSelectedId: (id: string) => void
  setSelectedIds: (ids: Set<string>) => void
  clearSelectedIds: () => void
  setAccessQuery: (q: string) => void
  addScrapingId: (id: string) => void
  removeScrapingId: (id: string) => void
}

export const useAdminStore = create<AdminStore>()(
  devtools(
    (set) => ({
      keyword: "",
      statusFilter: "all" as EventStatus | "all",
      selectedEventId: null,
      editingTagIds: [],
      selectedIds: new Set<string>(),
      accessQuery: "",
      scrapingSourceIds: new Set<string>(),

      setKeyword: (k) => set({ keyword: k }),
      setStatusFilter: (s) => set({ statusFilter: s }),
      setSelectedEventId: (id) => set({ selectedEventId: id }),
      setEditingTagIds: (ids) => set({ editingTagIds: ids }),
      toggleSelectedId: (id) =>
        set((s) => {
          const next = new Set(s.selectedIds)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return { selectedIds: next }
        }),
      setSelectedIds: (ids) => set({ selectedIds: ids }),
      clearSelectedIds: () => set({ selectedIds: new Set() }),
      setAccessQuery: (q) => set({ accessQuery: q }),
      addScrapingId: (id) =>
        set((s) => ({ scrapingSourceIds: new Set([...s.scrapingSourceIds, id]) })),
      removeScrapingId: (id) =>
        set((s) => {
          const next = new Set(s.scrapingSourceIds)
          next.delete(id)
          return { scrapingSourceIds: next }
        }),
    }),
    { name: "admin" }
  )
)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/stores/admin-store.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Migrate `src/pages/admin/admin-events.tsx`**

Replace the top of `AdminEventsPage` (currently 5 `useState` calls) with `useAdminStore` selectors. The full updated component opening:

```tsx
import { useMemo } from "react"
import type { Event } from "@/lib/types"
import { useAdminToast } from "@/hooks/use-admin-toast"
import {
  AdminEventReviewDialog,
  AdminEventsBulkBar,
  AdminEventsList,
  AdminEventsToolbar,
  AdminEventStatusFilterBar,
} from "@/components/admin/admin-events-sections"
import { AdminCityFilterBar } from "@/components/admin/admin-city-filter-bar"
import {
  useAdminEventFacets,
  useAdminEvents,
  useBatchUpdateAdminEventStatus,
  useUpdateAdminEventStatus,
} from "@/hooks/admin/use-admin-events"
import {
  useAdminEventAiTrace,
  useUpdateAdminEventTags,
} from "@/hooks/admin/use-admin-event-ai-trace"
import { useAdminCities } from "@/hooks/admin/use-admin-cities"
import { useCityFilter } from "@/hooks/admin/use-city-filter"
import { UNASSIGNED_CITY_KEY } from "@/lib/group-by-city"
import { useTags } from "@/hooks/use-tags"
import { toast } from "sonner"
import { useAdminStore } from "@/stores/admin-store"

type EventStatusFilter = Event["status"] | "all"

export function AdminEventsPage() {
  const keyword = useAdminStore((s) => s.keyword)
  const statusFilter = useAdminStore((s) => s.statusFilter)
  const selectedEventId = useAdminStore((s) => s.selectedEventId)
  const editingTagIds = useAdminStore((s) => s.editingTagIds)
  const selectedIds = useAdminStore((s) => s.selectedIds)
  const setKeyword = useAdminStore((s) => s.setKeyword)
  const setStatusFilter = useAdminStore((s) => s.setStatusFilter)
  const setSelectedEventId = useAdminStore((s) => s.setSelectedEventId)
  const setEditingTagIds = useAdminStore((s) => s.setEditingTagIds)
  const toggleSelectedId = useAdminStore((s) => s.toggleSelectedId)
  const setSelectedIds = useAdminStore((s) => s.setSelectedIds)
  const clearSelectedIds = useAdminStore((s) => s.clearSelectedIds)
  const { value: cityFilter, setValue: setCityFilter } = useCityFilter()
  // ... rest of data fetching unchanged
```

Replace the local function bodies that used `setState` updaters:

```tsx
function toggleSelect(id: string) {
  toggleSelectedId(id)
}

function handleStatusFilterChange(status: EventStatusFilter) {
  setStatusFilter(status)
  clearSelectedIds()
}

function toggleSelectAll() {
  if (allDraftsSelected) {
    clearSelectedIds()
  } else {
    setSelectedIds(new Set(draftEvents.map((event) => event.id)))
  }
}
```

Replace the batch update reset:

```tsx
async function batchUpdateStatus(newStatus: Event["status"]) {
  if (selectedDraftIds.length === 0) return
  try {
    const { count } = await batchUpdateStatusMutation.mutateAsync({
      eventIds: selectedDraftIds,
      status: newStatus,
    })
    toast.success(`${count} event${count === 1 ? "" : "s"} ${newStatus}`)
    clearSelectedIds()
  } catch (error) {
    toastError(error, "Bulk update failed.")
  }
}
```

Replace `updateStatus` reset:

```tsx
async function updateStatus(id: string, newStatus: Event["status"]) {
  try {
    await updateStatusMutation.mutateAsync({ eventId: id, status: newStatus })
    toast.success(`Event ${newStatus}`)
    setSelectedEventId(null)
  } catch (error) {
    toastError(error, "Failed to update event status.")
  }
}
```

Replace the `onOpenReview` and `onToggleTag` in the JSX:

```tsx
onOpenReview={(event) => {
  setSelectedEventId(event.id)
  setEditingTagIds((event.tags ?? []).map((tag) => tag.tag_id))
}}

onToggleTag={(tagId) =>
  setEditingTagIds(
    editingTagIds.includes(tagId)
      ? editingTagIds.filter((id) => id !== tagId)
      : [...editingTagIds, tagId]
  )
}

onOpenChange={(open) => {
  if (!open) setSelectedEventId(null)
}}
```

- [ ] **Step 6: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: no errors. Fix any before proceeding.

- [ ] **Step 7: Commit**

```bash
git add src/stores/admin-store.ts src/stores/admin-store.test.ts src/pages/admin/admin-events.tsx
git commit -m "feat: add admin-store, migrate admin-events to Zustand"
```

---

### Task 6: Migrate admin-access.tsx + admin-sources.tsx to admin-store

**Files:**
- Modify: `src/pages/admin/admin-access.tsx`
- Modify: `src/pages/admin/admin-sources.tsx`

Context: `admin-access.tsx` has `query` state that moves to `accessQuery` in AdminStore. `dialogUserId` and `disabledReason` are dialog-specific ephemeral state — they stay as local `useState`. `admin-sources.tsx` has `scrapingSourceIds` that moves to AdminStore; `dialogOpen` and `newSource` stay local.

- [ ] **Step 1: Update `src/pages/admin/admin-access.tsx`**

Remove `query` from local state and replace with store. The `dialogUserId` and `disabledReason` stay as `useState`.

```tsx
import { useMemo, useState } from "react"
import {
  AdminAccessDisableDialog,
  AdminAccessHeader,
  AdminAccessList,
} from "@/components/admin/admin-access-sections"
import { useAuth } from "@/stores/auth-store"
import { useAdminUserAccess, useUpdateAdminUserAccess } from "@/hooks/admin/use-admin-access"
import { useAdminToast } from "@/hooks/use-admin-toast"
import { useAdminStore } from "@/stores/admin-store"
import { toast } from "sonner"

export function AdminAccessPage() {
  const { user, refreshProfile } = useAuth()
  const { data: accounts = [] } = useAdminUserAccess()
  const updateAccess = useUpdateAdminUserAccess()
  const { toastError } = useAdminToast()

  const query = useAdminStore((s) => s.accessQuery)
  const setQuery = useAdminStore((s) => s.setAccessQuery)
  const [dialogUserId, setDialogUserId] = useState<string | null>(null)
  const [disabledReason, setDisabledReason] = useState("")
  // ... rest of component unchanged
```

All references to `query` and `setQuery` in the component body remain identical — no other changes needed.

- [ ] **Step 2: Update `src/pages/admin/admin-sources.tsx`**

Remove `scrapingSourceIds` local state and replace with store actions. `dialogOpen` and `newSource` stay as `useState`.

```tsx
import { useState } from "react"
// ... other imports unchanged
import { useAdminStore } from "@/stores/admin-store"

export function AdminSourcesPage() {
  // ...existing hooks unchanged...
  const scrapingSourceIds = useAdminStore((s) => s.scrapingSourceIds)
  const addScrapingId = useAdminStore((s) => s.addScrapingId)
  const removeScrapingId = useAdminStore((s) => s.removeScrapingId)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newSource, setNewSource] = useState({ /* unchanged */ })
```

Update `handleScrape` to use store actions:

```tsx
async function handleScrape(sourceId: string) {
  addScrapingId(sourceId)
  try {
    await triggerScrape.mutateAsync({ sourceId })
    toast.success("Scrape started!", { description: "Ingestion run queued." })
  } catch (error) {
    toastError(error, "Failed to trigger scrape.")
  } finally {
    removeScrapingId(sourceId)
  }
}
```

Remove the old `setScrapingSourceIds` calls — they no longer exist. The `scrapingSourceIds` prop passed to `<AdminSourcesList>` reads from the store and is unchanged.

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/admin-access.tsx src/pages/admin/admin-sources.tsx
git commit -m "feat: migrate admin-access and admin-sources to admin-store"
```

---

### Task 7: Create explore-store.ts with tests + migrate explore.tsx + final cleanup

**Files:**
- Create: `src/stores/explore-store.ts`
- Create: `src/stores/explore-store.test.ts`
- Modify: `src/pages/explore.tsx`

Context: `explore.tsx` has 6 `useState` calls for filter state. `combinedTagSlugs`, `ageFilter`, and `dateRange` are derived values computed via `useMemo` — they stay in the component because they depend on TanStack Query data or on other state. The `clearAllFilters` function maps 1:1 to `resetFilters()` in the store.

- [ ] **Step 1: Write the failing test at `src/stores/explore-store.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest"
import { useExploreStore } from "./explore-store"

function resetStore() {
  useExploreStore.getState().resetFilters()
}

describe("useExploreStore", () => {
  beforeEach(resetStore)

  describe("toggleTagSlug", () => {
    it("adds slug when not present", () => {
      useExploreStore.getState().toggleTagSlug("music")
      expect(useExploreStore.getState().selectedTagSlugs).toContain("music")
    })

    it("removes slug when already present", () => {
      useExploreStore.getState().toggleTagSlug("music")
      useExploreStore.getState().toggleTagSlug("music")
      expect(useExploreStore.getState().selectedTagSlugs).not.toContain("music")
    })

    it("preserves other slugs when removing one", () => {
      useExploreStore.getState().toggleTagSlug("music")
      useExploreStore.getState().toggleTagSlug("sports")
      useExploreStore.getState().toggleTagSlug("music")
      expect(useExploreStore.getState().selectedTagSlugs).toEqual(["sports"])
    })
  })

  describe("resetFilters", () => {
    it("clears all filter state", () => {
      useExploreStore.getState().setKeyword("test")
      useExploreStore.getState().setActiveDateFilter("today")
      useExploreStore.getState().setSelectedAge("kids")
      useExploreStore.getState().setOnlyFree(true)
      useExploreStore.getState().toggleTagSlug("music")
      useExploreStore.getState().setActiveCategory("arts")

      useExploreStore.getState().resetFilters()

      const s = useExploreStore.getState()
      expect(s.keyword).toBe("")
      expect(s.activeDateFilter).toBeNull()
      expect(s.selectedAge).toBeNull()
      expect(s.onlyFree).toBe(false)
      expect(s.selectedTagSlugs).toEqual([])
      expect(s.activeCategory).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/stores/explore-store.test.ts
```

Expected: FAIL — `explore-store` module not found.

- [ ] **Step 3: Create `src/stores/explore-store.ts`**

```ts
import { create } from "zustand"
import { devtools } from "zustand/middleware"

const INITIAL_FILTERS = {
  keyword: "",
  activeDateFilter: null as string | null,
  selectedAge: null as string | null,
  onlyFree: false,
  selectedTagSlugs: [] as string[],
  activeCategory: null as string | null,
}

interface ExploreStore {
  keyword: string
  activeDateFilter: string | null
  selectedAge: string | null
  onlyFree: boolean
  selectedTagSlugs: string[]
  activeCategory: string | null

  setKeyword: (k: string) => void
  setActiveDateFilter: (f: string | null) => void
  setSelectedAge: (a: string | null) => void
  setOnlyFree: (v: boolean) => void
  setSelectedTagSlugs: (slugs: string[]) => void
  toggleTagSlug: (slug: string) => void
  setActiveCategory: (c: string | null) => void
  resetFilters: () => void
}

export const useExploreStore = create<ExploreStore>()(
  devtools(
    (set) => ({
      ...INITIAL_FILTERS,

      setKeyword: (k) => set({ keyword: k }),
      setActiveDateFilter: (f) => set({ activeDateFilter: f }),
      setSelectedAge: (a) => set({ selectedAge: a }),
      setOnlyFree: (v) => set({ onlyFree: v }),
      setSelectedTagSlugs: (slugs) => set({ selectedTagSlugs: slugs }),
      toggleTagSlug: (slug) =>
        set((s) => ({
          selectedTagSlugs: s.selectedTagSlugs.includes(slug)
            ? s.selectedTagSlugs.filter((t) => t !== slug)
            : [...s.selectedTagSlugs, slug],
        })),
      setActiveCategory: (c) => set({ activeCategory: c }),
      resetFilters: () => set(INITIAL_FILTERS),
    }),
    { name: "explore" }
  )
)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/stores/explore-store.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Migrate `src/pages/explore.tsx`**

Replace the 6 `useState` calls with `useExploreStore` selectors. Remove `clearAllFilters` and `toggleTagSlug` local functions (they're now `resetFilters` and `toggleTagSlug` from the store). Update `useApp` and `useAuth` imports.

```tsx
import { useMemo } from "react"
import { useApp } from "@/stores/app-store"
import { useAuth } from "@/stores/auth-store"
import { useExploreStore } from "@/stores/explore-store"
// ... all other imports unchanged

export function ExplorePage() {
  const keyword = useExploreStore((s) => s.keyword)
  const activeDateFilter = useExploreStore((s) => s.activeDateFilter)
  const selectedAge = useExploreStore((s) => s.selectedAge)
  const onlyFree = useExploreStore((s) => s.onlyFree)
  const selectedTagSlugs = useExploreStore((s) => s.selectedTagSlugs)
  const activeCategory = useExploreStore((s) => s.activeCategory)
  const setKeyword = useExploreStore((s) => s.setKeyword)
  const setActiveDateFilter = useExploreStore((s) => s.setActiveDateFilter)
  const setSelectedAge = useExploreStore((s) => s.setSelectedAge)
  const setOnlyFree = useExploreStore((s) => s.setOnlyFree)
  const toggleTagSlug = useExploreStore((s) => s.toggleTagSlug)
  const setActiveCategory = useExploreStore((s) => s.setActiveCategory)
  const resetFilters = useExploreStore((s) => s.resetFilters)

  // ... all useMemo hooks (ageFilter, dateRange, combinedTagSlugs, filteredEvents, etc.) unchanged
  // ... all data fetching hooks unchanged
```

Replace `clearAllFilters` usage with `resetFilters`:

```tsx
// Before
function clearAllFilters() {
  setActiveDateFilter(null)
  setSelectedAge(null)
  setOnlyFree(false)
  setSelectedTagSlugs([])
  setActiveCategory(null)
}

// After — delete clearAllFilters entirely, use resetFilters from store
```

In JSX, replace `onClearAllFilters={clearAllFilters}` with `onClearAllFilters={resetFilters}`.

Replace `onToggleTagSlug={toggleTagSlug}` — the local `toggleTagSlug` function is deleted; the store's `toggleTagSlug` is used directly (same name, same signature `(slug: string) => void`). No JSX change needed if the local function name matched.

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass, including the two new store tests.

- [ ] **Step 7: Run final typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add src/stores/explore-store.ts src/stores/explore-store.test.ts src/pages/explore.tsx
git commit -m "feat: add explore-store, migrate explore.tsx to Zustand — completes refactor"
```
