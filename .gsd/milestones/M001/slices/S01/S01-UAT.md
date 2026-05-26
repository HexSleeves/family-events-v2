# S01: iOS Explore Filter Parity — UAT

**Milestone:** M001
**Written:** 2026-05-26T16:47:34.117Z

# S01 UAT: iOS Explore Filter Parity

**UAT Type:** Manual functional verification on iOS Simulator or device  
**Preconditions:**
- Xcode project builds and runs on iOS 16+ simulator or device
- App connects to Supabase backend (or uses local seed data with events_enriched_v2 view)
- At least one event with `age_min`/`age_max` data and at least one event with a category tag are present in the data set

---

## Test Cases

### TC-01: Category chips render inline on Explore screen
**Steps:**
1. Launch app and navigate to Explore tab
2. Observe the area between the search bar and any existing filter chips

**Expected:** Four category chips are visible inline — Playgroups, Music, Outdoor, Storytime — in a horizontally scrollable row. No chip is selected by default.

---

### TC-02: Tapping a category chip filters the event list
**Steps:**
1. On Explore screen, tap the "Outdoor" category chip
2. Observe the event list below

**Expected:**
- "Outdoor" chip appears highlighted/selected (accent color)
- Event list narrows to show only events matching the "outdoor" category slug
- An active-filter chip for "Outdoor" appears in the active filters bar below the chip row

---

### TC-03: Active category chip is dismissible
**Steps:**
1. Select any category chip (e.g., "Music")
2. In the active filters bar, tap the × on the "Music" chip

**Expected:**
- The category filter is cleared
- The category chip row returns to unselected state
- The event list returns to the unfiltered result set

---

### TC-04: Filter sheet shows Age and Category sections
**Steps:**
1. Tap the filter icon to open the filter sheet

**Expected:**
- Filter sheet contains an "Age" section with a picker offering: Any age, 0–1 yr, 1–3 yrs, 2–4 yrs, 5–8 yrs, 9+
- Filter sheet contains a "Category" section with a checkmark list of the 4 categories
- Existing filter sections (e.g., Free only) remain present and functional

---

### TC-05: Age filter narrows event list
**Steps:**
1. Open filter sheet
2. Select "0–1 yr" from the Age picker
3. Apply/close the filter sheet

**Expected:**
- Event list shows only events whose age range overlaps with 0–1 yr (i.e., events where ageMax ≥ 0 and ageMin ≤ 1)
- Events with no age data (nil ageMin/ageMax) are excluded (ageMax ?? 99 >= 0 and ageMin ?? 0 <= 1 — nil-age events are included by default)
- An active-filter chip "0–1 yr" appears in the active filters bar

---

### TC-06: Age filter chip is dismissible
**Steps:**
1. Apply the "5–8 yrs" age filter
2. In the active filters bar, tap the × on the age chip

**Expected:**
- Age filter clears
- Event list returns to full unfiltered result (or filtered by remaining active filters)

---

### TC-07: Age and category filters combine correctly
**Steps:**
1. Select "1–3 yrs" age filter and "Music" category
2. Observe event list

**Expected:**
- Only events matching both age overlap AND "music" category slug appear
- Both active-filter chips are visible in the filters bar

---

### TC-08: EventDTO decodes v2 fields without crash
**Steps:**
1. Fetch events normally (any Explore search)
2. Observe that no crash occurs
3. (Optional) In Xcode network inspector, confirm RPC calls go to `events_enriched_v2`

**Expected:**
- App does not crash on event fetch
- Events with `is_outdoor: true` and `parent_tips` arrays decode silently without error
- Events missing those fields (older records) also decode without crash

---

## Edge Cases

- **No events match filter:** List shows empty state (zero results) — no crash, no stale data
- **Selecting same category chip twice:** Second tap deselects the chip (toggle behaviour) and clears the active filter
- **Switching from age filter to "Any age":** Clears the age constraint; list expands back

---

## Pass Criteria

All TC-01 through TC-08 pass without crash. Active filter chips correctly reflect selected state. Event list visibly narrows when filters are applied. App does not crash on v2 field decode (TC-08).

