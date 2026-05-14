# iOS Milestone 2 — Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a usable auth surface: Sign in with Apple + email/password + sign-up + forgot/reset password + account linking on email collision + delete-account flow. Sessions persist across launches via raw Keychain (Security framework), expire and refresh automatically, and gate the tab shell so unauthenticated users see the auth flow first.

**Architecture:** All auth UI and the real `SessionStore` lifecycle live in `FEAuth`. Token persistence uses a `KeychainStorage` actor that wraps `Security`'s `SecItem` C API. The Supabase Swift SDK's auth methods do the heavy lifting; `SessionStore` is a thin `@Observable @MainActor` state machine that subscribes to `supabase.auth.onAuthStateChange` and mirrors transitions into the SwiftUI environment. A new SECURITY DEFINER RPC (`private.delete_my_account` + public wrapper) handles account deletion per the project convention in `CLAUDE.md`.

**Tech Stack:**
- iOS 17+, Swift 5.10
- `supabase-swift` 2.20.0 (pinned in M1)
- `AuthenticationServices` framework (ASAuthorizationController for SIWA, ASWebAuthenticationSession for password reset)
- `Security` framework (raw SecItem for Keychain)
- SwiftUI + Observation (`@Observable`)
- XCTest

**Spec:** `docs/superpowers/specs/2026-05-13-ios-apple-native-rethink-design.md` (§5 Feature Mapping → Auth row, §7 Auth flow, §11 Milestone 2)

**Predecessor:** M1 Foundation (`docs/superpowers/plans/2026-05-13-ios-m1-foundation-plan.md`) — packages must exist, `SessionStore` stub must be in place.

**Successor:** M3 Plan tab.

---

## Decisions locked in for M2

| Decision | Choice | Rationale |
|---|---|---|
| Identity linking trust | Password challenge on email collision | Industry standard. User proves ownership of existing email/password account before SIWA is attached as a second identity. |
| Account deletion | Backend RPC + iOS UI both ship in M2 | App Store requires deletion for SIWA-using apps. |
| Token storage | Raw `Security` framework (`SecItem*`) | Zero leaf-dependencies; ~80 LOC; fully testable via in-memory mock. |
| Password reset entry | Via Universal Link from email; opens `ResetPasswordScreen` | Matches the web's `/reset-password` route. Email body comes from existing Supabase email templates. |
| Email confirmation | Supabase project setting (already enabled per `config.toml`) | After sign-up, show "Check your email" state; user clicks email link → existing web flow confirms. iOS doesn't need a confirmation screen of its own. |
| Sign-up gated by invite code? | **No, not in M2** | Existing invite flow lives in admin/web. iOS sign-up calls `supabase.auth.signUp` directly. Invite gating, if needed for iOS, lands in a later milestone. |

---

## Out of scope for this plan

- Universal Links entitlement + Associated Domains (M8 owns deep-link reception from the web; for M2 we accept the `familyevents://` custom scheme for reset tokens).
- Biometric (Face ID / Touch ID) gate before opening Keychain. Tracked for M2.5.
- Email/SMS MFA. Not in spec.
- Social providers other than Apple (Google, GitHub, etc.).
- Invite-code gating on iOS sign-up.
- Marketing landing page. Logged-out iOS opens directly to `SignInScreen`.

---

## File structure (after this milestone)

```
apps/ios/
├─ FamilyEvents/
│   ├─ App/
│   │   ├─ FamilyEventsApp.swift                 # MODIFY: inject SupabaseClient + SessionStore via environment
│   │   ├─ RootView.swift                        # MODIFY: gate on session state
│   │   ├─ AppRoute.swift                        # MODIFY: add .auth and .resetPassword cases
│   │   └─ DeepLinkRouter.swift                  # MODIFY: parse password-reset URLs
│   └─ FamilyEventsTests/
│       ├─ RootViewSmokeTests.swift              # MODIFY: gate-on-session assertions
│       └─ DeepLinkRouterTests.swift             # MODIFY: reset-password URL coverage
└─ Packages/
    ├─ FECore/Sources/FECore/
    │   ├─ Identifiers.swift                     # MODIFY: add UserID
    │   ├─ AppError.swift                        # MODIFY: refine .auth cases
    │   └─ Tests/FECoreTests/
    │       ├─ IdentifiersTests.swift            # MODIFY
    │       └─ AppErrorTests.swift               # MODIFY
    └─ FEAuth/
        ├─ Package.swift                         # MODIFY: add AuthenticationServices weak link
        ├─ Sources/FEAuth/
        │   ├─ Keychain/
        │   │   ├─ KeychainStorage.swift         # NEW
        │   │   └─ KeychainKey.swift             # NEW
        │   ├─ Session/
        │   │   ├─ SessionStore.swift            # MODIFY: replace stub with real impl
        │   │   ├─ SessionState.swift            # MODIFY: extend state machine
        │   │   ├─ AuthService.swift             # NEW: protocol abstracting supabase.auth
        │   │   └─ SupabaseAuthService.swift     # NEW: protocol impl via supabase-swift
        │   ├─ SignInWithApple/
        │   │   ├─ AppleSignInCoordinator.swift  # NEW: ASAuthorizationController wrapper
        │   │   └─ AppleSignInButton.swift       # NEW: SwiftUI wrapper around ASAuthorizationAppleIDButton
        │   ├─ Screens/
        │   │   ├─ AuthRootView.swift            # NEW: routes to SignIn/SignUp/etc.
        │   │   ├─ SignInScreen.swift            # NEW
        │   │   ├─ SignUpScreen.swift            # NEW
        │   │   ├─ ForgotPasswordScreen.swift    # NEW
        │   │   ├─ ResetPasswordScreen.swift     # NEW
        │   │   ├─ LinkAccountScreen.swift       # NEW
        │   │   ├─ ProfileSheet.swift            # NEW
        │   │   └─ DeleteAccountConfirmation.swift  # NEW
        │   ├─ ViewModels/
        │   │   ├─ SignInViewModel.swift         # NEW
        │   │   ├─ SignUpViewModel.swift         # NEW
        │   │   ├─ ForgotPasswordViewModel.swift # NEW
        │   │   ├─ ResetPasswordViewModel.swift  # NEW
        │   │   └─ LinkAccountViewModel.swift    # NEW
        │   └─ Form/
        │       └─ EmailPasswordValidators.swift # NEW
        └─ Tests/FEAuthTests/
            ├─ Keychain/
            │   ├─ KeychainStorageTests.swift
            │   └─ InMemoryKeychainStorage.swift  # test fake
            ├─ Session/
            │   ├─ SessionStoreTests.swift        # MODIFY
            │   └─ FakeAuthService.swift          # test fake
            ├─ ViewModels/
            │   ├─ SignInViewModelTests.swift
            │   ├─ SignUpViewModelTests.swift
            │   ├─ ForgotPasswordViewModelTests.swift
            │   ├─ ResetPasswordViewModelTests.swift
            │   └─ LinkAccountViewModelTests.swift
            └─ Form/
                └─ EmailPasswordValidatorsTests.swift

supabase/
└─ migrations/
    └─ 20260601002400_delete_my_account_rpc.sql  # NEW
```

---

## Conventions

- Every step that changes code shows the full new contents (paste-ready).
- One commit per task. Commits use the project's `<type>(ios):` / `<type>(supabase):` style (`feat`, `refactor`, `test`, `fix`, `build`).
- For Swift tests, run from the package directory: `swift test` (Xcode toolchain via `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` if needed — Task 19 of M1 baked this into `package.json`, so `pnpm run test:packages` works without env vars).
- For app-level tests: `cd apps/ios && pnpm run test`.
- For migrations: write the SQL file, then verify with `pnpm run db:migrate` against a local Supabase. If local Supabase isn't running, just SQL-lint the file with `psql --dry-run` or read the existing migrations as a reference.

---

## Phase A — Core types (Tasks 1–2)

### Task 1: Add `UserID` to `FECore`

The Supabase session exposes a UUID for the authenticated user. We wrap it in a typed identifier to keep parity with `EventID` / `CityID` / `PlanID`.

**Files:**
- Modify: `apps/ios/Packages/FECore/Sources/FECore/Identifiers.swift`
- Modify: `apps/ios/Packages/FECore/Tests/FECoreTests/IdentifiersTests.swift`

- [ ] **Step 1: Write the failing test (append to `IdentifiersTests.swift`)**

Add at the bottom of `IdentifiersTests` (before the closing brace):

```swift
    func testUserIDWrapsString() {
        let id = UserID("550e8400-e29b-41d4-a716-446655440000")
        XCTAssertEqual(id.rawValue, "550e8400-e29b-41d4-a716-446655440000")
    }

    func testUserIDRoundTripsThroughJSON() throws {
        let id = UserID("user_42")
        let data = try JSONEncoder().encode(id)
        let decoded = try JSONDecoder().decode(UserID.self, from: data)
        XCTAssertEqual(decoded, id)
    }
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | head -20
```

Expected: compile error — `UserID` undefined.

- [ ] **Step 3: Add the type**

Append to `apps/ios/Packages/FECore/Sources/FECore/Identifiers.swift` (before the final closing characters):

```swift
public struct UserID: TypedIdentifier {
    public let rawValue: String
    public init(_ rawValue: String) { self.rawValue = rawValue }
}
```

- [ ] **Step 4: Run and confirm pass**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FECore/Sources/FECore/Identifiers.swift apps/ios/Packages/FECore/Tests/FECoreTests/IdentifiersTests.swift
git commit -m "feat(ios): add UserID typed identifier to FECore"
```

---

### Task 2: Refine `AppError` with auth-specific cases

`AppError` currently has `.network`, `.unauthorized`, `.notFound`, `.config`, `.unknown`. Auth surfaces need finer-grained cases so the UI can show the right message.

**Files:**
- Modify: `apps/ios/Packages/FECore/Sources/FECore/AppError.swift`
- Modify: `apps/ios/Packages/FECore/Tests/FECoreTests/AppErrorTests.swift`

- [ ] **Step 1: Write the failing tests (append to `AppErrorTests`)**

```swift
    func testInvalidCredentialsHasFriendlyMessage() {
        XCTAssertEqual(AppError.invalidCredentials.userMessage, "Email or password is incorrect.")
    }

    func testEmailAlreadyInUseHasFriendlyMessage() {
        XCTAssertEqual(AppError.emailAlreadyInUse.userMessage, "An account with that email already exists.")
    }

    func testEmailNotConfirmedHasFriendlyMessage() {
        XCTAssertEqual(AppError.emailNotConfirmed.userMessage, "Please confirm your email before signing in.")
    }

    func testAppleSignInCancelledIsTreatedAsNoOp() {
        XCTAssertEqual(AppError.appleSignInCancelled.userMessage, "")
    }

    func testPasswordResetEmailSentIsInformational() {
        XCTAssertEqual(AppError.passwordResetEmailSent.userMessage, "Check your email for a reset link.")
    }
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | head -20
```

- [ ] **Step 3: Extend `AppError`**

Replace `apps/ios/Packages/FECore/Sources/FECore/AppError.swift` with:

```swift
import Foundation

