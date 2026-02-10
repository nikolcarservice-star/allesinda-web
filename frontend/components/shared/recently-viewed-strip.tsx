"use client"

import { forwardRef } from "react"
import { cn, getOptimizedImageUrl } from "@/lib/utils"
import type { CategoryType, FavoriteType } from "@/lib/api/types"
import { HorizontalCardCarousel } from "@/components/shared/horizontal-card-carousel"
import type { CardVariant, MarketplaceItemCardProps } from "@/components/shared/marketplace-item-card"
import { parsePriceLabel } from "@/lib/utils/recently-viewed"
import { FavoriteButton } from "@/components/ui/favorite-button"

export type RecentlyViewedDisplayItem = {
  id: number | string
  title: string
  subtitle?: string
  image?: string
  priceLabel?: string
  rating?: number
  href: string
  itemType?: CategoryType
  soldCount?: number
  price?: number
  pricePerDay?: number
  city_name?: string | null
  category_id?: number | null // Category ID (preferred)
  category?: string // Category slug (deprecated, for backward compatibility)
  totalReviews?: number
  profile_image_url?: string // Profile image URL for masters (fetched from backend)
}

export function mapRecentlyViewedDisplayItemToCard(
  item: RecentlyViewedDisplayItem,
): MarketplaceItemCardProps | null {
  if (!item.itemType) {
    return null
  }

  const parsedLabel = parsePriceLabel(item.priceLabel)
  // Note: MarketplaceItemCard will optimize the image again, but we normalize here for consistency
  // Backend ensures image_url is always the profile image for masters, and view-tracker.tsx
  // stores the profile image when items are viewed, so stored images are already correct
  const normalizedImage = item.image ? getOptimizedImageUrl(item.image, 'card') : "/placeholder.svg"
  const safeImage = normalizedImage && normalizedImage.trim().length > 0 ? normalizedImage : "/placeholder.svg"
  const ratingValue = typeof item.rating === "number" ? item.rating : 0
  const totalReviews = typeof item.totalReviews === "number" ? item.totalReviews : undefined

  if (item.itemType === "master") {
    // Avoid duplicating city as profession subtitle
    const normalize = (v?: string | null) =>
      (v ?? "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    const fallbackLocation = item.city_name ?? (item.subtitle && item.subtitle.trim().length > 0 ? item.subtitle : undefined)
    const location = [fallbackLocation].filter(Boolean).join(", ")
    const normalizedLocation = normalize(location)
    const normalizedSubtitle = normalize(item.subtitle)
    const effectiveProfession =
      normalizedSubtitle &&
      !(normalizedSubtitle === normalizedLocation ||
        (normalizedSubtitle && normalizedLocation && (normalizedSubtitle.includes(normalizedLocation) || normalizedLocation.includes(normalizedSubtitle))))
        ? item.subtitle ?? undefined
        : undefined

    return {
      type: "master",
      data: {
        id: String(item.id),
        href: item.href,
        name: item.title,
        profession: effectiveProfession,
        category_id: item.category_id ?? undefined,
        category: item.category ?? undefined, // Keep for backward compatibility
        rating: ratingValue,
        reviews: totalReviews ?? 0,
        location: location || "Location not specified",
        image: safeImage,
        priceLabel: item.priceLabel,
        priceFrom: item.price ?? parsedLabel ?? undefined,
        verified: false,
        distanceKm: undefined,
        contactPhone: undefined,
        contactEmail: undefined,
        canChat: false,
      },
    }
  }

  if (item.itemType === "product") {
    return {
      type: "product",
      data: {
        id: String(item.id),
        href: item.href,
        name: item.title,
        price: item.price ?? parsedLabel ?? 0,
        image: safeImage,
        seller: item.subtitle ?? "Kürzlich angesehener Verkäufer",
        rating: ratingValue,
        reviews: totalReviews,
        stock: undefined,
        brand: undefined,
        category: item.subtitle ?? item.category ?? undefined,
        city_name: item.city_name ?? undefined,
      },
    }
  }

  if (item.itemType === "rental") {
    const pricePerDay = item.pricePerDay ?? (item.itemType === "rental" ? parsedLabel ?? 0 : 0)
    return {
      type: "rental",
      data: {
        id: String(item.id),
        href: item.href,
        name: item.title,
        pricePerDay,
        image: safeImage,
        owner: item.subtitle ?? "Kürzlich angesehener Eigentümer",
        available: true,
        stock: undefined,
        availableStock: undefined,
        rating: ratingValue > 0 ? ratingValue : undefined,
        totalReviews,
        category_id: item.category_id ?? undefined,
        category: item.category ?? undefined, // Keep for backward compatibility
        city_name: item.city_name ?? undefined,
      },
    }
  }

  return null
}

type BaseProps = {
  items: RecentlyViewedDisplayItem[]
  className?: string
  ariaLabel?: string
  ariaLive?: "off" | "polite" | "assertive"
  onSelect?: (item: RecentlyViewedDisplayItem) => void
  onRemove?: (item: RecentlyViewedDisplayItem) => void
  removeLabel?: string
}

type ImageOnlyProps = BaseProps & {
  mode: "image-only"
  removeButtonVisibility?: "always" | "hover-desktop"
}

type DetailedProps = BaseProps & {
  mode: "detailed"
  cardVariant?: CardVariant
  cardClassName?: string
}

export type RecentlyViewedStripProps = ImageOnlyProps | DetailedProps

const overlayButtonBaseClasses =
  "flex items-center justify-center rounded-full border border-border/60 bg-white/80 text-foreground shadow-sm transition-all duration-200 hover:bg-white supports-[backdrop-filter]:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 !h-9 !w-9 !min-h-9 !min-w-9"

export const RecentlyViewedStrip = forwardRef<HTMLDivElement, RecentlyViewedStripProps>(
  (props, forwardedRef) => {
    if (props.mode === "image-only") {
      const {
        items,
        className,
        ariaLabel,
        ariaLive,
        onSelect,
        onRemove,
        removeLabel,
        removeButtonVisibility = "always",
      } = props
      if (!items.length) {
        return null
      }

      return (
        <div
          ref={forwardedRef}
          className={cn(
            "flex gap-3 overflow-x-auto overflow-y-hidden py-1 px-6 scroll-smooth [-ms-overflow-style:'none'] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            className,
          )}
          aria-label={ariaLabel ?? "Kürzlich angesehen"}
          aria-live={ariaLive}
          role="list"
        >
          {items.map((item) => {
            // Backend ensures image_url is always the profile image for masters, and view-tracker.tsx
            // stores the profile image when items are viewed, so stored images are already correct
            // For img tag, we can use normalizeImageUrl, but getOptimizedImageUrl ensures proper URL format
            const normalizedImage = item.image ? getOptimizedImageUrl(item.image, 'thumbnail') : null
            const imageSource =
              normalizedImage && normalizedImage.trim().length > 0 ? normalizedImage : "/placeholder.jpg"
            const favoriteType: FavoriteType =
              item.itemType === "master" ? "profile" : item.itemType === "rental" ? "rental" : "product"

            return (
              <div
                key={`${item.itemType ?? "item"}-${item.id}-${item.href}`}
                role="listitem"
                className="flex-shrink-0"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect?.(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onSelect?.(item)
                    }
                  }}
                  className="group relative block h-[148px] w-[138px] min-w-[138px] cursor-pointer overflow-hidden rounded-none border-0 bg-transparent shadow-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={item.title}
                >
                  <div className="relative h-full w-full overflow-hidden bg-neutral-100">
                    <img
                      src={imageSource}
                      alt={item.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  {onRemove && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onRemove(item)
                      }}
                      className={cn(
                        "absolute left-2 top-2 z-10",
                        overlayButtonBaseClasses,
                        removeButtonVisibility === "hover-desktop"
                          ? "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                          : "opacity-100",
                        "hover:-translate-y-0.5",
                      )}
                      aria-label={removeLabel ?? "Kürzlich angesehenes Element entfernen"}
                    >
                      <span className="text-lg font-semibold leading-none">×</span>
                    </button>
                  )}
                  <div className="absolute right-2 top-2 z-10">
                    <FavoriteButton
                      favoriteType={favoriteType}
                      favoriteId={typeof item.id === "number" ? item.id : Number(item.id)}
                      size="sm"
                      variant="outline"
                      className={cn(overlayButtonBaseClasses, "hover:-translate-y-0.5")}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    const { items, ariaLabel, cardVariant = "default", cardClassName, onRemove, removeLabel } = props
    if (!items.length) {
      return null
    }

    const cards = items.reduce<MarketplaceItemCardProps[]>((acc, item) => {
      if (!item.itemType) {
        return acc
      }

      const card = mapRecentlyViewedDisplayItemToCard(item)
      if (!card) {
        return acc
      }

      const mergedCard: MarketplaceItemCardProps = {
        ...card,
        className: cn(card.className, cardClassName),
        onRemove: onRemove
          ? () => {
              onRemove(item)
            }
          : card.onRemove,
        removeLabel: onRemove ? removeLabel ?? card.removeLabel ?? "Kürzlich angesehenes Element entfernen" : card.removeLabel,
      }

      acc.push(mergedCard)
      return acc
    }, [])

    if (!cards.length) {
      return null
    }

    return (
      <HorizontalCardCarousel
        items={cards}
        ariaLabel={ariaLabel ?? "Recently viewed items"}
        cardVariant={cardVariant}
        cardClassName={cardClassName}
      />
    )
  },
)

RecentlyViewedStrip.displayName = "RecentlyViewedStrip"


