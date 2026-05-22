# Auth Email Hook Failure Runbook

## What the `notify-email` edge function does
Supabase auth hooks POST to `notify-email` for signup/confirmation events.
The function validates the payload, reads the Supabase URL from `vault.decrypted_secrets`
(with GUC fallback for local dev), and sends the email via the configured provider.

## Payload validation
The function validates: `user.email`, `email_data.token`, `email_data.token_hash`, `email_data.redirect_to`.
If any field is missing, it logs and returns 200 (to avoid Supabase auth retry loops).

## Diagnosing failures
1. Check Supabase edge function logs: `supabase functions logs notify-email`
2. For local testing: Inbucket is available at http://127.0.0.1:54324
3. Check vault has the URL secret: `SELECT name FROM vault.decrypted_secrets;`

## Vault fallback (20260601001700)
`private.dispatch_email_notification` reads URL from `vault.decrypted_secrets` first,
then falls back to `current_setting('app.settings.supabase_url', true)`.
On Supabase Cloud, GUC fallback returns NULL — the vault secret is required for production.
