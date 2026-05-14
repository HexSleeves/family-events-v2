# iOS Milestone 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use senior-staff-engineer:subagent-driven-development (recommended) or senior-staff-engineer:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carve the iOS app into local Swift packages with enforced module boundaries, stand up a `SupabaseClient`, an `@Observable` `SessionStore` stub, the `FEDesignSystem` primitives, and an empty 3-tab shell that compiles and tests cleanly. No real auth or data fetching yet — those land in M2/M3.

**Architecture:** Local Swift packages under `apps/ios/Packages/`, declared in `project.yml` via XcodeGen's `packages:` directive. Strict downward-only dependency graph (FECore ← FEData ← FEDesignSystem ← feature packages ← app target). Tests live alongside each package; the app's `xcodebuild test` invocation runs all of them.

**Tech Stack:**
- Swift 5.10, iOS 17 deployment target
- XcodeGen 2.38+ (already in use)
- `supabase-swift` 2.x (added in this milestone)
- SwiftData (system framework)
- `@Observable` macro from `Observation` (system framework)
- XCTest (system framework)

**Spec:** `docs/superpowers/specs/2026-05-13-ios-apple-native-rethink-design.md`

**Predecessor:** none (this is the foundational milestone).
**Successor:** M2 (Auth).

---

## File structure (after this milestone)

```
apps/ios/
├─ project.yml                                            # MODIFY: declare packages
├─ package.json                                           # MODIFY: split test scripts
├─ FamilyEvents/
│   ├─ App/FamilyEventsApp.swift                         # MODIFY: host RootView
│   ├─ App/RootView.swift                                # NEW: TabView root
│   ├─ App/DeepLinkRouter.swift                          # NEW: stub
│   ├─ App/Tab.swift                                     # NEW: tab enum
│   ├─ App/AppRoute.swift                                # NEW: typed routes
│   ├─ Networking/APIClient.swift                        # DELETE: moves to FEData
│   ├─ Networking/ConsumerAPIPath.swift                  # DELETE: moves to FECore
│   ├─ Features/Home/HomeView.swift                      # DELETE: replaced by RootView
│   └─ Info.plist                                        # unchanged
├─ FamilyEventsTests/
│   ├─ APIClientTests.swift                              # DELETE: moves to FEDataTests
│   ├─ ConsumerAPIPathTests.swift                        # DELETE: moves to FECoreTests
│   ├─ RootViewSmokeTests.swift                          # NEW
│   └─ EndpointPolicyTests.swift                         # NEW: admin-path guard
└─ Packages/
    ├─ FECore/
    │   ├─ Package.swift
    │   ├─ Sources/FECore/Identifiers.swift              # EventID, CityID, PlanID
    │   ├─ Sources/FECore/AppError.swift
    │   ├─ Sources/FECore/EnvConfig.swift
    │   ├─ Sources/FECore/ConsumerAPIPath.swift          # moved from app
    │   └─ Tests/FECoreTests/{Identifiers,AppError,EnvConfig,ConsumerAPIPath}Tests.swift
    ├─ FEData/
    │   ├─ Package.swift                                 # depends on FECore + supabase-swift
    │   ├─ Sources/FEData/SupabaseClient.swift
    │   ├─ Sources/FEData/APIClient.swift                # moved from app
    │   ├─ Sources/FEData/Repository.swift               # protocol
    │   ├─ Sources/FEData/ModelContainer+App.swift       # SwiftData stub
    │   └─ Tests/FEDataTests/{SupabaseClient,APIClient,Repository}Tests.swift
    ├─ FEDesignSystem/
    │   ├─ Package.swift                                 # depends on FECore
    │   ├─ Sources/FEDesignSystem/Color+App.swift
    │   ├─ Sources/FEDesignSystem/Typography.swift
    │   ├─ Sources/FEDesignSystem/PlaceholderView.swift
    │   └─ Tests/FEDesignSystemTests/PlaceholderViewTests.swift
    ├─ FEAuth/
    │   ├─ Package.swift                                 # depends on FECore + FEData
    │   ├─ Sources/FEAuth/SessionStore.swift
    │   └─ Tests/FEAuthTests/SessionStoreTests.swift
    ├─ FEEventDetail/
    │   ├─ Package.swift                                 # depends on FECore + FEData + FEDesignSystem
    │   ├─ Sources/FEEventDetail/EventDetailScreen.swift # placeholder
    │   └─ Tests/FEEventDetailTests/EventDetailScreenTests.swift
    ├─ FEPlan/
    │   ├─ Package.swift
    │   ├─ Sources/FEPlan/PlanTab.swift                  # placeholder
    │   └─ Tests/FEPlanTests/PlanTabTests.swift
    ├─ FEExplore/
    │   ├─ Package.swift
    │   ├─ Sources/FEExplore/ExploreTab.swift            # placeholder
    │   └─ Tests/FEExploreTests/ExploreTabTests.swift
    ├─ FESaved/
    │   ├─ Package.swift
    │   ├─ Sources/FESaved/SavedTab.swift                # placeholder
    │   └─ Tests/FESavedTests/SavedTabTests.swift
    └─ FEAppIntents/
        ├─ Package.swift
        ├─ Sources/FEAppIntents/AppIntentsRegistry.swift # placeholder
        └─ Tests/FEAppIntentsTests/AppIntentsRegistryTests.swift
```

**File-responsibility rules:**
- `FECore` has **zero** UI, **zero** networking. Pure values and protocols.
- `FEData` has **zero** UI. Owns the Supabase + SwiftData boundary.
- `FEDesignSystem` has **zero** networking. SwiftUI views and tokens only.
- Feature packages (`FEAuth`, `FEPlan`, `FEExplore`, `FESaved`, `FEEventDetail`, `FEAppIntents`) **never** import each other.
- The app target (`FamilyEvents`) is the **only** module that imports all feature packages.

---

## Conventions used in this plan

- Every step that changes code shows the full new file content (so the engineer can paste it directly).
- Commit messages follow the project's existing style: `feat(ios):`, `chore(ios):`, `test(ios):`. Each commit is scoped to one task.
- All `xcodegen generate` and `xcodebuild` invocations are run from `apps/ios/` unless otherwise stated.
- All `swift test --package-path` invocations are run from the repo root.

---

## Task 1: Pin a known-good `supabase-swift` version

`supabase-swift` is the SDK we'll depend on starting in M3, but we add the dependency now so `FEData` builds against it from day one and no later milestone has to rewire the dependency graph.

**Files:**
- Modify: `apps/ios/project.yml` (add a `packages:` block — this is where remote SPM deps go for XcodeGen)
- Modify: `apps/ios/Packages/FEData/Package.swift` (created in Task 6 — this step only adds the version pin here)

Skip the project.yml edit until Task 5; this task just records the version pin we'll use.

- [ ] **Step 1: Record the version pin in this plan**

Use `supabase-swift` `2.20.0` (latest stable as of the spec date). Add this to your notes — every subsequent task referencing the SDK uses this version.

- [ ] **Step 2: Commit the plan if not already committed**

```bash
git status docs/superpowers/plans/2026-05-13-ios-m1-foundation-plan.md
# If unmodified-and-tracked, skip. Otherwise:
git add docs/superpowers/plans/2026-05-13-ios-m1-foundation-plan.md
git commit -m "docs(ios): add M1 foundation plan"
```

---

## Task 2: Create the `FECore` package shell

The first package. Sets the pattern every subsequent package follows.

**Files:**
- Create: `apps/ios/Packages/FECore/Package.swift`
- Create: `apps/ios/Packages/FECore/Sources/FECore/FECore.swift`
- Create: `apps/ios/Packages/FECore/Tests/FECoreTests/FECoreTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/Packages/FECore/Tests/FECoreTests/FECoreTests.swift`:

```swift
import XCTest
@testable import FECore

final class FECoreTests: XCTestCase {
    func testPackageLoads() {
        XCTAssertEqual(FECore.version, "0.1.0")
    }
}
```

