# Mobile Parity Matrix

Web is the product and behavior source of truth. iOS and Android must match the visible layout, token usage, data states, and role gates for each row before a row is considered ported.

| Area | Web source | iOS target | Android target | Acceptance |
| --- | --- | --- | --- | --- |
| Auth | Sign in, sign up, forgot/reset password, invite request | FEAuth screens | AuthScreen | Same validation, loading/error states, and reset-link handling |
| Plan | Saturday plan, weather strip, hero and thumb cards | FEPlan | PlanScreen | Same event ordering, imagery, refresh, city prompt, and empty states |
| Explore | Search, filters, list/map browsing | FEExplore | ExploreScreen | Same search/filter semantics and event-card anatomy |
| Map | Map view and event mini cards | FEExplore map surfaces | Explore/map surface | Same pins, selected event state, and fallback when location is unavailable |
| Calendar | Saved calendar events | Native calendar surface | Native calendar surface | Same add/remove state and signed-in requirement |
| Saved | Favorite list and profile entry | FESaved | SavedScreen | Same favorite sync, empty state, and profile CTA |
| Event detail | Hero, info grid, location, source, booking, reviews | FEEventDetail | EventDetailScreen | Same hero image/fallback, actions, ratings, comments, and source/location behavior |
| Public share | `/share/:eventId` preview | Deep link/event handoff | Deep link/event handoff | Shared links open the native event detail after auth resolution |
| Profile | Display name, city, child info, theme, password, delete | ProfileSheet | ProfileDialog | Same fields, role-safe behavior, and theme persistence |
| Admin dashboard | Stats, source health, review load | Admin tab | Admin tab | Admin-only visibility, same stats, and same failure states |
| Admin sources | Source list, runs, errors, run actions | Admin source section | Admin source section | Admin-only read/write actions with server role checks |
| Admin events | Search, facets, edit, publish/delete, locks | Admin event section | Admin event section | Same editable fields, validation, locking, and destructive confirmations |
| Admin cities | City list and activation | Admin city section | Admin city section | Same city state, timezone, and source coverage |
| Admin comments | Moderation queue | Admin comments section | Admin comments section | Same approve/flag/delete outcomes |
| Admin ratings | Rating review/delete | Admin ratings section | Admin ratings section | Same remove flow and event aggregates refresh |
| Admin access | User access and role | Admin access section | Admin access section | Same enabled/disabled and role-gated behavior |
| Admin invites | Requests, approval, code create/revoke | Admin invites section | Admin invites section | Plaintext code surfaced once and revoke state matches web |
| Admin logs | Source runs, tag queue, audit logs | Admin logs section | Admin logs section | Same sorting, error details, and retry affordances |
| Admin crons | Job list, history, run/toggle/schedule | Admin crons section | Admin crons section | Same run/toggle/schedule semantics and confirmation requirements |
| System shortcuts | N/A web route source | App Intents/App Shortcuts | Deep links/dynamic shortcuts | Consumer and admin shortcuts require auth and role checks for writes |
