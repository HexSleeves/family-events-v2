# Pexels/Pixabay Migration Checklist

## ✅ Completed

- [x] Create `stock-images.ts` with multi-provider abstraction
- [x] Update `backfill-event-enrichment/index.ts` to use new module
- [x] Add Pexels/Pixabay domains to image host allowlist
- [x] Create database migration for provider columns
- [x] Add tests for title search term extraction
- [x] Commit changes to `feat/pexels-pixabay-fallback` branch

## 🔲 Remaining Tasks

### 1. Get API Keys (5 min)

**Pexels:**
1. Visit https://www.pexels.com/api/
2. Sign up/login
3. Get API key (instant)
4. Note: 200 requests/hour default

**Pixabay:**
1. Visit https://pixabay.com/api/docs/
2. Sign up/login  
3. Get API key (instant)
4. Note: 100 requests/minute (6,000/hour)

### 2. Add Environment Variables (10 min)

**Local (.env.local):**
```bash
PEXELS_API_KEY=your_key_here
PIXABAY_API_KEY=your_key_here
# Keep existing:
UNSPLASH_ACCESS_KEY=existing_key
```

**Supabase Edge Functions:**
```bash
# Via Supabase Dashboard → Edge Functions → Configuration
PEXELS_API_KEY=your_key_here
PIXABAY_API_KEY=your_key_here
```

**Railway (if used):**
```bash
railway variables set PEXELS_API_KEY=your_key_here
railway variables set PIXABAY_API_KEY=your_key_here
```

### 3. Run Database Migration (5 min)

**Staging:**
```bash
supabase db push --db-url $STAGING_DATABASE_URL
```

**Production:**
```bash
supabase db push --db-url $PRODUCTION_DATABASE_URL
```

Or via Supabase Dashboard → Database → Migrations → Run migration.

### 4. Deploy Edge Functions (10 min)

```bash
# Deploy updated backfill function
supabase functions deploy backfill-event-enrichment

# Verify deployment
supabase functions list
```

### 5. Test Enrichment Flow (15 min)

**Find test events:**
```sql
SELECT event_id, title, images, needs_images_enrichment
FROM events  
WHERE needs_images_enrichment = true
  AND images IS NULL
LIMIT 5;
```

**Trigger backfill manually:**
```bash
curl -X POST \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  https://your-project.supabase.co/functions/v1/backfill-event-enrichment
```

**Check results:**
```sql
-- Verify images were added
SELECT event_id, title, images
FROM events
WHERE event_id IN (...test event IDs...);

-- Check provider distribution
SELECT provider, COUNT(*)
FROM event_image_attributions
WHERE created_at > now() - interval '1 hour'
GROUP BY provider;
```

**Expected results:**
- Most images should come from Pexels (first in fallback chain)
- Some from Pixabay if Pexels missed
- Very few from Unsplash (last resort)

### 6. Monitor Rate Limits (24 hours)

Check cron logs for rate limit headers:

```sql
SELECT created_at, data->'images_from_pexels' as pexels,
       data->'images_from_pixabay' as pixabay,
       data->'images_from_unsplash' as unsplash
FROM cron_run_events
WHERE function_name = 'backfill-event-enrichment'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

**Expected:**
- Pexels should handle ~90% of requests (until we hit 200/hr)
- Pixabay catches overflow (never hits 6K/hr limit)
- Unsplash rarely used (dramatic drop from current 50/hr bottleneck)

### 7. Request Pexels Unlimited Tier (After 1 Week Stable)

Email: api@pexels.com

**Subject:** Pexels API Unlimited Requests - Family Events Platform

**Body:**
```
Hi Pexels team,

I'm using the Pexels API for https://family-events.com, a platform that
helps families discover local activities and events.

Application details:
- Use case: Event image enrichment when scrapers can't extract images
- Current usage: ~100-150 requests/hour during enrichment backfills
- Attribution: We display photographer name + "Photos provided by Pexels"
  link on every event card that uses a Pexels image
- API integration: Using search endpoint with landscape orientation filter,
  showing random results to avoid repetition

Example attribution: [attach screenshot of event card showing Pexels credit]

We're currently hitting the 200/hour limit during backfill runs. Could you
please enable unlimited requests for our API key?

API Key: [your key]

Thank you!
[Your name]
```

## 📊 Success Metrics

**Before (Unsplash only):**
- 50 requests/hour limit
- ~100/hour needed during backfills
- Constant rate limit errors

**After (Pexels → Pixabay → Unsplash):**
- 200/hour immediate (Pexels)
- → Unlimited after approval (Pexels)
- + 6,000/hour backup (Pixabay)
- Never hit rate limits again ✅

## 🔄 Rollback Plan

If issues arise:

1. **Emergency rollback** (revert to Unsplash-only):
   ```bash
   git revert HEAD
   supabase functions deploy backfill-event-enrichment
   ```

2. **Partial rollback** (disable Pexels/Pixabay but keep code):
   ```bash
   # Remove API keys from environment
   # Unsplash will be used exclusively
   ```

3. **Database rollback** (if migration causes issues):
   ```sql
   -- Revert provider columns (only if no Pexels/Pixabay rows exist)
   ALTER TABLE event_image_attributions 
     DROP COLUMN IF EXISTS pexels_photo_id,
     DROP COLUMN IF EXISTS pexels_photographer_name,
     DROP COLUMN IF EXISTS pexels_photographer_profile_url,
     DROP COLUMN IF EXISTS pexels_photo_url,
     DROP COLUMN IF EXISTS pixabay_photo_id,
     DROP COLUMN IF EXISTS pixabay_photographer_name,
     DROP COLUMN IF EXISTS pixabay_photographer_username,
     DROP COLUMN IF EXISTS pixabay_photo_url;
   ```

## 📝 Notes

- Pexels/Pixabay images are downloaded and cached (better for CDN performance)
- Unsplash requires hotlinking (can't cache), so Pexels/Pixabay are better anyway
- Attribution requirements are simpler for Pexels/Pixabay
- Migration is backwards compatible - existing Unsplash attributions unchanged
