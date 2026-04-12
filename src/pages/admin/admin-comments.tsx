import { useState } from "react"
import { Check, Flag, Trash2, MessageSquare } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StarRating } from "@/components/star-rating"
import { toast } from "sonner"

const MOCK_COMMENTS = [
  {
    id: "c1",
    user: "Maria T.",
    event: "Musical Storytime & Singalong",
    body: "Our 3-year-old absolutely loved it! The instructor was so patient and creative.",
    rating: 5,
    date: new Date(Date.now() - 172800000).toISOString(),
    is_approved: true,
    is_flagged: false,
  },
  {
    id: "c2",
    user: "James P.",
    event: "Sensory Storytime & Bubbles",
    body: "Great way to spend a morning. Parking can be tricky so arrive early!",
    rating: 4,
    date: new Date(Date.now() - 604800000).toISOString(),
    is_approved: true,
    is_flagged: false,
  },
  {
    id: "c3",
    user: "Anonymous",
    event: "Tiny Explorers Tour",
    body: "This is spam content trying to sell products...",
    rating: 1,
    date: new Date(Date.now() - 86400000).toISOString(),
    is_approved: false,
    is_flagged: true,
  },
  {
    id: "c4",
    user: "Sarah H.",
    event: "Little Hands Pottery",
    body: "My daughter made the most adorable clay pot! We'll definitely come back.",
    rating: 5,
    date: new Date(Date.now() - 259200000).toISOString(),
    is_approved: true,
    is_flagged: false,
  },
]

export function AdminCommentsPage() {
  const [comments, setComments] = useState(MOCK_COMMENTS)

  function approve(id: string) {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_approved: true, is_flagged: false } : c))
    )
    toast.success("Comment approved")
  }

  function remove(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id))
    toast("Comment removed")
  }

  const flagged = comments.filter((c) => c.is_flagged)
  const approved = comments.filter((c) => c.is_approved && !c.is_flagged)
  const pending = comments.filter((c) => !c.is_approved && !c.is_flagged)

  function CommentCard({ c }: { c: (typeof comments)[0] }) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs bg-muted">{c.user.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{c.user}</span>
                <span className="text-xs text-muted-foreground">on</span>
                <span className="text-xs font-medium text-primary truncate">{c.event}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {format(new Date(c.date), "MMM d")}
                </span>
              </div>
              <StarRating value={c.rating} readonly size="sm" className="mt-0.5" />
              <p className="text-sm text-muted-foreground mt-1">{c.body}</p>
              <div className="flex items-center gap-2 mt-2">
                {c.is_flagged && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <Flag className="h-2.5 w-2.5" /> Flagged
                  </Badge>
                )}
                {!c.is_approved && !c.is_flagged && (
                  <Badge variant="outline" className="text-[10px]">
                    Pending
                  </Badge>
                )}
                {!c.is_approved && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1 text-green-600 hover:text-green-700"
                    onClick={() => approve(c.id)}
                  >
                    <Check className="h-3 w-3" /> Approve
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 text-destructive hover:text-destructive"
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold text-foreground">Comment Moderation</h1>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({comments.length})</TabsTrigger>
          <TabsTrigger value="flagged">
            Flagged{" "}
            {flagged.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-4 px-1.5 text-[10px]">
                {flagged.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
        </TabsList>

        {[
          { value: "all", list: comments },
          { value: "flagged", list: flagged },
          { value: "pending", list: pending },
          { value: "approved", list: approved },
        ].map(({ value, list }) => (
          <TabsContent key={value} value={value} className="mt-4 space-y-3">
            {list.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No comments here</p>
              </div>
            ) : (
              list.map((c) => <CommentCard key={c.id} c={c} />)
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
