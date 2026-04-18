import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const supabaseHost = (() => {
  try {
    return new URL(supabaseUrl).host.replace(/[^a-z0-9.-]/gi, "_")
  } catch {
    return "unknown"
  }
})()

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: `family-events-auth-${supabaseHost}`,
  },
})
