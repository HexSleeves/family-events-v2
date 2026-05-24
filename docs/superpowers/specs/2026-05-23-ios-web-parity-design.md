# iOS ↔ Web Parity — Design Spec

**Date**: 2026-05-23
**Owner**: TBD
**Status**: Draft (awaiting review)

## Problem

The iOS consumer app (`apps/ios`) lags the web consumer app (`apps/web`) in three ways:

1. **Feature surface** — iOS ships 3 tabs (Plan, Explore, Saved); web ships 6 consumer routes (Plan, Explore, Map, Calendar, Saved, Profile). Calendar and dedicated Map are missing on iOS. Profile is partial. City selector is a hard-coded stub.
2. **Data refresh** — `.task` runs on view mount (cold start) but does not refire when the app returns from background. There is no `ScenePhase` handler. Pull-to-refresh is wired on Plan, Explore, and Saved but missing on Event Detail. There is no cache TTL — refresh is fully manual.
3. **Design adoption** — `DesignTokens` (light + dark) are generated, but per-view adoption is inconsistent. Some surfaces still use SwiftUI defaults (`.secondary`, `.tint`) instead of token-backed `Color.dsToken(...)` helpers.

The user explicitly asked for:

- iOS design to match the web experience.
- A fresh fetch when the app loads (including return-from-background).
- Pull-to-refresh on every page, refreshing whatever that page shows.

## Goals

- Close every consumer-surface gap between web and iOS in a single coordinated branch.
- Add `ScenePhase`-aware refresh so the active tab refetches on cold start and on foreground return.
- Add `.refreshable` to every scroll surface (including Event Detail).
- Enforce token adoption end-to-end: no ad-hoc `.secondary` / `.tint` / hex literals in consumer packages.
- Promote Map to a dedicated tab; add a native Calendar tab; complete Saved (Upcoming / Past / All); ship a real city picker; ship a theme toggle in Profile.
- Add Supabase realtime channel subscription for comments on Event Detail.

## Non-goals

- Admin endpoints stay blocked (`EndpointPolicyTests` is load-bearing).
- Event creation, edit, dashboard ("My Events" administrative view) are NOT in scope — they are web-only and unrelated to the consumer surface.
- Password change form, display-name editing, and explicit sign-out button on Profile (deferred — only the theme toggle ships in this round).
- Marketing / share-preview routes (`/share/:eventId`) are not required on iOS — deep links resolve directly to native Event Detail.
- Re-implementing web's motion primitives (`FadeSwap`, `StaggerList`) literally. iOS uses native SwiftUI transitions and `.transition(...)`.

## Current state — verified

### Tab structure today (`apps/ios/FamilyEvents/App/Tab.swift`)

```
plan     → calendar.badge.clock
explore  → sparkle.magnifyingglass
saved    → bookmark.fill
```

### Packages today (`apps/ios/Packages/`)

`FECore`, `FEData`, `FEDesignSystem`, `FEAuth`, `FEPlan`, `FEExplore`, `FESaved`, `FEEventDetail`, `FEAppIntents`, `FEAdmin` (unlinked).

### Refresh behavior today

- `.task { … }` on `SaturdayPlanScreen`, `ExploreScreen`, `SavedScreen`, `EventDetailScreen` — fires on view mount.
- `.refreshable` on `SaturdayPlanScreen` (`SaturdayPlanScreen.swift:80`), `ExploreScreen` (`ExploreScreen.swift:38`), `SavedScreen` (`SavedScreen.swift:61`). MISSING on `EventDetailScreen`.
- No `@Environment(\.scenePhase)` reader anywhere — `grep` returned zero matches.
- No cache TTL — `SupabaseEventRepository`, `SupabaseFavoriteRepo`, etc., fetch fresh on every call.

### City picker

`FEPlan/Components/CityPickerStub.swift:4-20` — placeholder copy "coming in a future update". `SessionStore`/`ProfileSheet` writes `selected_city_id` to user profile, but there is no in-app picker UI.

### Token adoption