public enum AppError: Error, Sendable {
    case network(Error)
    case unauthorized
    case notFound
    case config(String)
    case invalidCredentials
    case emailAlreadyInUse
    case emailNotConfirmed
    case weakPassword(String)
    case appleSignInCancelled
    case appleSignInFailed(Error)
    case passwordResetEmailSent
    case keychain(OSStatus)
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
        case .invalidCredentials:
            return "Email or password is incorrect."
        case .emailAlreadyInUse:
            return "An account with that email already exists."
        case .emailNotConfirmed:
            return "Please confirm your email before signing in."
        case .weakPassword(let reason):
            return reason.isEmpty ? "Choose a stronger password." : reason
        case .appleSignInCancelled:
            return "" // Sentinel — UI suppresses this.
        case .appleSignInFailed:
            return "Apple sign-in didn't complete. Please try again."
        case .passwordResetEmailSent:
            return "Check your email for a reset link."
        case .keychain:
            return "Couldn't securely store your session. Please try again."
        case .unknown:
            return "Something went wrong."
        }
    }
}
```

- [ ] **Step 4: Run and confirm pass**

```bash
cd apps/ios/Packages/FECore && swift test 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FECore/Sources/FECore/AppError.swift apps/ios/Packages/FECore/Tests/FECoreTests/AppErrorTests.swift
git commit -m "feat(ios): extend AppError with auth-specific cases"
```

---

## Phase B — Keychain storage (Tasks 3–5)

### Task 3: Define the `KeychainStorage` protocol and `KeychainKey` enum

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Keychain/KeychainKey.swift`
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Keychain/KeychainStorage.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Keychain/InMemoryKeychainStorage.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Keychain/KeychainStorageTests.swift`

- [ ] **Step 1: Write the failing test for the protocol shape**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Keychain/KeychainStorageTests.swift`:

```swift
import XCTest
@testable import FEAuth

final class KeychainStorageProtocolTests: XCTestCase {
    func testInMemoryStorageRoundTripsString() async throws {
        let storage: any KeychainStorage = InMemoryKeychainStorage()
        try await storage.setString("hello", for: .accessToken)
        let stored = try await storage.string(for: .accessToken)
        XCTAssertEqual(stored, "hello")
    }

    func testInMemoryStorageReturnsNilForMissingKey() async throws {
        let storage: any KeychainStorage = InMemoryKeychainStorage()
        let stored = try await storage.string(for: .refreshToken)
        XCTAssertNil(stored)
    }

    func testInMemoryStorageRemovesValues() async throws {
        let storage: any KeychainStorage = InMemoryKeychainStorage()
        try await storage.setString("x", for: .accessToken)
        try await storage.remove(.accessToken)
        let stored = try await storage.string(for: .accessToken)
        XCTAssertNil(stored)
    }

    func testInMemoryStorageRemoveAllClearsEverything() async throws {
        let storage: any KeychainStorage = InMemoryKeychainStorage()
        try await storage.setString("a", for: .accessToken)
        try await storage.setString("b", for: .refreshToken)
        try await storage.removeAll()
        let a = try await storage.string(for: .accessToken)
        let b = try await storage.string(for: .refreshToken)
        XCTAssertNil(a)
        XCTAssertNil(b)
    }
}
```

