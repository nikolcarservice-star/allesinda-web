"use client"

import { useState, useEffect, useMemo, memo, type MouseEvent } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { BeforeAfterCard } from "./before-after-card"
import { Play, Video, ImageIcon, Trash2 } from "lucide-react"
import type { Media } from "@/lib/api/types"
import { getOptimizedImageUrl, toMediaRelativePath, cn } from "@/lib/utils"
import { BeforeAfterFullscreenModal, VideoFullscreenModal } from "./gallery-fullscreen-modal"
import { FullscreenImageViewer } from "@/components/ui/fullscreen-image-viewer"

type GalleryItem = Media & {
  master_name?: string
  master_profile_id?: number
  master_verified?: boolean
  master_image_url?: string | null // Profile image URL
}

interface GalleryCardProps {
  item: GalleryItem
  href: string
  onVideoClick?: (item: GalleryItem) => void
  priority?: boolean
  hideProfile?: boolean
  showStatusBadge?: boolean
  showTypeBadge?: boolean
  onDelete?: (item: GalleryItem) => void
  isDeleting?: boolean
  allItems?: GalleryItem[]
  currentIndex?: number
}

function GalleryCardInner({ 
  item, 
  href, 
  onVideoClick, 
  priority = false, 
  hideProfile = false,
  showStatusBadge = false,
  showTypeBadge = false,
  onDelete,
  isDeleting = false,
  allItems,
  currentIndex
}: GalleryCardProps) {
  const imageData = getItemImage(item)
  const [showBeforeAfterModal, setShowBeforeAfterModal] = useState(false)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  
  // Get all image items for navigation (filter out videos and before-after)
  const imageItems = useMemo(() => {
    if (!allItems) return []
    return allItems
      .map((it, idx) => {
        const img = getItemImage(it)
        if (img.type === "image") {
          return { item: it, index: idx, imageUrl: img.image }
        }
        return null
      })
      .filter((v): v is { item: GalleryItem; index: number; imageUrl: string } => v !== null)
  }, [allItems])
  
  // Find the current image index in the filtered list when modal opens or currentIndex changes
  useEffect(() => {
    if (showImageModal && imageItems.length > 0) {
      if (allItems && currentIndex !== undefined) {
        // Try to find the image at the currentIndex
        const imgIndex = imageItems.findIndex(img => img.index === currentIndex)
        if (imgIndex !== -1) {
          setCurrentImageIndex(imgIndex)
          return
        }
      }
      // If current item is an image, find its index in the filtered list
      const currentItemIndex = imageItems.findIndex(img => img.item.id === item.id)
      if (currentItemIndex !== -1) {
        setCurrentImageIndex(currentItemIndex)
      } else {
        setCurrentImageIndex(0)
      }
    }
  }, [showImageModal, allItems, currentIndex, imageItems, item.id])
  
  // Use same-origin paths for all gallery media so they load via Next.js rewrite — works on mobile (no CORS) and after backend redeploy
  const imageSrc = imageData.type === "image"
    ? (imageData.image ? (imageData.image.startsWith("/") ? imageData.image : `/${imageData.image}`) : "/placeholder.svg")
    : ""
  // Video thumbnail: same-origin path; placeholder when no real thumbnail (e.g. backend fell back to video URL)
  const thumbSrc = imageData.type === "video"
    ? (imageData.thumbnail
        ? (imageData.thumbnail.startsWith("/") ? imageData.thumbnail : `/${imageData.thumbnail}`)
        : "/placeholder.svg")
    : ""

  const handleCardClick = (event: MouseEvent) => {
    if (imageData.type === "before-after") {
      event.preventDefault()
      event.stopPropagation()
      setShowBeforeAfterModal(true)
    } else if (imageData.type === "video") {
      event.preventDefault()
      event.stopPropagation()
      if (onVideoClick) {
        onVideoClick(item)
      } else {
        setShowVideoModal(true)
      }
    } else if (imageData.type === "image") {
      // For regular images, open fullscreen instead of navigating
      event.preventDefault()
      event.stopPropagation()
      setShowImageModal(true)
    }
  }

  const handleVideoOverlayClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (onVideoClick) {
      onVideoClick(item)
    } else {
      setShowVideoModal(true)
    }
  }

  return (
    <>
      <Link href={href} onClick={handleCardClick}>
        <Card className="overflow-hidden rounded-none group cursor-pointer transition-all duration-300 h-full flex flex-col border border-border/40">
        {imageData.type === "before-after" ? (
          <div className="relative aspect-square bg-muted rounded-none overflow-hidden">
            <BeforeAfterCard
              beforeUrl={imageData.before}
              afterUrl={imageData.after}
              priority={priority}
            />
            {/* Type Badge overlay */}
            {showTypeBadge && (
              <div className="absolute top-2 left-2">
                <Badge className="bg-indigo-500/90 text-white px-2 py-0.5 text-xs font-semibold border-0 shadow-md shrink-0">
                  Vorher/Nachher
                </Badge>
              </div>
            )}
          </div>
        ) : imageData.type === "video" ? (
          <div className="relative aspect-square bg-muted cursor-pointer rounded-none overflow-hidden" onClick={handleVideoOverlayClick}>
            <img
              src={thumbSrc}
              alt={item.title || "Video"}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 rounded-none"
              loading={priority ? "eager" : "lazy"}
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Play className="h-6 w-6 text-foreground fill-foreground ml-0.5" />
              </div>
            </div>
            {/* Type Badge overlay */}
            {showTypeBadge && (
              <div className="absolute top-2 left-2">
                <Badge className="bg-purple-500/90 text-white px-2 py-0.5 text-xs font-semibold border-0 shadow-md flex items-center gap-1 shrink-0">
                  <Video className="h-3 w-3" />
                  Video
                </Badge>
              </div>
            )}
          </div>
        ) : (
          <div className="relative aspect-square bg-muted cursor-pointer" onClick={handleCardClick}>
            <img
              src={imageSrc}
              alt={item.title || "Arbeit"}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading={priority ? "eager" : "lazy"}
              referrerPolicy="no-referrer"
            />
            {/* Type Badge overlay */}
            {showTypeBadge && (
              <div className="absolute top-2 left-2">
                <Badge className="bg-blue-500/90 text-white px-2 py-0.5 text-xs font-semibold border-0 shadow-md flex items-center gap-1 shrink-0">
                  <ImageIcon className="h-3 w-3" />
                  Foto
                </Badge>
              </div>
            )}
          </div>
        )}
        <div className="p-2.5 sm:p-3 md:p-4 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1">
            <h4 className="font-semibold text-xs sm:text-sm md:text-base group-hover:text-primary transition-colors truncate flex-1 min-w-0" title={item.title || "Unbenannte Arbeit"}>
              {item.title || "Unbenannte Arbeit"}
            </h4>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            {showStatusBadge && item.status && (
              <Badge
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-md shrink-0",
                  item.status === "approved" && "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20",
                  item.status === "pending" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20",
                  item.status === "rejected" && "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                )}
              >
                {item.status === "approved" ? "Genehmigt" : 
                 item.status === "pending" ? "Ausstehend" : 
                 item.status === "rejected" ? "Abgelehnt" : 
                 "Unbekannt"}
              </Badge>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(item)
                }}
                disabled={isDeleting}
                className="h-7 w-7 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-all hover:scale-110 rounded-md flex items-center justify-center ml-auto"
                title="Medien löschen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {!hideProfile && item.master_name && (
            <div className="flex items-center gap-2 mt-1">
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0">
                {item.master_image_url ? (
                  <AvatarImage
                    src={getOptimizedImageUrl(item.master_image_url, 'thumbnail') || undefined}
                    alt={item.master_name}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="text-xs sm:text-sm">
                  {item.master_name?.[0]?.toUpperCase() || 'M'}
                </AvatarFallback>
              </Avatar>
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground line-clamp-1">{item.master_name}</p>
            </div>
          )}
        </div>
        </Card>
      </Link>

      {imageData.type === "before-after" && (
        <BeforeAfterFullscreenModal
          item={item}
          isOpen={showBeforeAfterModal}
          onClose={() => setShowBeforeAfterModal(false)}
        />
      )}

      {imageData.type === "video" && (
        <VideoFullscreenModal
          item={item}
          isOpen={showVideoModal}
          onClose={() => setShowVideoModal(false)}
        />
      )}

      {imageData.type === "image" && (
        <FullscreenImageViewer
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
          imageUrl={imageItems.length > 0 ? imageItems[currentImageIndex]?.imageUrl || imageData.image || null : imageData.image || null}
          alt={imageItems.length > 0 ? imageItems[currentImageIndex]?.item.title || item.title || "Arbeit" : item.title || "Arbeit"}
          onPrevious={
            imageItems.length > 1
              ? () => {
                  const prevIndex = currentImageIndex - 1 < 0 ? imageItems.length - 1 : currentImageIndex - 1
                  setCurrentImageIndex(prevIndex)
                }
              : undefined
          }
          onNext={
            imageItems.length > 1
              ? () => {
                  const nextIndex = currentImageIndex + 1 >= imageItems.length ? 0 : currentImageIndex + 1
                  setCurrentImageIndex(nextIndex)
                }
              : undefined
          }
        />
      )}
    </>
  )
}

