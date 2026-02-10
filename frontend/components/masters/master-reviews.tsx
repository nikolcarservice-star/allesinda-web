"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Star, Loader2 } from "lucide-react"
import { getSellerReviews } from "@/lib/api/reviews"
import type { Review } from "@/lib/api/types"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale/de"

interface MasterReviewsProps {
  masterId: string
  profileId: number
  rating: number
  totalReviews: number
}

export function MasterReviews({ masterId, profileId, rating, totalReviews }: MasterReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [ratingDistribution, setRatingDistribution] = useState<{ stars: number; percentage: number; count: number }[]>([])

  useEffect(() => {
    loadReviews()
  }, [profileId])

  const loadReviews = async () => {
    try {
      setLoading(true)
      // Get user_id from profile - we need to fetch the profile first or pass user_id
      // For now, we'll use profileId as seller_id (assuming profile.user_id = seller_id)
      const response = await getSellerReviews(profileId, { page: 1, page_size: 20 })
      const reviewsData = response.items || []
      setReviews(reviewsData)

      // Calculate rating distribution
      const distribution = [5, 4, 3, 2, 1].map((stars) => {
        const count = reviewsData.filter((r) => r.rating === stars).length
        const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0
        return { stars, percentage, count }
      })
      setRatingDistribution(distribution)
    } catch (error: any) {
      console.error("Failed to load reviews:", error)
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Rating Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Overall Rating */}
            <div className="text-center md:text-left">
              <div className="text-5xl font-bold mb-2">{rating.toFixed(1)}</div>
              <div className="flex items-center justify-center md:justify-start gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${i < Math.floor(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted"}`}
                  />
                ))}
              </div>
              <p className="text-muted-foreground">{totalReviews} Bewertungen</p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-2">
              {ratingDistribution.map((item) => (
                <div key={item.stars} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm font-medium">{item.stars}</span>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <Progress value={item.percentage} className="flex-1" />
                  <span className="text-sm text-muted-foreground w-8 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Reviews */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Noch keine Bewertungen</p>
          <p className="text-sm">Dieser Meister hat noch keine Bewertungen erhalten</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar>
                    <AvatarImage src="/placeholder.svg" alt="Anonym" />
                    <AvatarFallback>A</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold">Anonym</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: de })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted"}`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.text && <p className="text-muted-foreground leading-relaxed">{review.text}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
