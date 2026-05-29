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
SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=<JWT secret — see generation step below>
```

If you ever rotate the Services ID, edit `[auth.external.apple].client_id`
in `supabase/config.toml` directly.

#### Generating the Apple JWT secret

Apple's "secret" is a short-lived ES256 JWT signed with the `.p8` key. The
hosted Supabase project computes it server-side from the Team ID / Key ID /
Service ID / `.p8` fields you paste into the Dashboard, so for production
you do not run this command. For local `supabase start` you need to mint
the JWT yourself once:

```bash
# Using the supabase CLI's helper (preferred):
supabase gen apple-client-secret \
  --team-id "$APPLE_TEAM_ID" \
  --key-id "$APPLE_KEY_ID" \
  --service-id "com.familyevents.app" \
  --key-file "$HOME/.apple/AuthKey_$APPLE_KEY_ID.p8"
```

If your installed CLI doesn't ship that subcommand, the canonical
Node one-liner is in the Supabase docs at
<https://supabase.com/docs/guides/auth/social-login/auth-apple#generate-the-client-secret>.

The JWT expires every 6 months — re-mint and update
`SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` whenever local sign-in starts
returning `invalid_client`.

## 2. Google — Sign in with Google

### Google Auth Platform → Branding

This is production-critical, not cosmetic. If the OAuth client branding is
left at the default, Google can show the Supabase project host
(`ufrjcnozcapskjtoakvf.supabase.co`) as the app the user is signing in to.

- **App name:** `Family Events`
- **User support email:** an address monitored by the project owner.
- **App logo:** use `apps/web/public/brand/family-events-icon.png`.
- **Application home page:** `https://family-events.org`
- **Privacy Policy:** `https://family-events.org/privacy`
- **Terms of Service:** `https://family-events.org/terms`
- **Authorized domains:** `family-events.org`

Google brand verification can take a few business days. Until a Supabase
custom auth domain is active, the OAuth callback still uses the Supabase
project host, so the branding screen may retain some Supabase-host context.

### Google Cloud Console → APIs & Services → Credentials

You need **three** OAuth 2.0 client IDs.

#### Web client (used by Supabase + web app)

- **Application type:** Web application
- **Authorized JavaScript origins:**
  - `https://family-events.org`
  - `https://family-events.up.railway.app`
  - `http://localhost:5173` (dev)
- **Authorized redirect URIs:**
  - `https://ufrjcnozcapskjtoakvf.supabase.co/auth/v1/callback`
  - `http://127.0.0.1:54321/auth/v1/callback` (local Supabase)
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

### Optional: Supabase custom auth domain

The cleanest production consent screen uses an owned auth host such as
`auth.family-events.org` instead of the generated Supabase project host.
This requires the Supabase Custom Domain add-on and a DNS change.

```bash
supabase domains create --custom-hostname auth.family-events.org --project-ref ufrjcnozcapskjtoakvf
supabase domains get --project-ref ufrjcnozcapskjtoakvf
supabase domains activate --project-ref ufrjcnozcapskjtoakvf
```

After activation:

1. Add `https://auth.family-events.org/auth/v1/callback` to the Google web
   client's **Authorized redirect URIs**.
2. Update production `VITE_SUPABASE_URL` to `https://auth.family-events.org`.
3. Redeploy web and mobile clients that still point at the generated Supabase
   host. After activation, Supabase Auth no longer serves OAuth callbacks on
   the generated host.

### Local development

Set in `supabase/.env`:

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<web client id>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<web client secret>
```

## 3. Verifying

### Web

1. Start `supabase start` (or use hosted).
2. `pnpm --filter @family-events/web dev`
3. Visit `/sign-in` → click "Continue with Apple" / "Continue with Google".
4. Provider consent screen should appear. After approval the browser bounces
   to `/auth/callback` then to `/`.

### iOS / Android

See platform-specific PRs (PR-I for iOS, PR-A for Android) — they consume
the Apple Services ID and the platform-specific Google client IDs.

## 4. Invite-only signup interaction

Server-side enforcement is now handled by the
`private.enforce_invited_oauth_signup()` trigger on `auth.users`.

When `app.settings.require_invite = true`, new Google/Apple-created
`auth.users` rows require a live unclaimed `pending_invite_claims` row for the
OAuth email. Without that claim, the database rejects the insert before
`user_profiles` or `user_access` rows are provisioned.

Email/password signup keeps the existing flow: the client redeems an invite code
with `redeem_invite_for_email`, Supabase creates the auth user, and
`claim_pending_invite_access` enables access after sign-in.
