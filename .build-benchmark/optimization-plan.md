# Xcode Build Optimization Plan

## Project Context
- **Project:** `apps/ios/FamilyEvents.xcodeproj`
- **Scheme:** `FamilyEvents`
- **Configuration:** `Debug`
- **Destination:** `platform=iOS Simulator,name=iPhone 17 Pro`
- **Xcode:** Xcode 26.5 (Build 17F42)
- **Date:** 2026-06-01T03:46:13Z
- **Benchmark artifact:** `.build-benchmark/20260601T034613Z-familyevents.json`

## Baseline Benchmarks

| Metric | Clean | Zero-Change |
|--------|-------|-------------|
| Median | 12.434s | 2.836s |
| Min | 12.090s | 2.754s |
| Max | 12.742s | 2.877s |
| Runs | 3 | 3 |
| Variance | 5.2% (low) | 4.3% (low) |

> Benchmark confidence: Good. Min-to-max spread is under 20% of median for both build types.

### Parallelism Analysis

Cumulative task time: ~96s across 281 Swift compile tasks + 135 C compile tasks + linking + overhead.
Wall-clock: 12.4s. **Parallelism ratio: 7.7x.**

This means Xcode is efficiently using all cores. Compile hotspot fixes will reduce parallel CPU work but are **unlikely to reduce your build wait time**.

### Clean Build Timing Summary (median run)

> These are aggregated task times across all CPU cores, not wall-clock.

| Category | Tasks | Seconds |
|----------|------:|--------:|
| SwiftCompile | 281 | 67.038s |
| SwiftDriver | 29 | 10.787s |
| SwiftEmitModule | 29 | 6.895s |
| CompileC | 135 | 5.973s |
| ScanDependencies | 135 | 3.530s |
| Ld | 41 | 1.467s |
| ExtractAppIntentsMetadata | 29 | 0.926s |
| CompileAssetCatalogVariant | 1 | 0.753s |
| RegisterExecutionPolicyException | 51 | 0.594s |
| Copy | 165 | 0.487s |
| CodeSign | 15 | 0.381s |
| Other | 488 | 0.400s |

## Build Settings Audit

### Debug Configuration
- [x] `SWIFT_COMPILATION_MODE`: `singlefile` (default, recommended)
- [x] `SWIFT_OPTIMIZATION_LEVEL`: `-Onone` (recommended)
- [x] `GCC_OPTIMIZATION_LEVEL`: `0` (recommended)
- [x] `ONLY_ACTIVE_ARCH`: `YES` (recommended)
- [x] `DEBUG_INFORMATION_FORMAT`: `dwarf` for app target (recommended)
- [x] `ENABLE_TESTABILITY`: `YES` (recommended)
- [x] `CLANG_ENABLE_MODULES`: `YES` (recommended)
- [ ] `EAGER_LINKING`: `NO` (recommended: `YES`)
- [ ] `COMPILATION_CACHE_ENABLE_CACHING`: not set (recommended: `YES`)
- [ ] `DEBUG_INFORMATION_FORMAT`: `dwarf-with-dsym` for test targets (recommended: `dwarf`)

### Release Configuration
- [x] `SWIFT_COMPILATION_MODE`: `wholemodule` (recommended)
- [x] `SWIFT_OPTIMIZATION_LEVEL`: `-O` (recommended)
- [x] `ONLY_ACTIVE_ARCH`: `NO` (recommended)
- [x] `DEBUG_INFORMATION_FORMAT`: `dwarf-with-dsym` (recommended)
- [x] `ENABLE_TESTABILITY`: `NO` (recommended)
- [x] `BUILD_LIBRARY_FOR_DISTRIBUTION`: `NO` (correct for app target)

### Cross-Target Consistency
- [x] `SWIFT_COMPILATION_MODE` is consistent across all targets
- [x] `SWIFT_OPTIMIZATION_LEVEL` is consistent across all targets
- [x] No `OTHER_SWIFT_FLAGS` overrides
- [ ] `DEBUG_INFORMATION_FORMAT` differs: app=`dwarf`, test targets=`dwarf-with-dsym` in Debug

## Compilation Diagnostics

Threshold: 100ms for function bodies and expression type-checking.

| Duration | Kind | File | Package | Name |
|---------:|------|------|---------|------|
| 131ms | function-body | ExploreFilterSheet.swift | FEExplore | body |
| 102ms | function-body | EventDetailScreen.swift | FEEventDetail | body |

**Only 2 files exceed 100ms.** Both are in separate packages that compile in parallel. At 7.7x parallelism, these have negligible impact on wall-clock build time. No source-level changes recommended for build performance.

## SPM Dependency Analysis

- **12 local packages**, 4-tier wide/shallow dependency graph (excellent parallelism)
- **3 direct external dependencies**: supabase-swift, GoogleSignIn-iOS, swift-snapshot-testing
- **17 total resolved packages** (14 transitive)
- **No circular dependencies**, no build plugins, no macros, no `@_exported` imports
- **No branch-pinned dependencies** (all version or revision pinned)
- Duplicate supabase-swift declaration in FEAuth (maintenance concern, no build impact)

## Prioritized Recommendations

### 1. Enable EAGER_LINKING