- [ ] **Step 2: Run the test and confirm it fails (package doesn't exist yet)**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | head -20
```

Expected: failure — no `Package.swift`.

- [ ] **Step 3: Create the package manifest**

Create `apps/ios/Packages/FECore/Package.swift`:

```swift
// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "FECore",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "FECore", targets: ["FECore"]),
    ],
    targets: [
        .target(name: "FECore", path: "Sources/FECore"),
        .testTarget(name: "FECoreTests", dependencies: ["FECore"], path: "Tests/FECoreTests"),
    ]
)
```

- [ ] **Step 4: Add the placeholder source**

Create `apps/ios/Packages/FECore/Sources/FECore/FECore.swift`:

```swift
public enum FECore {
    public static let version = "0.1.0"
}
```

- [ ] **Step 5: Run the test and confirm it passes**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | tail -10
```

Expected: `Test Suite 'All tests' passed at ...`, 1 test passing.

- [ ] **Step 6: Commit**

```bash
git add apps/ios/Packages/FECore
git commit -m "feat(ios): scaffold FECore Swift package"
```

---

## Task 3: Add typed identifiers to `FECore`

Typed IDs prevent passing an `EventID` where a `CityID` is expected. Mirrors how `packages/contracts` exposes branded types on the web side.

**Files:**
- Create: `apps/ios/Packages/FECore/Sources/FECore/Identifiers.swift`
- Create: `apps/ios/Packages/FECore/Tests/FECoreTests/IdentifiersTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/Packages/FECore/Tests/FECoreTests/IdentifiersTests.swift`:

```swift
import XCTest
@testable import FECore

final class IdentifiersTests: XCTestCase {
    func testEventIDWrapsString() {
        let id = EventID("evt_123")
        XCTAssertEqual(id.rawValue, "evt_123")
    }

    func testEventIDIsHashable() {
        let set: Set<EventID> = [EventID("a"), EventID("b"), EventID("a")]
        XCTAssertEqual(set.count, 2)
    }

    func testCityIDAndEventIDAreDistinctTypes() {
        let evt = EventID("x")
        let city = CityID("x")
        // Both wrap the same raw value, but their types differ — the compiler
        // should refuse to compare them. This is a compile-time guarantee, so
        // we just assert they each round-trip independently here.
        XCTAssertEqual(evt.rawValue, city.rawValue)
    }

    func testPlanIDEncodesAsString() throws {
        let id = PlanID("plan_1")
        let data = try JSONEncoder().encode(id)
        let decoded = try JSONDecoder().decode(PlanID.self, from: data)
        XCTAssertEqual(decoded, id)
    }
}
```

- [ ] **Step 2: Run the test and confirm it fails (types not defined)**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | head -30
```

Expected: compile errors — `EventID`, `CityID`, `PlanID` undefined.

- [ ] **Step 3: Implement the identifiers**

Create `apps/ios/Packages/FECore/Sources/FECore/Identifiers.swift`:

```swift
import Foundation

public protocol TypedIdentifier: Hashable, Codable, CustomStringConvertible, Sendable {
    var rawValue: String { get }
    init(_ rawValue: String)
}

public extension TypedIdentifier {
    var description: String { rawValue }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        self.init(try container.decode(String.self))
    }
}

public struct EventID: TypedIdentifier {
    public let rawValue: String
    public init(_ rawValue: String) { self.rawValue = rawValue }
}

public struct CityID: TypedIdentifier {
    public let rawValue: String
    public init(_ rawValue: String) { self.rawValue = rawValue }
}

public struct PlanID: TypedIdentifier {
    public let rawValue: String
    public init(_ rawValue: String) { self.rawValue = rawValue }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | tail -10
```

Expected: 5 tests passing (1 from Task 2 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FECore/Sources/FECore/Identifiers.swift apps/ios/Packages/FECore/Tests/FECoreTests/IdentifiersTests.swift
git commit -m "feat(ios): add typed identifiers to FECore"
```

---

## Task 4: Move `ConsumerAPIPath` into `FECore`

`ConsumerAPIPath` currently lives in the app target. Moving it to `FECore` lets every package (including future test targets) consume it without circular dependencies, and keeps the admin-path guard test centralized.

**Files:**
- Create: `apps/ios/Packages/FECore/Sources/FECore/ConsumerAPIPath.swift`
- Create: `apps/ios/Packages/FECore/Tests/FECoreTests/ConsumerAPIPathTests.swift`
- Delete: `apps/ios/FamilyEvents/Networking/ConsumerAPIPath.swift`
- Delete: `apps/ios/FamilyEventsTests/ConsumerAPIPathTests.swift`

- [ ] **Step 1: Write the failing test in the new location**

Create `apps/ios/Packages/FECore/Tests/FECoreTests/ConsumerAPIPathTests.swift`:

```swift
import XCTest
@testable import FECore

final class ConsumerAPIPathTests: XCTestCase {
    func testConsumerPathsAreSupported() {
        XCTAssertEqual(ConsumerAPIPath.events.value, "/api/v1/events")
        XCTAssertEqual(ConsumerAPIPath.eventDetail(id: EventID("evt_1")).value, "/api/v1/events/evt_1")
        XCTAssertEqual(ConsumerAPIPath.favorites.value, "/api/v1/favorites")
        XCTAssertEqual(ConsumerAPIPath.profile.value, "/api/v1/profile")
    }

    func testNoAdminPathsExposed() {
        let allCases: [ConsumerAPIPath] = [
            .events,
            .eventDetail(id: EventID("evt_1")),
            .favorites,
            .profile,
        ]
        for path in allCases {
            XCTAssertFalse(path.value.contains("/admin"), "admin path leaked into ConsumerAPIPath: \(path.value)")
        }
    }
}
```

- [ ] **Step 2: Run the test and confirm it fails (type not yet in FECore)**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | head -20
```

Expected: compile error — `ConsumerAPIPath` not found.

- [ ] **Step 3: Add the type to `FECore`**

Create `apps/ios/Packages/FECore/Sources/FECore/ConsumerAPIPath.swift`:

```swift
import Foundation

public enum ConsumerAPIPath: Equatable, Sendable {
    case events
    case eventDetail(id: EventID)
    case favorites
    case profile

