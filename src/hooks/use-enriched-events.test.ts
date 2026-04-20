import { describe, expect, it } from "vitest"
import { adaptEnrichedRow } from "./use-enriched-events"

function baseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "evt-1",
    title: "Storytime",
    description: "Books + songs",
    start_datetime: "2026-05-01T15:00:00Z",
    end_datetime: null,
    timezone: "America/New_York",
    venue_name: "Library",
    address: "1 Main",
    city_id: "city-1",
    latitude: 42.36,
    longitude: -71.05,
    age_min: 0,
    age_max: 5,
    price: 0,
    is_free: true,
    source_url: null,
    source_name: null,
    source_id: null,
    images: [],
    status: "published",
    ai_confidence: null,
    ai_tag_provider: null,
    recurrence_info: null,
    is_featured: false,
    view_count: 0,
    search_vector: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    avg_rating: 0,
    rating_count: 0,
    tags: [],
    is_favorited: false,
    is_in_calendar: false,
    ...overrides,
  }
}

describe("adaptEnrichedRow", () => {
  it("defaults missing aggregates to safe values", () => {
    const result = adaptEnrichedRow(baseRow({ avg_rating: null, rating_count: null, tags: null }))
    expect(result.avg_rating).toBe(0)
    expect(result.rating_count).toBe(0)
    expect(result.tags).toEqual([])
  })

  it("coerces is_favorited / is_in_calendar to strict booleans", () => {
    const result = adaptEnrichedRow(baseRow({ is_favorited: null, is_in_calendar: undefined }))
    expect(result.is_favorited).toBe(false)
    expect(result.is_in_calendar).toBe(false)
  })

  it("adapts flat tag jsonb into the EventTag + Tag nested shape", () => {
    const result = adaptEnrichedRow(
      baseRow({
        tags: [
          { id: "tag-1", name: "Outdoor", slug: "outdoor", color: "#00ff00" },
          { id: "tag-2", name: "Free", slug: "free", color: "#0000ff" },
        ],
      })
    )

    expect(result.tags).toHaveLength(2)
    expect(result.tags?.[0]).toMatchObject({
      event_id: "evt-1",
      tag_id: "tag-1",
      tag: { id: "tag-1", name: "Outdoor", slug: "outdoor", color: "#00ff00" },
    })
  })

  it("drops malformed tag entries rather than throwing", () => {
    const result = adaptEnrichedRow(
      baseRow({
        tags: [
          { id: "tag-1", name: "Outdoor", slug: "outdoor", color: "#0f0" },
          null,
          "not-a-tag",
          { name: "no-id-field" },
        ],
      })
    )
    expect(result.tags).toHaveLength(1)
    expect(result.tags?.[0]?.tag_id).toBe("tag-1")
  })

  it("preserves ai_tag_provider so downstream consumers can read it", () => {
    const result = adaptEnrichedRow(baseRow({ ai_tag_provider: "openai" }))
    expect(result.ai_tag_provider).toBe("openai")
  })

  it("guarantees images is an array even if RPC hands back non-array json", () => {
    const result = adaptEnrichedRow(baseRow({ images: null }))
    expect(Array.isArray(result.images)).toBe(true)
    expect(result.images).toHaveLength(0)
  })
})
