"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search as SearchIcon, ChevronLeft, ChevronRight, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, getOptimizedImageUrl } from "@/lib/utils"
import type { CategoryType } from "@/lib/api/types"
import { RecentlyViewedStrip, type RecentlyViewedDisplayItem } from "@/components/shared/recently-viewed-strip"
import { CityCombobox } from "@/components/shared/city-combobox"

export type HighlightItem = {
  id: number
  title: string
  subtitle?: string
  image?: string
  priceLabel?: string
  soldCount?: number
  rating?: number
  href: string
  itemType?: CategoryType
}

interface HeaderSearchBarProps {
  variant: "desktop" | "mobile"
  value: string
  onValueChange: (value: string) => void
  onSubmit: (value?: string, cityId?: number | undefined) => void
  placeholder?: string
  onInputRef?: (input: HTMLInputElement | null) => void
  recentSearches: string[]
  onRecentSelect: (term: string, cityId?: number | undefined) => void
  onClearRecent: () => void
  trendingItems: HighlightItem[]
  trendingStatus: "idle" | "loading" | "ready" | "error"
  onTrendingSelect: (item: HighlightItem) => void
  recentlyViewed: RecentlyViewedDisplayItem[]
  onRecentlyViewedSelect: (item: RecentlyViewedDisplayItem) => void
  onRecentlyViewedRemove?: (item: RecentlyViewedDisplayItem) => void
  onClearRecentlyViewed: () => void
  onExploreTrending: () => void
  onOpenChange?: (isOpen: boolean) => void
  // City filter
  cityId?: number
  onCityChange?: (cityId: number | undefined) => void
  // Whether to render the inline (in-row) city dropdown; useful to hide in sheets on resize
  showInlineCity?: boolean
}

function renderSuggestionCard(
  item: HighlightItem,
  onSelect: (item: HighlightItem) => void,
  variant: "horizontal" | "vertical" | "image-only" = "horizontal"
) {
  // For img tag, getOptimizedImageUrl ensures proper URL format for production
  const normalizedImage = item.image ? getOptimizedImageUrl(item.image, 'thumbnail') : null
  const imageSource =
    normalizedImage && normalizedImage.trim().length > 0 ? normalizedImage : "/placeholder.jpg"
  const isImageOnly = variant === "image-only"

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        "group overflow-hidden text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isImageOnly
          ? "relative block h-[148px] w-[138px] min-w-[138px] rounded-none border-0 bg-transparent shadow-none hover:shadow-none"
          : "flex flex-col rounded-sm bg-white hover:shadow-md",
        !isImageOnly && variant === "horizontal" ? "w-[180px] min-w-[180px]" : null,
        !isImageOnly && variant === "vertical" ? "w-full" : null
      )}
      aria-label={isImageOnly ? item.title : undefined}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-neutral-100",
          isImageOnly ? "h-full rounded-none" : "aspect-[4/5]"
        )}
      >
        <img
          src={imageSource}
          alt={item.title}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
            isImageOnly && "rounded-none"
          )}
        />
      </div>
      {!isImageOnly && (
        <div className="flex flex-col gap-1 p-3">
          <p className="text-sm font-semibold text-neutral-900 line-clamp-2">{item.title}</p>
          {item.subtitle && (
            <p className="text-xs text-neutral-600 line-clamp-1">{item.subtitle}</p>
          )}
          <div className="mt-1 flex items-center justify-between text-xs text-neutral-600">
            {item.priceLabel && (
              <span className="font-semibold text-neutral-900">{item.priceLabel}</span>
            )}
            {typeof item.rating === "number" && item.rating > 0 && (
              <span className="flex items-center gap-1 text-neutral-700">
                <Star className="h-3 w-3 fill-primary text-primary" aria-hidden="true" />
                {item.rating.toFixed(1)}
              </span>
            )}
          </div>
          {typeof item.soldCount === "number" && item.soldCount > 0 && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {item.soldCount} verkauft
            </span>
          )}
        </div>
      )}
    </button>
  )
}

