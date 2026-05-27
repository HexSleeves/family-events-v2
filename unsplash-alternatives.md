# Unsplash Alternatives for Event Image Fallback

## Summary

We're hitting Unsplash rate limits (50 requests/hour) during image enrichment. Better alternatives exist with 2-4x higher free limits and easier paths to unlimited access.

## Current Service: Unsplash

**Rate Limits:**

- Demo tier: **50 requests/hour** (~1,200/day)
- Production tier: 5,000 requests/hour (paid, pricing unclear)

**Pros:**

- High-quality curated photography
- Good search relevance
- Already integrated

**Cons:**

- ⚠️ Very restrictive free tier (50/hour)
- Must hotlink images (cannot download + cache)
- Stricter API attribution requirements

## Best Alternative: Pexels

**Rate Limits:**

- Default: **200 requests/hour** (4x Unsplash)
- Default: **20,000 requests/month** (~667/day)
- **FREE unlimited** - just email <api@pexels.com> with your use case + attribution

**Pros:**

- ✅ 4x higher free tier than Unsplash
- ✅ Easy path to unlimited (free, just requires proper attribution)
- ✅ Photos AND videos in one API
- ✅ Simpler integration (instant API key)
- ✅ Can download + cache images (24hr recommended)
- ✅ More lenient about attribution

**Cons:**

- Slightly less curated than Unsplash

**Integration:**

- API: `https://api.pexels.com/v1/search?query={term}`
- Auth: `Authorization: YOUR_API_KEY` header
- Response: Similar JSON structure to Unsplash
- Pagination: max 80 results per page

**Migration Effort:** Low - similar search API, just swap endpoint + auth header

## Second Alternative: Pixabay

**Rate Limits:**

- **100 requests per 60 seconds** (6,000/hour)
- **No monthly cap** on free tier

**Pros:**

- ✅ Highest free tier (100/min = 6,000/hour)
- ✅ Photos, illustrations, vectors, videos, music
- ✅ Very permissive license (CC0-like)
- ✅ MUST download + cache (not allowed to hotlink) - better for our use case
- ✅ Attribution appreciated but not required

**Cons:**

- Must cache responses for 24 hours (enforced)
- Max 500 images accessible per query
- API expects "cache-conscious client" behavior

**Integration:**

- API: `https://pixabay.com/api/?key={KEY}&q={term}`
- Auth: Query string `key` parameter
- Response: Similar JSON structure
- Requires 24hr caching (enforced by terms)

**Migration Effort:** Low - similar search API, need to add caching layer

## Recommendation

### Immediate Fix (This Week)

**Switch to Pexels:**

1. Get API key (instant)
2. Swap endpoint in `supabase/functions/_shared/unsplash.ts`
3. Test enrichment with 200/hour limit
4. Email <api@pexels.com> to request unlimited (show attribution)

**Why:** 4x immediate improvement, clear path to unlimited for free, minimal code changes.

### Long-term Solution (Next Sprint)

**Dual-provider fallback:**

1. Primary: Pexels (unlimited after approval)
2. Secondary: Pixabay (6,000/hour, download + cache)
3. Fallback chain: Pexels → Pixabay → placeholder

**Why:**

- Never hit rate limits (Pexels unlimited + Pixabay 6K/hour backup)
- Better image diversity (2 different stock sources)
- Pixabay requires download anyway - good for perf (self-hosted CDN)

## Cost Analysis

| Service | Free Tier | Paid Tier | Our Usage | Monthly Cost |
|---------|-----------|-----------|-----------|--------------|
| Unsplash | 50/hour | 5,000/hour (?) | ~100/hour (backfills) | Blocked |
| Pexels | 200/hour → unlimited (free) | N/A | ~100/hour | **$0** |
| Pixabay | 6,000/hour | N/A (free only) | Backup only | **$0** |

**Savings:** $0 → $0 but unblocked + 40-120x capacity increase
