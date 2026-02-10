"use client"

import { useEffect, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale/de"
import { Loader2, Star, ThumbsUp, Search, ChevronLeft, ChevronRight } from "lucide-react"

import { getSellerReviews } from "@/lib/api/reviews"
import type { Review } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SortOption = "newest" | "oldest" | "highest" | "lowest"
type RatingFilter = "all" | 1 | 2 | 3 | 4 | 5

interface ReviewsSectionProps {
  sellerId?: number | null
  rating?: number | null
  totalReviews?: number | null
  itemTitle: string
  className?: string
}

const PAGE_SIZE = 25
const REVIEWS_PER_PAGE = 4

export function ReviewsSection({
  sellerId,
  rating,
  totalReviews,
  itemTitle,
  className,
}: ReviewsSectionProps) {
  const [allReviews, setAllReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>("newest")
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [fetchedTotal, setFetchedTotal] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showReviews, setShowReviews] = useState(true)

  useEffect(() => {
    setAllReviews([])
    setFetchedTotal(null)
    setCurrentPage(1)
    setShowReviews(true)
  }, [sellerId])

  useEffect(() => {
    if (!sellerId || typeof sellerId !== 'number') return

    let cancelled = false
    const currentSellerId = sellerId

    async function fetchAllReviews() {
      setLoading(true)
      setError(null)

      try {
        const aggregated: Review[] = []
        let page = 1
        let totalPages: number | undefined = 1

        while (!cancelled && (totalPages === undefined || (totalPages !== null && page <= totalPages))) {
          const response = await getSellerReviews(currentSellerId, { page, page_size: PAGE_SIZE })
          const items = response.items ?? []
          aggregated.push(...items)

          totalPages = response.total_pages ?? undefined
          setFetchedTotal(response.total ?? null)

          if (!totalPages || page >= totalPages || items.length === 0) {
            break
          }

          page += 1
        }

        if (!cancelled) {
          setAllReviews(aggregated)
        }
      } catch (fetchError) {
        console.error("Failed to load reviews", fetchError)
        if (!cancelled) {
          setError("Wir konnten die Bewertungen derzeit nicht laden. Bitte versuchen Sie es später erneut.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchAllReviews()

    return () => {
      cancelled = true
    }
  }, [sellerId])

  const effectiveTotalReviews = useMemo(() => {
    if (typeof totalReviews === "number" && totalReviews >= 0) {
      return totalReviews
    }
    if (typeof fetchedTotal === "number") {
      return fetchedTotal
    }
    return allReviews.length
  }, [allReviews.length, fetchedTotal, totalReviews])

  const derivedAverageRating = useMemo(() => {
    if (typeof rating === "number") {
      return rating
    }

    if (!allReviews.length) {
      return null
    }

    const sum = allReviews.reduce((acc, review) => acc + review.rating, 0)
    return sum / allReviews.length
  }, [allReviews, rating])

  const distribution = useMemo(() => {
    const totalCount = effectiveTotalReviews || 0
    return [5, 4, 3, 2, 1].map((stars) => {
      const count = allReviews.filter((review) => review.rating === stars).length
      const percentage = totalCount > 0 ? Math.min(100, (count / totalCount) * 100) : 0
      return { stars, count, percentage }
    })
  }, [allReviews, effectiveTotalReviews])

  const processedReviews = useMemo(() => {
    let reviews = [...allReviews]

    if (ratingFilter !== "all") {
      reviews = reviews.filter((review) => review.rating === ratingFilter)
    }

    if (searchTerm.trim()) {
      const query = searchTerm.trim().toLowerCase()
      reviews = reviews.filter((review) => review.text?.toLowerCase().includes(query))
    }

    reviews.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      switch (sortBy) {
        case "highest":
          return b.rating - a.rating || dateB - dateA
        case "lowest":
          return a.rating - b.rating || dateB - dateA
        case "oldest":
          return dateA - dateB
        case "newest":
        default:
          return dateB - dateA
      }
    })

    return reviews
  }, [allReviews, ratingFilter, searchTerm, sortBy])

  useEffect(() => {
    setCurrentPage(1)
  }, [ratingFilter, searchTerm, sortBy])

  const totalPages = Math.max(1, Math.ceil(processedReviews.length / REVIEWS_PER_PAGE))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * REVIEWS_PER_PAGE
    const end = start + REVIEWS_PER_PAGE
    return processedReviews.slice(start, end)
  }, [processedReviews, currentPage])

  if (!sellerId) {
    return null
  }

  return (
    <div className={cn("space-y-6 rounded-none border border-border/60 bg-background/60 p-6 backdrop-blur-sm", className)}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.55fr)_minmax(0,0.45fr)]">
        <Card className="border-none bg-transparent shadow-none">
          <CardContent className="p-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-4xl font-bold text-foreground">
                  {derivedAverageRating ? derivedAverageRating.toFixed(1) : "0.0"}
                  <span className="ml-1 text-base font-semibold text-muted-foreground">/ 5</span>
                </p>
                <div className="mt-2 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, index) => {
                    const filled = derivedAverageRating ? index < Math.round(derivedAverageRating) : false
                    return (
                      <Star
                        key={index}
                        className={cn(
                          "h-4 w-4",
                          filled ? "fill-yellow-500 text-yellow-500" : "text-border"
                        )}
                      />
                    )
                  })}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {effectiveTotalReviews} Bewertung{effectiveTotalReviews === 1 ? "" : "en"}
                </p>
              </div>

              <div className="flex-1 space-y-2">
                {distribution.map((item) => (
                  <div key={item.stars} className="flex items-center gap-3">
                    <span className="flex w-14 items-center gap-1 text-sm">
                      {item.stars}
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    </span>
                    <div className="relative h-2 flex-1 rounded-full bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-yellow-500 transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm text-muted-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3 rounded-md border border-border/60 bg-background/50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Bewertungen suchen"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full pl-9"
                />
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger size="medium" className="min-w-[9.5rem] justify-between">
                  <SelectValue placeholder="Sortieren nach" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Neueste</SelectItem>
                  <SelectItem value="oldest">Älteste</SelectItem>
                  <SelectItem value="highest">Höchste Bewertung</SelectItem>
                  <SelectItem value="lowest">Niedrigste Bewertung</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={String(ratingFilter)}
                onValueChange={(value) => {
                  if (value === "all") {
                    setRatingFilter("all")
                  } else {
                    setRatingFilter(Number(value) as RatingFilter)
                  }
                }}
              >
                <SelectTrigger size="medium" className="min-w-[8.5rem] justify-between">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="5">5 Sterne</SelectItem>
                  <SelectItem value="4">4 Sterne</SelectItem>
                  <SelectItem value="3">3 Sterne</SelectItem>
                  <SelectItem value="2">2 Sterne</SelectItem>
                  <SelectItem value="1">1 Stern</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {processedReviews.length
              ? `Zeige ${(currentPage - 1) * REVIEWS_PER_PAGE + paginatedReviews.length} von ${processedReviews.length} passenden Bewertungen`
              : "Keine Bewertungen entsprechen Ihren Filtern"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !showReviews ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShowReviews(true)}>
            Bewertungen
          </Button>
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : !allReviews.length ? (
        <div className="rounded-md border border-border/60 bg-background/40 p-8 text-center">
          <p className="text-base font-medium text-foreground">Noch keine Bewertungen</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Seien Sie der Erste, der Ihre Erfahrung mit {itemTitle} teilt.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {paginatedReviews.map((review) => (
            <Card key={review.id} className="border border-border/50 bg-background/60 shadow-none transition hover:border-primary/30">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={cn(
                            "h-4 w-4",
                            index < review.rating ? "fill-yellow-500 text-yellow-500" : "text-border"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Verifizierter Käufer
                    </span>
                  </div>

                  {review.text ? (
                    <p className="text-sm leading-relaxed text-foreground">{review.text}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Dieser Bewerter hat keine Kommentare hinterlassen.</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: de })}</span>
                    <span>&bull;</span>
                    <span>Bestellung #{review.order_id}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-primary"
                  aria-label="Bewertung als hilfreich markieren"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Hilfreich?
                </button>
              </CardContent>
            </Card>
          ))}

          <div className="flex flex-col gap-4">
            {processedReviews.length > REVIEWS_PER_PAGE && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-4 sm:flex-row">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Select
                    value={String(currentPage)}
                    onValueChange={(value) => setCurrentPage(Number(value))}
                  >
                    <SelectTrigger size="medium" className="min-w-[6.5rem] justify-between">
                      <SelectValue placeholder="Seite" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: totalPages }, (_, index) => (
                        <SelectItem key={index + 1} value={String(index + 1)}>
                          {index + 1} von {totalPages}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <Button variant="ghost" className="px-5" onClick={() => setShowReviews(false)}>
                  Bewertungen ausblenden
                </Button>
              </div>
            )}

            {processedReviews.length <= REVIEWS_PER_PAGE && (
              <div className="flex justify-center">
                <Button variant="ghost" className="px-5" onClick={() => setShowReviews(false)}>
                  Bewertungen ausblenden
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

