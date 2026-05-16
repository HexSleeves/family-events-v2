# Design System — family-events

> A sunlit civic bulletin board for families. Tactile paper, local map logic, warm daylight, just enough playful color to feel kid-aware without becoming childish. Sunday morning at the kitchen table, planning a weekend that already feels handled.

## Product Context

- **What this is:** family-friendly event discovery — parents browse local events, filter by city / age / cost / weather, plan a weekend.
- **Who it's for:** parents and caregivers planning weekend activities with kids.
- **Space/industry:** consumer event-discovery, local/civic, family-lifestyle.
- **Project type:** monorepo with two consumer surfaces (web user app, iOS consumer app) + one operations surface (web admin). Both consumer surfaces share design tokens via `packages/design-system`. Admin is web-only.
- **Memorable thing (locked):** *this product knows my city, my neighborhood, and what my kids will like.*

Reference mockup: [`docs/design/mocks/design-preview.html`](./design/mocks/design-preview.html). Open in a browser.

## Aesthetic Direction

- **Direction:** Warm editorial-modern. Sunlit civic bulletin board.
- **Decoration level:** intentional — real city/event photos do the work. No decorative blobs, no purple gradients, no glowing "AI sparkle" icons, no decorative illustrations of generic kids.
- **Mood:** Sunday morning, weekend planning at the kitchen table. Calm and curated. Trustworthy, not promotional. Daylight, library board, school calendar, park district.
- **Reference posture:** Apartment Therapy meets a well-designed civic tool. Friend-curated, not algorithm-driven.

## Typography

Four families, four jobs.

| Role | Font | Why | Loading |
|---|---|---|---|
| Display (event titles, hero, section headers, app name) | **Fraunces** (variable serif, opsz + SOFT axes) | Warm literary tilt; carries the "someone thought about this" signal that Eventbrite/Partiful do not have. Weight 400–500, SOFT 60–80. | Google Fonts |
| UI / body (filters, cards, buttons, tab bar, labels) | **DM Sans** (humanist sans) | Clean and durable without the anonymous-tech-product feel of Inter. Free Söhne-analog. Weight 400–500. | Google Fonts |
| Editorial body (curator notes, "why this is good for your kids", source descriptions) | **Newsreader** (variable serif, opsz axis) | Locally-edited feel, distinct from Fraunces display. Italic at 14–18px reads like a magazine pull-quote. | Google Fonts |
| Data / tables / metadata (price, distance, age range, admin) | **Geist Mono** | Tabular numbers. Sets data apart from prose without shouting. | Google Fonts / self-hosted later |

Banned: Inter, Roboto, Arial, Helvetica, system-ui as display, Space Grotesk, Poppins, Montserrat. Avoid licensed Söhne / GT America / Reckless to keep tokens portable across web + iOS.

### Scale

Mobile / desktop in px (line-height in parens):

| Token | Mobile | Desktop | Use |
|---|---|---|---|
| `text-2xs` | 11 (1.4) | 11 (1.4) | mono captions, tiny eyebrows |
| `text-xs` | 12 (1.45) | 12 (1.45) | mono metadata |
| `text-sm` | 14 (1.5) | 14 (1.5) | helper text, pill labels |
| `text-base` | 16 (1.55) | 16 (1.55) | body — never smaller on mobile (iOS HIG) |
| `text-md` | 18 (1.5) | 20 (1.5) | editorial body |
| `text-lg` | 22 (1.3) | 26 (1.3) | secondary card titles |
| `text-xl` | 28 (1.15) | 34 (1.15) | hero card title |
| `text-2xl` | 36 (1.1) | 44 (1.1) | page title display |
| `text-3xl` | — | 60 (1.05) | marketing hero only |

Body baseline is 16px on mobile. Hero copy uses Fraunces at `clamp(28px, 4vw, 48px)`.

## Color

Primary mode: **light**. Dark mode: opt-in, warm-dark not pure-black. The pivot from the current dark+pink palette is intentional — the memorable-thing ("knows my neighborhood") does not serve party-energy.

### Semantic tokens (light)

| Token | oklch | hex | Use |
|---|---|---|---|
| `--bg` | `oklch(97.5% 0.018 88)` | `#FAF6EE` | warm paper bedrock |
| `--surface` | `#FFFFFF` | `#FFFFFF` | cards, sheets, admin panels |
| `--surface-raised` | `oklch(94.5% 0.025 88)` | `#F2EBDB` | elevated panels |
| `--text-primary` | `oklch(23% 0.025 78)` | `#2A2520` | warm charcoal — never `#000` |
| `--text-muted` | `oklch(50% 0.035 78)` | `#766A56` | secondary text |
| `--border` | `oklch(84% 0.035 82)` | `#D9CFB8` | hairlines |
| `--accent-primary` (neighborhood green) | `oklch(0.45 0.08 165)` | `#256F5D` | brand anchor — parks, trust, primary CTA |
| `--accent-primary-soft` | `oklch(0.93 0.04 165)` | `#DDEEE7` | pill background, hover tints |
| `--accent-secondary` (flyer coral) | `oklch(0.65 0.16 35)` | `#E36B3F` | save, plan, this-weekend actions |
| `--accent-secondary-soft` | `oklch(0.92 0.05 35)` | `#FAE0D2` | action chip background |
| `--accent-tertiary` (civic blue) | `oklch(0.56 0.10 245)` | `#3B75AF` | location, distance, admin states, source credibility |
| `--accent-tertiary-soft` | `oklch(0.93 0.03 240)` | `#DDE9F4` | location-band background |
| `--accent-kid` (school-bus yellow) | `oklch(0.83 0.16 90)` | `#F2C94C` | kid-affordances only — age-fit, free, stroller, indoor-backup |
| `--accent-kid-soft` | `oklch(0.93 0.06 90)` | `#FBEBB8` | pill background |

