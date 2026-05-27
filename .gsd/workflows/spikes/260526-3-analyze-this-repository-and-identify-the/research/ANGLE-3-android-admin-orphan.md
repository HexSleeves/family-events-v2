# ANGLE 3 — `apps/android/admin/` is orphan code violating the "Android is consumer-only" scope policy

**Category:** cleanup / maintainability (with a real
compliance/scope-policy risk underneath — admin code is supposed to be
*structurally* prevented from shipping to Android).
**Confidence:** high — verified against git history,
`apps/android/settings.gradle.kts`, and `tests/guards/android-scope.test.mjs`.

## Finding

`apps/android/admin/` is a 4,406-line Kotlin module (`AdminScreen.kt`
alone is 1,968 lines, `SupabaseAdminApi.kt` is 1,161 lines) that is **not
part of the Android Gradle build**, but **still lives in the tree, still
gets touched by features commits, and partially escapes the very guard
test that was supposed to keep admin out of Android.**

The full picture from git:

1. The module was originally created when Android had admin support
   (`refactor(android): carve admin into separate :admin Gradle module`,
   commit `ae0ab59c`).
2. Then a deliberate scope-policy commit removed it from the build:

   ```
   refactor(admin): remove admin-related components and dependencies
   from the Android and iOS apps
     - Eliminated references to the admin module in Android's settings
       and build files, including the removal of the admin tab from the
       app's navigation.
     ...
   ```

   The diff dropped `":admin"` from `apps/android/settings.gradle.kts`.
3. **But the module's source tree was never deleted.** And a later
   commit `b6f2cbdc` —
   `feat(admin): enhance event management with city and tag functionalities` —
   re-touched files inside `apps/android/admin/` after that scope policy
   was supposedly enforced. So the orphan module is *both* dead (not
   compiled, not in `settings.gradle.kts`) *and* live (recent commits
   keep adding features to it).

`README.md` and `apps/android/AGENTS.md` both state the policy clearly:

> Consumer-only: Plan, Explore, Saved, Event Detail, Auth, Profile.
> Admin surfaces stay out of Android unless explicitly approved.

And `tests/guards/android-scope.test.mjs` enforces it at the
`ConsumerApiPath.kt` level (the test asserts `doesNotMatch(source, /admin/i)`).
That test catches the path-policy file but does **not** scan the rest of
the Android source tree, so 4.4 K LOC of admin code can sit untouched in
`apps/android/admin/` without ever tripping the guard.

This is a textbook scope-policy escape: there is a written rule, a guard
test, and a live violation that the guard doesn't see.

## Evidence

```
$ grep -c "admin" apps/android/settings.gradle.kts
0
$ grep -n "include" apps/android/settings.gradle.kts
23:include(
$ git log -p --since="2 months ago" apps/android/settings.gradle.kts | grep -A1 -B1 admin
     ":platform",
-    ":admin",
 )
```

```
$ git log --oneline -5 -- apps/android/admin/
b6f2cbdc feat(admin): enhance event management with city and tag functionalities   ← AFTER policy removal
ad2512df fix(android): keep Ktor imports inside :admin to satisfy boundary guard
fa3f9321 fix(android): address PR 25 review comments
00ce8ecb merge: resolve PR #25 vs main conflicts
ae0ab59c refactor(android): carve admin into separate :admin Gradle module
```

```
$ find apps/android/admin -name "*.kt" -not -path "*/build/*" | xargs wc -l | tail -1
    4406 total
```

```
$ cat tests/guards/android-scope.test.mjs | grep -A3 "android endpoint policy"
test("android endpoint policy is consumer-only", () => {
  const source = readFileSync(pathPolicyPath, "utf8")
  assert.doesNotMatch(source, /admin/i)
  assert.match(source, /Events/)
```

The guard reads exactly one file
(`apps/android/core/src/main/java/com/familyevents/core/ConsumerApiPath.kt`)
and asserts it does not mention admin. The `apps/android/admin/` directory
and its 1,161 lines of `SupabaseAdminApi.kt` referencing every admin
RPC endpoint are not scanned.

