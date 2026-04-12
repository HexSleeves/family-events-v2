import { createContext, useContext, useState, useEffect } from "react"
import type { City } from "@/lib/types"
import { MOCK_CITIES } from "@/lib/mock-data"

interface AppContextValue {
  selectedCity: City | null
  setSelectedCity: (city: City | null) => void
  cities: City[]
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [cities] = useState<City[]>(MOCK_CITIES)
  const [selectedCity, setSelectedCityState] = useState<City | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem("family-events-city")
    if (saved) {
      const city = MOCK_CITIES.find(c => c.id === saved)
      if (city) setSelectedCityState(city)
    } else {
      setSelectedCityState(MOCK_CITIES[0])
    }
  }, [])

  function setSelectedCity(city: City | null) {
    setSelectedCityState(city)
    if (city) localStorage.setItem("family-events-city", city.id)
  }

  return (
    <AppContext.Provider value={{ selectedCity, setSelectedCity, cities }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