export const GalleryCard = memo(GalleryCardInner)

function safeUrl(u: unknown): string | undefined | null {
  if (u == null) return undefined
  if (typeof u === "string") return u.trim() || undefined
  return undefined
}

/** Get URL from media item (API may return url or file_url) */
function getMediaUrl(item: GalleryItem): string | undefined {
  const url = safeUrl(item?.url) ?? safeUrl((item as { file_url?: string })?.file_url)
  return url || undefined
}

const VIDEO_EXT = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i

/** True if URL points to a video file (do not use in <img>). Thumbnails are also under /videos/ but have .jpg extension. */
function isVideoUrl(url: string | undefined): boolean {
  if (!url) return false
  const path = toMediaRelativePath(url) || url
  return VIDEO_EXT.test(path)
}

function getItemImage(item: GalleryItem) {
  const beforeUrl = safeUrl(item?.before_url)
  const afterUrl = safeUrl(item?.after_url)
  if (item?.is_before_after && beforeUrl && afterUrl) {
    return {
      type: "before-after" as const,
      before: toMediaRelativePath(beforeUrl) || getOptimizedImageUrl(beforeUrl, 'full'),
      after: toMediaRelativePath(afterUrl) || getOptimizedImageUrl(afterUrl, 'full'),
    }
  }
  if (item?.media_type === "video") {
    const thumb = safeUrl(item?.thumbnail_url)
    const url = getMediaUrl(item)
    // Backend may set thumbnail_url to video URL when thumbnail generation fails — never use that in <img>
    const validThumb = thumb && !isVideoUrl(thumb) && thumb !== url
    const thumbPath = validThumb ? (toMediaRelativePath(thumb) || getOptimizedImageUrl(thumb, 'gallery')) : ""
    return {
      type: "video" as const,
      thumbnail: thumbPath || undefined,
    }
  }
  const rawUrl = getMediaUrl(item)
  const imagePath = toMediaRelativePath(rawUrl)
  const imageOptimized = getOptimizedImageUrl(rawUrl, 'gallery')
  return { type: "image" as const, image: imagePath || imageOptimized }
}

