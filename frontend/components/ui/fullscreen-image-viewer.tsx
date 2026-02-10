"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"

interface FullscreenImageViewerProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string | null | undefined
  alt: string
  onPrevious?: () => void
  onNext?: () => void
}

export function FullscreenImageViewer({
  isOpen,
  onClose,
  imageUrl,
  alt,
  onPrevious,
  onNext,
}: FullscreenImageViewerProps) {
  // Handle ESC key to close full-screen image and prevent body scroll
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key === "ArrowLeft") {
        onPrevious?.()
        return
      }
      if (e.key === "ArrowRight") {
        onNext?.()
      }
    }

    document.addEventListener("keydown", handleEscape)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose, onPrevious, onNext])

  const touchStartXRef = useRef<number | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !imageUrl || !mounted) return null

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    // Enable swiping on all screens when navigation is available
    if (!onPrevious && !onNext) return
    
    if (event.touches.length > 0) {
      touchStartXRef.current = event.touches[0].clientX
    }
  }

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    // Enable swiping on all screens when navigation is available
    if (!onPrevious && !onNext) return
    
    if (touchStartXRef.current === null) return
    const touch = event.changedTouches[0]
    if (!touch) return

    const deltaX = touch.clientX - touchStartXRef.current
    touchStartXRef.current = null

    const threshold = 40
    if (Math.abs(deltaX) < threshold) {
      return
    }

    if (deltaX > 0) {
      onPrevious?.()
    } else {
      onNext?.()
    }
  }

  const content = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black pointer-events-auto" 
      onClick={onClose}
      style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onClose()
        }}
        className="absolute top-4 right-4 z-[10000] rounded-full bg-black/70 p-2 text-white transition-all duration-200 hover:bg-black/90 hover:scale-110 active:scale-95 pointer-events-auto shadow-lg hover:shadow-xl"
        aria-label="Schließen"
        style={{ zIndex: 10000 }}
      >
        <X className="h-6 w-6 sm:h-8 sm:w-8 transition-transform duration-200" />
      </button>
      <div
        className="relative h-full w-full max-h-[100vh] max-w-[100vw] p-4 sm:p-6 md:p-8 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={getOptimizedImageUrl(imageUrl, 'full') || "/placeholder.svg"}
          alt={alt}
          fill
          className="object-contain"
          sizes="100vw"
          quality={100}
          unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(imageUrl, 'full'))}
          priority
        />

        {onPrevious && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              event.preventDefault()
              onPrevious()
            }}
            className="absolute left-4 sm:left-6 top-1/2 flex h-10 w-10 sm:h-12 sm:w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/80 text-black shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 pointer-events-auto z-[10000]"
            aria-label="Vorheriges Bild"
            style={{ zIndex: 10000 }}
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        )}

        {onNext && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              event.preventDefault()
              onNext()
            }}
            className="absolute right-4 sm:right-6 top-1/2 flex h-10 w-10 sm:h-12 sm:w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/80 text-black shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 pointer-events-auto z-[10000]"
            aria-label="Nächstes Bild"
            style={{ zIndex: 10000 }}
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