## Why it matters

Three concrete harms:

1. **Maintenance drag.** New engineers (and AI agents) reading the
   Android tree will see `apps/android/admin/AdminScreen.kt` and assume
   admin is in scope. The recent `feat(admin): enhance event management`
   commit confirms this is already happening — someone treated the
   orphan module as live code and added features to it.

2. **Latent compliance regression.** Re-adding `":admin"` to
   `settings.gradle.kts` is a one-line, easy-to-merge change. There is
   no guard that fails CI if anyone does so. The scope policy is held
   together by social convention, not a structural test.

3. **Stale, drifting API surface.** `SupabaseAdminApi.kt` (1,161 lines)
   pins URLs, payload shapes, and auth flows for admin RPCs. The
   server-side admin contract (in `supabase/migrations/` and
   `supabase/functions/admin-run-cron/`) is actively evolving (recent
   commit `feat(cron): add known railway cron labels and integrate into
   admin crons page` touched the admin side). The Android admin module
   will silently drift out of sync — and because it doesn't compile, no
   one will notice until someone tries to revive it for an internal
   tool, at which point it's a 4 K-line untangling job.

## Recommended fix

Pick one of two stances, then enforce it structurally — the current
limbo state is the worst option.

### Option A (recommended) — delete the module

1. `git rm -r apps/android/admin/`.
2. **Add a structural guard.** Extend
   `tests/guards/android-scope.test.mjs` with a new test that scans
   `apps/android/` for any subdirectory or path segment named `admin`
   and fails if one exists. Mirror the same guard for `apps/ios/` to
   cover the equivalent risk on the iOS side.
3. As a smaller related cleanup, remove the now-stale
   `(supabase as any).rpc(...)` casts in
   `apps/web/src/features/admin/api/ai-settings.ts` — the generated
   `packages/contracts/src/database.types.ts` already contains
   `get_approved_ai_models`, `ai_feature_config`, and
   `upsert_ai_feature_config`, so the `as any` is leftover from before
   `pnpm run db:types` was regenerated, and a future RPC rename will
   not be caught by `tsc`.
4. Also delete the stale "Decide fate of `useEvents` hook +
   `search_events` RPC" entry from `TODOS.md` Phase 2 — the hook is
   already gone from `apps/web/src/`, and the corresponding
   `search_events` RPC has been dropped per
   `supabase/migrations/.../drop_search_events_rpc.sql`.

### Option B — make admin officially supported on Android

1. Re-add `":admin"` to `settings.gradle.kts`.
2. Remove the consumer-only language from `README.md`, `AGENTS.md`,
   and the guard test.
3. Wire `apps/android/admin/` into the actual app build and ship it as
   an entitled feature.

I do not recommend B without a product decision — it directly
contradicts the existing iOS scope policy
(`EndpointPolicyTests` blocks admin on iOS), and asymmetric admin
between platforms is more confusing than no admin at all.

## Pros / cons / risks

**Pros (of Option A)**
- Eliminates 4.4 K LOC of orphan code in one commit.
- Closes the structural-policy hole (no admin path on Android without
  a CI failure).
- The cleanup propagates: it lets the next Android contributor work in
  a tree that matches the documented scope.

**Cons / risks**
- If there is an unstated plan to revive Android admin, deletion is
  destructive. Mitigation: confirm with the product owner that admin
  on Android is out of scope before deletion. If uncertain, the
  conservative variant is to move `apps/android/admin/` to an
  `archive/` branch and add the guard test now.
- The guard test will fail loudly on the same PR that deletes the
  module — make sure to land the deletion and the guard in the same
  commit.

## Estimated impact / effort

- **Impact:** medium. No immediate user-visible bug, but cleans up a
  scope-policy escape that is already being violated by passing
  commits, and removes a significant maintenance footprint from the
  Android tree.
- **Effort:** low. One `git rm`, one new ~30-line guard test, one
  small `ai-settings.ts` cleanup. A single PR.
