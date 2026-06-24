"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, ChevronLeft, ChevronRight } from "lucide-react"
import { FullscreenMediaViewer } from "@/components/ui/fullscreen-media-viewer"
import type { Media } from "@/lib/api/types"
import { getOptimizedImageUrl, getVideoPlaybackUrl, shouldUseUnoptimized } from "@/lib/utils"

interface MediaGalleryProps {
  mediaItems: Media[]
  imageUrl?: string
  title: string
  aspectRatio?: "square" | "video"
  showBadge?: {
    text: string
    variant?: "default" | "destructive" | "secondary" | "outline"
  }
  className?: string
  selectedIndex?: number
  onIndexChange?: (index: number) => void
}

export function MediaGallery({
  mediaItems,
  imageUrl,
  title,
  aspectRatio = "square",
  showBadge,
  className = "",
  selectedIndex: controlledIndex,
  onIndexChange,
}: MediaGalleryProps) {
  const [internalIndex, setInternalIndex] = useState(0)
  const selectedImageIndex = controlledIndex !== undefined ? controlledIndex : internalIndex
  const setSelectedImageIndex = onIndexChange || setInternalIndex
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Reset image error when media changes
  useEffect(() => {
    setImageError(false)
  }, [mediaItems])

  // Get all media items sorted by sort_order
  const sortedMediaItems = mediaItems && mediaItems.length > 0 
    ? [...mediaItems].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    : []

  // Fallback to image_url if no media
  const hasMedia = sortedMediaItems.length > 0
  const currentMedia = hasMedia ? sortedMediaItems[selectedImageIndex] : null
  const fallbackImage = imageUrl || "/placeholder.svg"

  // Display media items for fullscreen viewer
  const displayMediaItems = sortedMediaItems.length > 0 
    ? sortedMediaItems 
    : imageUrl 
      ? [{
          id: 0,
          url: imageUrl,
          thumbnail_url: imageUrl,
          media_type: "photo" as const,
          product_id: undefined,
          rental_id: undefined,
          profile_id: undefined,
          owner_id: 0,
          sort_order: 0,
          status: "approved" as const,
          is_before_after: false,
          created_at: new Date().toISOString(),
        } as Media]
      : []

  const handleClick = () => {
    if (displayMediaItems.length > 0 || imageUrl) {
      setIsImageModalOpen(true)
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.tagName === 'BUTTON' || target.tagName === 'A') {
      return
    }
    
    const videoElement = target.closest('video') as HTMLVideoElement
    if (videoElement) {
      const rect = videoElement.getBoundingClientRect()
      const touchY = e.touches[0].clientY
      const videoBottom = rect.bottom
      const controlAreaHeight = rect.height * 0.2
      if (touchY > videoBottom - controlAreaHeight) {
        return
      }
    }
    
    setTouchEnd(null)
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.tagName === 'BUTTON' || target.tagName === 'A') {
      return
    }
    
    const videoElement = target.closest('video') as HTMLVideoElement
    if (videoElement) {
      const rect = videoElement.getBoundingClientRect()
      const touchY = e.touches[0].clientY
      const videoBottom = rect.bottom
      const controlAreaHeight = rect.height * 0.2
      if (touchY > videoBottom - controlAreaHeight) {
        return
      }
    }
    
    setTouchEnd(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.tagName === 'BUTTON' || target.tagName === 'A') {
      setTouchStart(null)
      setTouchEnd(null)
      return
    }
    
    const videoElement = target.closest('video') as HTMLVideoElement
    if (videoElement && touchStart) {
      const rect = videoElement.getBoundingClientRect()
      const touchY = e.changedTouches[0]?.clientY || e.touches[0]?.clientY
      if (touchY) {
        const videoBottom = rect.bottom
        const controlAreaHeight = rect.height * 0.2
        if (touchY > videoBottom - controlAreaHeight) {
          setTouchStart(null)
          setTouchEnd(null)
          return
        }
      }
    }
    
    if (!touchStart || !touchEnd) {
      setTouchStart(null)
      setTouchEnd(null)
      return
    }
    
    const distance = touchStart - touchEnd
    const minSwipeDistance = 50
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe || isRightSwipe) {
      if (sortedMediaItems.length > 1) {
        e.preventDefault()
        if (isLeftSwipe) {
          const newIndex = selectedImageIndex < sortedMediaItems.length - 1 ? selectedImageIndex + 1 : 0
          if (onIndexChange) {
            onIndexChange(newIndex)
          } else {
            setInternalIndex(newIndex)
          }
        } else if (isRightSwipe) {
          const newIndex = selectedImageIndex > 0 ? selectedImageIndex - 1 : sortedMediaItems.length - 1
          if (onIndexChange) {
            onIndexChange(newIndex)
          } else {
            setInternalIndex(newIndex)
          }
        }
      }
    }
    
    setTouchStart(null)
    setTouchEnd(null)
  }

  const aspectClass = aspectRatio === "square" ? "aspect-square" : "aspect-video"

  return (
    <>
      <div 
        className={`relative ${aspectClass} rounded-lg sm:rounded-xl overflow-hidden bg-muted group shadow-lg sm:shadow-xl cursor-pointer transition-all duration-300 hover:shadow-2xl ${className}`}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {currentMedia && currentMedia.media_type === "video" ? (
          <div className="relative w-full h-full">
            <video
              src={getVideoPlaybackUrl(currentMedia.url)}
              controls
              playsInline
              className="w-full h-full object-cover"
              poster={getOptimizedImageUrl(currentMedia.thumbnail_url, 'gallery')}
              onClick={(e) => e.stopPropagation()}
            >
              Your browser does not support the video tag.
            </video>
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-black/80 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-lg border border-white/20 z-10">
              <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Video
            </div>
            {(hasMedia || imageUrl) && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center pointer-events-none">
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg border border-white/20 transform group-hover:scale-105">
                  Klicken Sie, um Vollbild anzuzeigen
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <Image
              src={getOptimizedImageUrl(currentMedia?.url || fallbackImage, 'full') || "/placeholder.svg"}
              alt={title}
              fill
              className="object-contain transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 1024px) 100vw, 50vw"
              quality={90}
              priority
              unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(currentMedia?.url || fallbackImage, 'full'))}
              onError={() => setImageError(true)}
            />
            {(hasMedia || imageUrl) && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center pointer-events-none">
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg border border-white/20 transform group-hover:scale-105">
                  Klicken Sie, um Vollbild anzuzeigen
                </div>
              </div>
            )}
          </>
        )}

        {/* Navigation arrows for multiple images */}
        {sortedMediaItems.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 sm:left-3 md:left-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 active:bg-black/95 text-white hover:text-white backdrop-blur-md border border-white/30 hover:border-white/50 active:border-white/60 transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full z-10 group touch-manipulation"
              onClick={(e) => {
                e.stopPropagation()
                const newIndex = selectedImageIndex > 0 ? selectedImageIndex - 1 : sortedMediaItems.length - 1
                if (onIndexChange) {
                  onIndexChange(newIndex)
                } else {
                  setInternalIndex(newIndex)
                }
              }}
            >
              <ChevronLeft className="h-4.5 w-4.5 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white transition-transform group-hover:-translate-x-0.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 sm:right-3 md:right-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 active:bg-black/95 text-white hover:text-white backdrop-blur-md border border-white/30 hover:border-white/50 active:border-white/60 transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full z-10 group touch-manipulation"
              onClick={(e) => {
                e.stopPropagation()
                const newIndex = selectedImageIndex < sortedMediaItems.length - 1 ? selectedImageIndex + 1 : 0
                if (onIndexChange) {
                  onIndexChange(newIndex)
                } else {
                  setInternalIndex(newIndex)
                }
              }}
            >
              <ChevronRight className="h-4.5 w-4.5 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white transition-transform group-hover:translate-x-0.5" />
            </Button>
            <div className="absolute bottom-2 sm:bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 bg-black/75 hover:bg-black/90 backdrop-blur-md text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm md:text-base font-semibold shadow-lg border border-white/20 transition-all duration-200 z-10">
              {selectedImageIndex + 1} / {sortedMediaItems.length}
            </div>
          </>
        )}

        {/* Badge */}
        {showBadge && (
          <Badge className={`absolute top-3 right-3 sm:top-4 sm:right-4 text-xs sm:text-sm z-10 ${showBadge.variant === "destructive" ? "bg-destructive" : showBadge.variant === "secondary" ? "bg-secondary" : showBadge.variant === "outline" ? "bg-background border" : "bg-accent"}`}>
            {showBadge.text}
          </Badge>
        )}
      </div>

      {/* Fullscreen Media Viewer */}
      {displayMediaItems.length > 0 && (
        <FullscreenMediaViewer
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          mediaItems={displayMediaItems}
          currentIndex={selectedImageIndex}
          onIndexChange={setSelectedImageIndex}
          productTitle={title}
        />
      )}
    </>
  )
}

