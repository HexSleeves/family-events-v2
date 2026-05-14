# iOS Apple-Native Rethink — Design Spec

- **Date:** 2026-05-13
- **Status:** Draft (awaiting user review)
- **Target app:** `apps/ios/FamilyEvents`
- **Scope:** Replace the current iOS skeleton with a consumer iOS app that re-imagines the web information architecture around iOS conventions, ships on iPhone + iPad (iOS 17+), and integrates the Apple-platform features that make the app feel native rather than a web shell.

---

## 1. Decisions (locked)

| Axis | Decision |
|---|---|
| Scope shape | Apple-native rethink — re-design IA around iOS patterns, not 1:1 web mirror |
| Information architecture | 3 tabs: **Plan / Explore / Saved** |
| App architecture | SwiftUI + `@Observable` (iOS 17 Observation) + SwiftData |
| Backend client | `supabase-swift` SDK (Postgres queries, Auth, Realtime, Edge Functions) |
| Auth | Sign in with Apple (primary) + email/password (parity with web) |
| Apple integrations | Push notifications, App Intents + Shortcuts, Spotlight, MapKit, EventKit |
| Devices | iPhone + iPad |
| Deployment target | iOS 17+ |
| Deferred to v1.1 | Home/Lock-Screen widgets, Live Activities, watchOS companion |

These decisions were arrived at via brainstorming on 2026-05-13. They are the inputs to the implementation plan; subsequent reviews should treat them as constraints unless explicitly reopened.

---

## 2. Out of scope

- All `/admin/*` features. iOS is consumer-only per the repo README and existing endpoint-policy tests.
- Marketing landing page. Logged-out iOS users go straight to the auth flow.
- Widgets, Live Activities, watchOS, visionOS, Handoff, Focus filters. Tracked for v1.1+.
- Re-architecting the web app to match iOS — these stay separate clients sharing the same Supabase backend and RLS.

---

## 3. Module layout & Xcode targets

```
apps/ios/
├─ project.yml                       # XcodeGen source of truth
├─ FamilyEvents/                     # App target (entry + DI only)
│   └─ App/FamilyEventsApp.swift
├─ FamilyEventsTests/                # App-level integration tests
├─ FamilyEventsUITests/              # XCUITest critical-path smoke
├─ Packages/                         # Local Swift packages
│   ├─ FECore/                       # Domain types, errors, env config
│   ├─ FEData/                       # SupabaseClient, repositories, SwiftData
│   ├─ FEDesignSystem/               # Reusable views, colors, typography
│   ├─ FEAuth/                       # Sign-in flow, SessionStore, SIWA
│   ├─ FEPlan/                       # Plan tab + sub-views
│   ├─ FEExplore/                    # Explore tab (list/map/calendar modes)
│   ├─ FESaved/                      # Saved tab + Profile sheet
│   ├─ FEEventDetail/                # Shared event detail screen
│   └─ FEAppIntents/                 # App Intents + Shortcuts donations
└─ Widgets/                          # Reserved for v1.1; empty for now
```

**Dependency rule:** allowed imports flow strictly downward.

```
        FamilyEvents (app target)
               │
   ┌───────────┼───────────┬──────────┐
 FEPlan    FEExplore    FESaved    FEAuth
   └──────┬────┴─────┬─────┘
          │          │
   FEEventDetail   FEAppIntents
          │
   FEDesignSystem
          │
        FEData
          │
        FECore
```

`FECore` and `FEData` have no UI dependencies. `FEDesignSystem` has no networking. Feature packages may not import each other.

**Rationale:** local Swift packages give compiler-enforced module boundaries without the friction of remote versioning. Mirrors the web's `features/*` slicing but enforced by the build system. Each package has its own test target, enabling parallel builds and fast feedback.

---

## 4. Navigation & deep linking

### Root composition

```swift
TabView(selection: $selectedTab) {
    PlanTab().tag(Tab.plan)            // calendar.badge.clock
    ExploreTab().tag(Tab.explore)      // sparkle.magnifyingglass
    SavedTab().tag(Tab.saved)          // bookmark.fill
}
```

