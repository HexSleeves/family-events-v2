import { useState } from "react"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

interface FavoriteButtonProps {
  eventId: string
  isFavorited: boolean
  onToggle?: (eventId: string, newState: boolean) => void
  size?: "sm" | "md"
  className?: string
  variant?: "overlay" | "inline"
}

export function FavoriteButton({
  eventId,
  isFavorited,
  onToggle,
  size = "md",
  className,
  variant = "inline",
}: FavoriteButtonProps) {
  const { user } = useAuth()
  const [optimistic, setOptimistic] = useState(isFavorited)
  const [loading, setLoading] = useState(false)

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      toast("Sign in to save events", {
        description: "Create a free account to save your favorites.",
      })
      return
    }

    setLoading(true)
    const newState = !optimistic
    setOptimistic(newState)
    onToggle?.(eventId, newState)

    try {
      if (newState) {
        toast.success("Event saved!", { description: "Added to your favorites." })
      } else {
        toast("Removed from favorites")
      }
    } finally {
      setLoading(false)
    }
  }

  if (variant === "overlay") {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        className={cn(
          "absolute top-3 right-3 z-10 flex items-center justify-center rounded-full",
          "bg-white/90 backdrop-blur-sm shadow-md transition-all hover:scale-110 active:scale-95",
          size === "sm" ? "h-7 w-7" : "h-9 w-9",
          className
        )}
        aria-label={optimistic ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart
          className={cn(
            "transition-colors",
            size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5",
            optimistic ? "fill-destructive stroke-destructive" : "stroke-muted-foreground"
          )}
        />
      </button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className={cn("gap-1.5", className)}
      aria-label={optimistic ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-colors",
          optimistic ? "fill-destructive stroke-destructive" : "stroke-current"
        )}
      />
    </Button>
  )
}