    public var value: String {
        switch self {
        case .events:
            return "/api/v1/events"
        case .eventDetail(let id):
            return "/api/v1/events/\(id.rawValue)"
        case .favorites:
            return "/api/v1/favorites"
        case .profile:
            return "/api/v1/profile"
        }
    }
}
```

- [ ] **Step 4: Run the FECore tests**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | tail -10
```

Expected: all tests pass (7 total).

- [ ] **Step 5: Delete the legacy app-target copies**

```bash
git rm apps/ios/FamilyEvents/Networking/ConsumerAPIPath.swift apps/ios/FamilyEventsTests/ConsumerAPIPathTests.swift
```

- [ ] **Step 6: Commit**

```bash
git add apps/ios/Packages/FECore/Sources/FECore/ConsumerAPIPath.swift apps/ios/Packages/FECore/Tests/FECoreTests/ConsumerAPIPathTests.swift
git commit -m "refactor(ios): move ConsumerAPIPath into FECore package"
```

---

## Task 5: Add `AppError` and `EnvConfig` to `FECore`

`AppError` is the single error type all repositories surface. `EnvConfig` reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Info.plist values that XcodeGen will inject from the user's environment.

**Files:**
- Create: `apps/ios/Packages/FECore/Sources/FECore/AppError.swift`
- Create: `apps/ios/Packages/FECore/Sources/FECore/EnvConfig.swift`
- Create: `apps/ios/Packages/FECore/Tests/FECoreTests/AppErrorTests.swift`
- Create: `apps/ios/Packages/FECore/Tests/FECoreTests/EnvConfigTests.swift`

- [ ] **Step 1: Write the failing tests**

Create `apps/ios/Packages/FECore/Tests/FECoreTests/AppErrorTests.swift`:

```swift
import XCTest
@testable import FECore

final class AppErrorTests: XCTestCase {
    func testNetworkErrorCarriesUnderlying() {
        let underlying = NSError(domain: "test", code: 42)
        let err = AppError.network(underlying)
        XCTAssertEqual(err.userMessage, "Network problem. Please try again.")
    }

    func testUnauthorizedHasFriendlyMessage() {
        XCTAssertEqual(AppError.unauthorized.userMessage, "You're signed out. Please sign in again.")
    }

    func testNotFoundHasFriendlyMessage() {
        XCTAssertEqual(AppError.notFound.userMessage, "We couldn't find that.")
    }

    func testUnknownWrapsUnderlying() {
        let err = AppError.unknown(NSError(domain: "x", code: 0))
        XCTAssertTrue(err.userMessage.contains("Something went wrong"))
    }
}
```

Create `apps/ios/Packages/FECore/Tests/FECoreTests/EnvConfigTests.swift`:

```swift
import XCTest
@testable import FECore

final class EnvConfigTests: XCTestCase {
    func testFailsWhenSupabaseURLMissing() {
        let bundle = StubBundle(values: ["SupabaseAnonKey": "anon"])
        XCTAssertThrowsError(try EnvConfig.load(from: bundle)) { error in
            guard case AppError.config(let key) = error else {
                XCTFail("expected config error, got \(error)")
                return
            }
            XCTAssertEqual(key, "SupabaseURL")
        }
    }

    func testFailsWhenAnonKeyMissing() {
        let bundle = StubBundle(values: ["SupabaseURL": "https://example.com"])
        XCTAssertThrowsError(try EnvConfig.load(from: bundle))
    }

    func testLoadsBothValues() throws {
        let bundle = StubBundle(values: [
            "SupabaseURL": "https://example.supabase.co",
            "SupabaseAnonKey": "anon_xxx",
        ])
        let config = try EnvConfig.load(from: bundle)
        XCTAssertEqual(config.supabaseURL.absoluteString, "https://example.supabase.co")
        XCTAssertEqual(config.supabaseAnonKey, "anon_xxx")
    }
}

private final class StubBundle: InfoPlistReader {
    let values: [String: Any]
    init(values: [String: Any]) { self.values = values }
    func object(forInfoDictionaryKey key: String) -> Any? { values[key] }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | head -30
```

Expected: compile errors — `AppError`, `EnvConfig`, `InfoPlistReader` undefined.

- [ ] **Step 3: Implement `AppError`**

Create `apps/ios/Packages/FECore/Sources/FECore/AppError.swift`:

```swift
import Foundation

public enum AppError: Error, Sendable {
    case network(Error)
    case unauthorized
    case notFound
    case config(String)
    case unknown(Error)

    public var userMessage: String {
        switch self {
        case .network:
            return "Network problem. Please try again."
        case .unauthorized:
            return "You're signed out. Please sign in again."
        case .notFound:
            return "We couldn't find that."
        case .config(let key):
            return "Configuration error: \(key) is missing."
        case .unknown:
            return "Something went wrong."
        }
    }
}
```

- [ ] **Step 4: Implement `EnvConfig`**

Create `apps/ios/Packages/FECore/Sources/FECore/EnvConfig.swift`:

```swift
import Foundation

public protocol InfoPlistReader {
    func object(forInfoDictionaryKey key: String) -> Any?
}

extension Bundle: InfoPlistReader {}

public struct EnvConfig: Sendable {
    public let supabaseURL: URL
    public let supabaseAnonKey: String

    public init(supabaseURL: URL, supabaseAnonKey: String) {
        self.supabaseURL = supabaseURL
        self.supabaseAnonKey = supabaseAnonKey
    }

    public static func load(from reader: InfoPlistReader = Bundle.main) throws -> EnvConfig {
        guard let urlString = reader.object(forInfoDictionaryKey: "SupabaseURL") as? String,
              let url = URL(string: urlString) else {
            throw AppError.config("SupabaseURL")
        }
        guard let key = reader.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String else {
            throw AppError.config("SupabaseAnonKey")
        }
        return EnvConfig(supabaseURL: url, supabaseAnonKey: key)
    }
}
```

- [ ] **Step 5: Run and confirm pass**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | tail -10
```

Expected: all 11 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/ios/Packages/FECore/Sources/FECore/AppError.swift apps/ios/Packages/FECore/Sources/FECore/EnvConfig.swift apps/ios/Packages/FECore/Tests/FECoreTests/AppErrorTests.swift apps/ios/Packages/FECore/Tests/FECoreTests/EnvConfigTests.swift
git commit -m "feat(ios): add AppError + EnvConfig to FECore"
```

---

## Task 6: Create the `FEData` package with `supabase-swift`

`FEData` depends on `FECore` and pulls in `supabase-swift`. We add the SDK now even though we don't call it until M2 — having it in the dependency graph from day one avoids a later migration.

**Files:**
- Create: `apps/ios/Packages/FEData/Package.swift`
- Create: `apps/ios/Packages/FEData/Sources/FEData/FEData.swift`
- Create: `apps/ios/Packages/FEData/Tests/FEDataTests/FEDataTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/Packages/FEData/Tests/FEDataTests/FEDataTests.swift`:

```swift
import XCTest
@testable import FEData
import FECore

final class FEDataTests: XCTestCase {
    func testPackageLoadsAndDependsOnFECore() {
        XCTAssertEqual(FEData.version, "0.1.0")
        XCTAssertEqual(FECore.version, "0.1.0")
    }
}
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd apps/ios/Packages/FEData && swift test 2>&1 | head -20
```

Expected: no `Package.swift`.

- [ ] **Step 3: Create the package manifest**

Create `apps/ios/Packages/FEData/Package.swift`:

```swift
// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "FEData",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "FEData", targets: ["FEData"]),
    ],
    dependencies: [
        .package(path: "../FECore"),
        .package(url: "https://github.com/supabase/supabase-swift", exact: "2.20.0"),
    ],
    targets: [
        .target(
            name: "FEData",
            dependencies: [
                "FECore",
                .product(name: "Supabase", package: "supabase-swift"),
            ],
            path: "Sources/FEData"
        ),
        .testTarget(
            name: "FEDataTests",
            dependencies: ["FEData", "FECore"],
            path: "Tests/FEDataTests"
        ),
    ]
)
```

- [ ] **Step 4: Add the placeholder source**

Create `apps/ios/Packages/FEData/Sources/FEData/FEData.swift`:

```swift
public enum FEData {
    public static let version = "0.1.0"
}
```

- [ ] **Step 5: Run the test (note: first run downloads `supabase-swift`)**

```bash
cd apps/ios/Packages/FEData && swift test 2>&1 | tail -10
```

Expected: 1 test passing. First run may take 30–90s as SPM resolves and builds `supabase-swift`.

- [ ] **Step 6: Commit**

```bash
git add apps/ios/Packages/FEData
git commit -m "feat(ios): scaffold FEData package with supabase-swift 2.20.0"
```

---

## Task 7: Move `APIClient` into `FEData`

Same pattern as Task 4 — the existing `APIClient` moves to `FEData` so the app target stops owning networking primitives.

**Files:**
- Create: `apps/ios/Packages/FEData/Sources/FEData/APIClient.swift`
- Create: `apps/ios/Packages/FEData/Tests/FEDataTests/APIClientTests.swift`
- Delete: `apps/ios/FamilyEvents/Networking/APIClient.swift`
- Delete: `apps/ios/FamilyEventsTests/APIClientTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/Packages/FEData/Tests/FEDataTests/APIClientTests.swift`:

```swift
import XCTest
@testable import FEData
import FECore

final class APIClientTests: XCTestCase {
    func testBuildsURLFromConsumerPath() {
        let client = APIClient(baseURL: URL(string: "https://example.com")!)
        let url = client.url(for: .events)
        XCTAssertEqual(url.absoluteString, "https://example.com/api/v1/events")
    }

    func testEventDetailURLEmbedsTypedID() {
        let client = APIClient(baseURL: URL(string: "https://example.com")!)
        let url = client.url(for: .eventDetail(id: EventID("evt_42")))
        XCTAssertEqual(url.absoluteString, "https://example.com/api/v1/events/evt_42")
    }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FEData && swift test 2>&1 | head -20
```

Expected: `APIClient` undefined in `FEData`.

- [ ] **Step 3: Implement `APIClient` in FEData**

Create `apps/ios/Packages/FEData/Sources/FEData/APIClient.swift`:

```swift
import Foundation
import FECore

public struct APIClient: Sendable {
    public let baseURL: URL

    public init(baseURL: URL) {
        self.baseURL = baseURL
    }

    public func url(for path: ConsumerAPIPath) -> URL {
        baseURL.appending(path: path.value)
    }
}
```

- [ ] **Step 4: Run the FEData tests**

```bash
cd apps/ios/Packages/FEData && swift test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Remove the legacy app-target files**

```bash
git rm apps/ios/FamilyEvents/Networking/APIClient.swift apps/ios/FamilyEventsTests/APIClientTests.swift
```

- [ ] **Step 6: Commit**

```bash
git add apps/ios/Packages/FEData/Sources/FEData/APIClient.swift apps/ios/Packages/FEData/Tests/FEDataTests/APIClientTests.swift
git commit -m "refactor(ios): move APIClient into FEData package"
```

---

## Task 8: Add the `SupabaseClient` wrapper to `FEData`

Thin Sendable wrapper around the SDK's `SupabaseClient`. We don't call any endpoints here — just verify it constructs from `EnvConfig`.

**Files:**
- Create: `apps/ios/Packages/FEData/Sources/FEData/SupabaseClient.swift`
- Create: `apps/ios/Packages/FEData/Tests/FEDataTests/SupabaseClientTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/Packages/FEData/Tests/FEDataTests/SupabaseClientTests.swift`:

```swift
import XCTest
@testable import FEData
import FECore

final class SupabaseClientTests: XCTestCase {
    func testInitFromEnvConfig() {
        let config = EnvConfig(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseAnonKey: "anon"
        )
        let client = FamilyEventsSupabase(config: config)
        XCTAssertEqual(client.config.supabaseURL.absoluteString, "https://example.supabase.co")
    }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FEData && swift test 2>&1 | head -20
```

Expected: `FamilyEventsSupabase` undefined.

- [ ] **Step 3: Implement the wrapper**

Create `apps/ios/Packages/FEData/Sources/FEData/SupabaseClient.swift`:

```swift
import Foundation
import Supabase
import FECore

/// Thin wrapper around the Supabase SDK so callers depend on FEData, not the
/// SDK directly. Future milestones add typed methods (auth, query helpers,
/// realtime subscriptions) as extensions on this type.
public final class FamilyEventsSupabase: @unchecked Sendable {
    public let config: EnvConfig
    public let client: SupabaseClient

