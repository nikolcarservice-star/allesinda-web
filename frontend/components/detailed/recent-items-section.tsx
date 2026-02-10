"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { HorizontalCardCarousel } from "@/components/shared/horizontal-card-carousel"
import { mapRecentlyViewedDisplayItemToCard } from "@/components/shared/recently-viewed-strip"
import type { RecentlyViewedDisplayItem } from "@/components/shared/recently-viewed-strip"
import {
  readRecentlyViewedItems,
  removeRecentlyViewedItem,
  clearRecentlyViewedItemsByType,
  RECENTLY_VIEWED_EVENT,
  type RecentlyViewedItem,
} from "@/lib/utils/recently-viewed"
import type { CategoryType } from "@/lib/api/types"

interface RecentItemsSectionProps {
  currentType: CategoryType
  currentItemHref?: string
}

function mapRecentlyViewedItemToDisplay(item: RecentlyViewedItem): RecentlyViewedDisplayItem {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    image: item.image,
    priceLabel: item.priceLabel,
    rating: item.rating,
    href: item.href,
    itemType: item.itemType,
    soldCount: item.soldCount,
    price: item.price,
    pricePerDay: item.pricePerDay,
    city_name: item.city_name ?? null,
    category_id: item.category_id ?? undefined,
    category: item.category, // Keep for backward compatibility
    totalReviews: item.totalReviews,
  }
}


export function RecentItemsSection({ currentType, currentItemHref }: RecentItemsSectionProps) {
  const [recentItems, setRecentItems] = useState<RecentlyViewedItem[]>([])

  const syncItems = useCallback(() => {
    const items = readRecentlyViewedItems()
    const filtered = items.filter(
      (item) => item.itemType === currentType && (!currentItemHref || item.href !== currentItemHref)
    )
    setRecentItems(filtered)
  }, [currentType, currentItemHref])

  useEffect(() => {
    syncItems()

    const handleUpdate = () => {
      syncItems()
    }

    window.addEventListener(RECENTLY_VIEWED_EVENT, handleUpdate)
    return () => {
      window.removeEventListener(RECENTLY_VIEWED_EVENT, handleUpdate)
    }
  }, [syncItems])

  const handleClearAll = () => {
    clearRecentlyViewedItemsByType(currentType)
    syncItems()
  }

  const handleRemove = useCallback(
    (item: RecentlyViewedDisplayItem) => {
      removeRecentlyViewedItem(item.href)
      syncItems()
    },
    [syncItems]
  )

  const displayItems = recentItems.map(mapRecentlyViewedItemToDisplay)
  const cardItems = displayItems
    .map((item) => mapRecentlyViewedDisplayItemToCard(item))
    .filter((card): card is NonNullable<typeof card> => Boolean(card))
    .map((card) => ({ ...card, variant: "flat" as const, compact: true }))

  if (cardItems.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Kürzliche Artikel</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          className="h-8 border-border/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-200"
        >
          Alle löschen
        </Button>
      </div>
      <HorizontalCardCarousel
        items={cardItems}
        ariaLabel="Kürzliche Artikel"
        cardVariant="flat"
        cardClassName="rounded-none shadow-none border border-border/60"
        containerClassName="sm:[&>div]:pb-3 [&>div]:pb-2"
      />
    </div>
  )
}

