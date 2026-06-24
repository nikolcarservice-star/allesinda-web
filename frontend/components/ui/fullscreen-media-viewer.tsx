"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getOptimizedImageUrl, getVideoPlaybackUrl, shouldUseUnoptimized } from "@/lib/utils"
import type { Media } from "@/lib/api/types"

interface FullscreenMediaViewerProps {
  isOpen: boolean
  onClose: () => void
  mediaItems: Media[]
  currentIndex: number
  onIndexChange: (index: number) => void
  productTitle?: string
}

export function FullscreenMediaViewer({
  isOpen,
  onClose,
  mediaItems,
  currentIndex,
  onIndexChange,
  productTitle = "Media",
}: FullscreenMediaViewerProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [hasSwiped, setHasSwiped] = useState(false)

  // Handle ESC / стрелки в полноэкранном режиме
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleArrowKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onIndexChange(currentIndex > 0 ? currentIndex - 1 : mediaItems.length - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onIndexChange(currentIndex < mediaItems.length - 1 ? currentIndex + 1 : 0)
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleArrowKeys)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleArrowKeys)
    }
  }, [isOpen, onClose, currentIndex, onIndexChange, mediaItems.length])

  if (!isOpen || mediaItems.length === 0) return null

  const currentMedia = mediaItems[currentIndex]
  const isVideo = currentMedia.media_type === "video"

  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't start swipe if touching buttons or links
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.tagName === 'BUTTON' || target.tagName === 'A') {
      return
    }
    
    // Check if touching video controls area (bottom 20% of video)
    const videoElement = target.closest('video') as HTMLVideoElement
    if (videoElement) {
      const rect = videoElement.getBoundingClientRect()
      const touchY = e.touches[0].clientY
      const videoBottom = rect.bottom
      const controlAreaHeight = rect.height * 0.2
      // If touch is in the bottom 20% (control area), don't start swipe
      if (touchY > videoBottom - controlAreaHeight) {
        return
      }
    }
    
    setTouchEnd(null)
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    // Don't track swipe if touching buttons or links
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.tagName === 'BUTTON' || target.tagName === 'A') {
      return
    }
    
    // Check if touching video controls area
    const videoElement = target.closest('video') as HTMLVideoElement
    if (videoElement) {
      const rect = videoElement.getBoundingClientRect()
      const touchY = e.touches[0].clientY
      const videoBottom = rect.bottom
      const controlAreaHeight = rect.height * 0.2
      // If touch is in the bottom 20% (control area), don't track swipe
      if (touchY > videoBottom - controlAreaHeight) {
        return
      }
    }
    
    setTouchEnd(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Don't process swipe if touching buttons or links
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.tagName === 'BUTTON' || target.tagName === 'A') {
      setTouchStart(null)
      setTouchEnd(null)
      return
    }
    
    // Check if touching video controls area
    const videoElement = target.closest('video') as HTMLVideoElement
    if (videoElement && touchStart) {
      const rect = videoElement.getBoundingClientRect()
      const touchY = e.changedTouches[0]?.clientY
      if (touchY) {
        const videoBottom = rect.bottom
        const controlAreaHeight = rect.height * 0.2
        // If touch is in the bottom 20% (control area), don't process swipe
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
    
    if ((isLeftSwipe || isRightSwipe) && mediaItems.length > 1) {
      e.preventDefault()
      setHasSwiped(true)
      if (isLeftSwipe) {
        // Swipe left - next image
        onIndexChange(currentIndex < mediaItems.length - 1 ? currentIndex + 1 : 0)
      } else if (isRightSwipe) {
        // Swipe right - previous image
        onIndexChange(currentIndex > 0 ? currentIndex - 1 : mediaItems.length - 1)
      }
      // Reset swipe flag after a short delay to allow click detection
      setTimeout(() => setHasSwiped(false), 300)
    }
    
    setTouchStart(null)
    setTouchEnd(null)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Don't close if a swipe just occurred
    if (hasSwiped) {
      e.preventDefault()
      return
    }
    onClose()
  }

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute top-4 right-4 z-[101] bg-black/70 hover:bg-black/90 text-white rounded-full p-2 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-6 w-6 sm:h-8 sm:w-8" />
      </button>

      {/* Navigation Arrows */}
      {mediaItems.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onIndexChange(currentIndex > 0 ? currentIndex - 1 : mediaItems.length - 1)
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-[101] bg-black/60 hover:bg-black/90 active:bg-black/95 text-white hover:text-white backdrop-blur-md border border-white/30 hover:border-white/50 active:border-white/60 transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl h-10 w-10 sm:h-12 sm:w-12 rounded-full group touch-manipulation"
            aria-label="Vorheriges"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 text-white transition-transform group-hover:-translate-x-0.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onIndexChange(currentIndex < mediaItems.length - 1 ? currentIndex + 1 : 0)
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-[101] bg-black/60 hover:bg-black/90 active:bg-black/95 text-white hover:text-white backdrop-blur-md border border-white/30 hover:border-white/50 active:border-white/60 transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl h-10 w-10 sm:h-12 sm:w-12 rounded-full group touch-manipulation"
            aria-label="Nächstes"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-white transition-transform group-hover:translate-x-0.5" />
          </Button>
        </>
      )}

      {/* Media Counter */}
      {mediaItems.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[101] bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
          {currentIndex + 1} / {mediaItems.length}
        </div>
      )}

      {/* Media Content */}
      <div 
        className="relative w-full h-full max-w-[100vw] max-h-[100vh] p-4 sm:p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              src={getVideoPlaybackUrl(currentMedia.url)}
              controls
              playsInline
              muted
              className="max-w-full max-h-full object-contain"
              poster={getOptimizedImageUrl(currentMedia.thumbnail_url, 'gallery')}
              autoPlay
            >
              Your browser does not support the video tag.
            </video>
            <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1.5 rounded text-sm flex items-center gap-2 z-10">
              <Play className="h-4 w-4" />
              Video
            </div>
          </div>
        ) : (
          <Image
            src={getOptimizedImageUrl(currentMedia.url, 'full') || "/placeholder.svg"}
            alt={`${productTitle} - ${currentIndex + 1}`}
            fill
            className="object-contain"
            sizes="100vw"
            quality={100}
            priority
            unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(currentMedia.url, 'full'))}
          />
        )}
      </div>
    </div>
  )
}

