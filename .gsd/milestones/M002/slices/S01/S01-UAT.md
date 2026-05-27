# S01: Two-Pass Unsplash Search with Test Coverage — UAT

**Milestone:** M002
**Written:** 2026-05-27T15:48:41.741Z

# UAT: Two-Pass Unsplash Image Search

## Test Scenarios

### Scenario 1: Activity-Specific Events Get Relevant Images

**Setup**: Deploy enrichment cron to production Railway service

**Test Cases**:

1. **Yoga/Outdoor Activity Event**
   - Find an event with title containing "Yoga in the Park", "Outdoor Yoga", or similar
   - Trigger enrichment (or wait for natural cron cycle)
   - **Expected**: Image shows yoga poses, outdoor fitness, or park yoga scenes
   - **Success Criteria**: Image is NOT a generic family portrait; image matches activity context

2. **Splash Park/Water Activity Event**
   - Find event with "Splash Park", "Water Play", or similar
   - Trigger enrichment
   - **Expected**: Image shows splash pads, water features, or kids in water play
   - **Success Criteria**: Image is NOT a generic park landscape; water activity visible

3. **Mom Walks / Walking Group Event**
   - Find event with "Mom Walks", "Walking Group", or similar
   - Trigger enrichment
   - **Expected**: Image shows walking trails, outdoor paths, or hiking scenes
   - **Success Criteria**: Image is NOT a generic family photo; trail/walking context clear

### Scenario 2: Obscure Terms Still Get Images via Fallback

**Test Cases**:

1. **Obscure Activity Term**
   - Find event with niche title like "Sensory Story Time", "STEM Challenge", or similar
   - Trigger enrichment
   - **Expected**: First pass (bare term) likely returns empty → second pass ("{term} family") succeeds
   - **Success Criteria**: Event gets an image (any image); no empty `images` field

2. **Check Logs for matchedTag**
   - Review enrichment logs after test events process
   - **Expected**: matchedTag shows bare term for Scenario 1 events, suffixed term for Scenario 2
   - **Success Criteria**: Logs confirm two-pass strategy is working as intended

### Scenario 3: No Rate Limit Warnings

**Test**:
- Monitor Railway logs for 24 hours after deploy
- **Expected**: No "429" HTTP errors or rate limit warnings in logs
- **Success Criteria**: Current usage (~2400 req/day) stays well under 5000 req/hr limit

## Pass/Fail Criteria

- ✅ **PASS** if:
  - 2/3 activity-specific events (Scenario 1) get contextually relevant images
  - Obscure events (Scenario 2) still get images via fallback
  - No rate-limit errors in 24hr monitoring window
  - matchedTag logs show expected bare vs suffix patterns

- ❌ **FAIL** if:
  - Activity events still get generic family portraits (two-pass not working)
  - Obscure events return null (fallback broken)
  - Rate limit warnings appear (API usage calculation wrong)

## Rollback Plan

If UAT fails:
1. Revert commit containing two-pass implementation
2. Redeploy previous version (always-suffixed queries)
3. File issue with UAT failure evidence (screenshots, logs, matchedTag samples)