Generated `DesignTokens.Color.{Light,Dark}` exists. `Color.dsToken(light:dark:)` bridge exists. Grep shows partial adoption — Event Detail uses tokens; Plan / Explore mix tokens with SwiftUI defaults.

## Target architecture

### Tab structure after this work

```
plan     → calendar.badge.clock        (unchanged)
explore  → sparkle.magnifyingglass      (unchanged, map toggle removed)
map      → map.fill                    (NEW — extracted from Explore)
calendar → calendar                    (NEW — native month + day list)
saved    → bookmark.fill               (unchanged tab, segmented control inside)
```

Five-tab bottom bar. Profile remains a sheet (toolbar avatar in each tab's nav bar), matching the existing pattern.

> **Why 5 not 6.** The Profile route on web is a full-screen page. On iOS, Profile is consistently a sheet (`ProfileSheet`) opened from a toolbar avatar button — this is HIG-native. No need to spend a tab slot on it.

### New / changed packages

| Package | Status | Purpose |
|---|---|---|
| `FEMap` | NEW | Standalone Map tab. Extract current `ExploreMapView` + cluster logic from `FEExplore` into its own SPM module. |
| `FECalendar` | NEW | Month grid + day list. SwiftData query against `CachedEvent` + `CachedFavorite` + `CachedCalendarEvent`. |
| `FECalendarSync` (folded into `FEEventDetail`) | EXISTS | EventKit add-to-calendar already lives in Event Detail; no new module needed. |
| `FEData` | CHANGED | Add `CachedCalendarEvent` model + `CalendarEventRepo` (mirrors `FavoriteRepo` shape). Add cache-TTL helper. Add Supabase realtime channel registry mirror for `event_comments`. |
| `FEExplore` | CHANGED | Remove map toggle (now handled by Map tab). Keep search + filter UI. |
| `FEPlan` | CHANGED | Replace `CityPickerStub` with real toolbar entry that presents `CityPickerSheet` (new shared view in `FECore` or a new tiny `FECityPicker` package). |
| `FESaved` | CHANGED | Segmented control (Upcoming / Past / All) at top. Drives in-memory filter on the existing favorite + calendar union. |
| `FEEventDetail` | CHANGED | Add `.refreshable`. Subscribe to Supabase realtime channel for `event_comments` (insert + update), invalidate local list, refetch comments. |
| `FEAuth` (`ProfileSheet`) | CHANGED | Add `ThemePickerCard` (Light / Dark / System) writing `@AppStorage("family-events-theme")`. |
| `FECore` or new `FEAppLifecycle` | NEW (small) | `ScenePhaseRefreshController` — observes scene phase, holds weak refs to "refreshable" view models, dispatches refresh on `.active` when previously `.background`. |

### Refresh model

Three-layer:

1. **Cold start** — existing `.task` on each tab's root view runs once when the view first mounts (already in place). No change.
2. **Foreground return** — root `RootView` observes `@Environment(\.scenePhase)`. On transition `background → active` (or `inactive → active` from background timestamp), dispatch refresh **on the currently-selected tab only**. Each tab root view exposes a `Refreshable` protocol the controller can call.
3. **Pull-to-refresh** — `.refreshable` on every scroll container, including a new one on `EventDetailScreen`. Same code path as the foreground-return refresh.

```swift
public protocol Refreshable: AnyObject {
    @MainActor func refresh() async
}
```

Each `@Observable` view model that owns network state conforms to `Refreshable`. The active tab's view model is registered with `ScenePhaseRefreshController` via `.environment`. On scene-phase transition, the controller awaits `viewModel.refresh()` on `MainActor`.

### Cache TTL

Add to `FECore`:

```swift
public struct CacheTTL: Sendable {
    public static let `default`: TimeInterval = 60     // matches web staleTime
    public static let plan: TimeInterval = 120
    public static let comments: TimeInterval = 30
}
```

Each view model stores `lastSuccessfulFetchAt: Date?`. `.task` and ScenePhase refresh skip the network call when `Date().timeIntervalSince(lastSuccessfulFetchAt) < ttl` AND cached SwiftData rows exist. Pull-to-refresh ignores TTL (user-initiated → always refetch).

> **Why match web's 60s staleTime.** Web's `QueryClient` uses `staleTime: 60_000` (`infrastructure/queries/query-client.ts:127`). Aligning prevents "iOS shows older data than web for the same user across devices in the same session."

### Realtime comments

Mirror web's pattern. Add to `FEData`:

```swift
public protocol CommentRealtime {
    func subscribe(eventID: EventID, onChange: @escaping () -> Void) -> RealtimeSubscription
}

public final class SupabaseCommentRealtime: CommentRealtime { … }
public struct RealtimeSubscription: Sendable { public let cancel: @Sendable () -> Void }
```

`EventDetailViewModel` calls `subscribe(eventID:)` from `.task`, stores the `RealtimeSubscription`, and cancels it in `deinit`. `onChange` triggers `await loadComments()` (which respects the 30s TTL — or bypasses it; this is a per-event payload, cheap).

Backed by `supabase-swift` realtime channels (already a transitive dependency via the SDK).

### City picker

`CityPickerSheet` lives in a new tiny `FECityPicker` package (or under `FECore`). API:

```swift
public struct CityPickerSheet: View {
    @Binding var selectedCityID: CityID?
    public init(selectedCityID: Binding<CityID?>, cityRepo: any CityRepository)
}
```

Used from every tab's `.toolbar` (leading): a `Button(action: { showPicker = true })` showing `currentCityName ?? "Pick city"` — opens `.sheet(isPresented:) { CityPickerSheet(...) }`. Selection writes to `@AppStorage("selected-city-id")` AND triggers a `profileRepo.updateSelectedCity(...)` so the same user sees the same city on web.

Searchable. Sticky alphabet section index for long lists. Empty state when offline.

### Map tab

Extract from `FEExplore/Screens/ExploreMapView.swift` into `FEMap`:

```
FEMap/
  Sources/FEMap/
    MapTab.swift
    MapScreen.swift
    MapViewModel.swift
    Clustering/
      Supercluster.swift          (Swift port or wrapper of MapKit annotation clustering)
    Components/
      EventPin.swift
      ClusterBubble.swift
      EventPopupCard.swift
      UserLocationDot.swift
```

Uses MapKit (`Map`, `Marker`, `Annotation`) rather than Google Maps to stay native. Reuses `EventRepository.fetchEnriched(cityId:, dateFrom:, dateTo:, userId:)` — same filters as Explore. Bounding-box filtering is done client-side after fetch (filter the city-scoped result set by `lat/lng` against the current visible region). No new RPC params required. This matches web `useEnrichedEvents()` which also does not pass bbox; web filters client-side via `supercluster`.

### Calendar tab

Native pattern, not a literal port of web's `CalendarMonthPanel`:

```
FECalendar/
  Sources/FECalendar/
    CalendarTab.swift
    CalendarScreen.swift             // month grid (top), day list (bottom)
    CalendarMonthGrid.swift          // 6 weeks × 7 days, dot indicator per day with events
    CalendarDayList.swift            // events on selected day
    CalendarViewModel.swift          // owns selectedDate, monthBounds, eventsByDay
```

Data: `EventRepository.fetchEnriched(cityId:, dateFrom: monthStart, dateTo: monthEnd, userId:)` once per month-change. Group results by `start.dateOnly` into `[Date: [Event]]`. Tap a day → updates `selectedDate` → bottom list re-renders.

Pull-to-refresh on the day list re-fetches the current month. ScenePhase refresh hits the current month only.

### Saved tab structure

Add to `SavedScreen`:

```swift
@State private var filter: SavedFilter = .upcoming

enum SavedFilter: String, CaseIterable, Identifiable {
    case upcoming = "Upcoming"
    case past = "Past"
    case all = "All"
    var id: String { rawValue }
}

Picker("Filter", selection: $filter) { … }.pickerStyle(.segmented)
```

Filter applied client-side on the existing favorite + calendar union. No new network calls.

### Profile theme toggle

Add to `ProfileSheet`:

```swift
Section("Appearance") {
    Picker("Theme", selection: $appearance) {
        Text("Light").tag(AppAppearancePreference.light)
        Text("Dark").tag(AppAppearancePreference.dark)
        Text("System").tag(AppAppearancePreference.system)
    }.pickerStyle(.segmented)
}
```

`appearance` is `@AppStorage("family-events-theme")` — already drives `.preferredColorScheme` in `FamilyEventsApp`. Just expose the picker.

### Design polish — token sweep

For each consumer package, replace:

| Pattern | Replace with |
|---|---|
| `Color.secondary` | `Color.dsTextMuted` |
| `Color.primary` (as foreground) | `Color.dsTextPrimary` |
| `Color.accentColor` / `.tint(.accentColor)` | `.tint(Color.dsAccentPrimary)` |
| `.background(Color.gray.opacity(0.1))` | `.background(Color.dsSurfaceRaised)` |
| Hex literals (`Color(hex: ...)`) | Token equivalent |
| `Font.system(size:weight:)` for body | `Font.dsBody` (existing helper) |
| `Font.title2` for hero | `Font.dsDisplay` (existing helper) |

Add a per-package guard test that grep-fails on `Color.secondary`, `Color.primary` (as foreground), and unprefixed hex usages in `Sources/`. Modeled on `tests/guards/shared-boundary.test.mjs`.

## Tab bar restructure — risk + rollout

Going 3 → 5 tabs is a visible change. Mitigation:

- Bottom bar already has space; 5 tabs render comfortably at all iPhone widths.
- No feature flag — this is the new floor. Users opening 1.x → 2.0 see the new tabs immediately. Add a one-shot "What's new" sheet (`@AppStorage("seen-tabs-onboarding-v2")`) introducing Map + Calendar.
- Existing deep links (`familyevents://saved`, `familyevents://event/{id}`) keep working. Add `familyevents://map`, `familyevents://calendar`.

## Data-flow diagram (foreground refresh)

```
[ User backgrounds app ]
  scenePhase: .active → .background
  ScenePhaseRefreshController records backgroundedAt = now

[ User opens app some minutes later ]
  scenePhase: .background → .active
  ScenePhaseRefreshController checks:
    - elapsed since backgroundedAt > 0s?  (always true)
    - currently-selected tab has a Refreshable view model?
  If yes → Task { await viewModel.refresh() }
  Cache TTL is bypassed for ScenePhase refresh (treated as user-equivalent intent).

[ User pulls down on Plan tab ]
  .refreshable triggers same Task { await viewModel.refresh() }
```

## Error handling

- Refresh failures show an inline toast (existing `Toast` view in `FEDesignSystem` if present, else add minimal one) — non-blocking. The cached data remains visible.
- Realtime subscription errors are silent; comments still pull-to-refresh.
- Offline state on city picker: list shows cached cities from SwiftData (`CachedCity`). Add `CachedCity` if not present.

## Testing strategy

- **Per-package XCTest** — every new view model has tests for `refresh()` happy path + network error path + TTL skip.
- **Snapshot tests** — `FECalendar.CalendarMonthGrid`, `FEMap.EventPin`, `FESaved.SavedScreen` (per filter), `FEAuth.ThemePickerCard` (light + dark). Use `swift-snapshot-testing` (already a `FEDesignSystem` transitive dep).
- **Integration test** — `FamilyEventsTests/ScenePhaseRefreshTests.swift`: simulate `.active → .background → .active`, assert the registered Refreshable was called exactly once.
- **Guard test** — `FamilyEventsTests/TokenAdoptionTests.swift`: grep `Sources/` of each consumer package for forbidden literals (`Color.secondary`, hex literals). Fails if found.
- **EndpointPolicyTests** must continue to pass — no admin RPCs added.

## Open questions

None blocking. Future polish (out of scope this round):

- Password change form in Profile.
- Display name editing in Profile.
- Activity feed (comments + ratings across all events the user touched).
- Widget extension (`FEAppIntents` already exists; could surface Saturday Plan widget).

## Success criteria

1. Cold start on iOS shows fresh data (verified by network log).
2. Background ≥ 1 second + foreground re-fetches the active tab (verified by integration test).
3. Pull-to-refresh works on Plan, Explore, Map, Calendar, Saved, **and Event Detail** (verified manually + UI test where cheap).
4. Tab bar shows 5 tabs (Plan, Explore, Map, Calendar, Saved). City picker is a real toolbar button, not a stub.
5. Profile sheet shows Theme picker (Light / Dark / System).
6. Saved tab shows segmented control; filter affects which events render.
7. Comments on Event Detail update without manual refresh when another user posts (verified manually against two devices or local Supabase).
8. `TokenAdoptionTests` passes — no ad-hoc colors remain in consumer packages.
9. `pnpm run ios:test` is green; all package suites pass.
10. `EndpointPolicyTests` still passes.

## File-level summary of changes

```
apps/ios/
  project.yml                                  # +FEMap, +FECalendar, +FECityPicker products
  FamilyEvents/App/
    Tab.swift                                  # +map, +calendar cases
    RootView.swift                             # wire Map + Calendar tabs; install ScenePhaseRefreshController
    DeepLinkRouter.swift                       # +map, +calendar deep links
    FamilyEventsApp.swift                      # inject ScenePhaseRefreshController into RootView env
  Packages/
    FECore/Sources/FECore/
      CacheTTL.swift                           # NEW
      Refreshable.swift                        # NEW (protocol)
      ScenePhaseRefreshController.swift        # NEW
    FEData/Sources/FEData/
      Models/CachedCalendarEvent.swift         # NEW
      Models/CachedCity.swift                  # NEW if absent
      Repositories/SupabaseCalendarEventRepo.swift   # NEW
      Realtime/SupabaseCommentRealtime.swift   # NEW
    FECityPicker/                              # NEW package
    FEMap/                                     # NEW package
    FECalendar/                                # NEW package
    FEExplore/Sources/FEExplore/
      Screens/ExploreScreen.swift              # remove map toggle
      Screens/ExploreMapView.swift             # DELETE (moved to FEMap)
    FEPlan/Sources/FEPlan/
      Components/CityPickerStub.swift          # DELETE (replaced by FECityPicker)
      Screens/SaturdayPlanScreen.swift         # add toolbar city button
    FESaved/Sources/FESaved/
      Screens/SavedScreen.swift                # +segmented filter
    FEEventDetail/Sources/FEEventDetail/
      Screens/EventDetailScreen.swift          # +.refreshable
      EventDetailViewModel.swift               # +realtime subscribe/cancel, conform Refreshable
    FEAuth/Sources/FEAuth/
      ProfileSheet.swift                       # +ThemePickerCard
      Components/ThemePickerCard.swift         # NEW
  FamilyEventsTests/
    ScenePhaseRefreshTests.swift               # NEW
    TokenAdoptionTests.swift                   # NEW
```

## Sequencing inside the single branch

Even though this is one PR per the user's "big bang" decision, internal commit order should be:

1. `FECore` additions: `Refreshable`, `CacheTTL`, `ScenePhaseRefreshController` (with tests).
2. `FEData` additions: `CachedCalendarEvent`, `SupabaseCalendarEventRepo`, `SupabaseCommentRealtime` (with tests).
3. `FECityPicker` package + wire into Plan/Explore toolbars.
4. `FEMap` package + remove map toggle from `FEExplore` + add Map tab.
5. `FECalendar` package + add Calendar tab.
6. `FESaved` segmented control.
7. `FEEventDetail` `.refreshable` + realtime subscription.
8. `FEAuth` theme picker in Profile.
9. Token-adoption sweep + `TokenAdoptionTests`.
10. `project.yml` regeneration + `Tab.swift` / `DeepLinkRouter.swift` updates.
11. Integration tests + What's-new sheet.

Each step compiles and tests independently. The branch never lands in a broken state.
