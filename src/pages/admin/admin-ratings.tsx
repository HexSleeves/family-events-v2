import { useState } from "react"
import { Trash2 } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StarRating } from "@/components/star-rating"
import { toast } from "sonner"

const MOCK_RATINGS = [
  {
    id: "r1",
    user: "Maria T.",
    event: "Musical Storytime & Singalong",
    score: 5,
    date: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "r2",
    user: "James P.",
    event: "Sensory Storytime & Bubbles",
    score: 4,
    date: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: "r3",
    user: "Anonymous",
    event: "Tiny Explorers Tour",
    score: 1,
    date: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "r4",
    user: "Sarah H.",
    event: "Little Hands Pottery",
    score: 5,
    date: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: "r5",
    user: "Tom K.",
    event: "Messy Masterpieces",
    score: 3,
    date: new Date(Date.now() - 345600000).toISOString(),
  },
]

export function AdminRatingsPage() {
  const [ratings, setRatings] = useState(MOCK_RATINGS)

  function handleRemove(id: string) {
    setRatings((prev) => prev.filter((r) => r.id !== id))
    toast("Rating removed")
  }

  const avg =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length).toFixed(1)
      : "0"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Ratings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {ratings.length} ratings · {avg} avg
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {ratings.map((r) => (
          <Card key={r.id} className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs bg-muted">{r.user.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{r.user}</span>
                  <span className="text-xs text-muted-foreground truncate">on {r.event}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <StarRating value={r.score} readonly size="sm" />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(r.date), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => handleRemove(r.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