    public init(config: EnvConfig) {
        self.config = config
        self.client = SupabaseClient(
            supabaseURL: config.supabaseURL,
            supabaseKey: config.supabaseAnonKey
        )
    }
}
```

- [ ] **Step 4: Run the tests**

```bash
cd apps/ios/Packages/FEData && swift test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FEData/Sources/FEData/SupabaseClient.swift apps/ios/Packages/FEData/Tests/FEDataTests/SupabaseClientTests.swift
git commit -m "feat(ios): add FamilyEventsSupabase wrapper around supabase-swift"
```

---

## Task 9: Add the `Repository` protocol and SwiftData model container scaffold

The repository protocol is the contract every domain repo (`EventRepo`, `PlanRepo`, …) implements in later milestones. The model container stub gives us a place to register `@Model` types as they get added.

**Files:**
- Create: `apps/ios/Packages/FEData/Sources/FEData/Repository.swift`
- Create: `apps/ios/Packages/FEData/Sources/FEData/ModelContainer+App.swift`
- Create: `apps/ios/Packages/FEData/Tests/FEDataTests/RepositoryTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/Packages/FEData/Tests/FEDataTests/RepositoryTests.swift`:

```swift
import XCTest
@testable import FEData

final class RepositoryTests: XCTestCase {
    func testFakeRepoConformsToRepository() async throws {
        let repo = FakeRepository()
        try await repo.refresh()
        XCTAssertEqual(repo.refreshCount, 1)
    }

    func testInMemoryModelContainerBuilds() throws {
        let container = try AppModelContainer.makeInMemory()
        XCTAssertNotNil(container)
    }
}

private final class FakeRepository: Repository, @unchecked Sendable {
    var refreshCount = 0
    func refresh() async throws {
        refreshCount += 1
    }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FEData && swift test 2>&1 | head -20
```

Expected: `Repository`, `AppModelContainer` undefined.

- [ ] **Step 3: Implement the protocol**

Create `apps/ios/Packages/FEData/Sources/FEData/Repository.swift`:

```swift
import Foundation

/// Every domain repository conforms. `refresh` is the network-pull side; the
/// SwiftData-observation side is exposed per-repo with concrete return types.
public protocol Repository: Sendable {
    func refresh() async throws
}
```

- [ ] **Step 4: Implement the model container scaffold**

Create `apps/ios/Packages/FEData/Sources/FEData/ModelContainer+App.swift`:

```swift
import Foundation
import SwiftData

/// Centralised SwiftData container construction. M1 has no @Model types yet —
/// later milestones extend `allModelTypes` as CachedEvent, CachedFavorite,
/// etc. are added.
public enum AppModelContainer {
    /// Types registered with SwiftData. Empty in M1; extended in M3+.
    public static var allModelTypes: [any PersistentModel.Type] { [] }

    public static func makePersistent() throws -> ModelContainer {
        let schema = Schema(allModelTypes)
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        return try ModelContainer(for: schema, configurations: config)
    }

    public static func makeInMemory() throws -> ModelContainer {
        let schema = Schema(allModelTypes)
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        return try ModelContainer(for: schema, configurations: config)
    }
}
```

- [ ] **Step 5: Run the tests**

```bash
cd apps/ios/Packages/FEData && swift test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/ios/Packages/FEData/Sources/FEData/Repository.swift apps/ios/Packages/FEData/Sources/FEData/ModelContainer+App.swift apps/ios/Packages/FEData/Tests/FEDataTests/RepositoryTests.swift
git commit -m "feat(ios): add Repository protocol and SwiftData container scaffold"
```

---

## Task 10: Create the `FEDesignSystem` package

Tokens + a `PlaceholderView` consumed by the three placeholder tabs in this milestone.

**Files:**
- Create: `apps/ios/Packages/FEDesignSystem/Package.swift`
- Create: `apps/ios/Packages/FEDesignSystem/Sources/FEDesignSystem/Color+App.swift`
- Create: `apps/ios/Packages/FEDesignSystem/Sources/FEDesignSystem/Typography.swift`
- Create: `apps/ios/Packages/FEDesignSystem/Sources/FEDesignSystem/PlaceholderView.swift`
- Create: `apps/ios/Packages/FEDesignSystem/Tests/FEDesignSystemTests/PlaceholderViewTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/Packages/FEDesignSystem/Tests/FEDesignSystemTests/PlaceholderViewTests.swift`:

```swift
import XCTest
import SwiftUI
@testable import FEDesignSystem

final class PlaceholderViewTests: XCTestCase {
    func testPlaceholderViewExposesTitleAndSymbol() {
        let view = PlaceholderView(title: "Plan", systemImage: "calendar.badge.clock")
        XCTAssertEqual(view.title, "Plan")
        XCTAssertEqual(view.systemImage, "calendar.badge.clock")
    }

    func testAppTypographyExposesTitleStyle() {
        // Sanity: the style enum compiles and exposes a known case.
        let style = AppTypography.titleLarge
        XCTAssertNotNil(style)
    }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FEDesignSystem && swift test 2>&1 | head -20
```

Expected: no `Package.swift`.

- [ ] **Step 3: Create the package manifest**

Create `apps/ios/Packages/FEDesignSystem/Package.swift`:

```swift
// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "FEDesignSystem",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "FEDesignSystem", targets: ["FEDesignSystem"]),
    ],
    dependencies: [
        .package(path: "../FECore"),
    ],
    targets: [
        .target(name: "FEDesignSystem", dependencies: ["FECore"], path: "Sources/FEDesignSystem"),
        .testTarget(name: "FEDesignSystemTests", dependencies: ["FEDesignSystem"], path: "Tests/FEDesignSystemTests"),
    ]
)
```

- [ ] **Step 4: Add the color tokens**

Create `apps/ios/Packages/FEDesignSystem/Sources/FEDesignSystem/Color+App.swift`:

```swift
import SwiftUI

public extension Color {
    static let appAccent = Color.accentColor
    static let appBackground = Color(.systemBackground)
    static let appSecondaryBackground = Color(.secondarySystemBackground)
    static let appLabel = Color(.label)
    static let appSecondaryLabel = Color(.secondaryLabel)
}
```

- [ ] **Step 5: Add the typography enum**

Create `apps/ios/Packages/FEDesignSystem/Sources/FEDesignSystem/Typography.swift`:

```swift
import SwiftUI

public enum AppTypography: Sendable {
    case titleLarge
    case titleMedium
    case body
    case caption