export function HeaderSearchBar({
  variant,
  value,
  onValueChange,
  onSubmit,
  placeholder = "Nach Artikeln und Marken suchen",
  onInputRef,
  recentSearches,
  onRecentSelect,
  onClearRecent,
  trendingItems,
  trendingStatus,
  onTrendingSelect,
  recentlyViewed,
  onRecentlyViewedSelect,
  onRecentlyViewedRemove,
  onClearRecentlyViewed,
  onExploreTrending,
  onOpenChange,
  cityId,
  onCityChange,
  showInlineCity = true,
}: HeaderSearchBarProps) {
  const [isOpen, setInternalIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const trendingListRef = useRef<HTMLDivElement | null>(null)
  const viewedListRef = useRef<HTMLDivElement | null>(null)
  const showTrending = false as const
  const hasTrending = showTrending && trendingItems.length > 0
  const trendingIsLoading = showTrending && trendingStatus === "loading"
  const hasSuggestions =
    recentSearches.length > 0 || recentlyViewed.length > 0 || hasTrending || trendingIsLoading
  const [canScrollRecentlyLeft, setCanScrollRecentlyLeft] = useState(false)
  const [canScrollRecentlyRight, setCanScrollRecentlyRight] = useState(false)

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setInternalIsOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange]
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        handleOpenChange(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [handleOpenChange])

  useEffect(() => {
    if (!isOpen) {
      setCanScrollRecentlyLeft(false)
      setCanScrollRecentlyRight(false)
      return
    }

    const node = viewedListRef.current
    if (!node) {
      setCanScrollRecentlyLeft(false)
      setCanScrollRecentlyRight(false)
      return
    }

    const EDGE_THRESHOLD = 8
    const updateScrollState = () => {
      const { scrollLeft, scrollWidth, clientWidth } = node
      setCanScrollRecentlyLeft(scrollLeft > EDGE_THRESHOLD)
      setCanScrollRecentlyRight(scrollLeft < scrollWidth - clientWidth - EDGE_THRESHOLD)
    }

    updateScrollState()
    node.addEventListener("scroll", updateScrollState)
    window.addEventListener("resize", updateScrollState)

    return () => {
      node.removeEventListener("scroll", updateScrollState)
      window.removeEventListener("resize", updateScrollState)
    }
  }, [isOpen, recentlyViewed])

  // Search is ONLY triggered when the Search button is clicked (form submit)
  // No debounce, no auto-search on typing, no search on city change
  // Pass current cityId to onSubmit to ensure we use the latest value
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(value, cityId)
    handleOpenChange(false)
  }

  const hasRecentSearches = recentSearches.length > 0
  const hasRecentlyViewed = recentlyViewed.length > 0
  const shouldFlattenBottom = isOpen && hasSuggestions

  const scrollCardStrip = (
    ref: React.RefObject<HTMLDivElement | null>,
    direction: "left" | "right"
  ) => {
    const node = ref.current
    if (!node) return
    const amount = direction === "left" ? -260 : 260
    node.scrollBy({ left: amount, behavior: "smooth" })
  }

  const handleRecentClick = (term: string) => {
    onValueChange(term)
    // Pass current cityId when selecting recent search
    onRecentSelect(term, cityId)
    handleOpenChange(false)
  }

  const handleTrendingClick = (item: HighlightItem) => {
    onTrendingSelect(item)
    handleOpenChange(false)
  }

  const handleRecentlyViewedClick = (item: RecentlyViewedDisplayItem) => {
    onRecentlyViewedSelect(item)
    handleOpenChange(false)
  }

  const wrapperClasses = cn(
    "relative",
    variant === "desktop" ? "flex-1" : "w-full",
    isOpen ? "z-[80]" : "z-30"
  )

  const formClasses = cn(
    "flex items-center gap-0 bg-white border border-gray-500 rounded-sm px-0.5 py-0.5 transition-all duration-200",
    isOpen ? "border-primary/70" : "hover:border-gray-500",
    shouldFlattenBottom && "rounded-b-none"
  )

  const inputClasses = cn(
    "flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:outline-none text-neutral-950 placeholder:text-gray-500 font-semibold leading-none pl-2 pr-3",
    variant === "desktop" ? "h-9 text-sm" : "h-10 text-base"
  )

  const buttonClasses = "shrink-0 rounded-sm transition-colors flex items-center justify-center p-0"

  const iconWrapperClasses = variant === "desktop" ? "h-9 pl-2 pr-1" : "h-10 pl-2.5 pr-1.5"

  return (
    <div ref={containerRef} className={wrapperClasses}>
      <div className={cn("w-full mb-2", showInlineCity ? "sm:hidden" : undefined)}>
        <CityCombobox
          value={cityId}
          // onChange only updates local state - does NOT trigger search
          // Search only happens on form submit (Search button click)
          onChange={onCityChange}
          size="md"
          variant="form"
          className="w-full justify-start"
          placeholder="Stadt"
        />
      </div>
      <form onSubmit={handleSubmit} className={formClasses}>
        <div className={cn("flex items-center justify-center rounded-sm", iconWrapperClasses)}>
          <SearchIcon className="h-5 w-5 text-neutral-900" aria-hidden="true" />
        </div>
        <Input
          ref={(node) => {
            inputRef.current = node
            if (onInputRef) {
              onInputRef(node)
            }
          }}
          value={value}
          onFocus={() => handleOpenChange(true)}
          // onChange only updates local state - does NOT trigger search
          // Search only happens on form submit (Search button click)
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
          className={inputClasses}
        />
        {showInlineCity && (
          <CityCombobox
            value={cityId}
            // onChange only updates local state - does NOT trigger search
            // Search only happens on form submit (Search button click)
            onChange={onCityChange}
            size={variant === "desktop" ? "sm" : "md"}
            className="w-[140px] sm:w-[180px] hidden sm:flex"
            placeholder="Stadt"
          />
        )}
        {value && (
          <button
            type="button"
            onClick={() => {
              onValueChange("")
              setTimeout(() => {
                inputRef.current?.focus()
              }, 0)
            }}
            className="px-2 text-xs font-semibold uppercase tracking-wide text-black/70 hover:text-black transition-colors"
          >
            Löschen
          </button>
        )}
        <Button
          type="submit"
          size={variant === "desktop" ? "icon-sm" : "icon"}
          className={cn(
            buttonClasses,
            "brand-icon-btn font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/60 [&_svg]:brand-glyph-stroke"
          )}
        >
          <SearchIcon className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Suchen</span>
        </Button>
      </form>

      {isOpen && hasSuggestions && (
        <div
          className={cn(
            "absolute left-0 right-0 mt-0 max-h-[70vh] overflow-y-auto rounded-sm border border-neutral-900/30 bg-white shadow-xl z-[85]",
            "scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent",
            shouldFlattenBottom ? "rounded-b-sm rounded-t-none border-t-0" : "rounded-sm"
          )}
        >
          {hasRecentSearches && (
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-900">Kürzliche Suchen</p>
                <button
                  type="button"
                  onClick={onClearRecent}
                  className="text-xs font-semibold uppercase tracking-wide text-primary hover:text-primary/80"
                >
                  Verlauf löschen
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.slice(0, 8).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleRecentClick(term)}
                    className="rounded-sm border border-neutral-300 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-700 transition hover:border-primary/60 hover:text-primary sm:py-1 sm:text-xs"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showTrending && hasTrending && (
            <div className="space-y-3 border-t border-neutral-100 bg-neutral-50 py-4">
              <div className="px-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-900">Trending</p>
                  <button
                    type="button"
                    onClick={onExploreTrending}
                    className="text-xs font-semibold uppercase tracking-wide text-primary hover:text-primary/80"
                  >
                    Mehr erkunden
                  </button>
                </div>
              </div>
              <div className="relative">
                <div
                  ref={trendingListRef}
                  className="flex gap-3 overflow-x-auto overflow-y-hidden py-1 px-6 scroll-smooth [-ms-overflow-style:'none'] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="list"
                  aria-live="polite"
                >
                  {trendingItems.map((item) => (
                    <div role="listitem" key={`${item.itemType ?? "item"}-${item.id}-${item.href}`}>
                      {renderSuggestionCard(item, handleTrendingClick, "horizontal")}
                    </div>
                  ))}
                </div>
                {trendingItems.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="group absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-300/80 bg-white/95 p-0 shadow-md transition duration-200 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:h-11 sm:w-11"
                      onClick={() => scrollCardStrip(trendingListRef, "left")}
                      aria-label="Nach links scrollen"
                    >
                      <ChevronLeft className="h-4 w-4 text-gray-700 transition duration-200 group-hover:text-primary" />
                    </button>
                    <button
                      type="button"
                      className="group absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-300/80 bg-white/95 p-0 shadow-md transition duration-200 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:h-11 sm:w-11"
                      onClick={() => scrollCardStrip(trendingListRef, "right")}
                      aria-label="Nach rechts scrollen"
                    >
                      <ChevronRight className="h-4 w-4 text-gray-700 transition duration-200 group-hover:text-primary" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {hasRecentlyViewed && (
            <div className="space-y-3 border-t border-neutral-100 bg-white py-4">
              <div className="px-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-900">Kürzlich angesehen</p>
                  <button
                    type="button"
                    onClick={onClearRecentlyViewed}
                    className="text-xs font-semibold uppercase tracking-wide text-primary hover:text-primary/80"
                  >
                    Alle löschen
                  </button>
                </div>
              </div>
              <div className="relative">
                <RecentlyViewedStrip
                  ref={viewedListRef}
                  mode="image-only"
                  items={recentlyViewed}
                  onSelect={(item) => handleRecentlyViewedClick(item)}
                  onRemove={onRecentlyViewedRemove}
                  removeButtonVisibility="hover-desktop"
                  ariaLabel="Kürzlich angesehene Artikel"
                  ariaLive="polite"
                />
                {canScrollRecentlyLeft && (
                  <button
                    type="button"
                    className="group absolute left-0 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-300/80 bg-white/95 p-0 shadow-md transition duration-200 hover:bg-primary/10 hover:text-primary hover:-translate-y-[calc(50%+2px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:flex sm:h-11 sm:w-11"
                    onClick={() => scrollCardStrip(viewedListRef, "left")}
                    aria-label="Nach links scrollen"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-700 transition duration-200 group-hover:text-primary" />
                  </button>
                )}
                {canScrollRecentlyRight && (
                  <button
                    type="button"
                    className="group absolute right-0 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-300/80 bg-white/95 p-0 shadow-md transition duration-200 hover:bg-primary/10 hover:text-primary hover:-translate-y-[calc(50%+2px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:flex sm:h-11 sm:w-11"
                    onClick={() => scrollCardStrip(viewedListRef, "right")}
                    aria-label="Nach rechts scrollen"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-700 transition duration-200 group-hover:text-primary" />
                  </button>
                )}
              </div>
            </div>
          )}

          {showTrending && trendingStatus === "loading" && !hasTrending && (
            <div className="px-4 py-6 text-center text-xs text-neutral-500">
              Vorschläge werden geladen…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