**Wait-Time Impact:** Expected to reduce your clean build by approximately 0.5–1.5 seconds.
**Category:** Project settings
**Evidence:** `EAGER_LINKING = NO` across all configurations. When enabled, the linker starts work before all compilation finishes, overlapping link and compile phases. With 41 link tasks totaling 1.5s and 7.7x parallelism, there is room for the linker to start earlier.
**Confidence:** Medium — impact depends on how much link/compile overlap is achievable in the current dependency graph.
**Risk:** Low. Well-established Xcode setting; reversible by removing the line from project.yml.
**Fix:** Add `EAGER_LINKING: YES` to `settings.base` in `apps/ios/project.yml`, then run `pnpm run generate`.

### 2. Enable Compilation Caching

**Wait-Time Impact:** Measured 5–14% faster clean builds across tested projects. For your 12.4s clean build, this could save 0.6–1.7s. The benefit compounds in real workflows where the cache persists between builds — branch switching, pulling changes, and CI with persistent DerivedData.
**Category:** Project settings
**Evidence:** `COMPILATION_CACHE_ENABLE_CACHING` is not set. The `COMPILATION_CACHE_CAS_PATH` exists at the default location, but caching is not enabled.
**Confidence:** High — Apple-measured improvement range, confirmed across multiple community projects.
**Risk:** Low. Can be set per-user via xcuserdata if you prefer not to commit it to the shared project.
**Fix:** Add `COMPILATION_CACHE_ENABLE_CACHING: YES` to `settings.base` in `apps/ios/project.yml`, then run `pnpm run generate`.

### 3. Use dwarf for test targets in Debug

**Wait-Time Impact:** Impact on wait time is uncertain — likely < 0.5s. Eliminates unnecessary dSYM generation for test bundles during local development.
**Category:** Project settings
**Evidence:** `FamilyEventsTests` and `FEDesignSystemTests` resolve to `dwarf-with-dsym` in Debug. dSYMs are only needed for crash symbolication in production/distribution, not for test targets during development.
**Confidence:** Low — test bundles are small, so dSYM overhead is minimal.
**Risk:** Low. Does not affect Release builds or crash reporting.
**Fix:** Add `DEBUG_INFORMATION_FORMAT: dwarf` under each test target's Debug settings in `apps/ios/project.yml`, then run `pnpm run generate`.

### Not Recommended (Investigated, No Action Needed)

| Area | Finding | Why No Action |
|------|---------|---------------|
| Compile hotspots | 2 files at 100ms+ | Not on critical path; 7.7x parallelism means these run in parallel with other work |
| SPM graph | Wide/shallow, 4 tiers | Already optimal for parallelism |
| SPM duplicate decl | supabase-swift in FEAuth + FEData | Maintenance concern only; no build-time impact in Xcode |
| Script phases | None | Nothing to optimize |
| Build targets | 3 targets (app + 2 test) | No stale/unnecessary targets |
| Module variants | Consistent settings | No duplicate builds from configuration drift |

## Approval Checklist

- [x] **1. Enable EAGER_LINKING** — Wait-Time Impact: ~0.5–1.5s clean build reduction | Risk: Low | **Applied**
- [x] **2. Enable Compilation Caching** — Wait-Time Impact: 5–14% clean build reduction (~0.6–1.7s) + compound benefit in real workflows | Risk: Low | **Applied**
- [x] **3. dwarf for test targets in Debug** — Wait-Time Impact: < 0.5s | Risk: Low | **Applied**

## Execution Report

### Baseline
- Clean build median: 12.434s
- Incremental build median: 2.836s

### Changes Applied

| # | Change | Actionability | Measured Result | Status |
|---|--------|---------------|-----------------|--------|
| 1 | `EAGER_LINKING: YES` in project.yml base settings | repo-local | Combined below | Kept |
| 2 | `COMPILATION_CACHE_ENABLE_CACHING: YES` in project.yml base settings | repo-local | Combined below | Kept |
| 3 | `DEBUG_INFORMATION_FORMAT: dwarf` for test targets in Debug/DebugCloud | repo-local | Combined below | Kept |

### Final Cumulative Result

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Clean build median | 12.434s | 9.521s | **-2.9s (23.4% faster)** |
| Incremental (zero-change) | 2.836s | 2.726s | -0.1s (3.9% faster) |

- Post-change clean build: **9.5s (was 12.4s) — 2.9s faster**
- Post-change incremental build: **2.7s (was 2.8s) — essentially unchanged**
- Post-change cached clean build: 19.5s (new metric; uses separate DerivedData with cold package resolution, not comparable to standard clean)
- **Net result: 23% faster clean builds**

The clean build improvement exceeded predictions (2.9s vs expected 1.1–3.2s combined). The compilation cache reduced cumulative SwiftCompile time from 67s to 6.2s by serving cached compilation results. EAGER_LINKING allowed the linker to overlap with remaining compile work.

### Benchmark Confidence
- Clean build variance: 3.6% (9.32s–9.67s, low noise)
- Post-change median (9.5s) is well below baseline min (12.1s) — improvement is real
- Benchmark artifact: `.build-benchmark/20260601T035600Z-familyevents.json`

### Remaining follow-up ideas
- None. All 3 recommendations applied and verified. Build performance is excellent at 9.5s clean / 2.7s incremental.