    public var font: Font {
        switch self {
        case .titleLarge: return .largeTitle.weight(.bold)
        case .titleMedium: return .title3.weight(.semibold)
        case .body: return .body
        case .caption: return .caption
        }
    }
}

public extension View {
    func appTypography(_ style: AppTypography) -> some View {
        font(style.font)
    }
}
```

- [ ] **Step 6: Add the placeholder view**

Create `apps/ios/Packages/FEDesignSystem/Sources/FEDesignSystem/PlaceholderView.swift`:

```swift
import SwiftUI

public struct PlaceholderView: View {
    public let title: String
    public let systemImage: String

    public init(title: String, systemImage: String) {
        self.title = title
        self.systemImage = systemImage
    }

    public var body: some View {
        ContentUnavailableView(title, systemImage: systemImage)
    }
}

#Preview {
    PlaceholderView(title: "Plan", systemImage: "calendar.badge.clock")
}
```

- [ ] **Step 7: Run the tests**

```bash
cd apps/ios/Packages/FEDesignSystem && swift test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/ios/Packages/FEDesignSystem
git commit -m "feat(ios): scaffold FEDesignSystem with tokens and PlaceholderView"
```

---

## Task 11: Scaffold `FEAuth` with an `@Observable` `SessionStore`

State machine only — no actual sign-in calls (those land in M2).

**Files:**
- Create: `apps/ios/Packages/FEAuth/Package.swift`
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/SessionStore.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/SessionStoreTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/SessionStoreTests.swift`:

```swift
import XCTest
@testable import FEAuth

@MainActor
final class SessionStoreTests: XCTestCase {
    func testInitialStateIsSignedOut() {
        let store = SessionStore()
        if case .signedOut = store.state {} else {
            XCTFail("expected initial state .signedOut, got \(store.state)")
        }
    }

    func testTransitionToSignedIn() {
        let store = SessionStore()
        store.markSignedIn(userID: "user_42")
        guard case .signedIn(let id) = store.state else {
            XCTFail("expected .signedIn, got \(store.state)")
            return
        }
        XCTAssertEqual(id, "user_42")
    }

    func testSignOutResets() {
        let store = SessionStore()
        store.markSignedIn(userID: "user_1")
        store.signOut()
        if case .signedOut = store.state {} else {
            XCTFail("expected .signedOut, got \(store.state)")
        }
    }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | head -20
```

Expected: no `Package.swift`.

- [ ] **Step 3: Create the package manifest**

Create `apps/ios/Packages/FEAuth/Package.swift`:

```swift
// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "FEAuth",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "FEAuth", targets: ["FEAuth"]),
    ],
    dependencies: [
        .package(path: "../FECore"),
        .package(path: "../FEData"),
    ],
    targets: [
        .target(name: "FEAuth", dependencies: ["FECore", "FEData"], path: "Sources/FEAuth"),
        .testTarget(name: "FEAuthTests", dependencies: ["FEAuth"], path: "Tests/FEAuthTests"),
    ]
)
```

- [ ] **Step 4: Implement the `SessionStore` stub**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/SessionStore.swift`:

```swift
import Foundation
import Observation

public enum SessionState: Equatable, Sendable {
    case signedOut
    case signedIn(userID: String)
}

@Observable
@MainActor
public final class SessionStore {
    public private(set) var state: SessionState = .signedOut

    public init() {}

    /// Test/transition seam — M2 replaces this with a real Supabase auth call.
    public func markSignedIn(userID: String) {
        state = .signedIn(userID: userID)
    }

    public func signOut() {
        state = .signedOut
    }
}
```

- [ ] **Step 5: Run the tests**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | tail -10
```

Expected: all 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/ios/Packages/FEAuth
git commit -m "feat(ios): scaffold FEAuth with @Observable SessionStore state machine"
```

---

## Task 12: Scaffold the four feature packages and `FEEventDetail`

Five tiny packages (`FEPlan`, `FEExplore`, `FESaved`, `FEEventDetail`, `FEAppIntents`), each with a single placeholder view + one test. They're all the same shape, so the steps below template once and apply five times.

**Files (per package, substitute `<Name>`):**
- Create: `apps/ios/Packages/<Name>/Package.swift`
- Create: `apps/ios/Packages/<Name>/Sources/<Name>/<Screen>.swift`
- Create: `apps/ios/Packages/<Name>/Tests/<Name>Tests/<Screen>Tests.swift`

Mapping:

| Package | Source file | Type | Symbol the test asserts on |
|---|---|---|---|
| `FEPlan` | `PlanTab.swift` | `struct PlanTab: View` | `PlanTab().tabTitle == "Plan"` |
| `FEExplore` | `ExploreTab.swift` | `struct ExploreTab: View` | `ExploreTab().tabTitle == "Explore"` |
| `FESaved` | `SavedTab.swift` | `struct SavedTab: View` | `SavedTab().tabTitle == "Saved"` |
| `FEEventDetail` | `EventDetailScreen.swift` | `struct EventDetailScreen: View` | `EventDetailScreen(eventID: EventID("x")).eventID.rawValue == "x"` |
| `FEAppIntents` | `AppIntentsRegistry.swift` | `enum AppIntentsRegistry` | `AppIntentsRegistry.registered.isEmpty` |

For each package, do the following (this is one repeated cycle — perform once per package, committing between):

- [ ] **Step 1: Write the failing test (`FEPlan` example shown; substitute for others)**

Create `apps/ios/Packages/FEPlan/Tests/FEPlanTests/PlanTabTests.swift`:

```swift
import XCTest
import SwiftUI
@testable import FEPlan

final class PlanTabTests: XCTestCase {
    func testTabTitle() {
        XCTAssertEqual(PlanTab().tabTitle, "Plan")
    }
}
```

For the others:

```swift
// FEExplore/Tests/FEExploreTests/ExploreTabTests.swift
import XCTest
@testable import FEExplore
final class ExploreTabTests: XCTestCase {
    func testTabTitle() {
        XCTAssertEqual(ExploreTab().tabTitle, "Explore")
    }
}

// FESaved/Tests/FESavedTests/SavedTabTests.swift
import XCTest
@testable import FESaved
final class SavedTabTests: XCTestCase {
    func testTabTitle() {
        XCTAssertEqual(SavedTab().tabTitle, "Saved")
    }
}

// FEEventDetail/Tests/FEEventDetailTests/EventDetailScreenTests.swift
import XCTest
import FECore
@testable import FEEventDetail
final class EventDetailScreenTests: XCTestCase {
    func testCarriesEventID() {
        XCTAssertEqual(EventDetailScreen(eventID: EventID("x")).eventID.rawValue, "x")
    }
}

// FEAppIntents/Tests/FEAppIntentsTests/AppIntentsRegistryTests.swift
import XCTest
@testable import FEAppIntents
final class AppIntentsRegistryTests: XCTestCase {
    func testRegistryStartsEmpty() {
        XCTAssertTrue(AppIntentsRegistry.registered.isEmpty)
    }
}
```

- [ ] **Step 2: Run and confirm failure for that package**

```bash
cd apps/ios/Packages/FEPlan && swift test 2>&1 | head -20
```

Expected: no `Package.swift`.

- [ ] **Step 3: Create the package manifest**

Create `apps/ios/Packages/FEPlan/Package.swift`:

```swift
// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "FEPlan",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "FEPlan", targets: ["FEPlan"]),
    ],
    dependencies: [
        .package(path: "../FECore"),
        .package(path: "../FEData"),
        .package(path: "../FEDesignSystem"),
    ],
    targets: [
        .target(
            name: "FEPlan",
            dependencies: ["FECore", "FEData", "FEDesignSystem"],
            path: "Sources/FEPlan"
        ),
        .testTarget(name: "FEPlanTests", dependencies: ["FEPlan"], path: "Tests/FEPlanTests"),
    ]
)
```

For the other four packages, the manifest is identical except:
- Replace `FEPlan` with `FEExplore` / `FESaved` / `FEEventDetail` / `FEAppIntents`.
- `FEAppIntents` only depends on `FECore` (drop `FEData` and `FEDesignSystem`).

- [ ] **Step 4: Add the placeholder source for `FEPlan`**

Create `apps/ios/Packages/FEPlan/Sources/FEPlan/PlanTab.swift`:

```swift
import SwiftUI
import FEDesignSystem

