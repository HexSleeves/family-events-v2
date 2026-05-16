# family-events-ui

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:

- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

## Design System

Always read [`docs/DESIGN.md`](./docs/DESIGN.md) before making any visual or UI decisions.

All font choices, colors, spacing, radius, motion, and aesthetic direction are defined there. Do not deviate without explicit user approval.

Source of truth lives in `packages/design-system` (tokens) and is consumed by both `apps/web` and `apps/ios` via codegen. Web tokens generate CSS custom properties for Tailwind 4's `@theme`. iOS tokens generate Swift constants for `FEDesignSystem`.

Mockup reference: [`docs/design/mocks/design-preview.html`](./docs/design/mocks/design-preview.html).

In QA mode, flag any code that doesn't match DESIGN.md.

## Conventions

### New SECURITY DEFINER RPCs

Any new RPC that needs elevated privileges (bypass RLS, write to admin tables, etc.) MUST follow the **private body + public wrapper** pattern to keep Supabase advisor lints 0028/0029 clean.

1. Author the real function as `private.<name>` with `SECURITY DEFINER`. Grant EXECUTE on it to whichever roles legitimately reach the wrapper (typically `authenticated, service_role`; add `anon` only if the wrapper is anon-callable).
2. Author a thin `public.<name>` wrapper as `SECURITY INVOKER` whose body is `SELECT [* FROM] private.<name>(args);`. Preserve all default values on the wrapper so PostgREST clients calling with omitted optional args continue to work.
3. `REVOKE EXECUTE ON FUNCTION public.<name>(args) FROM PUBLIC, anon;` for admin-only RPCs. Anon-callable RPCs get default privs.

Reference migration: `supabase/migrations/20260601002100_wrap_security_definer_rpcs.sql`.

### Reading Supabase project URL / service-role key

Do not rely on `app.settings.*` GUCs in functions called from pg_cron or pg_net — Supabase Cloud blocks `ALTER DATABASE ... SET app.settings.*`, so the GUCs are NULL in hosted projects and the function silently no-ops. Always read from `vault.decrypted_secrets` first, then fall back to the GUC for local-dev parity. Reference: `private.dispatch_email_notification` in `supabase/migrations/20260601001700_url_from_vault_fallback.sql`.
