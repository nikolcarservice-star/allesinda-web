"use client"

import { useEffect, useState, type ComponentType, type SVGProps } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, ShoppingBag, Users, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getTrendingItems } from "@/lib/api"
import type { CategoryType, FeaturedItem, TrendingItem } from "@/lib/api"
import type { MarketplaceItemCardProps } from "@/components/shared/marketplace-item-card"
import { mapFeaturedItemToCard } from "@/components/shared/map-featured-item-to-card"
import { HorizontalCardCarousel } from "@/components/shared/horizontal-card-carousel"

type PanelConfig = {
  type: CategoryType
  title: string
  description: string
  ctaHref: string
  ctaLabel: string
  emptyMessage: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  limit?: number
}

type ItemsByType = Record<CategoryType, FeaturedItem[]>
type LoadingByType = Record<CategoryType, boolean>
type ErrorByType = Record<CategoryType, string | null>

const PANEL_CONFIGS: PanelConfig[] = [
  {
    type: "master",
    title: "Top Meister",
    description: "Am häufigsten gebuchte Profis diese Woche.",
    ctaHref: "/?types=master",
    ctaLabel: "Alle anzeigen",
    emptyMessage: "Derzeit keine trendigen Meister. Schauen Sie später noch einmal vorbei.",
    icon: Users,
  },
  {
    type: "product",
    title: "Beliebte Produkt",
    description: "Meistverkaufte Ausrüstung gerade jetzt.",
    ctaHref: "/?types=product",
    ctaLabel: "Alle durchsuchen",
    emptyMessage: "Derzeit keine trendigen Produkt verfügbar.",
    icon: ShoppingBag,
  },
  {
    type: "rental",
    title: "Beliebte Verleih",
    description: "Ausrüstung, die alle buchen.",
    ctaHref: "/?types=rental",
    ctaLabel: "Alle anzeigen",
    emptyMessage: "Derzeit keine trendigen Verleih verfügbar.",
    icon: Wrench,
  },
]

const INITIAL_ITEMS: ItemsByType = {
  master: [],
  product: [],
  rental: [],
}

const INITIAL_LOADING: LoadingByType = {
  master: true,
  product: true,
  rental: true,
}

const INITIAL_ERRORS: ErrorByType = {
  master: null,
  product: null,
  rental: null,
}

const DEFAULT_LIMIT = 6

function mapTrendingItemToFeaturedItem(item: TrendingItem): FeaturedItem {
  // subtitle is location (city_name) from backend, category is profession/category from backend
  // Use city_name as fallback for subtitle if subtitle is missing
  const subtitleForDisplay = item.subtitle ?? (item.city_name && item.city_name.trim().length > 0 ? item.city_name : undefined)
  
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    subtitle: subtitleForDisplay,
    description: undefined,
    image_url: item.image_url,
    rating: item.rating ?? null,
    total_reviews: item.total_reviews ?? null,
    price: item.price ?? null,
    price_per_day: item.price_per_day ?? null,
    city_id: item.city_id ?? null,
    city_name: item.city_name ?? null,
    category_id: item.category_id ?? null, // Category ID (preferred)
    category: item.category ?? undefined, // Category slug (deprecated, for backward compatibility)
    created_at: undefined,
    stock: item.stock ?? null,
    available_stock: item.available_stock ?? null,
    available: item.available ?? null,
    relationships: undefined,
    likes_count: item.likes_count ?? item.sold_count ?? 0,
  }
}

export function TrendingSection() {
  const [itemsByType, setItemsByType] = useState<ItemsByType>(INITIAL_ITEMS)
  const [loadingByType, setLoadingByType] = useState<LoadingByType>(INITIAL_LOADING)
  const [errorByType, setErrorByType] = useState<ErrorByType>(INITIAL_ERRORS)

  useEffect(() => {
    let cancelled = false

    PANEL_CONFIGS.forEach(({ type, limit }) => {
      const fetchFeatured = async () => {
        setLoadingByType((prev) => ({ ...prev, [type]: true }))
        try {
          const limitValue = limit ?? DEFAULT_LIMIT
          const response = await getTrendingItems({
            type,
            page: 1,
            page_size: (limitValue ?? DEFAULT_LIMIT) + 5,
          })
          if (cancelled) return

          const rawItems = (response?.items ?? []).filter((item): item is TrendingItem => Boolean(item))
          const featuredItems = rawItems
            .map(mapTrendingItemToFeaturedItem)
            .filter((item) => {
              if (type !== "rental") return true
              if (item.available === false) return false
              if (typeof item.stock === "number" && item.stock <= 0) return false
              return true
            })
            .sort((a, b) => {
              const likesA = typeof a.likes_count === "number" ? a.likes_count : 0
              const likesB = typeof b.likes_count === "number" ? b.likes_count : 0
              if (likesA === likesB) {
                return (b.rating ?? 0) - (a.rating ?? 0)
              }
              return likesB - likesA
            })

          setItemsByType((prev) => ({
            ...prev,
            [type]: featuredItems.slice(0, limitValue),
          }))
          setErrorByType((prev) => ({ ...prev, [type]: null }))
        } catch (error) {
          // Gracefully handle API errors - show empty state instead of breaking
          if (process.env.NODE_ENV !== "production") {
            console.error(`Failed to load featured ${type}s`, error)
          }
          if (cancelled) return
          setItemsByType((prev) => ({ ...prev, [type]: [] }))
          setErrorByType((prev) => ({
            ...prev,
            [type]: null, // Don't show error message, just show empty state
          }))
        } finally {
          if (!cancelled) {
            setLoadingByType((prev) => ({ ...prev, [type]: false }))
          }
        }
      }

      fetchFeatured()
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="bg-white py-12 sm:py-16 md:py-20">
      <div className="container mx-auto space-y-12 px-sides sm:space-y-16 md:space-y-20">
        {PANEL_CONFIGS.map((config) => {
          const items = itemsByType[config.type] ?? []
          const isLoading = loadingByType[config.type]
          const error = errorByType[config.type]
          const limit = config.limit ?? DEFAULT_LIMIT

          return (
            <div key={config.type} className="space-y-6 sm:space-y-8">
              <div className="space-y-2">
                <div className="flex flex-row items-center justify-between gap-4">
                  <h2 className="flex-1 min-w-0 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                    {config.title}
                  </h2>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="shrink-0 flex-shrink-0 group/btn border-border/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-200 font-medium"
                  >
                    <Link href={config.ctaHref} className="flex items-center gap-1.5">
                      <span>{config.ctaLabel}</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                    </Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground sm:text-base">{config.description}</p>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12 sm:py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground sm:h-8 sm:w-8" />
                </div>
              ) : items.length > 0 ? (
                <HorizontalCardCarousel
                  items={items
                    .slice(0, limit)
                    .map(mapFeaturedItemToCard)
                    .filter((item): item is MarketplaceItemCardProps => Boolean(item))}
                  ariaLabel={`${config.type} trending items`}
                  cardVariant="flat"
                />
              ) : (
                <div className="rounded-none border border-dashed border-muted/40 bg-muted/10 py-10 text-center text-muted-foreground sm:py-12">
                  <p>{error ?? config.emptyMessage}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