public struct PlanTab: View {
    public let tabTitle = "Plan"

    public init() {}

    public var body: some View {
        NavigationStack {
            PlaceholderView(title: tabTitle, systemImage: "calendar.badge.clock")
                .navigationTitle(tabTitle)
        }
    }
}

#Preview { PlanTab() }
```

`FEExplore/Sources/FEExplore/ExploreTab.swift`:

```swift
import SwiftUI
import FEDesignSystem

public struct ExploreTab: View {
    public let tabTitle = "Explore"

    public init() {}

    public var body: some View {
        NavigationStack {
            PlaceholderView(title: tabTitle, systemImage: "sparkle.magnifyingglass")
                .navigationTitle(tabTitle)
        }
    }
}
```

`FESaved/Sources/FESaved/SavedTab.swift`:

```swift
import SwiftUI
import FEDesignSystem

public struct SavedTab: View {
    public let tabTitle = "Saved"

    public init() {}

    public var body: some View {
        NavigationStack {
            PlaceholderView(title: tabTitle, systemImage: "bookmark.fill")
                .navigationTitle(tabTitle)
        }
    }
}
```

`FEEventDetail/Sources/FEEventDetail/EventDetailScreen.swift`:

```swift
import SwiftUI
import FECore
import FEDesignSystem

public struct EventDetailScreen: View {
    public let eventID: EventID

    public init(eventID: EventID) {
        self.eventID = eventID
    }

    public var body: some View {
        PlaceholderView(title: "Event \(eventID.rawValue)", systemImage: "calendar")
    }
}
```

`FEAppIntents/Sources/FEAppIntents/AppIntentsRegistry.swift`:

```swift
import Foundation

public enum AppIntentsRegistry {
    public static let registered: [String] = []
}
```

- [ ] **Step 5: Run the package's tests**

```bash
cd apps/ios/Packages/FEPlan && swift test 2>&1 | tail -10
```

Expected: 1 test pass per package.

- [ ] **Step 6: Commit (one commit per package — five commits total in this task)**

```bash
git add apps/ios/Packages/FEPlan
git commit -m "feat(ios): scaffold FEPlan placeholder package"

git add apps/ios/Packages/FEExplore
git commit -m "feat(ios): scaffold FEExplore placeholder package"

git add apps/ios/Packages/FESaved
git commit -m "feat(ios): scaffold FESaved placeholder package"

git add apps/ios/Packages/FEEventDetail
git commit -m "feat(ios): scaffold FEEventDetail placeholder package"

git add apps/ios/Packages/FEAppIntents
git commit -m "feat(ios): scaffold FEAppIntents placeholder package"
```

---

## Task 13: Wire all packages into `project.yml`

XcodeGen needs `packages:` to know about local packages and `dependencies: - package: <Name>` on the app + test targets to link them.

**Files:**
- Modify: `apps/ios/project.yml`

- [ ] **Step 1: Read the current `project.yml`**

```bash
cat apps/ios/project.yml
```

Expected: matches the version recorded in §1 of the spec (no `packages:` block yet).

- [ ] **Step 2: Replace `project.yml` with the package-aware version**

Replace the contents of `apps/ios/project.yml` with:

```yaml
name: FamilyEvents
options:
  minimumXcodeGenVersion: 2.38.0
settings:
  base:
    SWIFT_VERSION: 5.10
    PRODUCT_BUNDLE_IDENTIFIER: com.familyevents.app
packages:
  FECore:
    path: Packages/FECore
  FEData:
    path: Packages/FEData
  FEDesignSystem:
    path: Packages/FEDesignSystem
  FEAuth:
    path: Packages/FEAuth
  FEPlan:
    path: Packages/FEPlan
  FEExplore:
    path: Packages/FEExplore
  FESaved:
    path: Packages/FESaved
  FEEventDetail:
    path: Packages/FEEventDetail
  FEAppIntents:
    path: Packages/FEAppIntents
targets:
  FamilyEvents:
    type: application
    platform: iOS
    deploymentTarget: "17.0"
    sources:
      - FamilyEvents
    info:
      path: FamilyEvents/Info.plist
      properties:
        UILaunchScreen: {}
        SupabaseURL: $(SUPABASE_URL)
        SupabaseAnonKey: $(SUPABASE_ANON_KEY)
    settings:
      base:
        PRODUCT_NAME: FamilyEvents
    dependencies:
      - package: FECore
      - package: FEData
      - package: FEDesignSystem
      - package: FEAuth
      - package: FEPlan
      - package: FEExplore
      - package: FESaved
      - package: FEEventDetail
      - package: FEAppIntents
    scheme:
      testTargets:
        - FamilyEventsTests
  FamilyEventsTests:
    type: bundle.unit-test
    platform: iOS
    deploymentTarget: "17.0"
    sources:
      - FamilyEventsTests
    dependencies:
      - target: FamilyEvents
      - package: FECore
      - package: FEData
```

- [ ] **Step 3: Regenerate the Xcode project**

```bash
cd apps/ios && pnpm run generate
```

Expected: `xcodegen` completes without errors. If `SUPABASE_URL` / `SUPABASE_ANON_KEY` env vars are absent, the build will still succeed — they only fail at runtime via `EnvConfig.load`.

- [ ] **Step 4: Commit**

```bash
git add apps/ios/project.yml apps/ios/FamilyEvents.xcodeproj
git commit -m "build(ios): declare local Swift packages in project.yml"
```

---

## Task 14: Add the app-level `Tab` enum

The single source of truth for which tabs exist.

**Files:**
- Create: `apps/ios/FamilyEvents/App/Tab.swift`
- Create: `apps/ios/FamilyEventsTests/TabTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/FamilyEventsTests/TabTests.swift`:

```swift
import XCTest
@testable import FamilyEvents

final class TabTests: XCTestCase {
    func testAllCasesExposed() {
        XCTAssertEqual(AppTab.allCases, [.plan, .explore, .saved])
    }

    func testSystemImagesAreNonEmpty() {
        for tab in AppTab.allCases {
            XCTAssertFalse(tab.systemImage.isEmpty, "tab \(tab) is missing systemImage")
        }
    }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios && pnpm run ios:test 2>&1 | tail -20
```

Expected: `AppTab` undefined.

- [ ] **Step 3: Implement the enum**

Create `apps/ios/FamilyEvents/App/Tab.swift`:

```swift
import Foundation

public enum AppTab: String, CaseIterable, Identifiable, Hashable, Sendable {
    case plan
    case explore
    case saved

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .plan: return "Plan"
        case .explore: return "Explore"
        case .saved: return "Saved"
        }
    }

    public var systemImage: String {
        switch self {
        case .plan: return "calendar.badge.clock"
        case .explore: return "sparkle.magnifyingglass"
        case .saved: return "bookmark.fill"
        }
    }
}
```

- [ ] **Step 4: Run and confirm pass**

```bash
cd apps/ios && pnpm run ios:test 2>&1 | tail -20
```

Expected: `TabTests` passes.

- [ ] **Step 5: Commit**

```bash
git add apps/ios/FamilyEvents/App/Tab.swift apps/ios/FamilyEventsTests/TabTests.swift
git commit -m "feat(ios): add AppTab enum"
```

---

## Task 15: Add `AppRoute` and `DeepLinkRouter` stub

`AppRoute` is the typed value pushed onto each tab's `NavigationStack`. `DeepLinkRouter` parses inbound URLs/user activities into `(AppTab, [AppRoute])`. M1 supports `familyevents://event/<id>` and `familyevents://saved`; everything else returns `nil`.

**Files:**
- Create: `apps/ios/FamilyEvents/App/AppRoute.swift`
- Create: `apps/ios/FamilyEvents/App/DeepLinkRouter.swift`
- Create: `apps/ios/FamilyEventsTests/DeepLinkRouterTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/FamilyEventsTests/DeepLinkRouterTests.swift`:

