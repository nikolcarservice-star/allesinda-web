"use client"

import { useEffect } from "react"
import { trackFeaturedView } from "@/lib/api"
import type { CategoryType, FeaturedDetail, Media } from "@/lib/api"
import {
  parsePriceLabel,
  type RecentlyViewedItem,
  upsertRecentlyViewedItem,
} from "@/lib/utils/recently-viewed"
import { formatPrice, getOptimizedImageUrl } from "@/lib/utils"

const PLACEHOLDER_IMAGE = "/placeholder.jpg"

interface ViewTrackerProps {
  type: CategoryType
  id: number
  detail: FeaturedDetail
}

function firstMediaUrl(media?: Media[] | null): string | undefined {
  if (!media || media.length === 0) return undefined
  const sorted = [...media].sort((a, b) => {
    const orderA = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER
    const orderB = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
    if (createdA !== createdB) return createdB - createdA
    return a.id - b.id
  })

  const withThumbnail = sorted.find((entry) => entry.thumbnail_url && entry.thumbnail_url.trim().length > 0)
  if (withThumbnail?.thumbnail_url) {
    return withThumbnail.thumbnail_url
  }

  const withUrl = sorted.find((entry) => entry.url && entry.url.trim().length > 0)
  return withUrl?.url
}

function resolveDetailImage(detail: FeaturedDetail): string {
  const candidates: Array<string | undefined> = []

  // For masters, prioritize profile image (image_url) first
  if (detail.type === "master" && detail.image_url && detail.image_url.trim().length > 0) {
    candidates.push(detail.image_url)
  }

  const primaryMedia = detail.media && detail.media.length ? detail.media : detail.portfolio
  const mediaCandidate = firstMediaUrl(primaryMedia)
  if (mediaCandidate) {
    candidates.push(mediaCandidate)
  }

  // For products and rentals, use image_url if available
  if (detail.type !== "master" && detail.image_url && detail.image_url.trim().length > 0) {
    candidates.push(detail.image_url)
  }

  for (const candidate of candidates) {
    if (!candidate) continue
    // Use 'original' preset to get absolute URL without optimization params (for storage)
    const normalized = getOptimizedImageUrl(candidate, 'original')
    if (normalized && normalized.trim().length > 0) {
      return normalized
    }
  }

  return PLACEHOLDER_IMAGE
}

function deriveMasterPrice(detail: FeaturedDetail): { priceLabel?: string; price?: number } {
  const extraLabel =
    detail.extra && typeof (detail.extra as { price_label?: unknown }).price_label === "string"
      ? ((detail.extra as { price_label?: string }).price_label ?? "").trim()
      : undefined

  if (extraLabel && extraLabel.length > 0) {
    const numeric = parsePriceLabel(extraLabel)
    if (typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0) {
      return { priceLabel: extraLabel, price: numeric }
    }
  }

  const lowestServicePrice = detail.services?.reduce<number | undefined>((lowest, service) => {
    const price = typeof service.price_from === "number" ? service.price_from : undefined
    if (!price || !Number.isFinite(price) || price <= 0) {
      return lowest
    }
    if (typeof lowest !== "number" || price < lowest) {
      return price
    }
    return lowest
  }, undefined)

  if (typeof lowestServicePrice === "number" && Number.isFinite(lowestServicePrice) && lowestServicePrice > 0) {
    return {
      priceLabel: formatPrice(lowestServicePrice, "EUR"),
      price: lowestServicePrice,
    }
  }

  const directPrice = typeof detail.price === "number" ? detail.price : undefined
  if (typeof directPrice === "number" && Number.isFinite(directPrice) && directPrice > 0) {
    return {
      priceLabel: formatPrice(directPrice, "EUR"),
      price: directPrice,
    }
  }

  return {}
}

function mapDetailToRecentlyViewed(detail: FeaturedDetail): RecentlyViewedItem {
  const href = `/detailed/${detail.type}/${detail.id}`
  const image = resolveDetailImage(detail)

  let priceLabel: string | undefined
  let price: number | undefined
  let pricePerDay: number | undefined

  if (detail.type === "master") {
    const derived = deriveMasterPrice(detail)
    priceLabel = derived.priceLabel
    price = derived.price
  } else if (detail.type === "product") {
    if (typeof detail.price === "number" && Number.isFinite(detail.price) && detail.price > 0) {
      price = detail.price
      priceLabel = formatPrice(detail.price, "EUR")
    }
  } else if (detail.type === "rental") {
    if (typeof detail.price_per_day === "number" && Number.isFinite(detail.price_per_day) && detail.price_per_day > 0) {
      pricePerDay = detail.price_per_day
      priceLabel = `${formatPrice(detail.price_per_day, "EUR")} / day`
    }
  }

  const subtitle =
    detail.subtitle && detail.subtitle.trim().length > 0
      ? detail.subtitle
      : ([(detail as any).city_name as string | undefined].filter(Boolean).join(", ") || undefined)

  return {
    id: detail.id,
    title: detail.title,
    subtitle,
    image,
    rating: typeof detail.rating === "number" ? detail.rating : undefined,
    priceLabel,
    href,
    itemType: detail.type,
    soldCount: undefined,
    city_name: (detail as any).city_name ?? undefined,
    category_id: (detail as any).category_id ?? undefined,
    category: detail.category ?? undefined, // Keep for backward compatibility in display
    price,
    pricePerDay,
    totalReviews: typeof detail.total_reviews === "number" ? detail.total_reviews : undefined,
  }
}

export function ViewTracker({ type, id, detail }: ViewTrackerProps) {
  useEffect(() => {
    trackFeaturedView(type, id).catch((error) => {
      console.error("Failed to record featured view", error)
    })

    const recentlyViewedItem = mapDetailToRecentlyViewed(detail)
    upsertRecentlyViewedItem(recentlyViewedItem)
  }, [detail, id, type])

  return null
}
