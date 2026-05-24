# AI Model Config — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

## Problem

The active AI model for event tagging and LLM event review is hardcoded via Railway env vars (`AI_MODEL`, `LLM_REVIEW_MODEL`). Changing the model requires a Railway env var update and service restart. Admins need to switch models on the fly from the admin console without redeployment.

## Goals

1. Admin UI page to select active model per AI feature (tagging, event-review)
2. Approved models table seeded by migration — not CRUD in UI
3. Edge functions read active model from DB at request time
4. Env vars preserved as fallback for local dev
5. Prompt improvements: structured output schema, confidence calibration, tighter token budget
6. Prompt versioning so traces capture which prompt produced each classification

## Non-Goals

- CRUD management of approved models in UI (additions go through migration + code review)
- Changing provider base URL or API key from the UI
- Per-event or per-source model overrides

---

## DB Schema

### `approved_ai_models`

Seeded by migration. Read-only from the UI. Defines which models are selectable.

```sql
CREATE TABLE approved_ai_models (
  id           text PRIMARY KEY,        -- model string sent to API, e.g. "gpt-4o-mini"
  provider     text NOT NULL,           -- "openai" | "ollama" | "localai"
  display_name text NOT NULL,
  description  text NOT NULL DEFAULT '',
  cost_tier    text NOT NULL DEFAULT 'medium', -- "low" | "medium" | "high"
  is_enabled   bool NOT NULL DEFAULT true
);
```

**Initial seed:**

| id | provider | display_name | cost_tier | notes |
|----|----------|--------------|-----------|-------|
| `gpt-4.1-nano` | openai | GPT-4.1 Nano | low | Recommended default for tagging |
| `gpt-4o-mini` | openai | GPT-4o mini | low | Prior default, proven |
| `gpt-4.1-mini` | openai | GPT-4.1 mini | medium | Step up if nano quality insufficient |
| `gpt-4.1` | openai | GPT-4.1 | high | Recommended for event-review |
| `gpt-4o` | openai | GPT-4o | high | Premium fallback |
| `qwen3:1.7b` | ollama | Qwen3 1.7B (local) | low | Self-hosted default |
| `qwen3:4b` | ollama | Qwen3 4B (local) | medium | Higher-quality local |

### `ai_feature_config`

One row per AI feature. Admin-writable via RPC.

```sql
CREATE TABLE ai_feature_config (
  feature     text PRIMARY KEY,         -- "tagging" | "event-review"
  model_id    text NOT NULL REFERENCES approved_ai_models(id),
  enabled     bool NOT NULL DEFAULT true, -- meaningful for event-review
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id)
);
```

**Initial seed:**

| feature | model_id | enabled |
|---------|----------|---------|
| `tagging` | `gpt-4.1-nano` | true |
| `event-review` | `gpt-4.1` | false |

RLS: `authenticated` can SELECT. `upsert_ai_feature_config` RPC enforces admin-only writes.

---

## RPCs

Follow the **private body + public wrapper** pattern from AGENTS.md (lints 0028/0029).

### `public.get_ai_feature_configs()`

Returns joined rows: `ai_feature_config` + `approved_ai_models` fields. Callable by `authenticated`.

```sql
-- Returns: feature, model_id, enabled, updated_at, display_name, provider, cost_tier
SELECT * FROM private.get_ai_feature_configs();
```

### `public.upsert_ai_feature_config(p_feature text, p_model_id text, p_enabled bool)`

- Validates caller is admin (`auth.jwt() ->> 'role' = 'admin'`)
- Validates `p_model_id` exists in `approved_ai_models WHERE is_enabled = true`
- Validates `p_feature` IN ('tagging', 'event-review')
- Upserts `ai_feature_config`, sets `updated_by = auth.uid()`, `updated_at = now()`
- Admin-only: `REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role` + admin check inside body

### `public.get_approved_ai_models()`

Returns all `approved_ai_models WHERE is_enabled = true`, ordered by provider then cost_tier. Callable by `authenticated`.

---

## Edge Function Changes

### `tag-event/handler.ts`

Add `TAG_EVENT_PROMPT_VERSION = "v2"` constant (bumped from implicit v1).

Add `loadTagFeatureConfig(supabase)` helper:

```typescript
async function loadTagFeatureConfig(supabase: SupabaseClient): Promise<{ modelId: string; provider: string } | null> {
  const { data } = await supabase
    .rpc("get_ai_feature_configs")
    .eq("feature", "tagging")
    .maybeSingle();
  if (!data) return null;
  return { modelId: data.model_id, provider: data.provider };
}
```

Modify `resolveAiConfig()` to:
1. Accept optional `dbConfig: { modelId: string; provider: string } | null`
2. If `dbConfig` present → use `dbConfig.modelId` and `dbConfig.provider`
3. Else → fall back to `Deno.env.get("AI_MODEL")` / `Deno.env.get("AI_PROVIDER")` (preserves local dev)

