import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { PlanEventsRow } from "@/lib/db"
import { qk } from "@/lib/query-keys"
import { supabase } from "@/lib/supabase"
import type { City, EventWithDetails } from "@/lib/types"
import { adaptEnrichedRow } from "@/hooks/use-enriched-events"
import { useGeolocation } from "@/hooks/use-geolocation"
import type { WeatherSnapshot } from "@/hooks/use-weather"
import { useWeather } from "@/hooks/use-weather"

export interface PlannedEvent extends EventWithDetails {
  plan_score: number
  distance_score: number
  weather_score: number
  age_score: number
  history_affinity: number
  distance_km: number | null
}

export interface PlanForTodayResult {
  date: string | null
  dayOffset: number
  weatherFit: string
  weather: WeatherSnapshot | null
  events: PlannedEvent[]
  heroEvent: PlannedEvent | null
  secondaryEvents: PlannedEvent[]
  fallbackMessage: string | null
}

interface UsePlanForTodayOptions {
  userId?: string
  selectedCity?: City | null
  childAge?: number | null
  enabled?: boolean
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateKey: string, daysToAdd: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + daysToAdd)
  return date.toISOString().slice(0, 10)
}

function fallbackMessageForOffset(offset: number): string | null {
  if (offset === 0) {
    return null
  }
  if (offset === 1) {
    return "Nothing matched today. Tomorrow has the best fit."
  }
  return `Nothing matched today. Looking ${offset} days ahead.`
}

function emptyPlan(weatherFit: string, weather: WeatherSnapshot | null): PlanForTodayResult {
  return {
    date: null,
    dayOffset: 0,
    weatherFit,
    weather,
    events: [],
    heroEvent: null,
    secondaryEvents: [],
    fallbackMessage: "No family plans found in the next 7 days.",
  }
}

export function usePlanForToday(options: UsePlanForTodayOptions = {}) {
  const { userId, selectedCity, childAge, enabled = true } = options

  const geolocation = useGeolocation({ selectedCity, enabled })
  const weather = useWeather({
    latitude: geolocation.latitude,
    longitude: geolocation.longitude,
    enabled,
  })
  const weatherFit = weather.data?.weatherFit ?? "any"

  const [dateKey, setDateKey] = useState(() => todayDateKey())

  useEffect(() => {
    const interval = setInterval(() => {
      const nextDateKey = todayDateKey()
      setDateKey((currentDateKey) =>
        currentDateKey === nextDateKey ? currentDateKey : nextDateKey
      )
    }, 60_000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  return useQuery({
    queryKey: qk.saturdayPlan.byContext({
      userId,
      cityId: selectedCity?.id,
      childAge,
      latitude: geolocation.latitude,
      longitude: geolocation.longitude,
      weatherFit,
      dateKey,
    }),
    enabled: enabled && Boolean(userId),
    queryFn: async (): Promise<PlanForTodayResult> => {
      if (!userId) {
        return emptyPlan(weatherFit, weather.data ?? null)
      }

      // Weekly plan composition:
      //
      //   geo (browser -> city centroid fallback)
      //      + weather (OpenWeather -> "any" fallback)
      //      + history (favorites inside SQL)
      //      + date stretch (D+0..D+7)
      //                |
      //                v
      //         plan_events_for_user RPC
      //                |
      //                v
      //       events_enriched hydration -> hero + secondary cards
      //
      let selectedDate: string | null = null
      let selectedOffset = 0
      let rankedRows: PlanEventsRow[] = []

      for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
        const date = addDays(dateKey, dayOffset)
        const { data, error } = await supabase.rpc("plan_events_for_user", {
          p_user_id: userId,
          p_date: date,
          p_city_id: selectedCity?.id ?? undefined,
          p_lat: geolocation.latitude ?? undefined,
          p_lng: geolocation.longitude ?? undefined,
          p_kid_age: childAge ?? undefined,
          p_weather_fit: weatherFit,
          p_limit: 3,
        })

        if (error) {
          throw error
        }

        if ((data ?? []).length > 0) {
          selectedDate = date
          selectedOffset = dayOffset
          rankedRows = (data ?? []) as PlanEventsRow[]
          break
        }
      }

      if (!selectedDate || rankedRows.length === 0) {
        return emptyPlan(weatherFit, weather.data ?? null)
      }

      const eventIds = rankedRows.map((row) => row.event_id)
      const { data: eventRows, error: eventRowsError } = await supabase.rpc("events_enriched", {
        p_event_ids: eventIds,
        p_user_id: userId,
      })
      if (eventRowsError) {
        throw eventRowsError
      }

      const eventsById = new Map(
        (eventRows ?? []).map((row) => {
          const enrichedEvent = adaptEnrichedRow(row as Record<string, unknown>)
          return [enrichedEvent.id, enrichedEvent]
        })
      )

      const plannedEvents = rankedRows.reduce<PlannedEvent[]>((acc, row) => {
        const event = eventsById.get(row.event_id)
        if (!event) {
          return acc
        }

        acc.push({
          ...event,
          plan_score: row.score,
          distance_score: row.distance_score,
          weather_score: row.weather_score,
          age_score: row.age_score,
          history_affinity: row.history_affinity,
          distance_km: row.distance_km ?? null,
        })
        return acc
      }, [])

      return {
        date: selectedDate,
        dayOffset: selectedOffset,
        weatherFit,
        weather: weather.data ?? null,
        events: plannedEvents,
        heroEvent: plannedEvents[0] ?? null,
        secondaryEvents: plannedEvents.slice(1, 3),
        fallbackMessage: fallbackMessageForOffset(selectedOffset),
      }
    },
  })
}