```swift
import XCTest
import FECore
@testable import FamilyEvents

final class DeepLinkRouterTests: XCTestCase {
    func testParsesEventURL() throws {
        let url = URL(string: "familyevents://event/evt_42")!
        let result = DeepLinkRouter.route(from: url)
        XCTAssertEqual(result?.tab, .plan)
        XCTAssertEqual(result?.routes, [.event(EventID("evt_42"))])
    }

    func testParsesSavedTabURL() throws {
        let url = URL(string: "familyevents://saved")!
        let result = DeepLinkRouter.route(from: url)
        XCTAssertEqual(result?.tab, .saved)
        XCTAssertEqual(result?.routes, [])
    }

    func testReturnsNilForUnknownScheme() {
        let url = URL(string: "https://example.com/event/x")!
        XCTAssertNil(DeepLinkRouter.route(from: url))
    }

    func testReturnsNilForUnknownHost() {
        let url = URL(string: "familyevents://nope/x")!
        XCTAssertNil(DeepLinkRouter.route(from: url))
    }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios && pnpm run ios:test 2>&1 | tail -20
```

Expected: `AppRoute`, `DeepLinkRouter` undefined.

- [ ] **Step 3: Implement `AppRoute`**

Create `apps/ios/FamilyEvents/App/AppRoute.swift`:

```swift
import Foundation
import FECore

public enum AppRoute: Hashable, Sendable {
    case event(EventID)
    case city(CityID)
    case profile
    case settings
}
```

- [ ] **Step 4: Implement `DeepLinkRouter`**

Create `apps/ios/FamilyEvents/App/DeepLinkRouter.swift`:

```swift
import Foundation
import FECore

public enum DeepLinkRouter {
    public struct Result: Equatable {
        public let tab: AppTab
        public let routes: [AppRoute]
    }

    public static func route(from url: URL) -> Result? {
        guard url.scheme == "familyevents" else { return nil }
        let host = url.host ?? ""
        switch host {
        case "event":
            let id = url.lastPathComponent
            guard !id.isEmpty, id != "event" else { return nil }
            return Result(tab: .plan, routes: [.event(EventID(id))])
        case "saved":
            return Result(tab: .saved, routes: [])
        default:
            return nil
        }
    }
}
```

- [ ] **Step 5: Run and confirm pass**

```bash
cd apps/ios && pnpm run ios:test 2>&1 | tail -20
```

Expected: all 4 router tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/ios/FamilyEvents/App/AppRoute.swift apps/ios/FamilyEvents/App/DeepLinkRouter.swift apps/ios/FamilyEventsTests/DeepLinkRouterTests.swift
git commit -m "feat(ios): add AppRoute and DeepLinkRouter stub"
```

---

## Task 16: Build `RootView` with the 3-tab `TabView`

The visible shell.

**Files:**
- Create: `apps/ios/FamilyEvents/App/RootView.swift`
- Create: `apps/ios/FamilyEventsTests/RootViewSmokeTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/FamilyEventsTests/RootViewSmokeTests.swift`:

```swift
import XCTest
import SwiftUI
@testable import FamilyEvents

@MainActor
final class RootViewSmokeTests: XCTestCase {
    func testRootViewSelectsPlanByDefault() {
        let view = RootView()
        XCTAssertEqual(view.initialTab, .plan)
    }

    func testRootViewExposesAllTabs() {
        XCTAssertEqual(RootView.shownTabs, [.plan, .explore, .saved])
    }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios && pnpm run ios:test 2>&1 | tail -20
```

Expected: `RootView` undefined.

- [ ] **Step 3: Implement `RootView`**

Create `apps/ios/FamilyEvents/App/RootView.swift`:

```swift
import SwiftUI
import FEPlan
import FEExplore
import FESaved

public struct RootView: View {
    public static let shownTabs: [AppTab] = AppTab.allCases
    public let initialTab: AppTab

    @State private var selectedTab: AppTab

    public init(initialTab: AppTab = .plan) {
        self.initialTab = initialTab
        _selectedTab = State(initialValue: initialTab)
    }

