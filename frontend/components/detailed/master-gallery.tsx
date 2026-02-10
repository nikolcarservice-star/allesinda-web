"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Play, Maximize2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { VideoPlayer } from "@/components/shared/video-player"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { FullscreenImageViewer } from "@/components/ui/fullscreen-image-viewer"
import { cn } from "@/lib/utils"
import { logger } from "@/lib/logger"

export type MasterGalleryItem =
  | {
      kind: "image"
      key: string
      title?: string | null
      url: string
    }
  | {
      kind: "video"
      key: string
      title?: string | null
      url: string
      thumbnail?: string | null
    }
  | {
      kind: "before-after"
      key: string
      title?: string | null
      before: string
      after: string
    }

interface MasterGalleryProps {
  items: MasterGalleryItem[]
  edgeToEdge?: boolean
}

const GAP_PX = 12
const MAX_COLUMNS = 6
const ENABLE_GALLERY_DEBUG = false

function galleryDebug(...args: unknown[]) {
  if (!ENABLE_GALLERY_DEBUG) return
  logger.log("[MasterGallery]", ...args)
}

export function MasterGallery({ items, edgeToEdge = true }: MasterGalleryProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const touchOriginRef = useRef<{ x: number; y: number } | null>(null)
  const verticalSwipeRef = useRef(false)
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null)

  const updateScrollState = useCallback(() => {
    const node = viewportRef.current
    if (!node) return
    const nextLeft = node.scrollLeft > 4
    const nextRight = node.scrollLeft < node.scrollWidth - node.clientWidth - 4
    if (ENABLE_GALLERY_DEBUG) {
      galleryDebug("updateScrollState", {
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        nextLeft,
        nextRight,
      })
    }
    setCanScrollLeft((prev) => (prev === nextLeft ? prev : nextLeft))
    setCanScrollRight((prev) => (prev === nextRight ? prev : nextRight))
  }, [])

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return

    const handleScroll = () => updateScrollState()
    const handleResize = () => updateScrollState()
    const handleMeasure = () => {
      const width = node.clientWidth
      if (!Number.isFinite(width) || width <= 0) return
      setViewportWidth((prev) => (Math.abs(prev - width) <= 0.5 ? prev : width))
    }

    updateScrollState()
    handleMeasure()
    const handleScrollWrapper = (event: Event) => {
      if (ENABLE_GALLERY_DEBUG) {
        galleryDebug("scroll", {
          scrollLeft: node.scrollLeft,
          scrollTop: node.scrollTop,
          eventType: event.type,
        })
      }
      handleScroll()
    }
    node.addEventListener("scroll", handleScrollWrapper, { passive: true })
    window.addEventListener("resize", handleResize)
    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(() => {
        if (ENABLE_GALLERY_DEBUG) {
          galleryDebug("resizeObserver")
        }
        handleMeasure()
      })
      resizeObserver.observe(node)
      return () => {
        node.removeEventListener("scroll", handleScrollWrapper)
        window.removeEventListener("resize", handleResize)
        resizeObserver.disconnect()
      }
    }

    return () => {
      node.removeEventListener("scroll", handleScrollWrapper)
      window.removeEventListener("resize", handleResize)
    }
  }, [updateScrollState])

  useEffect(() => {
    updateScrollState()
  }, [items.length, updateScrollState])

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      touchOriginRef.current = { x: touch.clientX, y: touch.clientY }
      verticalSwipeRef.current = false
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY }
      if (viewportRef.current) {
        viewportRef.current.style.overflowX = ""
      }
      galleryDebug("touchStart", { x: touch.clientX, y: touch.clientY })
    }

    const handleTouchMove = (event: TouchEvent) => {
      const origin = touchOriginRef.current
      const touch = event.touches[0]
      if (!origin || !touch) return
      const deltaX = touch.clientX - origin.x
      const deltaY = touch.clientY - origin.y
      if (ENABLE_GALLERY_DEBUG) {
        galleryDebug("touchMove", { deltaX, deltaY })
      }

      if (verticalSwipeRef.current) {
        const last = lastTouchRef.current
        if (last) {
          const incrementalY = touch.clientY - last.y
        if (Math.abs(incrementalY) > 0.025) {
          window.scrollBy({ top: -incrementalY * 9.5, behavior: "auto" })
            lastTouchRef.current = { x: touch.clientX, y: touch.clientY }
            galleryDebug("verticalScroll", { incrementalY })
          }
        } else {
          lastTouchRef.current = { x: touch.clientX, y: touch.clientY }
        }
        event.preventDefault()
        return
      }

      if (Math.abs(deltaY) > Math.abs(deltaX) + 6) {
        verticalSwipeRef.current = true
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY }
        if (viewportRef.current) {
          viewportRef.current.style.overflowX = "hidden"
        }
        event.preventDefault()
      }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (ENABLE_GALLERY_DEBUG && touchOriginRef.current) {
        const touch = event.changedTouches[0]
        if (touch) {
          const deltaX = touch.clientX - touchOriginRef.current.x
          const deltaY = touch.clientY - touchOriginRef.current.y
          galleryDebug("touchEnd", { deltaX, deltaY })
        }
      }
      touchOriginRef.current = null
      verticalSwipeRef.current = false
      lastTouchRef.current = null
      if (viewportRef.current) {
        viewportRef.current.style.overflowX = ""
      }
    }

    node.addEventListener("touchstart", handleTouchStart, { passive: true })
    node.addEventListener("touchmove", handleTouchMove, { passive: false })
    node.addEventListener("touchend", handleTouchEnd, { passive: true })
    node.addEventListener("touchcancel", handleTouchEnd, { passive: true })

    return () => {
      node.removeEventListener("touchstart", handleTouchStart)
      node.removeEventListener("touchmove", handleTouchMove)
      node.removeEventListener("touchend", handleTouchEnd)
      node.removeEventListener("touchcancel", handleTouchEnd)
    }
  }, [])

  const scrollBy = useCallback((direction: "left" | "right") => {
    const node = viewportRef.current
    if (!node) return

    const firstCard = node.querySelector<HTMLElement>("[data-gallery-card]")
    if (!firstCard) return

    const firstRect = firstCard.getBoundingClientRect()
    const nextCard = firstCard.nextElementSibling as HTMLElement | null
    let step = firstRect.width

    if (nextCard) {
      const nextRect = nextCard.getBoundingClientRect()
      const gap = nextRect.left - firstRect.right
      if (!Number.isNaN(gap) && gap > 0) {
        step += gap
      }
    } else if (node.children.length === 1) {
      step = node.clientWidth * 0.8
    }

    galleryDebug("scrollBy", { direction, step })
    node.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" })
  }, [])

  const imageEntries = useMemo(
    () =>
      items.flatMap((item) => {
        if (item.kind === "before-after") {
          return [
            {
              key: `${item.key}-before`,
              url: item.before,
              alt: item.title ? `${item.title} – vorher` : "Vorher-Bild",
            },
            {
              key: `${item.key}-after`,
              url: item.after,
              alt: item.title ? `${item.title} – nachher` : "Nachher-Bild",
            },
          ]
        }

        if (item.kind === "image") {
          return [
            {
              key: item.key,
              url: item.url,
              alt: item.title ?? "Galeriebild",
            },
          ]
        }

        return []
      }),
    [items],
  )

  const imageIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    imageEntries.forEach((entry, index) => map.set(entry.key, index))
    return map
  }, [imageEntries])

  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null)
  const [activeVideo, setActiveVideo] = useState<Extract<MasterGalleryItem, { kind: "video" }> | null>(null)
  const [activeBeforeAfter, setActiveBeforeAfter] =
    useState<Extract<MasterGalleryItem, { kind: "before-after" }> | null>(null)

  const openImage = (key: string) => {
    const index = imageIndexMap.get(key)
    if (index != null) {
      setActiveImageIndex(index)
    }
  }

  const fallbackWidth = edgeToEdge ? 1280 : 640
  const containerWidth = viewportWidth || fallbackWidth
  const desiredWidth = edgeToEdge ? 260 : 200
  const minColumns = edgeToEdge ? 1 : 2
  const estimatedColumns = Math.floor((containerWidth + GAP_PX) / (desiredWidth + GAP_PX))
  const columns = Math.min(
    MAX_COLUMNS,
    Math.max(minColumns, Number.isFinite(estimatedColumns) && estimatedColumns > 0 ? estimatedColumns : minColumns),
  )
  const flexBasis =
    columns <= 1
      ? "100%"
      : `calc((100% - ${(columns - 1) * GAP_PX}px) / ${columns})`

  const baseCardStyle: CSSProperties = {
    flex: `0 0 ${flexBasis}`,
    maxWidth: flexBasis,
  }
  const beforeAfterCardStyle: CSSProperties = baseCardStyle

  const renderCard = (item: MasterGalleryItem) => {
    if (item.kind === "before-after") {
      const beforeKey = `${item.key}-before`
      const afterKey = `${item.key}-after`

      return (
        <div key={item.key} data-gallery-card className="flex flex-col snap-start" style={beforeAfterCardStyle}>
          <div className="overflow-hidden border border-border/60 bg-background/80 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
            <div className="grid grid-cols-2 gap-0.5 bg-muted/40">
              <button
                type="button"
                onClick={() => openImage(beforeKey)}
                className="relative aspect-square overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Image
                  src={item.before}
                  alt={item.title ? `${item.title} – vorher` : "Vorher"}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <Badge className="absolute left-2 top-2 bg-black/70 text-white">Vorher</Badge>
                <Maximize2 className="absolute bottom-2 right-2 h-4 w-4 text-white opacity-80" />
              </button>
              <button
                type="button"
                onClick={() => openImage(afterKey)}
                className="relative aspect-square overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Image
                  src={item.after}
                  alt={item.title ? `${item.title} – nachher` : "Nachher"}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <Badge className="absolute right-2 top-2 bg-primary text-primary-foreground">Nachher</Badge>
                <Maximize2 className="absolute bottom-2 right-2 h-4 w-4 text-white opacity-80" />
              </button>
            </div>

            {item.title && (
              <div className="space-y-1 border-t border-border/60 bg-background/90 p-4">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <button
                  type="button"
                  onClick={() => setActiveBeforeAfter(item)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Vergleich anzeigen
                </button>
              </div>
            )}
          </div>
        </div>
      )
    }

    if (item.kind === "video") {
      return (
        <div key={item.key} data-gallery-card className="flex snap-start" style={baseCardStyle}>
          <button
            type="button"
            onClick={() => setActiveVideo(item)}
            className={cn(
              "group relative aspect-[4/5] w-full overflow-hidden border border-border/60 bg-black text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md",
            )}
          >
            <Image
              src={item.thumbnail || item.url || "/placeholder.svg"}
              alt={item.title ?? "Video"}
              fill
              sizes="(max-width: 640px) 70vw, (max-width: 1024px) 30vw, 20vw"
              className="object-cover opacity-80 transition duration-200 group-hover:scale-105 group-hover:opacity-100"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition group-hover:scale-110">
                <Play className="ml-1 h-7 w-7 fill-primary" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              {item.title && <p className="text-sm font-semibold text-white">{item.title}</p>}
            </div>
          </button>
        </div>
      )
    }

    return (
      <div key={item.key} data-gallery-card className="flex snap-start" style={baseCardStyle}>
        <button
          type="button"
          onClick={() => openImage(item.key)}
          className="group relative aspect-[4/5] w-full overflow-hidden border border-border/60 bg-muted shadow-sm transition hover:-translate-y-1 hover:shadow-md"
        >
          <Image
            src={item.url}
            alt={item.title ?? "Gallery image"}
            fill
            sizes="(max-width: 640px) 70vw, (max-width: 1024px) 30vw, 20vw"
            className="object-cover transition duration-200 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          <Maximize2 className="absolute right-3 top-3 h-5 w-5 text-white opacity-90 transition group-hover:scale-110" />
          {item.title && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              <p className="text-sm font-semibold text-white">{item.title}</p>
            </div>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className={cn("overflow-x-hidden", edgeToEdge && "md:overflow-visible")}>
          <div
            ref={viewportRef}
            className={cn(
              "flex gap-3 pb-4",
              edgeToEdge ? "-ml-4 -mr-4 pl-4 pr-4" : "px-2 sm:px-3",
              items.length > 1 ? "overflow-x-auto md:snap-x md:snap-mandatory [&::-webkit-scrollbar]:hidden" : "overflow-hidden",
            )}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {items.map((item) => renderCard(item))}
          </div>
        </div>

        {items.length > 1 && canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy("left")}
            className="absolute left-1 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 shadow-md transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 md:flex"
            aria-label="Galerie nach links scrollen"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {items.length > 1 && canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy("right")}
            className="absolute right-1 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 shadow-md transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 md:flex"
            aria-label="Galerie nach rechts scrollen"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      <FullscreenImageViewer
        isOpen={activeImageIndex !== null}
        onClose={() => setActiveImageIndex(null)}
        imageUrl={activeImageIndex !== null ? imageEntries[activeImageIndex]?.url ?? null : null}
        alt={activeImageIndex !== null ? imageEntries[activeImageIndex]?.alt ?? "Gallery image" : "Gallery image"}
        onPrevious={
          activeImageIndex !== null && imageEntries.length > 1
            ? () =>
                setActiveImageIndex((prev) => {
                  if (prev === null) return prev
                  return prev - 1 < 0 ? imageEntries.length - 1 : prev - 1
                })
            : undefined
        }
        onNext={
          activeImageIndex !== null && imageEntries.length > 1
            ? () =>
                setActiveImageIndex((prev) => {
                  if (prev === null) return prev
                  return prev + 1 >= imageEntries.length ? 0 : prev + 1
                })
            : undefined
        }
      />

      <VideoPlayer
        videoUrl={activeVideo?.url ?? ""}
        thumbnailUrl={activeVideo?.thumbnail ?? null}
        title={activeVideo?.title ?? null}
        isOpen={!!activeVideo}
        onClose={() => setActiveVideo(null)}
      />

      <Dialog open={!!activeBeforeAfter} onOpenChange={(open) => !open && setActiveBeforeAfter(null)}>
        <DialogContent className="w-full max-w-4xl border-none bg-background p-0">
          {activeBeforeAfter && (
            <>
              <DialogTitle className="sr-only">{activeBeforeAfter.title ?? "Vorher und nachher"}</DialogTitle>
              <div className="grid gap-0.5 bg-muted/40 md:grid-cols-2">
                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src={activeBeforeAfter.before}
                    alt={activeBeforeAfter.title ? `${activeBeforeAfter.title} – vorher` : "Vorher"}
                    fill
                    className="object-cover"
                  />
                  <Badge className="absolute left-3 top-3 bg-black/75 text-white">Vorher</Badge>
                </div>
                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src={activeBeforeAfter.after}
                    alt={activeBeforeAfter.title ? `${activeBeforeAfter.title} – nachher` : "Nachher"}
                    fill
                    className="object-cover"
                  />
                  <Badge className="absolute right-3 top-3 bg-primary text-primary-foreground">Nachher</Badge>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
