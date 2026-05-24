import {
  Accessibility,
  Backpack,
  Clock,
  CloudSun,
  HeartHandshake,
  Info,
  Sparkles,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { type ParentTip } from "@/features/events/lib/parent-tips-fallback"

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  arrival: Clock,
  bring: Backpack,
  behavior: HeartHandshake,
  timing: Sparkles,
  weather: CloudSun,
  accessibility: Accessibility,
}

interface EventDetailAboutProps {
  description: string | null
  tips: ParentTip[]
}

export function EventDetailAbout({ description, tips }: EventDetailAboutProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-3">About the Experience</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

      {tips.length > 0 && (
        <div className="mt-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Parent Tips</p>
          </div>
          <ul className="space-y-2">
            {tips.map((tip, index) => {
              const Icon = CATEGORY_ICONS[tip.category] ?? Info
              return (
                <li
                  key={`${tip.category}-${index}`}
                  className="flex gap-2 text-xs text-blue-700 dark:text-blue-300 leading-relaxed"
                >
                  <Icon
                    className="size-3.5 mt-0.5 shrink-0 text-blue-500 dark:text-blue-400"
                    aria-hidden
                  />
                  <span>
                    <span className="sr-only">{tip.category}: </span>
                    {tip.text}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