    public var body: some View {
        TabView(selection: $selectedTab) {
            PlanTab()
                .tabItem { Label(AppTab.plan.title, systemImage: AppTab.plan.systemImage) }
                .tag(AppTab.plan)

            ExploreTab()
                .tabItem { Label(AppTab.explore.title, systemImage: AppTab.explore.systemImage) }
                .tag(AppTab.explore)

            SavedTab()
                .tabItem { Label(AppTab.saved.title, systemImage: AppTab.saved.systemImage) }
                .tag(AppTab.saved)
        }
    }
}

#Preview { RootView() }
```

- [ ] **Step 4: Run and confirm pass**

```bash
cd apps/ios && pnpm run ios:test 2>&1 | tail -20
```

Expected: all root-view tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/ios/FamilyEvents/App/RootView.swift apps/ios/FamilyEventsTests/RootViewSmokeTests.swift
git commit -m "feat(ios): build RootView with 3-tab TabView shell"
```

---

## Task 17: Replace `HomeView` with `RootView` in `FamilyEventsApp`

The last app-target wiring step. Delete the old `HomeView`.

**Files:**
- Modify: `apps/ios/FamilyEvents/App/FamilyEventsApp.swift`
- Delete: `apps/ios/FamilyEvents/Features/Home/HomeView.swift`

- [ ] **Step 1: Replace the app entry point**

Replace the contents of `apps/ios/FamilyEvents/App/FamilyEventsApp.swift` with:

```swift
import SwiftUI

@main
struct FamilyEventsApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
```

- [ ] **Step 2: Delete `HomeView` and its empty parent directory**

```bash
git rm apps/ios/FamilyEvents/Features/Home/HomeView.swift
rmdir apps/ios/FamilyEvents/Features/Home apps/ios/FamilyEvents/Features 2>/dev/null || true
```

- [ ] **Step 3: Regenerate the Xcode project (sources tree changed)**

```bash
cd apps/ios && pnpm run generate
```

Expected: `xcodegen` succeeds.

- [ ] **Step 4: Build and run the test suite**

```bash
cd apps/ios && pnpm run ios:test 2>&1 | tail -20
```

Expected: build succeeds, all app-level tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/ios/FamilyEvents/App/FamilyEventsApp.swift apps/ios/FamilyEvents.xcodeproj
git commit -m "feat(ios): mount RootView from app entry point; remove HomeView"
```

---

## Task 18: Add the endpoint-policy guard test

A grep-style assertion that no app-target or package file references `/admin/*` in any string literal. Mirrors `tests/guards/ios-scope.test.mjs` at the iOS layer.

**Files:**
- Create: `apps/ios/FamilyEventsTests/EndpointPolicyTests.swift`

- [ ] **Step 1: Write the failing test**

Create `apps/ios/FamilyEventsTests/EndpointPolicyTests.swift`:

```swift
import XCTest

final class EndpointPolicyTests: XCTestCase {
    func testNoAdminPathReferencesInIOSSources() throws {
        let fileManager = FileManager.default
        let repoRoot = try repoRootURL()
        let iosRoot = repoRoot.appending(path: "apps/ios")
        let searchRoots = [
            iosRoot.appending(path: "FamilyEvents"),
            iosRoot.appending(path: "Packages"),
        ]

        var offenders: [String] = []
        for root in searchRoots {
            let enumerator = fileManager.enumerator(at: root, includingPropertiesForKeys: nil)
            while let url = enumerator?.nextObject() as? URL {
                guard url.pathExtension == "swift" else { continue }
                let contents = try String(contentsOf: url, encoding: .utf8)
                if contents.contains("/api/v1/admin") || contents.contains("\"/admin/") {
                    offenders.append(url.path)
                }
            }
        }
        XCTAssertTrue(offenders.isEmpty, "admin-path references found in: \(offenders.joined(separator: ", "))")
    }

    private func repoRootURL() throws -> URL {
        // Walk up from this source file until we find a `pnpm-workspace.yaml`.
        var url = URL(fileURLWithPath: #filePath)
        while url.pathComponents.count > 1 {
            url.deleteLastPathComponent()
            let marker = url.appending(path: "pnpm-workspace.yaml")
            if FileManager.default.fileExists(atPath: marker.path) {
                return url
            }
        }
        throw NSError(domain: "EndpointPolicyTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "repo root not found"])
    }
}
```

- [ ] **Step 2: Run and confirm pass (no admin paths exist yet)**

```bash
cd apps/ios && pnpm run ios:test 2>&1 | tail -20
```

Expected: `EndpointPolicyTests` passes.

- [ ] **Step 3: Validate the guard catches a real violation**

Temporarily add this line to `apps/ios/Packages/FECore/Sources/FECore/ConsumerAPIPath.swift`:

```swift
public static let leakedAdminPath = "/api/v1/admin/users"
```

Run the tests again:

```bash
cd apps/ios && pnpm run ios:test 2>&1 | grep -E "(EndpointPolicy|admin-path)" | head -5
```

Expected: `EndpointPolicyTests` fails with the offender path.

Now revert the change:

```bash
git checkout apps/ios/Packages/FECore/Sources/FECore/ConsumerAPIPath.swift
```

Re-run to confirm pass:

```bash
cd apps/ios && pnpm run ios:test 2>&1 | tail -10
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/ios/FamilyEventsTests/EndpointPolicyTests.swift
git commit -m "test(ios): add EndpointPolicyTests guarding against admin path references"
```

---

## Task 19: Update `apps/ios/package.json` to test all packages

`pnpm run ios:test` currently runs only the app's `xcodebuild test`. Extend it so package tests are exercised on every invocation.

**Files:**
- Modify: `apps/ios/package.json`

- [ ] **Step 1: Read the existing file**

```bash
cat apps/ios/package.json
```

- [ ] **Step 2: Replace with the package-aware version**

Replace `apps/ios/package.json` with:

```json
{
  "name": "@family-events/ios",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "generate": "xcodegen generate",
    "test:packages": "for pkg in FECore FEData FEDesignSystem FEAuth FEPlan FEExplore FESaved FEEventDetail FEAppIntents; do echo \"--- $pkg ---\" && (cd Packages/$pkg && swift test) || exit 1; done",
    "test:app": "xcodegen generate && if xcode-select -p | grep -q '/Applications/Xcode'; then xcodebuild -project FamilyEvents.xcodeproj -scheme FamilyEvents -destination 'platform=iOS Simulator,name=iPhone 15' test; else echo 'xcodebuild skipped: full Xcode not selected'; fi",
    "test": "pnpm run test:packages && pnpm run test:app"
  }
}
```

- [ ] **Step 3: Run the full test pipeline**

```bash
cd apps/ios && pnpm run test 2>&1 | tail -40
```

Expected: every package's tests pass in turn, then the app's `xcodebuild test` runs (or skips with the existing message if Xcode CLI tools aren't full Xcode).

- [ ] **Step 4: Commit**

```bash
git add apps/ios/package.json
git commit -m "build(ios): run package tests as part of pnpm test"
```

---

## Task 20: Update the iOS section of the root README

Reflect the new package layout and run commands.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current iOS section**

```bash
grep -n "iOS" README.md | head -10
```

- [ ] **Step 2: Replace the iOS Workspace section**

Replace the iOS Workspace block in `README.md` with:

```markdown
## iOS Workspace

Path: `apps/ios`

Layout (post-M1):
- App target: `FamilyEvents/` (entry point + tab shell + deep-link routing).
- Local Swift packages under `Packages/`: `FECore`, `FEData`, `FEDesignSystem`, `FEAuth`, `FEPlan`, `FEExplore`, `FESaved`, `FEEventDetail`, `FEAppIntents`.

Project generation/build strategy:
- Xcode project is generated from `apps/ios/project.yml` using XcodeGen.
- Commit the `project.yml` source of truth and generated project files together.

Primary commands:
- `pnpm run ios:generate` — regenerate `FamilyEvents.xcodeproj` from `project.yml`.
- `pnpm run ios:test` — run every package's `swift test` plus the app's `xcodebuild test`.

Scope policy:
- iOS is consumer-only.
- Admin features/routes are out of scope and blocked by `EndpointPolicyTests`.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(ios): document M1 package layout in README"
```

---

## Task 21: Final verification

Confirm M1's definition of done.

- [ ] **Step 1: Clean build from a fresh state**

```bash
cd apps/ios && rm -rf .build Packages/*/.build && pnpm run test 2>&1 | tail -30
```

Expected: every package's tests pass, then the app target's tests pass (or skip with the documented message if full Xcode is unavailable).

- [ ] **Step 2: Confirm the file graph matches the plan**

```bash
find apps/ios/Packages -name Package.swift | sort
```

Expected: nine files — one per package — in alphabetical order:

```
apps/ios/Packages/FEAppIntents/Package.swift
apps/ios/Packages/FEAuth/Package.swift
apps/ios/Packages/FECore/Package.swift
apps/ios/Packages/FEData/Package.swift
apps/ios/Packages/FEDesignSystem/Package.swift
apps/ios/Packages/FEEventDetail/Package.swift
apps/ios/Packages/FEExplore/Package.swift
apps/ios/Packages/FEPlan/Package.swift
apps/ios/Packages/FESaved/Package.swift
```

- [ ] **Step 3: Confirm the old paths are gone**

```bash
test ! -e apps/ios/FamilyEvents/Networking/APIClient.swift && \
test ! -e apps/ios/FamilyEvents/Networking/ConsumerAPIPath.swift && \
test ! -e apps/ios/FamilyEvents/Features/Home/HomeView.swift && \
echo "ok"
```

Expected output: `ok`.

- [ ] **Step 4: Confirm the workspace-level guards still pass**

```bash
pnpm run workspace:test 2>&1 | tail -20
```

Expected: all existing workspace guards green. (The `ios-scope.test.mjs` guard should be unaffected since it operates on `apps/ios` paths regardless of internal layout.)

- [ ] **Step 5: Confirm M1's definition of done**

- [x] SPM packages declared and built.
- [x] `SupabaseClient` wrapper exists in `FEData`.
- [x] `SessionStore` `@Observable` state machine exists in `FEAuth`.
- [x] `FEDesignSystem` exposes color tokens, typography, and `PlaceholderView`.
- [x] 3-tab shell renders Plan / Explore / Saved.
- [x] All admin-scope guards pass.
- [x] `pnpm run ios:test` exercises every layer.
- [x] README reflects the new layout.

- [ ] **Step 6: Tag the milestone (optional, but helps M2 start from a clean line)**

```bash
git tag ios-m1-foundation
```

---

## Out of scope for this plan (deferred to later milestones)

- Real Sign in with Apple / email/password — **M2**.
- Keychain token persistence — **M2**.
- `delete_my_account` RPC — **M2** (backend) + iOS UI in **M7**.
- Event/Plan/Favorite repositories with live Supabase calls — **M3**.
- `CachedEvent`, `CachedPlan`, `CachedFavorite` SwiftData `@Model`s — **M3**.
- Event Detail screen content (hero, action row, share, add-to-calendar) — **M4**.
- Search, filters, infinite scroll — **M5**.
- MapKit annotations, calendar mode — **M6**.
- Saved sectioning, profile sheet — **M7**.
- Push, App Intents donations, Spotlight, Universal Links — **M8**.
- iPad `NavigationSplitView` — **M9**.

If a task in M1 starts to drift toward any of these, stop and re-scope rather than expanding the plan.

---

## Self-review notes

Run through this list before declaring M1 done:

1. **Spec coverage.** §3 (module layout), §4 (root composition + AppRoute + DeepLinkRouter stub), §6 (SupabaseClient + Repository + ModelContainer scaffold), §7 (SessionStore state machine — UI in M2), §10 (endpoint-policy guard, package test invocation) — all addressed in this plan. §5, §8, §9 are out of scope for M1 per §11.
2. **Placeholders.** No "TBD"/"TODO" in any step.
3. **Type consistency.** `EventID` from `FECore` is used in `ConsumerAPIPath.eventDetail`, `EventDetailScreen.eventID`, `AppRoute.event`, and `DeepLinkRouterTests` — same constructor signature `EventID(_ rawValue: String)` everywhere. `AppTab`, `RootView`, `Tab` enum cases all use the lowercase `plan`/`explore`/`saved` spelling.
4. **Order of operations.** Packages created before `project.yml` references them (Task 13 follows Tasks 2–12). The app target's wiring (Tasks 14–17) follows the package layer, so the build graph is always valid at every commit.
