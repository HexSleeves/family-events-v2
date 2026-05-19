# OAuth Provider Setup — Apple & Google

This doc covers the **one-time provider setup** needed to make the
"Continue with Apple" / "Continue with Google" buttons work end-to-end.
Each platform (web / iOS / Android) consumes a subset of the same
credentials; this file is the canonical inventory.

## 1. Apple — Sign in with Apple

### Apple Developer Console

1. **Identifiers → App IDs** — ensure your iOS bundle ID (e.g. `app.familyevents.ios`)
   has "Sign In with Apple" capability enabled.
2. **Identifiers → Services IDs** — create a Services ID
   (e.g. `app.familyevents.signin`). Enable "Sign In with Apple" and configure:
   - **Primary App ID:** your iOS App ID
   - **Domains and Subdomains:** `family-events.up.railway.app`,
     plus your Supabase host (e.g. `<project>.supabase.co`).
   - **Return URLs:**
     - `https://family-events.up.railway.app/auth/callback`
     - `https://<project>.supabase.co/auth/v1/callback`
3. **Keys → All** — create an "Apple Sign in" key, download the `.p8` file.
   Record the Key ID and your Team ID.

### Supabase Dashboard → Authentication → Providers → Apple

- **Enabled:** on
- **Service ID:** the Services ID from step 2 (e.g. `app.familyevents.signin`)
- **Team ID:** your Apple Developer team ID (10-char alphanumeric)
- **Key ID:** from the `.p8` key
- **Secret Key (for OAuth):** paste the contents of the `.p8` file
  (Supabase computes the JWT secret server-side).

### Local development (supabase start)

The Apple `client_id` is hardcoded in `supabase/config.toml` (it is the
public Services ID — safe to commit and useful so `supabase config push`
doesn't clobber prod when an env var is missing locally). You only need
to set the secret:

```bash
SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=<JWT secret you generate from .p8 + key id + team id>
```

If you ever rotate the Services ID, edit `[auth.external.apple].client_id`
in `supabase/config.toml` directly.

## 2. Google — Sign in with Google

### Google Cloud Console → APIs & Services → Credentials

You need **three** OAuth 2.0 client IDs.

#### Web client (used by Supabase + web app)

- **Application type:** Web application
- **Authorized JavaScript origins:**
  - `https://family-events.up.railway.app`
  - `http://localhost:5173` (dev)
- **Authorized redirect URIs:**
  - `https://<project>.supabase.co/auth/v1/callback`
- Record **Client ID** and **Client Secret**.

#### iOS client (used by GoogleSignIn SDK on iOS)

- **Application type:** iOS
- **Bundle ID:** your iOS bundle (e.g. `app.familyevents.ios`)
- Record **Client ID** and **Reversed Client ID** (used as a URL scheme).

#### Android client (used by Credential Manager + signInWithIdToken)

- **Application type:** Android
- **Package name:** `com.familyevents.app`
- **SHA-1 certificate fingerprint:**
  - Debug: `./gradlew :app:signingReport` (look for the debug variant).
  - Release: from Play Console → App Signing.
- Record **Client ID**. (Android does not use a client secret.)

### Supabase Dashboard → Authentication → Providers → Google

- **Enabled:** on
- **Client ID (for OAuth):** the **web** client ID from above.
- **Client Secret (for OAuth):** the web client secret.
- **Skip nonce checks:** off (default).

### Local development

Set in `supabase/.env`:

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<web client id>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<web client secret>
```

## 3. Verifying

### Web

1. Start `supabase start` (or use hosted).
2. `pnpm --filter family-events-web dev`
3. Visit `/sign-in` → click "Continue with Apple" / "Continue with Google".
4. Provider consent screen should appear. After approval the browser bounces
   to `/auth/callback` then to `/`.

### iOS / Android

See platform-specific PRs (PR-I for iOS, PR-A for Android) — they consume
the Apple Services ID and the platform-specific Google client IDs.

## 4. Invite-only signup interaction

The current sign-up flow gates new account creation behind invite codes
(see `pending_invite_claims` + `redeem_invite_for_email`). OAuth providers
bypass this gate: a new Google/Apple account creates a Supabase user
without an invite claim.

**Follow-up work (out of scope for the initial PR):** add a
`auth.users` trigger that checks `pending_invite_claims` for new OAuth
signups and either (a) refuses creation when `invites_required = true`
and no claim exists, or (b) creates a "pending approval" flag that the
admin Invites Requests section can promote.
