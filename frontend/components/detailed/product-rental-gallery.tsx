"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { FullscreenImageViewer } from "@/components/ui/fullscreen-image-viewer"

export type ProductRentalGalleryItem = {
  key: string
  url: string
  alt?: string | null
}

interface ProductRentalGalleryProps {
  items: ProductRentalGalleryItem[]
  variant?: "default" | "hero"
}

export function ProductRentalGallery({ items, variant = "default" }: ProductRentalGalleryProps) {
  const normalizedItems = useMemo<ProductRentalGalleryItem[]>(() => {
    if (!items.length) {
      return [
        {
          key: "placeholder",
          url: "/placeholder.svg",
          alt: "Image coming soon",
        },
      ]
    }
    return items
  }, [items])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null)
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const touchStartXRef = useRef<number | null>(null)
  const swipeDetectedRef = useRef(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 1024) // lg breakpoint
    }
    
    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)
    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])
  const goToFullscreen = (index: number) => {
    setFullscreenIndex(index)
  }

  const closeFullscreen = () => {
    setFullscreenIndex(null)
  }


  const goToIndex = (index: number) => {
    if (index < 0) {
      setCurrentIndex(normalizedItems.length - 1)
    } else if (index >= normalizedItems.length) {
      setCurrentIndex(0)
    } else {
      setCurrentIndex(index)
    }
  }

  const handlePrevious = () => {
    goToIndex(currentIndex - 1)
  }

  const handleNext = () => {
    goToIndex(currentIndex + 1)
  }

  const active = normalizedItems[currentIndex]

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    // Disable swipe on small screens for hero variant (master detailed page)
    if (variant === "hero" && isSmallScreen) {
      return
    }
    if (event.touches.length > 0) {
      touchStartXRef.current = event.touches[0].clientX
      swipeDetectedRef.current = false
    }
  }

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    // Disable swipe on small screens for hero variant (master detailed page)
    if (variant === "hero" && isSmallScreen) {
      return
    }
    if (touchStartXRef.current === null) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const deltaX = touch.clientX - touchStartXRef.current
    touchStartXRef.current = null

    const threshold = 40
    if (Math.abs(deltaX) < threshold) {
      return
    }

    swipeDetectedRef.current = true
    if (deltaX > 0) {
      handlePrevious()
    } else {
      handleNext()
    }
  }

  const handleImageClick = () => {
    if (swipeDetectedRef.current) {
      swipeDetectedRef.current = false
      return
    }
    goToFullscreen(currentIndex)
  }

  return (
    <div className={cn(
      "flex gap-4 lg:gap-6",
      variant === "hero" ? "md:flex md:gap-4 lg:h-full lg:flex-col lg:justify-center" : "lg:h-full"
    )}>
      {variant === "default" && (
        <div className="hidden md:flex md:flex-col md:gap-2">
          <div className="hidden md:block md:max-h-[520px] md:space-y-2 md:overflow-y-auto md:pr-1">
            {normalizedItems.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "relative block h-20 w-20 overflow-hidden border bg-muted transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40",
                  index === currentIndex ? "border-foreground" : "border-muted-foreground/20",
                )}
                aria-label={`Bild ${index + 1} anzeigen`}
              >
                <Image src={item.url} alt={item.alt ?? ""} fill className="object-cover" sizes="80px" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={cn("relative flex-1 w-full", "lg:h-full lg:flex lg:items-center lg:justify-center")}>
        <div
          className={cn(
            "group relative overflow-hidden bg-background w-full",
            variant === "hero" 
              ? "aspect-[4/5] lg:aspect-auto lg:h-full lg:w-full" 
              : "aspect-[4/5] lg:aspect-auto lg:h-full lg:w-full"
          )}
          style={{
            ...(variant === "hero" ? { minHeight: "400px" } : {}),
            ...(variant === "hero" && isSmallScreen ? { touchAction: "pan-y" } : {})
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {active && (
            <Image
              key={active.key}
              src={active.url}
              alt={active.alt ?? "Gallery image"}
              fill
              priority
              className={cn(
                "transition-transform duration-300 group-hover:scale-[1.02]",
                "object-cover"
              )}
              sizes="(max-width: 1024px) 100vw, 60vw"
              onClick={handleImageClick}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  handleImageClick()
                }
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="rounded-full border border-white/40 bg-black/70 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-white shadow">
              Klicken Sie, um Vollbild anzuzeigen
            </span>
          </div>

      {variant === "default" && normalizedItems.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevious}
            className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-white/75 text-foreground shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 lg:flex"
                aria-label="Vorheriges Bild"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
            className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-white/75 text-foreground shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 lg:flex"
                aria-label="Nächstes Bild"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

      {/* Small-screen dots indicator (outside image) */}
      {variant === "default" && normalizedItems.length > 1 && (
        <div className="md:hidden mt-3 flex items-center justify-center gap-0.5">
          {normalizedItems.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "h-px w-px rounded-full transition transform scale-[0.3]",
                index === currentIndex ? "bg-foreground" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
              )}
              aria-label={`Bild ${index + 1} anzeigen`}
            />
          ))}
        </div>
      )}

      {variant === "default" && normalizedItems.length > 1 && (
        <div className="hidden md:flex lg:hidden items-center justify-center gap-2">
          {normalizedItems.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "h-2 w-8 transition",
                index === currentIndex ? "bg-foreground" : "bg-muted-foreground/30 hover:bg-muted-foreground/60",
              )}
              aria-label={`Bild ${index + 1} anzeigen`}
            />
          ))}
        </div>
      )}
      </div>

      <FullscreenImageViewer
        isOpen={fullscreenIndex !== null}
        onClose={closeFullscreen}
        imageUrl={fullscreenIndex !== null ? normalizedItems[fullscreenIndex]?.url : null}
        alt={fullscreenIndex !== null ? normalizedItems[fullscreenIndex]?.alt ?? "Gallery image" : "Gallery image"}
        onPrevious={
          fullscreenIndex !== null && normalizedItems.length > 1
            ? () => {
                const nextIndex = fullscreenIndex - 1 < 0 ? normalizedItems.length - 1 : fullscreenIndex - 1
                setFullscreenIndex(nextIndex)
                setCurrentIndex(nextIndex)
              }
            : undefined
        }
        onNext={
          fullscreenIndex !== null && normalizedItems.length > 1
            ? () => {
                const nextIndex = fullscreenIndex + 1 >= normalizedItems.length ? 0 : fullscreenIndex + 1
                setFullscreenIndex(nextIndex)
                setCurrentIndex(nextIndex)
              }
            : undefined
        }
      />
    </div>
  )
}

