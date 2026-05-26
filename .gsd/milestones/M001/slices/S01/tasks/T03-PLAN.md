---
estimated_steps: 18
estimated_files: 4
skills_used: []
---

# T03: Created ExploreCategoryChipRow (4 category chips), added Age/Category sections to ExploreFilterSheet, added ageFilter/activeCategory dismissible chips to ExploreActiveFiltersBar, and wired ExploreCategoryChipRow into ExploreScreen between search bar and active filters bar.

**Why**: With the model (T01) and filter logic (T02) in place, this task closes R001/R002/R003 by wiring three visual surfaces: the inline category chip row (quick one-tap filter), the Age and Category sections in the filter sheet (full filter controls), and the dismissible chips in ExploreActiveFiltersBar (active filter state). All changes are additive — no existing sections are modified.

**Do**:
1. Create `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreCategoryChipRow.swift`:
   - `import SwiftUI; import FEDesignSystem`
   - `public struct ExploreCategoryChipRow: View` with `@Binding public var activeCategory: String?`
   - `public init(activeCategory: Binding<String?>) { _activeCategory = activeCategory }`
   - Private constant: `let categories: [(label: String, slug: String)] = [("Playgroups","playgroup"),("Music & Movement","music"),("Outdoor Fun","outdoor"),("Indoor Storytime","storytime")]`
   - Body: `ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 8) { ForEach(categories, id: \.slug) { cat in Button { activeCategory = (activeCategory == cat.slug) ? nil : cat.slug } label: { Text(cat.label).font(.subheadline).padding(.horizontal, 12).padding(.vertical, 6).background(activeCategory == cat.slug ? Color.dsAccentPrimarySoft : Color.secondary.opacity(0.1)).foregroundStyle(activeCategory == cat.slug ? Color.dsAccentPrimary : Color.primary).clipShape(Capsule()) } .buttonStyle(.plain) } }.padding(.horizontal, 16).padding(.vertical, 8) }`
   - Note: Use Color.dsAccentPrimarySoft and Color.dsAccentPrimary if they exist in FEDesignSystem; otherwise use Color.accentColor.opacity(0.15) and Color.accentColor for selected state.

2. In ExploreFilterSheet.swift: After the Price Section, append two new sections:
   - Age: `Section("Age") { Picker("Age", selection: $filters.ageFilter) { Text("Any age").tag(Optional<ExploreFilters.AgeFilter>.none); ForEach(ExploreFilters.AgeFilter.allCases, id: \.self) { af in Text(af.rawValue).tag(Optional(af)) } }.pickerStyle(.inline).labelsHidden() }`
   - Category: `Section("Category") { ForEach([("Playgroups","playgroup"),("Music & Movement","music"),("Outdoor Fun","outdoor"),("Indoor Storytime","storytime")], id: \.1) { label, slug in Button { filters.activeCategory = (filters.activeCategory == slug) ? nil : slug } label: { HStack { Text(label).foregroundStyle(.primary); Spacer(); if filters.activeCategory == slug { Image(systemName: "checkmark").foregroundStyle(Color.accentColor) } } } .buttonStyle(.plain) } }`

3. In ExploreActiveFiltersBar.swift: After the `onlyFree` chip block (still inside the HStack), add:
   - `if let af = filters.ageFilter { chip(label: af.rawValue) { filters.ageFilter = nil } }`
   - `if let slug = filters.activeCategory { chip(label: categoryLabel(for: slug)) { filters.activeCategory = nil } }`
   - Add private helper at bottom of the struct: `private func categoryLabel(for slug: String) -> String { switch slug { case "playgroup": return "Playgroups"; case "music": return "Music & Movement"; case "outdoor": return "Outdoor Fun"; case "storytime": return "Indoor Storytime"; default: return slug } }`

4. In ExploreScreen.swift: In the top `VStack(spacing: 0)`, insert `ExploreCategoryChipRow(activeCategory: $viewModel.filters.activeCategory)` between `ExploreSearchBar` and `ExploreActiveFiltersBar`. The VStack order becomes: ExploreSearchBar → ExploreCategoryChipRow → ExploreActiveFiltersBar.

**Done when**: ExploreCategoryChipRow.swift file exists with 4 category chips; ExploreScreen.swift references ExploreCategoryChipRow; ExploreFilterSheet.swift has Age and Category sections; ExploreActiveFiltersBar.swift emits chips for ageFilter and activeCategory.

## Inputs

- `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift`
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreFilterSheet.swift`
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreActiveFiltersBar.swift`
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Screens/ExploreScreen.swift`
- `apps/web/src/features/explore/constants/categories.ts`

## Expected Output

- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreCategoryChipRow.swift`
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreFilterSheet.swift`
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreActiveFiltersBar.swift`
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Screens/ExploreScreen.swift`

## Verification

test -f apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreCategoryChipRow.swift && grep -q "ExploreCategoryChipRow" apps/ios/Packages/FEExplore/Sources/FEExplore/Screens/ExploreScreen.swift && grep -q "ageFilter" apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreActiveFiltersBar.swift
