"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"

type GalleryItem = {
  before_url?: string | null
  after_url?: string | null
  url?: string | null
  media_type?: string
  title?: string | null
}

interface BeforeAfterFullscreenModalProps {
  item: GalleryItem
  isOpen: boolean
  onClose: () => void
}

export function BeforeAfterFullscreenModal({
  item,
  isOpen,
  onClose,
}: BeforeAfterFullscreenModalProps) {
  const [showSingleImage, setShowSingleImage] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  const beforeUrl = item.before_url ? getOptimizedImageUrl(item.before_url, 'full') : null
  const afterUrl = item.after_url ? getOptimizedImageUrl(item.after_url, 'full') : null
  const images = [beforeUrl, afterUrl].filter((url): url is string => url !== null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setShowSingleImage(false)
      setCurrentImageIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index)
    setShowSingleImage(true)
  }

  const handleNext = useCallback(() => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  const handlePrev = useCallback(() => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!showSingleImage) return
      if (e.key === "ArrowLeft") {
        handlePrev()
      } else if (e.key === "ArrowRight") {
        handleNext()
      } else if (e.key === "Escape") {
        if (showSingleImage) {
          setShowSingleImage(false)
        } else {
          onClose()
        }
      }
    },
    [showSingleImage, handlePrev, handleNext, onClose],
  )

  useEffect(() => {
    if (showSingleImage) {
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }
  }, [showSingleImage, handleKeyDown])

  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && images.length > 1) {
      handleNext()
    }
    if (isRightSwipe && images.length > 1) {
      handlePrev()
    }
  }

  if (!isOpen || !mounted) return null

  if (showSingleImage) {
    const content = (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center" style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        <button
          onClick={() => setShowSingleImage(false)}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 text-white hover:text-gray-300 transition-colors p-2"
          aria-label="Schließen"
        >
          <X className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>

        {images.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 hidden items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors md:flex"
              aria-label="Vorheriges Bild"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 hidden items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors md:flex"
              aria-label="Nächstes Bild"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        <div
          className="relative w-full h-full flex items-center justify-center"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <Image
            src={images[currentImageIndex] || "/placeholder.svg"}
            alt={currentImageIndex === 0 ? "Vorher" : "Nachher"}
            fill
            className="object-contain"
            quality={100}
            priority
          />
        </div>

        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  index === currentImageIndex ? "w-8 bg-white" : "w-2 bg-white/50",
                )}
                aria-label={`Zum Bild ${index + 1} gehen`}
              />
            ))}
          </div>
        )}
      </div>
    )
    return createPortal(content, document.body)
  }

  const content = (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center" style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 text-white hover:text-gray-300 transition-colors p-2"
        aria-label="Schließen"
      >
        <X className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>

      <div className="w-full h-full flex flex-col md:flex-row items-center justify-center gap-0.5 sm:gap-1 p-2 sm:p-4">
        {beforeUrl && (
          <div
            className="relative flex-1 w-full md:w-auto h-full max-h-[50%] md:max-h-full max-w-full md:max-w-[50%] cursor-pointer group"
            onClick={() => handleImageClick(0)}
          >
            <Image
              src={beforeUrl}
              alt="Vorher"
              fill
              className="object-contain transition-opacity group-hover:opacity-90"
              quality={100}
              priority
              unoptimized={shouldUseUnoptimized(beforeUrl)}
            />
            <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 md:bottom-4 md:left-4 bg-black/80 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium backdrop-blur-md border border-white/20 shadow-lg">
              Vorher
            </div>
          </div>
        )}
        {afterUrl && (
          <div
            className="relative flex-1 w-full md:w-auto h-full max-h-[50%] md:max-h-full max-w-full md:max-w-[50%] cursor-pointer group"
            onClick={() => handleImageClick(1)}
          >
            <Image
              src={afterUrl}
              alt="Nachher"
              fill
              unoptimized={shouldUseUnoptimized(afterUrl)}
              className="object-contain transition-opacity group-hover:opacity-90"
              quality={100}
              priority
            />
            <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 md:bottom-4 md:right-4 bg-primary/90 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium backdrop-blur-md border border-white/20 shadow-lg">
              Nachher
            </div>
          </div>
        )}
      </div>
    </div>
  )
  return createPortal(content, document.body)
}

interface VideoFullscreenModalProps {
  item: GalleryItem
  isOpen: boolean
  onClose: () => void
}

export function VideoFullscreenModal({ item, isOpen, onClose }: VideoFullscreenModalProps) {
  const videoUrl = item.url ? getOptimizedImageUrl(item.url, 'original') : null
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  if (!isOpen || !videoUrl || !mounted) return null

  const content = (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center" style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 text-white hover:text-gray-300 transition-colors p-2.5 sm:p-3"
        aria-label="Schließen"
      >
        <X className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>

      <div className="w-full h-full flex items-center justify-center">
        <video
          src={videoUrl}
          controls
          autoPlay
          className="rounded-sm"
          style={{ 
            width: "auto",
            height: "auto",
            maxWidth: "calc(100vw - 6rem)",
            maxHeight: "calc(100vh - 6rem)",
            objectFit: "contain",
            margin: "3rem"
          }}
        >
          Ihr Browser unterstützt das Video-Tag nicht.
        </video>
      </div>
    </div>
  )
  return createPortal(content, document.body)
}

