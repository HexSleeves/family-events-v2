import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { City } from "@/lib/types"
import { useCities } from "@/hooks/use-cities"

interface AppContextValue {
  selectedCity: City | null
  setSelectedCity: (city: City | null) => void
  cities: City[]
  isCitiesLoading: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: cities = [], isLoading: isCitiesLoading } = useCities()
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)

  useEffect(() => {
    if (cities.length === 0) {
      return
    }

    const savedCityId = localStorage.getItem("family-events-city")
    const hasSaved = savedCityId && cities.some((city) => city.id === savedCityId)

    setSelectedCityId((current) => {
      if (current && cities.some((city) => city.id === current)) {
        return current
      }
      return hasSaved ? savedCityId! : cities[0].id
    })
  }, [cities])

  useEffect(() => {
    if (selectedCityId) {
      localStorage.setItem("family-events-city", selectedCityId)
    } else {
      localStorage.removeItem("family-events-city")
    }
  }, [selectedCityId])

  const selectedCity = useMemo(
    () => cities.find((city) => city.id === selectedCityId) ?? null,
    [cities, selectedCityId]
  )

  function setSelectedCity(city: City | null) {
    setSelectedCityId(city?.id ?? null)
  }

  return (
    <AppContext.Provider value={{ selectedCity, setSelectedCity, cities, isCitiesLoading }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
