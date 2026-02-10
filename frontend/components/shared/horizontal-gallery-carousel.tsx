"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { GalleryCard } from "@/components/gallery/gallery-card"
import type { Media } from "@/lib/api/types"

type GalleryItem = Media & {
  master_name?: string
  master_profile_id?: number
  master_verified?: boolean
}

type HorizontalGalleryCarouselProps = {
  items: GalleryItem[]
  ariaLabel: string
  getItemHref: (item: GalleryItem) => string
  containerClassName?: string
}

export function HorizontalGalleryCarousel({
  items,
  ariaLabel,
  getItemHref,
  containerClassName,
}: HorizontalGalleryCarouselProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)

  const updateScrollState = useCallback(() => {
    const node = containerRef.current
    if (!node) return
    
    const { scrollLeft, scrollWidth, clientWidth } = node
    const threshold = 4
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)
    
    setCanScrollLeft(scrollLeft > threshold)
    setCanScrollRight(maxScrollLeft > threshold && (maxScrollLeft - scrollLeft) > threshold)
  }, [])

  const scrollLeft = useCallback(() => {
    const node = containerRef.current
    if (!node) return
    
    const scrollAmount = node.clientWidth * 0.8
    node.scrollBy({ left: -scrollAmount, behavior: "smooth" })
  }, [])

  const scrollRight = useCallback(() => {
    const node = containerRef.current
    if (!node) return
    
    const scrollAmount = node.clientWidth * 0.8
    node.scrollBy({ left: scrollAmount, behavior: "smooth" })
  }, [])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    updateScrollState()

    const handleScroll = () => {
      updateScrollState()
    }

    const handleResize = () => {
      // Check if we're on large screen (lg breakpoint = 1024px)
      setIsLargeScreen(window.innerWidth >= 1024)
      updateScrollState()
    }

    // Initial check
    handleResize()

    // Use native passive event listeners for better performance
    node.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleResize, { passive: true })

    // Also observe for content changes
    const observer = new ResizeObserver(() => {
      updateScrollState()
    })
    observer.observe(node)

    return () => {
      node.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleResize)
      observer.disconnect()
    }
  }, [updateScrollState, items.length])

  if (!items.length) return null

  return (
    <div className={cn("relative w-full", containerClassName)}>
      <div
        ref={containerRef}
        className={cn(
          "flex gap-2 w-full",
          // Always horizontal scrolling on all screens
          "flex-nowrap overflow-x-auto overflow-y-visible",
          "scrollbar-hide snap-x snap-mandatory",
          "px-2 sm:px-3 md:px-4",
          // Hide scrollbar on large screens (arrow buttons will be shown instead)
          "lg:[&::-webkit-scrollbar]:hidden"
        )}
        style={{ 
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          // Touch styles for mobile swipeable behavior (like category carousel)
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y pinch-zoom",
          overscrollBehaviorY: "auto",
          overscrollBehaviorX: "contain",
        }}
        aria-label={ariaLabel}
        role="region"
      >
        {items.map((item, index) => {
          const key = `${item.id}-${index}`
          // Responsive card widths
          const cardWidth = "w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.5rem)] md:w-[calc(25%-0.5rem)] lg:w-[calc(20%-0.5rem)] xl:w-[calc(16.666%-0.5rem)]"
          
          return (
            <div
              key={key}
              data-carousel-card
              className={cn(
                "flex-shrink-0 snap-center",
                cardWidth
              )}
            >
              <GalleryCard
                item={item}
                href={getItemHref(item)}
                priority={index === 0}
              />
            </div>
          )
        })}
      </div>

      {/* Arrow buttons - only show on large screens */}
      {isLargeScreen && canScrollLeft && (
        <button
          type="button"
          onClick={scrollLeft}
          className={cn(
            "absolute left-1 md:left-2 top-1/2 -translate-y-1/2 z-10",
            "hidden lg:flex h-9 w-9 items-center justify-center rounded-full",
            "border border-border/50 bg-white/95 backdrop-blur-md text-foreground/70",
            "shadow-md hover:bg-white hover:text-primary hover:border-primary/50 hover:shadow-lg",
            "transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            "active:scale-95"
          )}
          aria-label="Nach links scrollen"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {isLargeScreen && canScrollRight && (
        <button
          type="button"
          onClick={scrollRight}
          className={cn(
            "absolute right-1 md:right-2 top-1/2 -translate-y-1/2 z-10",
            "hidden lg:flex h-9 w-9 items-center justify-center rounded-full",
            "border border-border/50 bg-white/95 backdrop-blur-md text-foreground/70",
            "shadow-md hover:bg-white hover:text-primary hover:border-primary/50 hover:shadow-lg",
            "transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            "active:scale-95"
          )}
          aria-label="Nach rechts scrollen"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