Each tab owns its own `NavigationStack(path: $path)` and a single `navigationDestination(for: AppRoute.self)`.

### Typed route enum

```swift
enum AppRoute: Hashable {
    case event(EventID)
    case city(CityID)
    case profile
    case settings
}
```

### Modal presentation

Sheets used for: Profile, Settings, Auth, Filter editor, Share sheet, Add-to-Calendar confirmation. All sheets use `.presentationDetents([.medium, .large])` + `.presentationDragIndicator(.visible)`.

### Deep links

- **URL scheme:** `familyevents://event/<id>`, `familyevents://city/<id>`.
- **Universal Links:** `https://familyevents.app/share/:eventId` (already returned by the `share-og` edge function) maps to Event Detail in unauthenticated read mode.
- A single `DeepLinkRouter` parses URLs/`NSUserActivity`/notification payloads into an `AppRoute` plus a target `Tab`. Entry points: cold-launch URL, Spotlight tap, push notification tap, share-sheet receive.

### Tab-bar badges

The Saved tab shows an unread badge driven by a `@Observable BadgeStore` subscribed to a Supabase Realtime channel for the user's saved-event comments.

---

## 5. Feature mapping

| Web page | iOS surface | Notes |
|---|---|---|
| Marketing (`/`) | _(omitted)_ | Logged-out users see the auth flow directly. |
| `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` | `FEAuth` flow | SIWA button above email/password. Reset handled via `ASWebAuthenticationSession`. |
| Saturday Plan (default home) | Plan tab → root | Hero: "Saturday, MMM d" with a vertical event timeline. |
| Dashboard (`/?legacy=1`) | Plan tab → inline "Past plans" section | Demoted; no longer top-level. |
| `/explore` | Explore tab → List mode | Searchable + filter chips. |
| `/map` | Explore tab → Map mode (segmented) | Native MapKit annotations. |
| `/calendar` | Explore tab → Calendar mode | iOS 17 `MultiDatePicker` + day strip. |
| `/events/:id` | `FEEventDetail` (pushed from any tab) | Hero image, save toggle, action row (Add to Calendar / Share / Directions). |
| `/saved` | Saved tab → root | Sectioned (Upcoming / Past) with swipe-to-unsave. |
| `/profile` | Saved tab → toolbar avatar → sheet | Account, notifications, sign-out, delete account. |
| `/share/:id` | Universal Link → Event Detail (read-only when unauth) | Same screen, different state. |

All `/admin/*` routes are explicitly out of scope and enforced by the endpoint-policy test described in §10.

---

## 6. Data layer & sync

### Layers inside `FEData`

