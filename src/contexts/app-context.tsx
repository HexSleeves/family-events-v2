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
  const [selectedCityId, setSelectedCityId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null
    }

    return localStorage.getItem("family-events-city")
  })

  const selectedCity = useMemo(() => {
    if (cities.length === 0) {
      return null
    }

    return cities.find((city) => city.id === selectedCityId) ?? cities[0]
  }, [cities, selectedCityId])

  useEffect(() => {
    if (selectedCity?.id) {
      localStorage.setItem("family-events-city", selectedCity.id)
    } else {
      localStorage.removeItem("family-events-city")
    }
  }, [selectedCity])

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