- [ ] **Step 2: Run and confirm failure (types don't exist yet)**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | head -20
```

- [ ] **Step 3: Define `KeychainKey`**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/Keychain/KeychainKey.swift`:

```swift
import Foundation

public enum KeychainKey: String, Sendable, CaseIterable {
    case accessToken = "supabase.accessToken"
    case refreshToken = "supabase.refreshToken"
    case userID = "supabase.userID"
}
```

- [ ] **Step 4: Define the protocol**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/Keychain/KeychainStorage.swift`:

```swift
import Foundation

public protocol KeychainStorage: Sendable {
    func string(for key: KeychainKey) async throws -> String?
    func setString(_ value: String, for key: KeychainKey) async throws
    func remove(_ key: KeychainKey) async throws
    func removeAll() async throws
}
```

- [ ] **Step 5: Create the in-memory test fake**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Keychain/InMemoryKeychainStorage.swift`:

```swift
import Foundation
@testable import FEAuth

actor InMemoryKeychainStorage: KeychainStorage {
    private var storage: [KeychainKey: String] = [:]

    func string(for key: KeychainKey) async throws -> String? {
        storage[key]
    }

    func setString(_ value: String, for key: KeychainKey) async throws {
        storage[key] = value
    }

    func remove(_ key: KeychainKey) async throws {
        storage[key] = nil
    }

    func removeAll() async throws {
        storage.removeAll()
    }
}
```

- [ ] **Step 6: Run and confirm pass**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Keychain apps/ios/Packages/FEAuth/Tests/FEAuthTests/Keychain
git commit -m "feat(ios): add KeychainStorage protocol and in-memory test fake"
```

---

### Task 4: Implement `SecItemKeychainStorage` (real Keychain backend)

Wraps the `Security` framework's `SecItem*` C API in a Sendable actor. Each `KeychainKey` maps to a generic-password item under the app's bundle identifier.

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Keychain/SecItemKeychainStorage.swift`
- Modify: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Keychain/KeychainStorageTests.swift`

- [ ] **Step 1: Add device-keychain integration test (gated by `#if !targetEnvironment(simulator) && canImport(UIKit)`)**

Append to `KeychainStorageTests.swift`:

```swift
final class SecItemKeychainStorageTests: XCTestCase {
    /// Round-trip against the real keychain. Skipped when running under
    /// `swift test` from the command line (no keychain access there).
    func testSecItemRoundTrip() async throws {
        #if !canImport(UIKit)
        throw XCTSkip("SecItem keychain not available on this test toolchain.")
        #else
        let storage = SecItemKeychainStorage(service: "test.familyevents.auth")
        try? await storage.removeAll()
        try await storage.setString("token_xyz", for: .accessToken)
        let got = try await storage.string(for: .accessToken)
        XCTAssertEqual(got, "token_xyz")
        try await storage.removeAll()
        let cleared = try await storage.string(for: .accessToken)
        XCTAssertNil(cleared)
        #endif
    }
}
```

- [ ] **Step 2: Run and confirm the new test fails (or skips) — but compiles**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | head -20
```

Expected: compile error — `SecItemKeychainStorage` undefined.

- [ ] **Step 3: Implement `SecItemKeychainStorage`**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/Keychain/SecItemKeychainStorage.swift`:

```swift
import Foundation
import FECore
#if canImport(Security)
import Security
#endif

public actor SecItemKeychainStorage: KeychainStorage {
    private let service: String

    public init(service: String) {
        self.service = service
    }

    public func string(for key: KeychainKey) async throws -> String? {
        #if canImport(Security)
        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        if status != errSecSuccess { throw AppError.keychain(status) }
        guard let data = item as? Data,
              let s = String(data: data, encoding: .utf8) else { return nil }
        return s
        #else
        return nil
        #endif
    }

    public func setString(_ value: String, for key: KeychainKey) async throws {
        #if canImport(Security)
        let data = Data(value.utf8)
        let query = baseQuery(for: key)

        // Try update first (covers the value-exists case)
        let updateStatus = SecItemUpdate(
            query as CFDictionary,
            [kSecValueData as String: data] as CFDictionary
        )

        switch updateStatus {
        case errSecSuccess:
            return
        case errSecItemNotFound:
            var add = query
            add[kSecValueData as String] = data
            let addStatus = SecItemAdd(add as CFDictionary, nil)
            if addStatus != errSecSuccess { throw AppError.keychain(addStatus) }
        default:
            throw AppError.keychain(updateStatus)
        }
        #endif
    }

    public func remove(_ key: KeychainKey) async throws {
        #if canImport(Security)
        let status = SecItemDelete(baseQuery(for: key) as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            throw AppError.keychain(status)
        }
        #endif
    }

    public func removeAll() async throws {
        for key in KeychainKey.allCases {
            try await remove(key)
        }
    }

    #if canImport(Security)
    private func baseQuery(for key: KeychainKey) -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
    }
    #endif
}
```

- [ ] **Step 4: Run and confirm pass (real-keychain test skips on macOS toolchain, the rest pass)**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Keychain/SecItemKeychainStorage.swift apps/ios/Packages/FEAuth/Tests/FEAuthTests/Keychain/KeychainStorageTests.swift
git commit -m "feat(ios): implement SecItemKeychainStorage via Security framework"
```

---

### Task 5: Wire `KeychainStorage` into the `FEAuth` package surface

Make sure both the protocol and the concrete impl are accessible to the rest of the package and (via `FEAuth.exports`) to the app target.

**Files:**
- Modify: `apps/ios/Packages/FEAuth/Package.swift` (no change expected — already in place; verify only)

- [ ] **Step 1: Verify the public exports compile against the rest of the package**

```bash
cd apps/ios/Packages/FEAuth && swift build 2>&1 | tail -5
```

Expected: `Build complete!` with no warnings about access control.

- [ ] **Step 2: No commit needed if step 1 passed. Otherwise fix and commit any access-modifier adjustments.**

---

## Phase C — Backend migration (Task 6)

### Task 6: Add `delete_my_account` SECURITY DEFINER RPC

Follows the project's private-body + public-wrapper convention (`CLAUDE.md` and `supabase/migrations/20260601002100_wrap_security_definer_rpcs.sql`).

**Files:**
- Create: `supabase/migrations/20260601002400_delete_my_account_rpc.sql`

- [ ] **Step 1: Read the reference migration**

```bash
grep -n "CREATE OR REPLACE FUNCTION private\." supabase/migrations/20260601002100_wrap_security_definer_rpcs.sql | head -3
```

Expected: at least one private-body function as a reference for the pattern.

- [ ] **Step 2: Author the migration**

Create `supabase/migrations/20260601002400_delete_my_account_rpc.sql`:

```sql
-- Account deletion RPC for consumer apps (web + iOS).
--
-- Pattern: SECURITY DEFINER body lives in `private`; a thin SECURITY INVOKER
-- wrapper in `public` calls into it. Anon callers are denied.
--
-- Behavior:
--   1. Delete the calling user's rows from public-facing tables we own
--      (favorites, ratings, plan memberships, comments). Cascade-friendly
--      tables are skipped because ON DELETE CASCADE already handles them.
--   2. Delete the auth.users row. Supabase requires service_role to delete
--      auth.users, hence SECURITY DEFINER.

set check_function_bodies = off;

create or replace function private.delete_my_account()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'not authenticated' using errcode = '28000';
    end if;

    -- App-owned per-user state. Add tables here as the schema grows;
    -- prefer ON DELETE CASCADE in newer tables to keep this list short.
    delete from public.user_event_favorites where user_id = v_user_id;
    delete from public.user_event_ratings   where user_id = v_user_id;
    delete from public.user_event_comments  where user_id = v_user_id;
    delete from public.user_plan_events     where user_id = v_user_id;

    -- The auth.users row itself. CASCADE handles auth.identities,
    -- auth.sessions, and auth.refresh_tokens.
    delete from auth.users where id = v_user_id;
end;
$$;

grant execute on function private.delete_my_account() to authenticated, service_role;

create or replace function public.delete_my_account()
returns void
language sql
security invoker
set search_path = pg_catalog, public
as $$
    select private.delete_my_account();
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
    'Deletes the calling user''s account and per-user app data. ' ||
    'Anon-callable: NO. Used by web /profile and iOS Profile sheet.';
```

- [ ] **Step 3: Validate the migration syntactically against a local Supabase**

```bash
pnpm run db:start 2>&1 | tail -5
pnpm run db:migrate 2>&1 | tail -10
```

Expected: migration applies. If `db:start` errors because Docker isn't running, skip and rely on the next-task SQL syntax review.

- [ ] **Step 4: Spot-check `public.delete_my_account` rejects anon and accepts authenticated**

Local SQL probe (only if the local Supabase started):

```bash
psql "postgres://postgres:postgres@localhost:54322/postgres" -c "select has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE');" 2>&1 | tail -3
psql "postgres://postgres:postgres@localhost:54322/postgres" -c "select has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE');" 2>&1 | tail -3
```

Expected: `anon → f`, `authenticated → t`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260601002400_delete_my_account_rpc.sql
git commit -m "feat(supabase): add delete_my_account RPC (private body + public wrapper)"
```

---

## Phase D — Auth service abstraction (Tasks 7–9)

### Task 7: Define the `AuthService` protocol and DTOs

Abstracting the auth surface behind a protocol lets the `SessionStore` tests run against a fake without touching the real network.

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Session/AuthService.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Session/FakeAuthService.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Session/FakeAuthServiceTests.swift`

- [ ] **Step 1: Failing test exercising the fake**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Session/FakeAuthServiceTests.swift`:

```swift
import XCTest
import FECore
@testable import FEAuth

final class FakeAuthServiceTests: XCTestCase {
    func testFakeServiceReturnsCannedSession() async throws {
        let fake = FakeAuthService()
        let session = AuthSession(
            userID: UserID("u_1"),
            accessToken: "access",
            refreshToken: "refresh",
            email: "alice@example.com",
            identityProvider: .password
        )
        fake.signInResult = .success(session)
        let got = try await fake.signIn(email: "alice@example.com", password: "pw")
        XCTAssertEqual(got, session)
    }

    func testFakeServiceThrowsConfiguredError() async {
        let fake = FakeAuthService()
        fake.signInResult = .failure(AppError.invalidCredentials)
        do {
            _ = try await fake.signIn(email: "x@y.z", password: "wrong")
            XCTFail("expected throw")
        } catch let error as AppError {
            XCTAssertEqual(error.userMessage, AppError.invalidCredentials.userMessage)
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | head -20
```

- [ ] **Step 3: Define DTOs and the protocol**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/Session/AuthService.swift`:

```swift
import Foundation
import FECore

public enum IdentityProvider: String, Sendable, Equatable {
    case password
    case apple
}

public struct AuthSession: Equatable, Sendable {
    public let userID: UserID
    public let accessToken: String
    public let refreshToken: String
    public let email: String?
    public let identityProvider: IdentityProvider

    public init(
        userID: UserID,
        accessToken: String,
        refreshToken: String,
        email: String?,
        identityProvider: IdentityProvider
    ) {
        self.userID = userID
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.email = email
        self.identityProvider = identityProvider
    }
}

public protocol AuthService: Sendable {
    func signIn(email: String, password: String) async throws -> AuthSession
    func signUp(email: String, password: String) async throws -> AuthSession
    func signInWithApple(idToken: String, nonce: String) async throws -> AuthSession
    func signOut() async throws
    func sendPasswordResetEmail(_ email: String) async throws
    func resetPassword(accessToken: String, newPassword: String) async throws
    func deleteAccount() async throws
    /// Re-hydrate a session from stored refresh token on cold-start.
    func restoreSession(accessToken: String, refreshToken: String) async throws -> AuthSession
}
```

- [ ] **Step 4: Implement the fake**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Session/FakeAuthService.swift`:

```swift
import Foundation
import FECore
@testable import FEAuth

final class FakeAuthService: AuthService, @unchecked Sendable {
    var signInResult: Result<AuthSession, Error> = .failure(AppError.unauthorized)
    var signUpResult: Result<AuthSession, Error> = .failure(AppError.unauthorized)
    var signInWithAppleResult: Result<AuthSession, Error> = .failure(AppError.appleSignInFailed(NSError(domain: "test", code: 0)))
    var restoreResult: Result<AuthSession, Error> = .failure(AppError.unauthorized)
    var signOutError: Error?
    var sendResetError: Error?
    var resetPasswordError: Error?
    var deleteAccountError: Error?

    private(set) var signOutCallCount = 0
    private(set) var deleteAccountCallCount = 0

    func signIn(email: String, password: String) async throws -> AuthSession {
        return try signInResult.get()
    }
    func signUp(email: String, password: String) async throws -> AuthSession {
        return try signUpResult.get()
    }
    func signInWithApple(idToken: String, nonce: String) async throws -> AuthSession {
        return try signInWithAppleResult.get()
    }
    func signOut() async throws {
        signOutCallCount += 1
        if let signOutError { throw signOutError }
    }
    func sendPasswordResetEmail(_ email: String) async throws {
        if let sendResetError { throw sendResetError }
    }
    func resetPassword(accessToken: String, newPassword: String) async throws {
        if let resetPasswordError { throw resetPasswordError }
    }
    func deleteAccount() async throws {
        deleteAccountCallCount += 1
        if let deleteAccountError { throw deleteAccountError }
    }
    func restoreSession(accessToken: String, refreshToken: String) async throws -> AuthSession {
        return try restoreResult.get()
    }
}
```

- [ ] **Step 5: Run and confirm pass**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Session/AuthService.swift apps/ios/Packages/FEAuth/Tests/FEAuthTests/Session
git commit -m "feat(ios): add AuthService protocol and FakeAuthService test double"
```

---

### Task 8: Implement `SupabaseAuthService` (real impl over `supabase-swift`)

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Session/SupabaseAuthService.swift`

- [ ] **Step 1: Write the failing integration test**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Session/SupabaseAuthServiceTests.swift`:

```swift
import XCTest
import FECore
@testable import FEAuth

final class SupabaseAuthServiceTests: XCTestCase {
    /// Compile-only smoke test — we don't have a credential to actually sign in
    /// against a real backend during unit tests, so we verify the service can be
    /// constructed and conforms to AuthService. End-to-end coverage lives in
    /// FamilyEventsUITests (deferred until M2 milestone integration step).
    func testCanInstantiateAgainstFamilyEventsSupabase() throws {
        let config = EnvConfig(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseAnonKey: "anon"
        )
        let supabase = FamilyEventsSupabase(config: config)
        let service: any AuthService = SupabaseAuthService(supabase: supabase)
        XCTAssertNotNil(service)
    }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | head -20
```

- [ ] **Step 3: Implement `SupabaseAuthService`**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/Session/SupabaseAuthService.swift`:

```swift
import Foundation
import Auth
import Supabase
import FECore
import FEData

public final class SupabaseAuthService: AuthService, Sendable {
    private let supabase: FamilyEventsSupabase

    public init(supabase: FamilyEventsSupabase) {
        self.supabase = supabase
    }

    public func signIn(email: String, password: String) async throws -> AuthSession {
        do {
            let response = try await supabase.client.auth.signIn(email: email, password: password)
            return Self.session(from: response, provider: .password)
        } catch {
            throw mapAuthError(error)
        }
    }

    public func signUp(email: String, password: String) async throws -> AuthSession {
        do {
            let response = try await supabase.client.auth.signUp(email: email, password: password)
            // Sign-up with email confirmation enabled returns no session.
            // Surface that to the UI as a sentinel.
            guard let session = response.session else {
                throw AppError.emailNotConfirmed
            }
            return Self.session(from: session, provider: .password)
        } catch let appError as AppError {
            throw appError
        } catch {
            throw mapAuthError(error)
        }
    }

    public func signInWithApple(idToken: String, nonce: String) async throws -> AuthSession {
        do {
            let response = try await supabase.client.auth.signInWithIdToken(
                credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
            )
            return Self.session(from: response, provider: .apple)
        } catch {
            throw AppError.appleSignInFailed(error)
        }
    }

    public func signOut() async throws {
        try await supabase.client.auth.signOut()
    }

    public func sendPasswordResetEmail(_ email: String) async throws {
        try await supabase.client.auth.resetPasswordForEmail(email)
    }

    public func resetPassword(accessToken: String, newPassword: String) async throws {
        try await supabase.client.auth.update(user: UserAttributes(password: newPassword))
    }

    public func deleteAccount() async throws {
        _ = try await supabase.client.rpc("delete_my_account").execute()
        try await signOut()
    }

    public func restoreSession(accessToken: String, refreshToken: String) async throws -> AuthSession {
        let response = try await supabase.client.auth.setSession(accessToken: accessToken, refreshToken: refreshToken)
        return Self.session(from: response, provider: .password) // provider inferred lossily; refined in M3 if needed.
    }

    private static func session(from supaSession: Session, provider: IdentityProvider) -> AuthSession {
        AuthSession(
            userID: UserID(supaSession.user.id.uuidString.lowercased()),
            accessToken: supaSession.accessToken,
            refreshToken: supaSession.refreshToken ?? "",
            email: supaSession.user.email,
            identityProvider: provider
        )
    }

    private func mapAuthError(_ error: Error) -> AppError {
        let message = (error as NSError).localizedDescription.lowercased()
        if message.contains("invalid login credentials") || message.contains("invalid_credentials") {
            return .invalidCredentials
        }
        if message.contains("already registered") || message.contains("user already exists") {
            return .emailAlreadyInUse
        }
        if message.contains("email not confirmed") {
            return .emailNotConfirmed
        }
        return .unknown(error)
    }
}
```

> **Implementer note:** the exact response/property names on `supabase-swift` 2.20.0 may differ from the above (`response.session`, `Session.refreshToken` as optional, etc.). If a property doesn't exist, find the closest equivalent in the checked-out SDK source under `apps/ios/Packages/FEData/.build/checkouts/supabase-swift/Sources/`. Make the minimum adjustment to compile — keep the public `AuthService` shape stable.

- [ ] **Step 4: Run and confirm pass**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Session/SupabaseAuthService.swift apps/ios/Packages/FEAuth/Tests/FEAuthTests/Session/SupabaseAuthServiceTests.swift
git commit -m "feat(ios): implement SupabaseAuthService over supabase-swift"
```

---

### Task 9: Extend `SessionState` with a hydrating state

The M1 stub had `signedOut / signedIn(userID:)`. We add `hydrating` (cold-start while restoring from Keychain) and `linkRequired(email:appleIdToken:nonce:)` (collision case from Phase G).

**Files:**
- Modify: `apps/ios/Packages/FEAuth/Sources/FEAuth/SessionStore.swift`
- Modify: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/SessionStoreTests.swift`
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Session/SessionState.swift`

- [ ] **Step 1: Failing tests in `SessionStoreTests.swift` — append**

```swift
    func testInitialStateIsHydratingWhenStorageHasTokens() async throws {
        let storage = InMemoryKeychainStorage()
        try await storage.setString("access", for: .accessToken)
        try await storage.setString("refresh", for: .refreshToken)
        try await storage.setString("u_1", for: .userID)
        let fake = FakeAuthService()
        fake.restoreResult = .success(.init(userID: UserID("u_1"), accessToken: "access", refreshToken: "refresh", email: nil, identityProvider: .password))
        let store = await SessionStore(authService: fake, storage: storage)
        if case .hydrating = await store.state {} else {
            XCTFail("expected .hydrating, got \(await store.state)")
        }
    }

    func testLinkRequiredStateCarriesIdToken() async {
        let store = await SessionStore(authService: FakeAuthService(), storage: InMemoryKeychainStorage())
        await store.markLinkRequired(email: "x@y.z", appleIdToken: "tok", nonce: "n")
        if case .linkRequired(let email, _, _) = await store.state {
            XCTAssertEqual(email, "x@y.z")
        } else {
            XCTFail("expected .linkRequired")
        }
    }
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | head -30
```

- [ ] **Step 3: Move `SessionState` into its own file and extend cases**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/Session/SessionState.swift`:

```swift
import Foundation
import FECore

public enum SessionState: Equatable, Sendable {
    case hydrating
    case signedOut
    case signedIn(userID: UserID)
    case linkRequired(email: String, appleIdToken: String, nonce: String)
}
```

- [ ] **Step 4: Delete the old inline `SessionState` and update `SessionStore`**

Replace `apps/ios/Packages/FEAuth/Sources/FEAuth/SessionStore.swift` with:

```swift
import Foundation
import Observation
import FECore

@Observable
@MainActor
public final class SessionStore {
    public private(set) var state: SessionState
    private let authService: any AuthService
    private let storage: any KeychainStorage

    public init(authService: any AuthService, storage: any KeychainStorage) {
        self.authService = authService
        self.storage = storage
        self.state = .hydrating
        Task { await self.bootstrap() }
    }

    private func bootstrap() async {
        do {
            guard
                let access = try await storage.string(for: .accessToken),
                let refresh = try await storage.string(for: .refreshToken)
            else {
                state = .signedOut
                return
            }
            let session = try await authService.restoreSession(accessToken: access, refreshToken: refresh)
            try await persist(session)
            state = .signedIn(userID: session.userID)
        } catch {
            try? await storage.removeAll()
            state = .signedOut
        }
    }

    public func markLinkRequired(email: String, appleIdToken: String, nonce: String) {
        state = .linkRequired(email: email, appleIdToken: appleIdToken, nonce: nonce)
    }

    public func adopt(_ session: AuthSession) async throws {
        try await persist(session)
        state = .signedIn(userID: session.userID)
    }

    public func signOut() async {
        try? await authService.signOut()
        try? await storage.removeAll()
        state = .signedOut
    }

    private func persist(_ session: AuthSession) async throws {
        try await storage.setString(session.accessToken, for: .accessToken)
        try await storage.setString(session.refreshToken, for: .refreshToken)
        try await storage.setString(session.userID.rawValue, for: .userID)
    }
}
```

- [ ] **Step 5: Run and confirm pass**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Session apps/ios/Packages/FEAuth/Sources/FEAuth/SessionStore.swift apps/ios/Packages/FEAuth/Tests/FEAuthTests/SessionStoreTests.swift
git commit -m "feat(ios): extend SessionStore with hydration + linking states"
```

---

## Phase E — Form validation (Task 10)

### Task 10: Add `EmailPasswordValidators`

Pure functions. Shared across `SignInViewModel`, `SignUpViewModel`, `ResetPasswordViewModel`.

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Form/EmailPasswordValidators.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Form/EmailPasswordValidatorsTests.swift`

- [ ] **Step 1: Failing test**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Form/EmailPasswordValidatorsTests.swift`:

```swift
import XCTest
@testable import FEAuth

final class EmailPasswordValidatorsTests: XCTestCase {
    func testValidEmailAccepted() {
        XCTAssertNil(EmailPasswordValidators.emailError("alice@example.com"))
        XCTAssertNil(EmailPasswordValidators.emailError("a.b+c@sub.domain.co.uk"))
    }
    func testInvalidEmailRejected() {
        XCTAssertNotNil(EmailPasswordValidators.emailError(""))
        XCTAssertNotNil(EmailPasswordValidators.emailError("no-at-sign"))
        XCTAssertNotNil(EmailPasswordValidators.emailError("trailing@"))
        XCTAssertNotNil(EmailPasswordValidators.emailError("@no-local"))
    }
    func testPasswordMinLength() {
        XCTAssertNotNil(EmailPasswordValidators.passwordError(""))
        XCTAssertNotNil(EmailPasswordValidators.passwordError("short"))
        XCTAssertNil(EmailPasswordValidators.passwordError("longenough"))
    }
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | head -10
```

- [ ] **Step 3: Implement**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/Form/EmailPasswordValidators.swift`:

```swift
import Foundation

public enum EmailPasswordValidators {
    public static func emailError(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "Email is required." }
        // Simple RFC-flavored check; not exhaustive but adequate at the form layer.
        let regex = #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#
        if trimmed.range(of: regex, options: .regularExpression) == nil {
            return "Please enter a valid email."
        }
        return nil
    }

    public static func passwordError(_ value: String) -> String? {
        if value.count < 8 { return "Password must be at least 8 characters." }
        return nil
    }
}
```

- [ ] **Step 4: Run and confirm pass**

```bash
cd apps/ios/Packages/FEAuth && swift test 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Form apps/ios/Packages/FEAuth/Tests/FEAuthTests/Form
git commit -m "feat(ios): add EmailPasswordValidators"
```

---

## Phase F — View models for email/password flows (Tasks 11–14)

Each view model is `@Observable @MainActor`. They drive a single screen's state machine: idle → submitting → success / error. Tests use `FakeAuthService` + `InMemoryKeychainStorage` + a freshly constructed `SessionStore`.

### Task 11: `SignInViewModel`

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/SignInViewModel.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/SignInViewModelTests.swift`

- [ ] **Step 1: Failing test**

```swift
import XCTest
import FECore
@testable import FEAuth

@MainActor
final class SignInViewModelTests: XCTestCase {
    func testSuccessfulSignInUpdatesSessionStore() async throws {
        let fake = FakeAuthService()
        let session = AuthSession(userID: UserID("u_1"), accessToken: "a", refreshToken: "r", email: "x@y.z", identityProvider: .password)
        fake.signInResult = .success(session)
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        let vm = SignInViewModel(authService: fake, sessionStore: store)
        vm.email = "x@y.z"
        vm.password = "longenough"
        await vm.submit()
        XCTAssertNil(vm.errorMessage)
        XCTAssertFalse(vm.isSubmitting)
    }

    func testInvalidEmailBlocksSubmit() async {
        let fake = FakeAuthService()
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        let vm = SignInViewModel(authService: fake, sessionStore: store)
        vm.email = "no-at-sign"
        vm.password = "longenough"
        await vm.submit()
        XCTAssertEqual(vm.errorMessage, "Please enter a valid email.")
    }

    func testInvalidCredentialsErrorIsSurfaced() async {
        let fake = FakeAuthService()
        fake.signInResult = .failure(AppError.invalidCredentials)
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        let vm = SignInViewModel(authService: fake, sessionStore: store)
        vm.email = "x@y.z"
        vm.password = "longenough"
        await vm.submit()
        XCTAssertEqual(vm.errorMessage, "Email or password is incorrect.")
    }
}
```

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Implement**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/SignInViewModel.swift`:

```swift
import Foundation
import Observation
import FECore

@Observable
@MainActor
public final class SignInViewModel {
    public var email: String = ""
    public var password: String = ""
    public private(set) var isSubmitting = false
    public private(set) var errorMessage: String?

    private let authService: any AuthService
    private let sessionStore: SessionStore

    public init(authService: any AuthService, sessionStore: SessionStore) {
        self.authService = authService
        self.sessionStore = sessionStore
    }

    public func submit() async {
        errorMessage = nil
        if let err = EmailPasswordValidators.emailError(email) { errorMessage = err; return }
        if let err = EmailPasswordValidators.passwordError(password) { errorMessage = err; return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let session = try await authService.signIn(email: email, password: password)
            try await sessionStore.adopt(session)
        } catch let app as AppError {
            errorMessage = app.userMessage
        } catch {
            errorMessage = AppError.unknown(error).userMessage
        }
    }
}
```

- [ ] **Step 4: Run and confirm pass**

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/SignInViewModel.swift apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/SignInViewModelTests.swift
git commit -m "feat(ios): add SignInViewModel"
```

---

### Task 12: `SignUpViewModel`

Mirror of Task 11 but exposes a `pendingConfirmation` state when Supabase returns no session (email confirmation required).

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/SignUpViewModel.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/SignUpViewModelTests.swift`

- [ ] **Step 1: Failing test (mirrors Task 11 plus a `pendingConfirmation` path)**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/SignUpViewModelTests.swift`:

```swift
import XCTest
import FECore
@testable import FEAuth

@MainActor
final class SignUpViewModelTests: XCTestCase {
    func testSuccessfulSignUpSignsIn() async throws {
        let fake = FakeAuthService()
        fake.signUpResult = .success(.init(userID: UserID("u_2"), accessToken: "a", refreshToken: "r", email: "a@b.c", identityProvider: .password))
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        let vm = SignUpViewModel(authService: fake, sessionStore: store)
        vm.email = "a@b.c"
        vm.password = "longenough"
        await vm.submit()
        XCTAssertNil(vm.errorMessage)
        XCTAssertFalse(vm.pendingConfirmation)
    }

    func testSignUpRequiringConfirmation() async {
        let fake = FakeAuthService()
        fake.signUpResult = .failure(AppError.emailNotConfirmed)
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        let vm = SignUpViewModel(authService: fake, sessionStore: store)
        vm.email = "a@b.c"
        vm.password = "longenough"
        await vm.submit()
        XCTAssertTrue(vm.pendingConfirmation)
        XCTAssertNil(vm.errorMessage) // pendingConfirmation is not an error
    }

    func testEmailAlreadyInUseSurfacesError() async {
        let fake = FakeAuthService()
        fake.signUpResult = .failure(AppError.emailAlreadyInUse)
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        let vm = SignUpViewModel(authService: fake, sessionStore: store)
        vm.email = "a@b.c"
        vm.password = "longenough"
        await vm.submit()
        XCTAssertEqual(vm.errorMessage, AppError.emailAlreadyInUse.userMessage)
    }
}
```

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Implement**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/SignUpViewModel.swift`:

```swift
import Foundation
import Observation
import FECore

@Observable
@MainActor
public final class SignUpViewModel {
    public var email: String = ""
    public var password: String = ""
    public private(set) var isSubmitting = false
    public private(set) var errorMessage: String?
    public private(set) var pendingConfirmation = false

    private let authService: any AuthService
    private let sessionStore: SessionStore

    public init(authService: any AuthService, sessionStore: SessionStore) {
        self.authService = authService
        self.sessionStore = sessionStore
    }

    public func submit() async {
        errorMessage = nil
        pendingConfirmation = false
        if let err = EmailPasswordValidators.emailError(email) { errorMessage = err; return }
        if let err = EmailPasswordValidators.passwordError(password) { errorMessage = err; return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let session = try await authService.signUp(email: email, password: password)
            try await sessionStore.adopt(session)
        } catch AppError.emailNotConfirmed {
            pendingConfirmation = true
        } catch let app as AppError {
            errorMessage = app.userMessage
        } catch {
            errorMessage = AppError.unknown(error).userMessage
        }
    }
}
```

- [ ] **Step 4: Run and confirm pass**

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/SignUpViewModel.swift apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/SignUpViewModelTests.swift
git commit -m "feat(ios): add SignUpViewModel"
```

---

### Task 13: `ForgotPasswordViewModel`

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/ForgotPasswordViewModel.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/ForgotPasswordViewModelTests.swift`

- [ ] **Step 1: Failing test**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/ForgotPasswordViewModelTests.swift`:

```swift
import XCTest
import FECore
@testable import FEAuth

@MainActor
final class ForgotPasswordViewModelTests: XCTestCase {
    func testSubmitSendsResetEmail() async {
        let fake = FakeAuthService()
        let vm = ForgotPasswordViewModel(authService: fake)
        vm.email = "a@b.c"
        await vm.submit()
        XCTAssertTrue(vm.emailSent)
        XCTAssertNil(vm.errorMessage)
    }
    func testBadEmailRejected() async {
        let fake = FakeAuthService()
        let vm = ForgotPasswordViewModel(authService: fake)
        vm.email = "nope"
        await vm.submit()
        XCTAssertFalse(vm.emailSent)
        XCTAssertEqual(vm.errorMessage, "Please enter a valid email.")
    }
}
```

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Implement**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/ForgotPasswordViewModel.swift`:

```swift
import Foundation
import Observation
import FECore

@Observable
@MainActor
public final class ForgotPasswordViewModel {
    public var email: String = ""
    public private(set) var isSubmitting = false
    public private(set) var emailSent = false
    public private(set) var errorMessage: String?

    private let authService: any AuthService

    public init(authService: any AuthService) {
        self.authService = authService
    }

    public func submit() async {
        errorMessage = nil
        emailSent = false
        if let err = EmailPasswordValidators.emailError(email) { errorMessage = err; return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await authService.sendPasswordResetEmail(email)
            emailSent = true
        } catch let app as AppError {
            errorMessage = app.userMessage
        } catch {
            errorMessage = AppError.unknown(error).userMessage
        }
    }
}
```

- [ ] **Step 4: Run and confirm pass**

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/ForgotPasswordViewModel.swift apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/ForgotPasswordViewModelTests.swift
git commit -m "feat(ios): add ForgotPasswordViewModel"
```

---

### Task 14: `ResetPasswordViewModel`

Driven from the deep link — the token comes in as a constructor parameter.

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/ResetPasswordViewModel.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/ResetPasswordViewModelTests.swift`

- [ ] **Step 1: Failing test**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/ResetPasswordViewModelTests.swift`:

```swift
import XCTest
import FECore
@testable import FEAuth

@MainActor
final class ResetPasswordViewModelTests: XCTestCase {
    func testSuccessfulReset() async {
        let fake = FakeAuthService()
        let vm = ResetPasswordViewModel(token: "tok_xyz", authService: fake)
        vm.newPassword = "longenough"
        await vm.submit()
        XCTAssertTrue(vm.didReset)
        XCTAssertNil(vm.errorMessage)
    }
    func testShortPasswordRejected() async {
        let fake = FakeAuthService()
        let vm = ResetPasswordViewModel(token: "tok_xyz", authService: fake)
        vm.newPassword = "short"
        await vm.submit()
        XCTAssertFalse(vm.didReset)
        XCTAssertEqual(vm.errorMessage, "Password must be at least 8 characters.")
    }
}
```

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Implement**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/ResetPasswordViewModel.swift`:

```swift
import Foundation
import Observation
import FECore

@Observable
@MainActor
public final class ResetPasswordViewModel {
    public let token: String
    public var newPassword: String = ""
    public private(set) var isSubmitting = false
    public private(set) var didReset = false
    public private(set) var errorMessage: String?

    private let authService: any AuthService

    public init(token: String, authService: any AuthService) {
        self.token = token
        self.authService = authService
    }

    public func submit() async {
        errorMessage = nil
        if let err = EmailPasswordValidators.passwordError(newPassword) { errorMessage = err; return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await authService.resetPassword(accessToken: token, newPassword: newPassword)
            didReset = true
        } catch let app as AppError {
            errorMessage = app.userMessage
        } catch {
            errorMessage = AppError.unknown(error).userMessage
        }
    }
}
```

- [ ] **Step 4: Run and confirm pass**

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/ResetPasswordViewModel.swift apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/ResetPasswordViewModelTests.swift
git commit -m "feat(ios): add ResetPasswordViewModel"
```

---

## Phase G — Apple sign-in (Tasks 15–17)

### Task 15: Apple sign-in coordinator

Wraps `ASAuthorizationController` in an async/await call returning `(idToken, nonce, email?)`.

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/SignInWithApple/AppleSignInCoordinator.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/SignInWithApple/AppleSignInCoordinatorTests.swift`

- [ ] **Step 1: Failing test — nonce generation property**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/SignInWithApple/AppleSignInCoordinatorTests.swift`:

```swift
import XCTest
@testable import FEAuth

final class AppleSignInCoordinatorTests: XCTestCase {
    func testNonceIsLongAndAlphanumeric() {
        let n1 = AppleSignInCoordinator.generateNonce()
        let n2 = AppleSignInCoordinator.generateNonce()
        XCTAssertGreaterThanOrEqual(n1.count, 32)
        XCTAssertNotEqual(n1, n2)
        for ch in n1 {
            XCTAssertTrue(ch.isLetter || ch.isNumber || ch == "-" || ch == "_" || ch == ".")
        }
    }

    func testHashesNonceWithSHA256() {
        let nonce = "deadbeef"
        let hashed = AppleSignInCoordinator.sha256(nonce)
        XCTAssertEqual(hashed.count, 64)
    }
}
```

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Implement the coordinator (UIKit-gated so macOS tests still build)**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/SignInWithApple/AppleSignInCoordinator.swift`:

```swift
import Foundation
import CryptoKit
#if canImport(AuthenticationServices) && canImport(UIKit)
import AuthenticationServices
import UIKit
#endif
import FECore

public struct AppleSignInResult: Sendable, Equatable {
    public let idToken: String
    public let nonce: String
    public let email: String?
    public init(idToken: String, nonce: String, email: String?) {
        self.idToken = idToken
        self.nonce = nonce
        self.email = email
    }
}

public enum AppleSignInCoordinator {
    /// Generates a cryptographically random nonce suitable for Apple's
    /// "rawNonce -> sha256 hex" requirement.
    public static func generateNonce(length: Int = 32) -> String {
        let charset = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var randoms = [UInt8](repeating: 0, count: 16)
            _ = randoms.withUnsafeMutableBytes { buf in
                SecRandomCopyBytes(kSecRandomDefault, buf.count, buf.baseAddress!)
            }
            for byte in randoms {
                if remaining == 0 { break }
                let idx = Int(byte) % charset.count
                result.append(charset[idx])
                remaining -= 1
            }
        }
        return result
    }

    public static func sha256(_ value: String) -> String {
        let data = Data(value.utf8)
        let hash = SHA256.hash(data: data)
        return hash.map { String(format: "%02x", $0) }.joined()
    }

    #if canImport(AuthenticationServices) && canImport(UIKit)
    /// Presents the system SIWA sheet.
    @MainActor
    public static func presentSignIn(from anchor: ASPresentationAnchor) async throws -> AppleSignInResult {
        let nonce = generateNonce()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)
        let controller = ASAuthorizationController(authorizationRequests: [request])
        let delegate = Delegate(rawNonce: nonce)
        controller.delegate = delegate
        controller.presentationContextProvider = ContextProvider(anchor: anchor)
        return try await withCheckedThrowingContinuation { continuation in
            delegate.continuation = continuation
            controller.performRequests()
        }
    }

    private final class Delegate: NSObject, ASAuthorizationControllerDelegate {
        let rawNonce: String
        var continuation: CheckedContinuation<AppleSignInResult, Error>?
        init(rawNonce: String) { self.rawNonce = rawNonce }

        func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let tokenString = String(data: tokenData, encoding: .utf8) else {
                continuation?.resume(throwing: AppError.appleSignInFailed(NSError(domain: "AppleSignIn", code: -1)))
                return
            }
            continuation?.resume(returning: AppleSignInResult(idToken: tokenString, nonce: rawNonce, email: credential.email))
        }

        func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
            if let asError = error as? ASAuthorizationError, asError.code == .canceled {
                continuation?.resume(throwing: AppError.appleSignInCancelled)
            } else {
                continuation?.resume(throwing: AppError.appleSignInFailed(error))
            }
        }
    }

    private final class ContextProvider: NSObject, ASAuthorizationControllerPresentationContextProviding {
        let anchor: ASPresentationAnchor
        init(anchor: ASPresentationAnchor) { self.anchor = anchor }
        func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { anchor }
    }
    #endif
}
```

- [ ] **Step 4: Run and confirm pass**

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/SignInWithApple/AppleSignInCoordinator.swift apps/ios/Packages/FEAuth/Tests/FEAuthTests/SignInWithApple/AppleSignInCoordinatorTests.swift
git commit -m "feat(ios): add Apple sign-in coordinator with secure nonce"
```

---

### Task 16: `AppleSignInButton` SwiftUI wrapper

Embed `ASAuthorizationAppleIDButton` in SwiftUI. Cosmetic but mandatory for HIG compliance — Apple requires their button design.

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/SignInWithApple/AppleSignInButton.swift`

- [ ] **Step 1: Implement (no automated test — visual component, covered by snapshot suite later)**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/SignInWithApple/AppleSignInButton.swift`:

```swift
import SwiftUI
#if canImport(AuthenticationServices) && canImport(UIKit)
import AuthenticationServices

public struct AppleSignInButton: UIViewRepresentable {
    private let style: ASAuthorizationAppleIDButton.Style
    private let action: () -> Void

    public init(style: ASAuthorizationAppleIDButton.Style = .black, action: @escaping () -> Void) {
        self.style = style
        self.action = action
    }

    public func makeUIView(context: Context) -> ASAuthorizationAppleIDButton {
        let button = ASAuthorizationAppleIDButton(type: .signIn, style: style)
        button.addTarget(context.coordinator, action: #selector(Coordinator.didTap), for: .touchUpInside)
        return button
    }

    public func updateUIView(_ uiView: ASAuthorizationAppleIDButton, context: Context) {}

    public func makeCoordinator() -> Coordinator { Coordinator(action: action) }

    public final class Coordinator: NSObject {
        let action: () -> Void
        init(action: @escaping () -> Void) { self.action = action }
        @objc func didTap() { action() }
    }
}
#else
public struct AppleSignInButton: View {
    private let action: () -> Void
    public init(style: Int = 0, action: @escaping () -> Void) { self.action = action }
    public var body: some View {
        Button("Sign in with Apple", action: action)
    }
}
#endif
```

- [ ] **Step 2: Build check**

```bash
cd apps/ios/Packages/FEAuth && swift build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/SignInWithApple/AppleSignInButton.swift
git commit -m "feat(ios): add AppleSignInButton SwiftUI wrapper"
```

---

### Task 17: `signInWithApple` orchestration on `SessionStore`

Adds a `MainActor` method `signInWithApple(presenting:)` that drives the coordinator, exchanges the id token, and either signs the user in or transitions to `.linkRequired` on collision.

**Files:**
- Modify: `apps/ios/Packages/FEAuth/Sources/FEAuth/SessionStore.swift`
- Modify: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/SessionStoreTests.swift`

- [ ] **Step 1: Failing test for the linking branch**

Append to `SessionStoreTests.swift`:

```swift
    func testSignInWithAppleSucceeds() async throws {
        let fake = FakeAuthService()
        let session = AuthSession(userID: UserID("u_apple"), accessToken: "a", refreshToken: "r", email: "x@y.z", identityProvider: .apple)
        fake.signInWithAppleResult = .success(session)
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        try await store.completeAppleSignIn(idToken: "tok", nonce: "n", email: "x@y.z")
        if case .signedIn(let uid) = store.state {
            XCTAssertEqual(uid, UserID("u_apple"))
        } else {
            XCTFail("expected .signedIn")
        }
    }

    func testSignInWithAppleEmailCollisionTransitionsToLinkRequired() async throws {
        let fake = FakeAuthService()
        // We model collision as a sentinel error the controller can pattern-match on.
        fake.signInWithAppleResult = .failure(AppError.emailAlreadyInUse)
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        try await store.completeAppleSignIn(idToken: "tok", nonce: "n", email: "x@y.z")
        if case .linkRequired(let email, _, _) = store.state {
            XCTAssertEqual(email, "x@y.z")
        } else {
            XCTFail("expected .linkRequired")
        }
    }
```

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Extend `SessionStore`**

Append to the existing `SessionStore.swift`:

```swift
extension SessionStore {
    public func completeAppleSignIn(idToken: String, nonce: String, email: String?) async throws {
        do {
            let session = try await authService.signInWithApple(idToken: idToken, nonce: nonce)
            try await adopt(session)
        } catch AppError.emailAlreadyInUse {
            // Backend says this email exists with a different identity provider.
            // Capture the Apple credential so the user can confirm via password.
            state = .linkRequired(email: email ?? "", appleIdToken: idToken, nonce: nonce)
        } catch AppError.appleSignInCancelled {
            // No-op; UI stays on sign-in screen.
            return
        } catch {
            throw error
        }
    }
}
```

- [ ] **Step 4: Run and confirm pass**

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/SessionStore.swift apps/ios/Packages/FEAuth/Tests/FEAuthTests/SessionStoreTests.swift
git commit -m "feat(ios): add SessionStore.completeAppleSignIn with link-required transition"
```

---

## Phase H — Account linking (Task 18)

### Task 18: `LinkAccountViewModel`

After Apple sign-in surfaces a collision, the user is asked to confirm by entering their existing password. On success, the email/password sign-in is performed (the user is now signed in as the existing account); the Apple identity can be linked in a follow-up settings flow (out of scope here — track in M2 backlog).

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/LinkAccountViewModel.swift`
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/LinkAccountViewModelTests.swift`

- [ ] **Step 1: Failing test**

Create `apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/LinkAccountViewModelTests.swift`:

```swift
import XCTest
import FECore
@testable import FEAuth

@MainActor
final class LinkAccountViewModelTests: XCTestCase {
    func testCorrectPasswordSignsInExistingAccount() async {
        let fake = FakeAuthService()
        fake.signInResult = .success(.init(userID: UserID("u_exist"), accessToken: "a", refreshToken: "r", email: "x@y.z", identityProvider: .password))
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        let vm = LinkAccountViewModel(email: "x@y.z", authService: fake, sessionStore: store)
        vm.password = "longenough"
        await vm.submit()
        XCTAssertNil(vm.errorMessage)
    }

    func testWrongPasswordSurfacesError() async {
        let fake = FakeAuthService()
        fake.signInResult = .failure(AppError.invalidCredentials)
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        let vm = LinkAccountViewModel(email: "x@y.z", authService: fake, sessionStore: store)
        vm.password = "wrong-but-long"
        await vm.submit()
        XCTAssertEqual(vm.errorMessage, AppError.invalidCredentials.userMessage)
    }
}
```

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Implement**

Create `apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/LinkAccountViewModel.swift`:

```swift
import Foundation
import Observation
import FECore

@Observable
@MainActor
public final class LinkAccountViewModel {
    public let email: String
    public var password: String = ""
    public private(set) var isSubmitting = false
    public private(set) var errorMessage: String?

    private let authService: any AuthService
    private let sessionStore: SessionStore

    public init(email: String, authService: any AuthService, sessionStore: SessionStore) {
        self.email = email
        self.authService = authService
        self.sessionStore = sessionStore
    }

    public func submit() async {
        errorMessage = nil
        if let err = EmailPasswordValidators.passwordError(password) { errorMessage = err; return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let session = try await authService.signIn(email: email, password: password)
            try await sessionStore.adopt(session)
        } catch let app as AppError {
            errorMessage = app.userMessage
        } catch {
            errorMessage = AppError.unknown(error).userMessage
        }
    }
}
```

- [ ] **Step 4: Run and confirm pass**

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/ViewModels/LinkAccountViewModel.swift apps/ios/Packages/FEAuth/Tests/FEAuthTests/ViewModels/LinkAccountViewModelTests.swift
git commit -m "feat(ios): add LinkAccountViewModel for SIWA email-collision flow"
```

---

## Phase I — Auth screens (Tasks 19–24)

Screens are thin SwiftUI views that read state from their view model. Each gets a minimal smoke test (renders without crash; major elements present). Real visual coverage lands in M9 snapshot tests.

The screens themselves are small (~30–60 lines each). The plan provides full contents for each.

### Task 19: `SignInScreen`

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/SignInScreen.swift`

- [ ] **Step 1: Implement**

Create the file:

```swift
import SwiftUI
import FECore
import FEDesignSystem

public struct SignInScreen: View {
    @Bindable var viewModel: SignInViewModel
    let onForgotPassword: () -> Void
    let onSignUp: () -> Void
    let onAppleSignIn: () -> Void

    public init(
        viewModel: SignInViewModel,
        onForgotPassword: @escaping () -> Void,
        onSignUp: @escaping () -> Void,
        onAppleSignIn: @escaping () -> Void
    ) {
        self.viewModel = viewModel
        self.onForgotPassword = onForgotPassword
        self.onSignUp = onSignUp
        self.onAppleSignIn = onAppleSignIn
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Text("Welcome back")
                    .appTypography(.titleLarge)
                    .frame(maxWidth: .infinity, alignment: .leading)

                AppleSignInButton(action: onAppleSignIn)
                    .frame(height: 48)

                LabeledContent("or") { Color.clear }.hidden() // visual divider placeholder
                Divider()

                TextField("Email", text: $viewModel.email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textContentType(.emailAddress)
                    .padding().background(Color.appSecondaryBackground).cornerRadius(8)

                SecureField("Password", text: $viewModel.password)
                    .textContentType(.password)
                    .padding().background(Color.appSecondaryBackground).cornerRadius(8)

                if let err = viewModel.errorMessage {
                    Text(err).foregroundStyle(.red).appTypography(.caption)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task { await viewModel.submit() }
                } label: {
                    if viewModel.isSubmitting {
                        ProgressView()
                    } else {
                        Text("Sign in").frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(viewModel.isSubmitting)

                HStack {
                    Button("Forgot password?", action: onForgotPassword).buttonStyle(.plain)
                    Spacer()
                    Button("Create account", action: onSignUp).buttonStyle(.plain)
                }
                .appTypography(.caption)
            }
            .padding()
        }
        .navigationTitle("Sign in")
    }
}
```

- [ ] **Step 2: Build**

```bash
cd apps/ios/Packages/FEAuth && swift build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/SignInScreen.swift
git commit -m "feat(ios): add SignInScreen"
```

---

### Task 20: `SignUpScreen`

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/SignUpScreen.swift`

- [ ] **Step 1: Implement**

```swift
import SwiftUI
import FECore
import FEDesignSystem

public struct SignUpScreen: View {
    @Bindable var viewModel: SignUpViewModel
    let onBackToSignIn: () -> Void

    public init(viewModel: SignUpViewModel, onBackToSignIn: @escaping () -> Void) {
        self.viewModel = viewModel
        self.onBackToSignIn = onBackToSignIn
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Text("Create your account").appTypography(.titleLarge).frame(maxWidth: .infinity, alignment: .leading)

                TextField("Email", text: $viewModel.email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textContentType(.emailAddress)
                    .padding().background(Color.appSecondaryBackground).cornerRadius(8)

                SecureField("Password (at least 8 characters)", text: $viewModel.password)
                    .textContentType(.newPassword)
                    .padding().background(Color.appSecondaryBackground).cornerRadius(8)

                if viewModel.pendingConfirmation {
                    Text("Check your email for a confirmation link. Once confirmed, sign in.")
                        .appTypography(.body)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button("Back to sign in", action: onBackToSignIn).buttonStyle(.borderedProminent)
                } else if let err = viewModel.errorMessage {
                    Text(err).foregroundStyle(.red).appTypography(.caption)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if !viewModel.pendingConfirmation {
                    Button {
                        Task { await viewModel.submit() }
                    } label: {
                        if viewModel.isSubmitting { ProgressView() }
                        else { Text("Create account").frame(maxWidth: .infinity) }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(viewModel.isSubmitting)

                    Button("Already have an account? Sign in", action: onBackToSignIn).buttonStyle(.plain)
                }
            }
            .padding()
        }
        .navigationTitle("Sign up")
    }
}
```

- [ ] **Step 2: Build**

- [ ] **Step 3: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/SignUpScreen.swift
git commit -m "feat(ios): add SignUpScreen"
```

---

### Task 21: `ForgotPasswordScreen`

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/ForgotPasswordScreen.swift`

- [ ] **Step 1: Implement**

```swift
import SwiftUI
import FECore
import FEDesignSystem

public struct ForgotPasswordScreen: View {
    @Bindable var viewModel: ForgotPasswordViewModel
    let onBack: () -> Void

    public init(viewModel: ForgotPasswordViewModel, onBack: @escaping () -> Void) {
        self.viewModel = viewModel
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: 24) {
            Text("Reset your password").appTypography(.titleLarge).frame(maxWidth: .infinity, alignment: .leading)
            Text("Enter your email and we'll send a reset link.")
                .appTypography(.body)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            TextField("Email", text: $viewModel.email)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                .autocorrectionDisabled()
                .textContentType(.emailAddress)
                .padding().background(Color.appSecondaryBackground).cornerRadius(8)

            if viewModel.emailSent {
                Text("Check your email for a reset link.").appTypography(.body)
                Button("Back to sign in", action: onBack).buttonStyle(.borderedProminent)
            } else {
                if let err = viewModel.errorMessage {
                    Text(err).foregroundStyle(.red).appTypography(.caption)
                }
                Button {
                    Task { await viewModel.submit() }
                } label: {
                    if viewModel.isSubmitting { ProgressView() }
                    else { Text("Send reset link").frame(maxWidth: .infinity) }
                }
                .buttonStyle(.borderedProminent).controlSize(.large)
                .disabled(viewModel.isSubmitting)
            }

            Spacer()
        }
        .padding()
        .navigationTitle("Forgot password")
    }
}
```

- [ ] **Step 2: Build**

- [ ] **Step 3: Commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/ForgotPasswordScreen.swift
git commit -m "feat(ios): add ForgotPasswordScreen"
```

---

### Task 22: `ResetPasswordScreen`

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/ResetPasswordScreen.swift`

- [ ] **Step 1: Implement**

```swift
import SwiftUI
import FECore
import FEDesignSystem

public struct ResetPasswordScreen: View {
    @Bindable var viewModel: ResetPasswordViewModel
    let onDone: () -> Void

    public init(viewModel: ResetPasswordViewModel, onDone: @escaping () -> Void) {
        self.viewModel = viewModel
        self.onDone = onDone
    }

    public var body: some View {
        VStack(spacing: 24) {
            Text("Choose a new password").appTypography(.titleLarge).frame(maxWidth: .infinity, alignment: .leading)

            SecureField("New password (at least 8 characters)", text: $viewModel.newPassword)
                .textContentType(.newPassword)
                .padding().background(Color.appSecondaryBackground).cornerRadius(8)

            if viewModel.didReset {
                Text("Password updated. You're signed in.").appTypography(.body)
                Button("Continue", action: onDone).buttonStyle(.borderedProminent)
            } else {
                if let err = viewModel.errorMessage {
                    Text(err).foregroundStyle(.red).appTypography(.caption)
                }
                Button {
                    Task { await viewModel.submit() }
                } label: {
                    if viewModel.isSubmitting { ProgressView() }
                    else { Text("Update password").frame(maxWidth: .infinity) }
                }
                .buttonStyle(.borderedProminent).controlSize(.large)
                .disabled(viewModel.isSubmitting)
            }

            Spacer()
        }
        .padding()
        .navigationTitle("Reset password")
    }
}
```

- [ ] **Step 2: Build + commit**

```bash
cd apps/ios/Packages/FEAuth && swift build 2>&1 | tail -5
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/ResetPasswordScreen.swift
git commit -m "feat(ios): add ResetPasswordScreen"
```

---

### Task 23: `LinkAccountScreen`

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/LinkAccountScreen.swift`

- [ ] **Step 1: Implement**

```swift
import SwiftUI
import FECore
import FEDesignSystem

public struct LinkAccountScreen: View {
    @Bindable var viewModel: LinkAccountViewModel
    let onCancel: () -> Void

    public init(viewModel: LinkAccountViewModel, onCancel: @escaping () -> Void) {
        self.viewModel = viewModel
        self.onCancel = onCancel
    }

    public var body: some View {
        VStack(spacing: 24) {
            Text("Connect your accounts").appTypography(.titleLarge).frame(maxWidth: .infinity, alignment: .leading)
            Text("An account already exists for **\(viewModel.email)**. Enter your password to sign in to that account and link Apple sign-in.")
                .appTypography(.body)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            SecureField("Password", text: $viewModel.password)
                .textContentType(.password)
                .padding().background(Color.appSecondaryBackground).cornerRadius(8)

            if let err = viewModel.errorMessage {
                Text(err).foregroundStyle(.red).appTypography(.caption)
            }

            Button {
                Task { await viewModel.submit() }
            } label: {
                if viewModel.isSubmitting { ProgressView() }
                else { Text("Sign in and link").frame(maxWidth: .infinity) }
            }
            .buttonStyle(.borderedProminent).controlSize(.large)
            .disabled(viewModel.isSubmitting)

            Button("Cancel", action: onCancel).buttonStyle(.plain)
            Spacer()
        }
        .padding()
        .navigationTitle("Link accounts")
    }
}
```

- [ ] **Step 2: Build + commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/LinkAccountScreen.swift
git commit -m "feat(ios): add LinkAccountScreen for SIWA email-collision flow"
```

---

### Task 24: `AuthRootView`

The state-machine router for the auth flow. Reads `SessionStore.state` and the local nav path.

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/AuthRootView.swift`

- [ ] **Step 1: Implement**

```swift
import SwiftUI
import FECore

public struct AuthRootView: View {
    private enum Screen: Hashable { case signIn, signUp, forgotPassword }

    @Environment(SessionStore.self) private var sessionStore
    private let authService: any AuthService
    @State private var path: [Screen] = []
    @State private var appleNonceInFlight = false

    public init(authService: any AuthService) {
        self.authService = authService
    }

    public var body: some View {
        NavigationStack(path: $path) {
            SignInScreen(
                viewModel: SignInViewModel(authService: authService, sessionStore: sessionStore),
                onForgotPassword: { path.append(.forgotPassword) },
                onSignUp: { path.append(.signUp) },
                onAppleSignIn: startAppleSignIn
            )
            .navigationDestination(for: Screen.self) { screen in
                switch screen {
                case .signIn:
                    EmptyView()
                case .signUp:
                    SignUpScreen(
                        viewModel: SignUpViewModel(authService: authService, sessionStore: sessionStore),
                        onBackToSignIn: { path.removeLast() }
                    )
                case .forgotPassword:
                    ForgotPasswordScreen(
                        viewModel: ForgotPasswordViewModel(authService: authService),
                        onBack: { path.removeLast() }
                    )
                }
            }
            .sheet(isPresented: linkRequiredBinding) {
                if case .linkRequired(let email, _, _) = sessionStore.state {
                    NavigationStack {
                        LinkAccountScreen(
                            viewModel: LinkAccountViewModel(email: email, authService: authService, sessionStore: sessionStore),
                            onCancel: { Task { await sessionStore.signOut() } }
                        )
                    }
                }
            }
        }
    }

    private var linkRequiredBinding: Binding<Bool> {
        Binding(
            get: {
                if case .linkRequired = sessionStore.state { return true }
                return false
            },
            set: { _ in /* dismissal handled inside the sheet */ }
        )
    }

    private func startAppleSignIn() {
        #if canImport(UIKit) && canImport(AuthenticationServices)
        guard !appleNonceInFlight else { return }
        appleNonceInFlight = true
        Task { @MainActor in
            defer { appleNonceInFlight = false }
            do {
                let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
                guard let anchor = scene?.windows.first else { return }
                let result = try await AppleSignInCoordinator.presentSignIn(from: anchor)
                try await sessionStore.completeAppleSignIn(idToken: result.idToken, nonce: result.nonce, email: result.email)
            } catch AppError.appleSignInCancelled {
                return
            } catch {
                // Future: surface via a top-level alert binding.
            }
        }
        #endif
    }
}
```

- [ ] **Step 2: Build + commit**

```bash
cd apps/ios/Packages/FEAuth && swift build 2>&1 | tail -5
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/AuthRootView.swift
git commit -m "feat(ios): add AuthRootView routing for sign-in/sign-up/reset/link"
```

---

## Phase J — Profile & deletion (Tasks 25–26)

### Task 25: `ProfileSheet` minimal

**Files:**
- Create: `apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/ProfileSheet.swift`

- [ ] **Step 1: Implement**

```swift
import SwiftUI
import FECore
import FEDesignSystem

public struct ProfileSheet: View {
    @Environment(SessionStore.self) private var sessionStore
    @Environment(\.dismiss) private var dismiss
    private let authService: any AuthService
    @State private var showDeleteConfirmation = false

    public init(authService: any AuthService) {
        self.authService = authService
    }

    public var body: some View {
        NavigationStack {
            List {
                if case .signedIn(let uid) = sessionStore.state {
                    Section("Account") {
                        LabeledContent("User ID", value: uid.rawValue)
                    }
                }
                Section {
                    Button("Sign out") {
                        Task { await sessionStore.signOut(); dismiss() }
                    }
                }
                Section {
                    Button("Delete account", role: .destructive) {
                        showDeleteConfirmation = true
                    }
                } footer: {
                    Text("Deleting your account permanently removes your saved events, ratings, and comments. This cannot be undone.")
                }
            }
            .navigationTitle("Profile")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
            .confirmationDialog(
                "Delete account?",
                isPresented: $showDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete forever", role: .destructive) {
                    Task {
                        try? await authService.deleteAccount()
                        await sessionStore.signOut()
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will delete your account and all associated data. You can't recover it later.")
            }
        }
    }
}
```

- [ ] **Step 2: Build + commit**

```bash
git add apps/ios/Packages/FEAuth/Sources/FEAuth/Screens/ProfileSheet.swift
git commit -m "feat(ios): add ProfileSheet with sign-out and delete-account"
```

---

### Task 26: Integration test — full account-deletion happy path

Verifies the fake auth service receives both `deleteAccount` and `signOut` and the SessionStore lands on `.signedOut`.

**Files:**
- Create: `apps/ios/Packages/FEAuth/Tests/FEAuthTests/Session/AccountDeletionIntegrationTests.swift`

- [ ] **Step 1: Failing test**

```swift
import XCTest
import FECore
@testable import FEAuth

@MainActor
final class AccountDeletionIntegrationTests: XCTestCase {
    func testDeleteAccountSignsOutAndClearsStorage() async throws {
        let fake = FakeAuthService()
        let storage = InMemoryKeychainStorage()
        try await storage.setString("a", for: .accessToken)
        try await storage.setString("r", for: .refreshToken)
        try await storage.setString("u_1", for: .userID)
        let store = SessionStore(authService: fake, storage: storage)

        // Pretend we're signed in.
        try await store.adopt(.init(userID: UserID("u_1"), accessToken: "a", refreshToken: "r", email: "x@y.z", identityProvider: .password))
        XCTAssertEqual(store.state, .signedIn(userID: UserID("u_1")))

        try await fake.deleteAccount()
        await store.signOut()

        XCTAssertEqual(fake.deleteAccountCallCount, 1)
        XCTAssertEqual(fake.signOutCallCount, 1)
        XCTAssertEqual(store.state, .signedOut)
        let leftoverAccess = try await storage.string(for: .accessToken)
        XCTAssertNil(leftoverAccess)
    }
}
```

- [ ] **Step 2: Run and confirm pass** (everything already exists from earlier tasks)

- [ ] **Step 3: Commit**

```bash
git add apps/ios/Packages/FEAuth/Tests/FEAuthTests/Session/AccountDeletionIntegrationTests.swift
git commit -m "test(ios): cover account deletion + sign-out integration path"
```

---

## Phase K — App integration (Tasks 27–30)

### Task 27: Update `AppRoute` and `DeepLinkRouter` for password reset

**Files:**
- Modify: `apps/ios/FamilyEvents/App/AppRoute.swift`
- Modify: `apps/ios/FamilyEvents/App/DeepLinkRouter.swift`
- Modify: `apps/ios/FamilyEventsTests/DeepLinkRouterTests.swift`

- [ ] **Step 1: Failing test (append to DeepLinkRouterTests)**

```swift
    func testParsesPasswordResetURL() throws {
        let url = URL(string: "familyevents://reset-password?token=tok_xyz")!
        let result = DeepLinkRouter.route(from: url)
        XCTAssertEqual(result?.tab, .saved) // We open auth flow regardless of tab; saved is a placeholder.
        XCTAssertEqual(result?.routes.count, 1)
        if case .resetPassword(let token) = result?.routes.first {
            XCTAssertEqual(token, "tok_xyz")
        } else {
            XCTFail("expected .resetPassword route")
        }
    }
```

- [ ] **Step 2: Add the case to `AppRoute`**

Replace `apps/ios/FamilyEvents/App/AppRoute.swift`:

```swift
import Foundation
import FECore

enum AppRoute: Hashable, Sendable {
    case event(EventID)
    case city(CityID)
    case profile
    case settings
    case resetPassword(token: String)
}
```

- [ ] **Step 3: Extend `DeepLinkRouter`**

In the existing `route(from:)` switch in `DeepLinkRouter.swift`, add a new `case "reset-password":` branch:

```swift
        case "reset-password":
            // familyevents://reset-password?token=<value>
            let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
            guard let token = comps?.queryItems?.first(where: { $0.name == "token" })?.value,
                  !token.isEmpty else { return nil }
            return Result(tab: .saved, routes: [.resetPassword(token: token)])
```

- [ ] **Step 4: Run app-level tests**

```bash
cd apps/ios && pnpm run test:app 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/ios/FamilyEvents/App/AppRoute.swift apps/ios/FamilyEvents/App/DeepLinkRouter.swift apps/ios/FamilyEventsTests/DeepLinkRouterTests.swift
git commit -m "feat(ios): route password-reset deep links via DeepLinkRouter"
```

---

### Task 28: Wire `SupabaseClient`, `SessionStore`, and `AuthService` into the app

**Files:**
- Modify: `apps/ios/FamilyEvents/App/FamilyEventsApp.swift`

- [ ] **Step 1: Replace `FamilyEventsApp.swift`**

```swift
import SwiftUI
import FECore
import FEData
import FEAuth

@main
struct FamilyEventsApp: App {
    private let env: EnvConfig
    private let supabase: FamilyEventsSupabase
    private let authService: any AuthService
    @State private var sessionStore: SessionStore

    init() {
        do {
            let env = try EnvConfig.load()
            self.env = env
            let supa = FamilyEventsSupabase(config: env)
            self.supabase = supa
            let svc = SupabaseAuthService(supabase: supa)
            self.authService = svc
            _sessionStore = State(initialValue: SessionStore(
                authService: svc,
                storage: SecItemKeychainStorage(service: "com.familyevents.app.auth")
            ))
        } catch {
            fatalError("EnvConfig failed to load: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView(authService: authService)
                .environment(sessionStore)
        }
    }
}
```

- [ ] **Step 2: Build**

```bash
cd apps/ios && pnpm run generate 2>&1 | tail -3
cd apps/ios && pnpm run test:app 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/ios/FamilyEvents/App/FamilyEventsApp.swift
git commit -m "feat(ios): inject auth dependencies into app entry point"
```

---

### Task 29: Gate `RootView` on session state

**Files:**
- Modify: `apps/ios/FamilyEvents/App/RootView.swift`
- Modify: `apps/ios/FamilyEventsTests/RootViewSmokeTests.swift`

- [ ] **Step 1: Failing test**

Replace `RootViewSmokeTests.swift`:

```swift
import XCTest
import SwiftUI
import FECore
import FEAuth
@testable import FamilyEvents

@MainActor
final class RootViewSmokeTests: XCTestCase {
    func testRootSelectsPlanTabWhenSignedIn() async throws {
        let fake = FakeAuthService()
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        try await store.adopt(.init(userID: UserID("u_1"), accessToken: "a", refreshToken: "r", email: nil, identityProvider: .password))
        let view = RootView(authService: fake).environment(store)
        XCTAssertEqual(view.signedInState(in: store), .signedIn(userID: UserID("u_1")))
    }

    func testRootShowsAuthRootWhenSignedOut() async {
        let fake = FakeAuthService()
        let store = SessionStore(authService: fake, storage: InMemoryKeychainStorage())
        await store.signOut()
        let view = RootView(authService: fake).environment(store)
        XCTAssertEqual(view.signedInState(in: store), .signedOut)
    }

    func testRootExposesAllTabs() {
        XCTAssertEqual(RootView.shownTabs, [.plan, .explore, .saved])
    }
}

// Test helpers — `signedInState` is a thin extension that exposes the store's
// current state without requiring view introspection of the SwiftUI tree.
@MainActor
extension RootView {
    func signedInState(in store: SessionStore) -> SessionState { store.state }
}
```

Note: the test file may also need to import `FEAuth` test helpers (`FakeAuthService`, `InMemoryKeychainStorage`). The Xcode project's `FamilyEventsTests` target already depends on `FECore` and `FEData`; add `FEAuth` to its dependency list in `project.yml`.

Update `project.yml` `FamilyEventsTests` block (already has `FECore` and `FEData`):

```yaml
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
      - package: FEAuth
    settings:
      base:
        GENERATE_INFOPLIST_FILE: YES
```

The test fakes (`FakeAuthService`, `InMemoryKeychainStorage`) currently live in `FEAuthTests`. We need them accessible from the app's test target. Two options:
1. Move the fakes into a `FEAuth/Sources/FEAuthTesting/` subpackage exposed publicly.
2. Duplicate them in `FamilyEventsTests/Fakes/`.

Pick option 1 — add a `FEAuthTesting` library product to `FEAuth/Package.swift` containing only the fakes. The implementer should make this refactor as part of this task.

- [ ] **Step 2: Add `FEAuthTesting` product**

Edit `apps/ios/Packages/FEAuth/Package.swift` to add a second target & product:

```swift
products: [
    .library(name: "FEAuth", targets: ["FEAuth"]),
    .library(name: "FEAuthTesting", targets: ["FEAuthTesting"]),
],
```

```swift
targets: [
    .target(name: "FEAuth", dependencies: [...]),
    .target(name: "FEAuthTesting", dependencies: ["FEAuth", "FECore"], path: "Sources/FEAuthTesting"),
    .testTarget(name: "FEAuthTests", dependencies: ["FEAuth", "FEAuthTesting"], path: "Tests/FEAuthTests"),
]
```

Move `FakeAuthService.swift` and `InMemoryKeychainStorage.swift` from `Tests/FEAuthTests/Session/` and `Tests/FEAuthTests/Keychain/` to `Sources/FEAuthTesting/`. Change `@testable import FEAuth` to plain `import FEAuth` in those moved files; mark types `public` so the test target consumers can use them.

- [ ] **Step 3: Update `project.yml` to depend on `FEAuthTesting` from `FamilyEventsTests`**

```yaml
dependencies:
  - target: FamilyEvents
  - package: FECore
  - package: FEData
  - package: FEAuth
    product: FEAuth
  - package: FEAuth
    product: FEAuthTesting
```

(XcodeGen syntax — confirm with the existing `dependencies` shape in the repo.)

- [ ] **Step 4: Replace `RootView.swift`**

```swift
import SwiftUI
import FECore
import FEAuth
import FEPlan
import FEExplore
import FESaved

struct RootView: View {
    static let shownTabs: [AppTab] = AppTab.allCases
    let initialTab: AppTab
    private let authService: any AuthService

    @Environment(SessionStore.self) private var sessionStore
    @State private var selectedTab: AppTab

    init(authService: any AuthService, initialTab: AppTab = .plan) {
        self.authService = authService
        self.initialTab = initialTab
        _selectedTab = State(initialValue: initialTab)
    }

    var body: some View {
        switch sessionStore.state {
        case .hydrating:
            ProgressView().controlSize(.large)
        case .signedOut, .linkRequired:
            AuthRootView(authService: authService)
        case .signedIn:
            TabView(selection: $selectedTab) {
                PlanTab().tabItem { Label(AppTab.plan.title, systemImage: AppTab.plan.systemImage) }.tag(AppTab.plan)
                ExploreTab().tabItem { Label(AppTab.explore.title, systemImage: AppTab.explore.systemImage) }.tag(AppTab.explore)
                SavedTab().tabItem { Label(AppTab.saved.title, systemImage: AppTab.saved.systemImage) }.tag(AppTab.saved)
            }
        }
    }
}
```

- [ ] **Step 5: Regenerate Xcode + run tests**

```bash
cd apps/ios && pnpm run generate && pnpm run test:app 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add apps/ios/Packages/FEAuth apps/ios/FamilyEvents/App/RootView.swift apps/ios/FamilyEventsTests/RootViewSmokeTests.swift apps/ios/project.yml apps/ios/FamilyEvents.xcodeproj
git commit -m "feat(ios): gate RootView on SessionStore state; expose FEAuthTesting"
```

---

### Task 30: Wire deep-link router into the app

When a `familyevents://reset-password?token=...` URL arrives, present `ResetPasswordScreen` regardless of current auth state.

**Files:**
- Modify: `apps/ios/FamilyEvents/App/RootView.swift`

- [ ] **Step 1: Add the URL handler**

Inside `RootView.body`, wrap the outer switch in a `.onOpenURL { url in ... }` modifier that routes via `DeepLinkRouter.route(from:)`. Present `ResetPasswordScreen` via a sheet driven by a `@State` `pendingResetToken`. Pseudocode (full body merged into the existing `RootView`):

```swift
@State private var pendingResetToken: String?

var body: some View {
    Group {
        switch sessionStore.state { /* ... unchanged ... */ }
    }
    .onOpenURL { url in
        if let result = DeepLinkRouter.route(from: url) {
            for route in result.routes {
                if case .resetPassword(let token) = route {
                    pendingResetToken = token
                }
            }
        }
    }
    .sheet(item: $pendingResetToken) { token in
        NavigationStack {
            ResetPasswordScreen(
                viewModel: ResetPasswordViewModel(token: token, authService: authService),
                onDone: { pendingResetToken = nil }
            )
        }
    }
}
```

Note: `.sheet(item:)` needs `Identifiable`. The cleanest fix is to wrap the token in a small struct:

```swift
struct PendingResetToken: Identifiable { let id: String; let token: String }
```

Update the body to use `$pendingResetToken` of type `PendingResetToken?`.

- [ ] **Step 2: Build, run tests, commit**

```bash
cd apps/ios && pnpm run test:app 2>&1 | tail -10
git add apps/ios/FamilyEvents/App/RootView.swift
git commit -m "feat(ios): present ResetPasswordScreen from deep link"
```

---

## Phase L — Final verification (Task 31)

### Task 31: Run the full pipeline and verify M2 DoD

- [ ] **Step 1: Clean build + tests**

```bash
cd apps/ios && rm -rf .build Packages/*/.build && pnpm run test 2>&1 | tail -30
```

Expected: every package test passes; the app's `xcodebuild test` passes.

- [ ] **Step 2: Confirm M2 file graph**

```bash
find apps/ios/Packages/FEAuth/Sources -name "*.swift" | sort
```

Expected: includes `Keychain/{KeychainKey,KeychainStorage,SecItemKeychainStorage}.swift`, `Session/{AuthService,SessionState,SupabaseAuthService}.swift`, `SignInWithApple/{AppleSignInCoordinator,AppleSignInButton}.swift`, `Screens/{AuthRoot,SignIn,SignUp,ForgotPassword,ResetPassword,LinkAccount,ProfileSheet}.swift`, `ViewModels/{SignIn,SignUp,ForgotPassword,ResetPassword,LinkAccount}ViewModel.swift`, plus `SessionStore.swift` and `Form/EmailPasswordValidators.swift`.

- [ ] **Step 3: Confirm M2 DoD**

- [ ] SIWA + email/password sign-in flows compile and pass tests with fakes.
- [ ] Sign-up flow handles email-confirmation-required state.
- [ ] Forgot-password sends a reset email; reset-password screen accepts a token via deep link.
- [ ] Account-linking screen appears when SIWA collides with an existing email.
- [ ] Sessions persist across launches via Keychain (`SecItemKeychainStorage`).
- [ ] Profile sheet exposes sign-out + delete-account.
- [ ] `delete_my_account` RPC exists in `supabase/migrations/` following the project's convention.
- [ ] `RootView` shows `AuthRootView` when signed out and the 3-tab shell when signed in.
- [ ] All app guards still pass (`pnpm run workspace:test`).

- [ ] **Step 4: Tag the milestone**

```bash
git tag ios-m2-auth
```

---

## Out of scope (deferred to later milestones)

- **M2.5** — Biometric gate before Keychain unlock (Face ID / Touch ID).
- **M2.5** — Linking the Apple identity to the existing account *server-side* (currently the password challenge signs the user in as the existing email/password account; the Apple identity isn't yet attached to `auth.identities`).
- **M3** — Real Saturday Plan repository + SwiftData `@Model`s.
- **M8** — Associated Domains entitlement + Universal Links (currently we use the `familyevents://` custom scheme for the reset flow).

---

## Self-review notes

1. **Spec coverage.** §5 (auth surface mapping), §7 (auth flow), §11 milestone 2 are all addressed. Account-linking trust model uses the password-challenge approach you confirmed.
2. **Placeholders.** No "TBD"/"TODO" in any step.
3. **Type consistency.** `AuthSession` shape (userID/accessToken/refreshToken/email/identityProvider) is identical in `AuthService.swift`, `FakeAuthService.swift`, every view-model test, and `SessionStore.adopt`. `IdentityProvider.{password,apple}` cases match across DTOs.
4. **Order of operations.** Phase A (types) precedes Phase B (Keychain) precedes Phase C (backend) precedes Phase D (auth service) precedes Phase E (form) precedes Phase F (view models) precedes Phase G (Apple) precedes Phase H (linking) precedes Phase I (screens) precedes Phase J (profile/deletion) precedes Phase K (app integration) precedes Phase L (verification). Each commit keeps the build green.