1. **`SupabaseClient`** — singleton initialized from env config (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
2. **DTOs** — `Codable` structs mirroring Postgres row shapes, hand-authored in `FEData/Sources/FEData/DTOs/` and kept in sync with `supabase/database.types.ts` (the `pnpm run db:types` output). Drift is caught by a contract test in `FEDataTests` that compares the Swift `CodingKeys` set for each DTO to a snapshot taken from the TS types file; the snapshot is regenerated whenever schema changes intentionally land. (Automated Swift codegen from Postgres is explicitly out of scope for v1 — the table surface is small enough that drift detection is cheaper than a codegen pipeline.)
3. **SwiftData `@Model` cache** — `CachedEvent`, `CachedPlan`, `CachedFavorite`, `CachedCity`. Container provided via `.modelContainer(...)` on the app root.
4. **Repositories** — one per domain (`EventRepo`, `PlanRepo`, `FavoriteRepo`, `CityRepo`). Each exposes:
   - `func refresh() async throws` — network fetch → upsert into SwiftData.
   - `func observe() -> Query<Cached…>` — SwiftData live query consumed by SwiftUI via `@Query`.
5. **Realtime** — Supabase Realtime subscriptions for favorites + comments on saved events. Subscription updates flow into the same SwiftData store; UI auto-updates.
6. **Conflict policy** — server is last-write-wins. iOS optimistically updates SwiftData on user action; rolls back on server error and surfaces a toast.

### Stale-while-revalidate UX

UI binds to SwiftData (`@Query`) so it renders cached data immediately on app launch. A timestamp shown on the Plan tab indicates last successful sync. Pull-to-refresh forces a `refresh()` on the visible repository.

### Why not CloudKit-only

CloudKit would bypass RLS and let users see each other's drafts (e.g., comments, ratings). Supabase RLS is the single authoritative authorization layer.

---

## 7. Auth flow

### Components

- **`ASAuthorizationController`** for Sign in with Apple.
- **`supabase.auth.signInWithIdToken(provider: .apple, idToken: ...)`** to exchange the Apple identity token for a Supabase session.
- **Email/password** via `supabase.auth.signIn(email:password:)`.
- **`SessionStore` (`@Observable`)** — current user, access + refresh tokens, refresh-on-401 interceptor.
- **Keychain** stores access + refresh tokens; biometric gate (Face ID / Touch ID) optional under Settings.

### Sign-in flow

```
Sign-in screen
   ├─ SIWA button → ASAuthorizationController
   │    → identityToken → supabase.auth.signInWithIdToken
   │    → SessionStore populated → RootView swaps to TabView
   └─ Email/password → supabase.auth.signIn(email:password:) → same path
```

### Apple relay-email handling

Apple may return a relay email; we store the Apple `user` identifier as the stable join key and treat the relay address as display-only. Re-login with the same Apple ID is recognized.

### Account deletion (App Store requirement)

Profile sheet → "Delete account" → confirmation sheet → calls `supabase.rpc("delete_my_account")`. New RPC added to the backend in this work, following the project's private-body + public-wrapper convention (see `CLAUDE.md` and `supabase/migrations/20260601002100_wrap_security_definer_rpcs.sql`).

---

## 8. Apple-platform integrations

### Push notifications

- APNs token registered at app launch when the user is authenticated.
- Token uploaded via a new edge function `register-device`.
- Backend extension to the existing `notify-email` logic also sends a push for the same event.
- Three `UNNotificationCategory` definitions: `EVENT_REMINDER` (with `Snooze` / `View` actions), `INVITE_RESPONSE`, `PLAN_DIGEST`.

### App Intents + Shortcuts

- **`WhatsMySaturdayPlanIntent`** — returns spoken summary + visual snippet for Lock Screen / Siri.
- **`SaveEventIntent`** — parameterized by `EventEntity: AppEntity`.
- **`OpenEventIntent`** — handles "Open <event name>" via Siri or Spotlight.
- Donations on first run + on save/view actions so Siri Suggestions surface them.

### Spotlight (`CoreSpotlight`)

- Each saved event indexed as a `CSSearchableItem` (title, location, date, image).
- Spotlight tap launches the app and routes via `NSUserActivity` → `AppRoute.event(id)`.
- Index entries updated on save / unsave; cleared on sign-out.

### MapKit

- `Map(position:)` with custom `Annotation` views.
- Tap → bottom sheet with event card.
- "Get Directions" hands off to Apple Maps via `MKMapItem.openInMaps`.

### EventKit

- Event Detail toolbar → "Add to Calendar" → `EKEventStore.requestWriteOnlyAccess()` → creates an `EKEvent` with title, start/end, location, notes, and a default 30-min alarm.
- Permission requested at tap, not at launch.

### Sign in with Apple

Covered in §7.

---

## 9. iPad adaptivity

### Strategy

Single root view branches on `horizontalSizeClass`. iPhone gets `TabView`; regular-width iPad gets `NavigationSplitView` with a sidebar listing the same three tabs.

```swift
@Environment(\.horizontalSizeClass) var sizeClass

var body: some View {
    if sizeClass == .regular {
        NavigationSplitView {
            SidebarTabList(selection: $selectedTab)
        } detail: {
            tabContent(for: selectedTab)
        }
    } else {
        TabView(selection: $selectedTab) { /* ... */ }
    }
}
```

### iPad-specific affordances

- Sidebar replaces tab bar; selected tab fills the detail column.
- Event Detail opens in a third "inspector" column on regular width; pushes onto the detail stack on compact iPad.
- Map mode uses the full width of the detail column; segmented control moves to the toolbar.
- Stage Manager half-window cleanly collapses back to phone-shaped UI via the size-class branch.

No screens are duplicated. The cost of iPad support is one branch in `RootView` plus per-screen `.navigationSplitViewStyle` choices.

---

## 10. Testing strategy

### Layers

1. **Unit (`<Package>Tests/`)** — XCTest per Swift package. Pure logic. Repositories tested with a fake `SupabaseClient`. Stores and intents tested against canned DTO inputs.
2. **Integration (`FamilyEventsTests/`)** — full app boot with a `MockSupabase` serving canned JSON. Covers deep-link parsing, tab switching, sign-in/out, SwiftData reset on sign-out.
3. **UI smoke (`FamilyEventsUITests/`)** — XCUITest for three critical paths: SIWA sign-in, save-an-event, view-Saturday-Plan. Runs against an iPhone 15 simulator in CI.

### Snapshot testing

`FEDesignSystem` reusable views (e.g., `EventCard`, `StarRating`, `FavoriteButton`) covered by `swift-snapshot-testing` with light/dark/Dynamic Type variants.

### Endpoint-policy guard

A test in `FamilyEventsTests` asserts that `ConsumerAPIPath` (and any other endpoint enum/string set) never references `/admin/*`. Same shape as the web's existing endpoint-policy tests.

### CI integration

Existing `pnpm run ios:test` continues to be the entry point. `xcodebuild test -scheme FamilyEvents -destination 'platform=iOS Simulator,name=iPhone 15'` runs all three layers. Snapshot tests run in record mode only when invoked locally.

---

## 11. Delivery sequence

Nine milestones, each a shippable internal TestFlight build.

| # | Milestone | Deliverable |
|---|---|---|
| 1 | Foundation | SPM package split, `SupabaseClient`, `SessionStore`, `FEDesignSystem` primitives, empty tab shell |
| 2 | Auth | SIWA + email/password, Keychain persistence, account deletion RPC |
| 3 | Plan tab | Saturday Plan timeline, repositories, SwiftData cache, pull-to-refresh |
| 4 | Event Detail | Hero image, action row, EventKit add-to-calendar, share sheet |
| 5 | Explore — List | Search, filters, infinite scroll, save toggle |
| 6 | Explore — Map & Calendar | MapKit annotations, iOS 17 `MultiDatePicker` |
| 7 | Saved + Profile | Sectioned saved list, profile sheet, notification prefs |
| 8 | Apple integrations | Push registration + handling, App Intents donations, Spotlight indexing, Universal Links |
| 9 | iPad polish | `NavigationSplitView`, Map/Calendar large-screen layouts |

**Internal TestFlight gate:** end of milestone 4 (auth + plan + event detail = usable app).
**Universal release candidate:** end of milestone 9.

---

## 12. Risks & open questions

| Risk / question | Mitigation |
|---|---|
| Supabase Swift SDK is younger than the JS one; Realtime may have rough edges. | Repository layer abstracts Realtime; fallback is polling on a Timer-driven refresh. |
| SwiftData migrations on schema changes can be fragile. | Use `VersionedSchema`; bake migrations into `FEData` from milestone 1 so we never have a v1 without versioning. |
| SIWA relay-email collisions with existing email/password accounts. | Backend account-linking RPC: if an Apple sign-in arrives for an email that already has a password account, prompt the user to link or sign in differently. Detailed in implementation plan. |
| Edge function `register-device` is new; backend work blocks milestone 8. | Surface in implementation plan as a backend prerequisite milestone, separable from iOS work. |
| iPad-only bugs invisible without device testing. | XCUITest matrix includes an iPad simulator from milestone 9. |
| App Store review on first SIWA build. | Account deletion RPC + clear privacy policy linked from the auth screen are explicit DoD items in milestone 2. |

---

## 13. Definition of done

- All nine milestones merged behind a per-milestone feature flag where the milestone is partially visible during development.
- `pnpm run ios:test` passes on every PR.
- Endpoint-policy test prevents any `/admin/*` reference from landing.
- TestFlight build at milestone 9 walks the full IA: sign in with Apple → see Saturday Plan → tap an event → save it → find it in Saved → open it from Spotlight on the home screen → add to Apple Calendar.
- README updated with iOS run/test instructions.
