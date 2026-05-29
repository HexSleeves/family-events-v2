---
status: resolved
trigger: "Our emal system is non-functioning. No emails are sent or received"
created: 2026-05-29
updated: 2026-05-29
---

# Debug Session: emails-not-sent

## Symptoms

- Expected behavior: Welcome email should be sent when new users log in/sign up.
- Actual behavior: Login succeeds but no welcome email arrives.
- Error messages: User did not report UI errors. Live Supabase edge-function logs show `POST | 502 | .../functions/v1/notify-email` near the new `/signup` event at 2026-05-29T18:07:27Z.
- Timeline: Unknown from user.
- Reproduction: Production `family-events.org` sign-up/login using Supabase + Resend.

## Current Focus

- hypothesis: The welcome path reaches `notify-email`, but Resend rejects the welcome template send because the edge function posts an outdated template payload shape.
- test: Patch the Resend template request body from top-level `template_alias`/`variables` to documented `template: { id, variables }`, then run targeted checks and redeploy/observe logs.
- expecting: A welcome dispatch returns `200 {"sent":true,...}` instead of `502`.
- next_action: Run targeted type/check command and deploy the patched edge function.
- reasoning_checkpoint: Live evidence showed successful Supabase Auth `/signup`, deployed `notify-email`, and a matching `notify-email` 502. Repo evidence showed welcome emails are fired from `public.handle_new_user()` via `private.dispatch_email_notification()` and sent using `sendViaResendTemplate()`.
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-29T18:07:27Z
  observation: Supabase auth logs show `/signup` returned 200 for a new email user and immediate password login.
- timestamp: 2026-05-29T18:07:28Z
  observation: Supabase edge-function logs show `POST | 502 | https://ufrjcnozcapskjtoakvf.supabase.co/functions/v1/notify-email`.
- timestamp: 2026-05-29
  observation: `supabase/functions/notify-email/index.ts` sent welcome template payload as top-level `template_alias` and `variables`.
- timestamp: 2026-05-29
  observation: Resend template docs show transactional template sends use a nested `template` object with `id` and `variables`.
- timestamp: 2026-05-29
  observation: After deploy, a direct production smoke test against `notify-email` with `kind=welcome` returned `200 {"sent":true,...}`.

## Eliminated

- hypothesis: Login itself fails.
  result: Eliminated. Supabase Auth logs show successful login/signup.
- hypothesis: `notify-email` is not deployed.
  result: Eliminated. Supabase project lists active `notify-email` edge function.
- hypothesis: Welcome emails are expected on every existing-user login.
  result: Partially eliminated. Current repo implementation sends welcome only from the new `auth.users` trigger, not every login event.

## Resolution

- root_cause: The deployed welcome-email edge function sent Resend template requests with the old top-level `template_alias`/`variables` payload shape. Resend rejected the request, so `notify-email` returned 502 after new-user signup.
- fix: Changed `sendViaResendTemplate()` to send `template: { id, variables }`.
- verification: `deno check --config supabase/functions/deno.json supabase/functions/notify-email/index.ts`; deployed `notify-email`; direct production smoke test returned `200 {"sent":true,...}`.
- files_changed: `supabase/functions/notify-email/index.ts`
