# App Gatekeeping Design

## Goal

Ship the initial release as a closed product:

- only the public marketing page and auth pages are accessible without an account
- all product routes require an authenticated, enabled account
- invited users can sign up with any email address
- admins can disable accounts later
- disabled users are removed from the app immediately on next app load or protected request

## Scope

In scope:

- routing changes for public vs gated routes
- database-backed access control for app entry
- invite-code-based signup gating
- admin controls to disable or re-enable accounts
- immediate removal of disabled users from active sessions

Out of scope:

- full custom auth replacement
- moving the entire app behind server-rendered or proxy-only APIs
- a strict guarantee that no unauthorized `auth.users` row can ever be created through direct Supabase auth APIs

## Access Model

### Public routes

- `/` is the public marketing page
- `/sign-in` is public
- `/sign-up` is public

### Gated routes

Everything else is gated:

- `/explore`
- `/events/:id`
- `/map`
- `/calendar`
- `/saved`
- `/profile`
- `/admin`
- all admin child routes

### Account eligibility

A user may access the app only when all of the following are true:

- they have a valid Supabase session
- they have a corresponding access record in the database
- that access record is enabled

If any of these checks fail, the user is treated as blocked.

## Data Design

Add a `public.user_access` table with one row per user.

Suggested fields:

- `user_id uuid primary key references public.user_profiles(id) on delete cascade`
- `is_enabled boolean not null default true`
- `enabled_at timestamptz not null default now()`
- `disabled_at timestamptz`
- `disabled_reason text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Optional admin/audit extension if useful during implementation:

- `updated_by uuid references public.user_profiles(id) on delete set null`

## Invite Flow

### Desired behavior

Invite codes remain the onboarding mechanism for launch. A valid invite code allows signup with any email address.

### Flow

1. Client checks whether invites are required.
2. If invites are required, the user submits an invite code during signup.
3. The code is validated and consumed.
4. Signup proceeds.
5. The new user receives a `user_access` row with `is_enabled = true`.

### Important product rule

Invite codes do not merely unlock the UI. They must lead to a durable access row in the database. That row becomes the source of truth for app access after signup.

## Enforcement

### Frontend route enforcement

Introduce a route guard for all gated routes.

Behavior:

- unauthenticated user → redirect to `/sign-in`
- authenticated but disabled user → sign out immediately and redirect to `/sign-in`
- authenticated and enabled user → allow access

### Auth bootstrap enforcement

`AuthProvider` must no longer treat an existing session as sufficient. On initial load and auth-state changes, it must fetch both profile and access state.

If the access row is missing or disabled:

- clear in-memory auth state
- sign out through Supabase auth
- redirect away from gated pages

### Query-time enforcement

Protected screens should not rely only on route guards. If a user becomes disabled while already signed in, the next protected app load or protected data fetch must lead to sign-out.

## Admin Controls

Admins need the ability to:

- list accounts with access status
- disable an account
- re-enable an account
- optionally store a disable reason

Disabling an account does not delete the user. It only flips access state.

## Security Model

### RLS

Enable RLS on `public.user_access`.

Policies:

- normal authenticated users can read only their own row
- normal users cannot insert, update, or delete access rows
- admins can read and manage all access rows

### Invite code table

Keep the existing admin-only access model for `invite_codes`, with public redemption only through controlled RPCs.

### Known limitation

Because the app currently uses direct client-side `supabase.auth.signUp(...)`, a sufficiently determined caller may still be able to create an auth user outside the intended invite UX.

Launch target for this work is:

- no product access without an enabled `user_access` row

Not the stricter target:

- no `auth.users` creation without a trusted backend signup path

If stricter enforcement becomes necessary, the signup flow should later move behind a trusted server or Edge Function path.

## Failure Modes

### Invalid invite

- signup blocked
- clear error shown
- no access row created

### Invite redeemed but signup fails

- acceptable for launch even if the invite is effectively wasted
- simpler than adding compensation logic

### Missing access row after signup

- user is blocked from the app
- auth bootstrap signs them out

### Disabled active user

- user is removed on next app load or protected request
- no continued use of gated routes

### Admin disables self

- allowed
- admin loses access on the next enforcement check as well

## Testing Strategy

### Frontend tests

- gated route redirects unauthenticated users to `/sign-in`
- gated route ejects disabled users
- public routes remain reachable without auth
- signup enforces invite requirement when the setting is enabled

### Auth-state tests

- session + enabled access row → allowed
- session + missing access row → immediate sign-out
- session + disabled access row → immediate sign-out

### Admin tests

- admin can disable a user
- admin can re-enable a user
- non-admin cannot manage access rows

### Database verification

- RLS on `user_access` blocks normal users from administrative changes
- invite redemption still works only through the intended RPC path

## Implementation Notes

Recommended path:

1. add migration for `user_access` and policies
2. extend auth bootstrap to load and enforce access state
3. add route guards and public/gated route split
4. update signup to create or confirm the access row after invited signup
5. add admin account access management UI
6. add tests around routing, auth enforcement, and admin disable flow

## Success Criteria

The design is successful when:

- anonymous visitors can only access the marketing page and auth pages
- no product route renders without an enabled access row
- invited signup grants durable access
- admins can disable accounts without deleting them
- disabled users are forced out immediately on the next app load or protected request
