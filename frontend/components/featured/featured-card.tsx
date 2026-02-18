"use client"

import Image from "next/image"
import Link from "next/link"
import { Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { FeaturedItem } from "@/lib/api"
import { cn, getOptimizedImageUrl, formatPrice, shouldUseUnoptimized } from "@/lib/utils"

const TYPE_LABEL: Record<string, string> = {
  master: "Master",
  product: "Product",
  rental: "Rental",
}

interface FeaturedCardProps {
  item: FeaturedItem
  cardClassName?: string
  imageWrapperClassName?: string
  imageClassName?: string
}

export function FeaturedCard({ item, cardClassName, imageWrapperClassName, imageClassName }: FeaturedCardProps) {
  const href = `/detailed/${item.type}/${item.id}`
  const image = getOptimizedImageUrl(item.image_url, 'card') || "/placeholder.svg"
  const rating = item.rating ?? undefined
  const reviews = item.total_reviews ?? undefined
  const price = item.type === "product" ? item.price : item.price_per_day
  const priceLabel = item.type === "rental" ? "per day" : undefined
  const stock = item.type === "rental" ? item.stock ?? null : null
  const available = item.type === "rental" ? item.available ?? (stock === null || stock > 0) : true
  const isOutOfStock = item.type === "rental" && (!available || (stock !== null && stock <= 0))
  const isLowStock = item.type === "rental" && !isOutOfStock && stock !== null && stock <= 3

  return (
    <Link href={href} className="block h-full">
      <Card className={cn("h-full overflow-hidden transition-shadow hover:shadow-lg", cardClassName)}>
        <div className={cn("relative aspect-[4/3] w-full overflow-hidden bg-muted/10", imageWrapperClassName)}>
          <Image
            src={image}
            alt={item.title}
            fill
            className={cn("object-cover transition-transform duration-300 group-hover:scale-105", imageClassName)}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized={shouldUseUnoptimized(image)}
          />
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <Badge variant="secondary" className="capitalize bg-background/90 text-foreground shadow">
              {TYPE_LABEL[item.type] ?? item.type}
            </Badge>
          </div>
          {item.type === "rental" && (
            <div className="absolute top-2 right-2">
              {isOutOfStock ? (
                <Badge variant="destructive" className="bg-red-600 text-white shadow">
                  Out of stock
                </Badge>
              ) : isLowStock && stock !== null ? (
                <Badge className="bg-amber-400 text-black shadow">
                  {stock === 1 ? "Only 1 left" : `${stock} left`}
                </Badge>
              ) : null}
            </div>
          )}
          {item.category && (
<Badge className="absolute bottom-2 left-2 bg-primary text-black font-bold shadow">
              {item.category.replace(/-/g, " ")}
            </Badge>
          )}
        </div>
        <CardHeader className="space-y-1">
          <CardTitle className="line-clamp-1 text-base font-semibold">
            {item.title}
          </CardTitle>
          {item.subtitle && (
            <p className="text-sm text-muted-foreground line-clamp-1">{item.subtitle}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
          )}

          <div className="flex items-center justify-between text-sm">
            {rating ? (
              <span className="inline-flex items-center gap-1 font-medium">
                <Star className="h-4 w-4 fill-primary text-primary" />
                {rating.toFixed(1)}
                {reviews ? <span className="text-muted-foreground">({reviews})</span> : null}
              </span>
            ) : (
              <span className="text-muted-foreground">&nbsp;</span>
            )}

            {price ? (
              <span className="font-semibold">
                {formatPrice(price, 'EUR')} {priceLabel}
              </span>
            ) : null}
          </div>

          {item.type === "rental" && (
            <p className={cn("text-xs font-medium", isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : "text-emerald-600")}>
              {isOutOfStock
                ? "Currently unavailable"
                : stock !== null
                  ? `${stock} unit${stock === 1 ? "" : "s"} available`
                  : available
                    ? "Available"
                    : "Currently unavailable"}
            </p>
          )}

          {item.city_name && (
            <p className="text-xs text-muted-foreground capitalize">
              {item.city_name}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export function FeaturedCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full" />
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/5" />
        </div>
      </CardContent>
    </Card>
  )
}