### Semantic feedback colors

| Token | hex | Use |
|---|---|---|
| `--success` | `#2E7D5B` | confirmed states |
| `--warning` | `#B7791F` | rain forecast, soft warnings |
| `--error` | `#B94A48` | destructive, validation fails |
| `--info` | `#3B75AF` | informational (same hue as tertiary) |

### Dark mode (opt-in)

| Token | oklch | hex |
|---|---|---|
| `--bg` | `oklch(18% 0.015 60)` | warm dark, never pure black |
| `--surface` | `oklch(22% 0.018 60)` |  |
| `--surface-raised` | `oklch(26% 0.02 60)` |  |
| `--text-primary` | `oklch(94% 0.012 78)` | warm off-white |
| `--text-muted` | `oklch(70% 0.02 78)` |  |
| `--border` | `oklch(34% 0.02 70)` |  |
| `--accent-primary` | `#4DA38D` | lightened green |
| `--accent-secondary` | `#F08A60` | lightened coral |
| `--accent-tertiary` | `#6FA0D3` | lightened blue |
| `--accent-kid` | `#F2C94C` | unchanged — high contrast on warm dark |

Dark-mode rule: preserve warmth. Reduce chroma 10–20%, never desaturate to gray.

### Color usage rules

- Neighborhood green is the **brand anchor**. Use it for primary CTAs, active states, and the brand mark.
- Coral is the **action color**. Use it for Save / Plan / This Weekend / RSVP. Never for navigation or destructive.
- Civic blue is **location and credibility**. Use it for distance pills, source attribution, admin pagination, and `info` semantic states.
- School-bus yellow is **kid-affordances only**. Use it on the small pills that signal "this fits my parenting context" — age range, free, stroller-friendly, indoor backup, bathroom on site. Do not use yellow for general accents.
- No purple gradients anywhere. No accent on accent (yellow text on green background, etc.).

## Spacing

Base unit: **4px**.

| Token | Mobile-tight default | Use |
|---|---|---|
| `space-1` | 4 | inline gap (icon + text) |
| `space-2` | 8 | pill internal padding |
| `space-3` | 12 | card internal sections |
| `space-4` | 16 | section gap, page padding |
| `space-5` | 24 | section gap (comfortable) |
| `space-6` | 32 | major section gap |
| `space-7` | 48 | hero margin |
| `space-8` | 64 | page-level rhythm |

**Density posture:** mobile-tight default (`space-3` between cards). Desktop steps up one (`space-4` to `space-5`). Admin is denser still — base spacing is `space-2` to `space-3` between rows.

**Touch target floor:** ≥44×44 px on every interactive element, enforced via a `TouchTarget` primitive. Visual size can be smaller — padding fills the rest.

**Safe area:** all sticky-bottom elements add `env(safe-area-inset-bottom)`. AppShell adds `viewport-fit=cover` in `index.html`.

## Layout

**Approach:** hybrid.

- **Consumer surfaces (user-facing web + iOS):** editorial-asymmetric on `lg+`, grid-disciplined at `sm`. Leads with one strong neighborhood-aware module ("This weekend near Logan Square"), then tight scannable event cards. Left-anchored composition. Never centered-everything.
- **Admin surfaces:** grid-disciplined always. Functional operations tool — source health, moderation, comments. Same tokens, denser spacing, less editorial framing.

**Max content width:**
- consumer pages: 1280px
- admin pages: 1440px

**Grid:** flexible — favor container queries over viewport breakpoints for component-level responsiveness. A card behaves the same in a 320px sidebar as on a 320px phone.

### Container-query breakpoints

| Token | min-width | Notes |
|---|---|---|
| `@xs` | 320px | iPhone SE width |
| `@sm` | 480px | larger phone |
| `@md` | 640px | small tablet / split view |
| `@lg` | 900px | tablet / desktop entry |
| `@xl` | 1200px | desktop comfortable |
| `@2xl` | 1440px | desktop wide |

Component primitives default to container-query variants. Only use viewport breakpoints for layout shell decisions (e.g., sidebar→sheet swap in `AdminShell`).

### Border radius

Radius is intentional, not bubble-everywhere.

| Token | px | Use |
|---|---|---|
| `radius-sm` | 6 | admin controls, dense buttons, input fields |
| `radius-md` | 8 | consumer event cards, secondary surfaces |
| `radius-lg` | 12 | mobile bottom sheets only, high-touch panels |
| `radius-full` | 9999 | pills, avatars, segmented toggles |