`createTagEventHandler` calls `loadTagFeatureConfig(supabase)` after constructing the client, passes result into `resolveAiConfig`. The `ALLOWED_OPENAI_MODELS` Set is updated to include `gpt-4.1-nano`, `gpt-4.1-mini`, `gpt-4.1`.

Add `prompt_version` field to `event_ai_traces` insert so future traces capture which prompt was used.

### `event-review/config.ts`

Add `loadEventReviewFeatureConfig(supabase)` with the same pattern (`feature = 'event-review'`).

`resolveLlmReviewConfig()` gains an optional `dbConfig` parameter. If present, `dbConfig.modelId` overrides `LLM_REVIEW_MODEL` and `dbConfig.enabled` overrides `LLM_REVIEW_ENABLED`. Env vars remain fallback.

The calling handler constructs the Supabase client and passes the loaded config in.

---

## Prompt Improvements (tag-event)

### Change 1 — Structured output schema for OpenAI providers

Replace `response_format: { type: "json_object" }` with `response_format: { type: "json_schema", json_schema: { ... } }` when `config.provider === "openai"`. Ollama stays on `json_object` (limited structured output support).

The JSON schema mirrors the existing parsed shape: `tags[]`, `age_min`, `age_max`, `price`, `is_free`, `venue_name`, `reasoning_summary`.

### Change 2 — Confidence calibration instruction

Add to system prompt constraints:

> "Calibrate confidence honestly: 0.9+ = explicit evidence in text, 0.7–0.9 = strong implication, 0.5–0.7 = reasonable inference. Omit tags below 0.5 rather than guessing."

### Change 3 — Tighter token budget

- `reasoning_summary`: change from "one brief paragraph" → "one sentence, max 20 words"
- Per-tag `reason`: add "max 8 words"

### Prompt version

Add `TAG_EVENT_PROMPT_VERSION = "v2"` constant. Store in `event_ai_traces.prompt_version` column (new column, migration required). Enables comparison of classification quality across prompt versions.

---

## Admin UI

### Route

`/admin/settings` — added to `ADMIN_NAV` with `Settings` icon from lucide-react.

App.tsx: add `AdminSettingsPage` lazy import + `<Route path="settings" element={<AdminSettingsPage />} />` inside the admin route block.

### Page layout

Two cards stacked vertically (full-width on mobile, side-by-side at lg breakpoint):

**Event Tagging card**
- Header: "Event Tagging" + current model badge (provider · model name)
- Model dropdown: `approved_ai_models` grouped by provider, cost tier badge per option
- Description text for selected model
- Save button → `upsert_ai_feature_config('tagging', selectedModelId, true)`
- Footer: "Last updated [date] by [user]"

**Event Review card**
- Same model dropdown
- Enabled/disabled toggle (maps to `ai_feature_config.enabled`)
- Save button → `upsert_ai_feature_config('event-review', selectedModelId, enabled)`
- Footer: same last-updated line

### Web layer files

- `apps/web/src/features/admin/api/ai-settings.ts` — `getAiFeatureConfigs()`, `getApprovedModels()`, `upsertAiFeatureConfig()`
- `apps/web/src/features/admin/hooks/use-admin-ai-settings.ts` — TanStack Query hooks wrapping the API
- `apps/web/src/features/admin/pages/admin-settings.tsx` — page component
- `apps/web/src/features/admin/components/admin-settings-sections.tsx` — card components

Follows existing patterns: `api/crons.ts` → `hooks/operations/use-admin-crons.ts` → `pages/admin-crons.tsx`.

---

## Migration Plan

Single migration file: `YYYYMMDD_ai_model_config.sql`

1. Create `approved_ai_models` table
2. Seed approved models
3. Create `ai_feature_config` table
4. Seed initial feature rows
5. Add `prompt_version` column to `event_ai_traces`
6. Create `private.get_ai_feature_configs()` SECURITY DEFINER
7. Create `public.get_ai_feature_configs()` SECURITY INVOKER wrapper
8. Create `private.upsert_ai_feature_config(...)` SECURITY DEFINER
9. Create `public.upsert_ai_feature_config(...)` SECURITY INVOKER wrapper
10. Create `public.get_approved_ai_models()` SECURITY INVOKER (no private wrapper needed — no elevated privileges)
11. Grant EXECUTE + verify one-off SQL block per AGENTS.md pattern

---

## Security

- `upsert_ai_feature_config` validates admin role claim inside the private body — not just at RPC level
- `p_model_id` validated against `approved_ai_models` — no arbitrary model strings from UI reach the edge function
- Env var override path preserved: a compromised DB row cannot force an unapproved model because `ALLOWED_OPENAI_MODELS` Set in handler.ts remains as last-resort guard
- `updated_by` audit trail on every config change

---

## Open Questions

None. All design decisions resolved in session.
