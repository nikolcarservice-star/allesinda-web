"use client"

import { useEffect, useState } from "react"
import { Star } from "lucide-react"
import { getSellerReviews } from "@/lib/api/reviews"
import type { Review } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface MasterFeaturedReviewProps {
  sellerId: number
  className?: string
}

export function MasterFeaturedReview({ sellerId, className }: MasterFeaturedReviewProps) {
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const response = await getSellerReviews(sellerId, { page: 1, page_size: 1 })
        if (!cancelled) {
          setReview(response.items?.[0] ?? null)
        }
      } catch {
        if (!cancelled) setReview(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [sellerId])

  if (loading) {
    return (
      <div
        className={cn("rounded-lg border border-neutral-200 bg-neutral-50/80 p-4", className)}
        aria-busy="true"
        aria-label="Bewertung wird geladen"
      >
        <div className="h-16 animate-pulse rounded-md bg-neutral-200" />
      </div>
    )
  }

  if (!review) return null

  const authorName = "Kunde"
  const initial = "K"

  return (
    <article
      className={cn(
        "flex gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm",
        className,
      )}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600"
        aria-hidden
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-0.5" aria-label={`${review.rating} von 5 Sternen`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className={cn(
                "h-3.5 w-3.5",
                index < review.rating ? "fill-amber-400 text-amber-400" : "text-neutral-200",
              )}
            />
          ))}
        </div>
        {review.text && (
          <p className="text-sm leading-relaxed text-neutral-700">
            {review.text}
            <span className="mt-1 block text-neutral-500">— {authorName}</span>
          </p>
        )}
      </div>
    </article>
  )
}
