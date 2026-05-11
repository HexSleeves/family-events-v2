# Zustand State Refactor

**Date:** 2026-05-11
**Status:** Approved

## Overview

Replace React `useState`/`useContext` with Zustand across the application where it makes sense. Client-side UI state moves into Zustand stores; server state stays in TanStack Query. The two React Contexts (`AuthContext`, `AppContext`) are deleted and replaced with stores. Call sites keep their existing hook names (`useAuth`, `useApp`) via thin wrappers exported from the store files.

---

## Decisions

| Question | Decision |
|---|---|
| Auth migration | Full — AuthContext deleted, all state into AuthStore |
| Store organization | Hybrid — one global store for auth + app prefs, separate stores for admin and explore |
| Optimistic updates | TanStack Query native (`onMutate`/`onError`/`onSettled`) — no Zustand involvement |

---

## File Structure

```
src/
  stores/
    auth-store.ts       # user, profile, access, session lifecycle
    app-store.ts        # selectedCityId (persisted), useApp() wrapper
    admin-store.ts      # admin UI state + scrapingSourceIds
    explore-store.ts    # explore filter state
  contexts/
    auth-context.tsx    # DELETED
    app-context.tsx     # DELETED
```

All stores use `devtools` middleware (Redux DevTools). `app-store.ts` additionally uses `persist` (localStorage).

---

## Auth Store (`src/stores/auth-store.ts`)

Replaces `AuthContext` entirely. All session lifecycle logic (Supabase listener, expiry timeout, `syncSession`, profile/access fetching) moves into the store file.

```ts
interface AuthStore {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  access: UserAccess | null
  isLoading: boolean
  // derived (computed inline in useAuth wrapper)
  // isAdmin: profile?.role === "admin"
  // isEnabled: access?.is_enabled === true

  setSession: (s: Session | null) => void
  setUser: (u: User | null) => void
  setProfile: (p: UserProfile | null) => void
  setAccess: (a: UserAccess | null) => void
  setIsLoading: (v: boolean) => void
  resetAuthState: () => void

  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  initAuth: () => () => void  // starts Supabase listener, returns cleanup fn
}
```

`initAuth()` is called once at the app root via `useEffect` (replacing `AuthProvider`). It starts `supabase.auth.getSession()` + `onAuthStateChange`, manages the expiry timeout via a module-level ref, and returns an unsubscribe function.

**`useAuth()` wrapper** (exported from `auth-store.ts`, replaces the old hook):

```ts
export function useAuth() {
  return useAuthStore((s) => ({
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
}
```

All existing consumers (`protected-route.tsx`, `admin-layout.tsx`, `favorite-button.tsx`, etc.) keep their `useAuth()` call unchanged.

---

## App Store (`src/stores/app-store.ts`)

Replaces `AppContext`. Owns only `selectedCityId`; `cities` and `isCitiesLoading` come from TanStack Query.

```ts
interface AppStore {
  selectedCityId: string | null
  setSelectedCityId: (id: string | null) => void
}
```

Middleware: `devtools` + `persist` with `partialize: (s) => ({ selectedCityId: s.selectedCityId })`. The manual `useEffect` + `localStorage` in the old `AppContext` is deleted — Zustand persist handles it.

**`useApp()` wrapper** (exported from `app-store.ts`):

```ts
export function useApp() {
  const { selectedCityId, setSelectedCityId } = useAppStore()
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

All existing consumers (`app-layout.tsx`, `map-view.tsx`, `dashboard.tsx`, etc.) keep their `useApp()` call unchanged.

---

## Admin Store (`src/stores/admin-store.ts`)

Owns all UI state from `admin-events.tsx` and `admin-access.tsx`, plus `scrapingSourceIds` from `admin-sources.tsx`.

```ts
interface AdminStore {
  // admin-events.tsx
  keyword: string
  statusFilter: EventStatus | "all"
  selectedEventId: string | null
  editingTagIds: string[]
  selectedIds: Set<string>

  // admin-access.tsx
  accessQuery: string

  // admin-sources.tsx
  scrapingSourceIds: Set<string>

  setKeyword: (k: string) => void
  setStatusFilter: (s: EventStatus | "all") => void
  setSelectedEventId: (id: string | null) => void
  setEditingTagIds: (ids: string[]) => void
  toggleSelectedId: (id: string) => void
  clearSelectedIds: () => void
  setAccessQuery: (q: string) => void
  addScrapingId: (id: string) => void
  removeScrapingId: (id: string) => void
}
```

`devtools` only. No persistence — admin filter state is ephemeral.

`handleScrape` in `admin-sources.tsx` calls `addScrapingId`/`removeScrapingId` in try/finally instead of local `setScrapingSourceIds`.

---

## Explore Store (`src/stores/explore-store.ts`)

Owns all filter state from `explore.tsx`.

```ts
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
```

`devtools` only. No persistence — restoring filter state across page loads would be confusing.

Derived values (`combinedTagSlugs`, `ageFilter`, `dateRange`) stay as `useMemo` in `explore.tsx`; they depend on data from TanStack Query and are not owned state.

---

## Optimistic Updates

`use-favorites.ts` already implements `onMutate`/`onError`/`onSettled` correctly — no change.

All other mutations (`updateStatus`, `batchUpdateStatus`, etc.) use TanStack Query's `isPending` for loading state — no change.

`scrapingSourceIds` is the only "manual" pending tracker; it moves to AdminStore as described above.

---

## Context Removal

**`App.tsx` changes:**
- Remove `<AuthProvider>` wrapper
- Remove `<AppProvider>` wrapper
- Add `useEffect(() => { const cleanup = useAuthStore.getState().initAuth(); return cleanup }, [])` at the app root component

**`src/contexts/auth-context.tsx`** — deleted  
**`src/contexts/app-context.tsx`** — deleted

`theme-provider.tsx` uses Context internally but is Shadcn/UI component code — left untouched.

---

## What Is Explicitly Out of Scope

- Zustand for server state (stays in TanStack Query)
- Middleware other than `devtools` and `persist`
- Slices composition pattern (stores are simple `create()` calls; slices add complexity without benefit at this scale)
- Global `devtools` store name namespacing (each store gets its own `devtools` instance with a descriptive name)
- Any page beyond the four stores listed above