Primary CTA buttons use `radius-sm` (clearer geometry than pills). Filter chips use `radius-full`.

## Motion

**Approach:** intentional. Aids comprehension, never decoration.

| Token | Duration | Easing | Use |
|---|---|---|---|
| `motion-micro` | 100ms | `ease-out` | hover scale, focus ring |
| `motion-short` | 200ms | `ease-out` | page transition fade-rise, dropdown open |
| `motion-medium` | 320ms | `ease-in-out` | bottom-sheet rise, drawer slide |
| `motion-long` | 500ms | `ease-out` | first-paint hero reveal (rare) |

`prefers-reduced-motion: reduce` collapses all motion to instant. The existing `@/components/motion/*` wrappers already honor this — reuse them.

Card hover: `scale(1.02)` at `motion-micro`. No skeuomorphic press states. No decorative scroll animations.

## Iconography

- **Primary set:** `lucide-react` on web (already in use), SF Symbols on iOS.
- **Stroke width:** 1.5 (matches Fraunces letterform weight). Never 2px.
- **Size scale:** 14 / 16 / 18 / 20 / 22 / 24 px.
- Avoid filled icons except for active tab states and pill leading-icons.

## Surface-level parity (web ↔ iOS)

| Surface | Web behavior | iOS behavior |
|---|---|---|
| Bottom navigation | Custom 3-tab bar (Plan / Explore / Saved) using shared tokens | Native `TabView` with matching icon set + spacing tokens |
| Event card | Photo top, Fraunces title, DM Sans meta, yellow kid-affordance pills | Identical hierarchy, native `LazyVStack`, same tokens |
| Hero card | 16:9 photo, eyebrow + title + byline + CTAs | Identical with native AsyncImage + matched padding |
| Pull-to-refresh | `@/components/motion/RefreshControl` | Native `.refreshable` |
| Modals | Radix `Sheet` (bottom-up on mobile, dialog `md+`) | Native `.sheet` |

iOS owns native-rendering and gesture conventions; web mirrors the visual language. Tokens are the source of truth.

## Open decisions — resolved

1. **Light mode add/defer/skip?** → **Add, primary.** Most usage is daytime weekend-planning. Dark mode opt-in, warm-dark (not pure-black).
2. **Font family?** → **Pivot from system-ui** to Fraunces + DM Sans + Newsreader + Geist Mono. All free via Google Fonts. Self-host later via `packages/design-system` if license/perf warrants.
3. **Dark+pink palette stay or pivot?** → **PIVOT.** Hyper-local memorable-thing does not serve party-energy. New anchor: neighborhood green + coral + civic blue + school-bus yellow.
4. **iOS bottom-nav style?** → **Native `TabView` on iOS, matching custom web tab-bar.** Tokens share; rendering is native.
5. **Admin parity vs essentials on phone?** → **Full parity** per plan. Priority tier: read + light-write tier-1 on phone; bulk-edit operations tier-2 (acceptable to degrade to "open desktop" callout when the operation is destructive or multi-row).

## Differentiation (intentional risks)

These are the deliberate departures from category norms. Each gain has a named cost.

1. **Light primary + warm earthy palette.** Departure from current dark+pink and from category default (Eventbrite gray, Macaroni Kid blue-red, Partiful gradient).
  - **Gain:** weekend-morning vibe, immediate visual distinction in screenshots, "this is for me, not for an algorithm."
  - **Cost:** less "premium tech" read. We give up the OLED-black-glamour look.
2. **Fraunces serif for event titles.** Every competitor uses sans.
  - **Gain:** editorial credibility — "someone thought about this." Distinct first impression.
  - **Cost:** slightly slower scan than a sans body. Mitigated by sans body and short titles.
3. **School-bus yellow for kid-affordances.** No competitor has a dedicated kid-context layer.
  - **Gain:** the product owns a parent-specific decision layer. Age fit, stroller-friendly, indoor backup, free, walking distance — all visible at a glance.
  - **Cost:** visual minimalism. Parent planning needs useful density; we accept it.

## Anti-slop (hard rules)

- No purple/violet gradients.
- No 3-column icon grids as a hero.
- No centered-everything composition. User-facing surfaces are left-anchored editorial; admin is grid-disciplined.
- No bubble-radius on every element. Radius is intentional per token table above.
- No `system-ui` or `-apple-system` as display.
- No Inter, Roboto, Space Grotesk, Poppins, or Montserrat as primary type.
- No accent-on-accent (yellow text on green background, etc.).
- No "Built for X / Designed for Y" marketing copy patterns.
- No stock-photo hero sections. Photos must be real city / real activity or omitted.

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-16 | Initial design system created | Created by `/design-consultation` after researching family + event-discovery space (Partiful, Eventbrite, Mommy Poppins, Macaroni Kid) and synthesizing three voices (Claude main, Codex `gpt-5.5`, Claude subagent). Locked memorable-thing: "knows my city + neighborhood + kids." Pivoted from dark+pink (current) to warm light editorial. |
