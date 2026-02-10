"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Play } from "lucide-react"
import type { Media } from "@/lib/api/types"
import { getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"

interface ThumbnailGalleryProps {
  mediaItems: Media[]
  imageUrl?: string
  selectedIndex: number
  onSelect: (index: number) => void
  title: string
  className?: string
}

export function ThumbnailGallery({
  mediaItems,
  imageUrl,
  selectedIndex,
  onSelect,
  title,
  className = "",
}: ThumbnailGalleryProps) {
  const [isMobile, setIsMobile] = useState(false)
  const thumbnailGalleryRef = useRef<HTMLDivElement>(null)

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-scroll to selected thumbnail when there are many items
  useEffect(() => {
    if (thumbnailGalleryRef.current && mediaItems) {
      const shouldScroll = isMobile 
        ? mediaItems.length > 3
        : mediaItems.length > 6
      
      if (shouldScroll) {
        const selectedThumbnail = thumbnailGalleryRef.current.children[selectedIndex] as HTMLElement
        if (selectedThumbnail) {
          selectedThumbnail.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          })
        }
      }
    }
  }, [selectedIndex, mediaItems, isMobile])

  // Get all media items sorted by sort_order
  const sortedMediaItems = mediaItems && mediaItems.length > 0 
    ? [...mediaItems].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    : []

  // If no media items but there's an image_url, create a temporary media item for thumbnail
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

  // Show thumbnail gallery if there's at least one media item
  if (displayMediaItems.length === 0) return null

  // Use horizontal scroll for many items on desktop, always scroll on mobile for better UX
  const useScroll = isMobile 
    ? displayMediaItems.length > 3  // Mobile: scroll if more than 3 items
    : displayMediaItems.length > 6   // Desktop: scroll if more than 6 items

  return (
    <div 
      ref={thumbnailGalleryRef}
      className={`${useScroll 
        ? "flex gap-2.5 sm:gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-2 sm:pb-3 snap-x snap-mandatory scroll-smooth -mx-3 sm:-mx-4 md:mx-0 px-3 sm:px-4 md:px-0 touch-pan-x py-0.5"
        : "grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-3 md:gap-4"
      } ${className}`}
    >
      {displayMediaItems.map((media, index) => (
        <button
          key={media.id || `thumb-${index}`}
          onClick={() => onSelect(index)}
          className={`relative aspect-square rounded-lg sm:rounded-xl border-2 transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 ${
            useScroll ? "flex-shrink-0 w-20 sm:w-24 md:w-28 snap-center min-w-[5rem] sm:min-w-[6rem] md:min-w-[7rem]" : ""
          } ${
            selectedIndex === index
              ? "border-primary shadow-xl m-0.5"
              : "border-border/50 hover:border-primary/60"
          }`}
        >
          <div className="relative w-full h-full rounded-lg sm:rounded-xl overflow-hidden">
            {media.media_type === "video" ? (
              <div className="relative w-full h-full group">
                <Image
                  src={getOptimizedImageUrl(media.thumbnail_url || media.url, 'thumbnail')}
                  alt={`${title} - ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-200 group-hover:scale-110"
                  unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(media.thumbnail_url || media.url, 'thumbnail'))}
                  sizes="(max-width: 640px) 25vw, (max-width: 1024px) 20vw, 16vw"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-200 group-hover:bg-black/50">
                  <div className="bg-black/60 backdrop-blur-md rounded-full p-2 sm:p-2.5 border border-white/20 shadow-lg transform group-hover:scale-110 transition-transform duration-200">
                    <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-white fill-white" />
                  </div>
                </div>
              </div>
            ) : (
              <Image
                src={getOptimizedImageUrl(media.url, 'thumbnail')}
                alt={`${title} - ${index + 1}`}
                fill
                className="object-cover transition-transform duration-200 hover:scale-110"
                unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(media.url, 'thumbnail'))}
                sizes="(max-width: 640px) 25vw, (max-width: 1024px) 20vw, 16vw"
              />
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

