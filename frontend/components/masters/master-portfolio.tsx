"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, Loader2, Image as ImageIcon, ChevronDown, CheckCircle2 } from "lucide-react"
import { getProfileGallery } from "@/lib/api/gallery"
import { MediaUpload } from "./media-upload"
import { FullscreenImageViewer } from "@/components/ui/fullscreen-image-viewer"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/lib/context/auth-context"
import type { Media } from "@/lib/api/types"
import { getOptimizedImageUrl, getVideoPlaybackUrl, shouldUseUnoptimized, toMediaRelativePath } from "@/lib/utils"

interface MasterPortfolioProps {
  masterId: string
  profileId?: number
  isOwnProfile?: boolean
  verified?: boolean
}

export function MasterPortfolio({ masterId, profileId, isOwnProfile = false, verified = false }: MasterPortfolioProps) {
  const [portfolio, setPortfolio] = useState<Media[]>([])
  const [displayedItems, setDisplayedItems] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<Media | null>(null)
  const [itemsToShow, setItemsToShow] = useState(5) // Show 5 items initially
  const { user } = useAuth()

  useEffect(() => {
    if (profileId) {
      loadPortfolio(profileId)
    }
  }, [profileId])

  const loadPortfolio = async (profileId: number) => {
    try {
      setLoading(true)
      const response = await getProfileGallery(profileId, {
        page: 1,
        page_size: 20,
        // All media is now automatically approved, no filtering needed
      })
      const items = response.items || []
      setPortfolio(items)
      setDisplayedItems(items.slice(0, itemsToShow))
    } catch (error: any) {
      console.error("Failed to load portfolio:", error)
      setPortfolio([])
      setDisplayedItems([])
    } finally {
      setLoading(false)
    }
  }

  // Update displayed items when itemsToShow changes
  useEffect(() => {
    if (portfolio.length > 0) {
      setDisplayedItems(portfolio.slice(0, itemsToShow))
    }
  }, [itemsToShow, portfolio])

  const handleLoadMore = () => {
    setItemsToShow(prev => prev + 5) // Load 5 more items
  }

  const handleUploadComplete = () => {
    if (profileId) {
      loadPortfolio(profileId)
    }
  }

  // Check if current user is viewing their own profile
  const canUpload = isOwnProfile && user?.role === "master"

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      {canUpload && (
        <div className="flex justify-end">
          <MediaUpload onUploadComplete={handleUploadComplete} />
        </div>
      )}
      {portfolio.length === 0 ? (
        <div className="text-center py-8 sm:py-12 md:py-16 space-y-2 sm:space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-muted/50 mb-3 sm:mb-4">
            <ImageIcon className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-muted-foreground" />
          </div>
          <p className="text-sm sm:text-base md:text-lg font-semibold text-foreground">No portfolio items yet</p>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
            {canUpload
              ? "Laden Sie Ihre Arbeit hoch, um Ihre Fähigkeiten zu präsentieren"
              : "Dieser Meister hat noch keine Arbeiten zu seiner Galerie hinzugefügt"}
          </p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
      {displayedItems.map((item) => {
        const isBeforeAfter = item.is_before_after && item.before_url && item.after_url
        const isVideo = item.media_type === "video"

        return (
          <div key={item.id} className="relative h-full flex flex-col bg-gradient-to-br from-purple-50/60 via-violet-50/50 to-fuchsia-50/60 dark:from-purple-950/25 dark:via-violet-950/20 dark:to-fuchsia-950/25 rounded-lg border border-purple-300/70 dark:border-purple-700/50 overflow-hidden hover:border-purple-400/80 dark:hover:border-purple-600/60 transition-all duration-200 hover:shadow-md hover:shadow-purple-500/10 group cursor-pointer">
            {isBeforeAfter ? (
              <div className="relative aspect-square bg-muted overflow-hidden">
                <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
                <div 
                    className="relative overflow-hidden cursor-pointer"
                  onClick={() => setSelectedImage({ url: item.before_url!, alt: `${item.title || "Work"} - Before` })}
                >
                  <Image
                    src={getOptimizedImageUrl(item.before_url, 'gallery') || "/placeholder.svg"}
                    alt="Vorher"
                    fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      sizes="(max-width: 768px) 50vw, 25vw"
                      quality={90}
                      loading="lazy"
                      unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.before_url, 'gallery'))}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-100 transition-opacity duration-300 group-hover:opacity-0"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-60 group-hover:opacity-0 transition-opacity duration-300"></div>
                    <Badge className="absolute top-1.5 left-1.5 bg-slate-600/90 backdrop-blur-sm text-white border-0 shadow-lg px-2 py-1 text-[10px] font-bold leading-tight uppercase tracking-wide hover:bg-slate-700/90 transition-all duration-200 z-10">
                      Vorher
                    </Badge>
                </div>
                <div 
                    className="relative overflow-hidden cursor-pointer"
                  onClick={() => setSelectedImage({ url: item.after_url!, alt: `${item.title || "Arbeit"} - Nachher` })}
                >
                  <Image
                    src={getOptimizedImageUrl(item.after_url, 'gallery') || "/placeholder.svg"}
                    alt="Nachher"
                    fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      sizes="(max-width: 768px) 50vw, 25vw"
                      quality={90}
                      loading="lazy"
                      unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.after_url, 'gallery'))}
                  />
                    <div className="absolute inset-0 bg-black/40 opacity-100 transition-opacity duration-300 group-hover:opacity-0"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-60 group-hover:opacity-0 transition-opacity duration-300"></div>
                    <Badge className="absolute top-1.5 right-1.5 bg-blue-600/90 backdrop-blur-sm text-white border-0 shadow-lg px-2 py-1 text-[10px] font-bold leading-tight uppercase tracking-wide hover:bg-blue-700/90 transition-all duration-200 z-10">
                      Nachher
                    </Badge>
                  </div>
                </div>
                
                {/* Category Badge - Bottom Left */}
                {item.category && (
                  <div className="absolute bottom-1.5 left-1.5 z-10 max-w-[calc(100%-3rem)]">
                    <Badge className="bg-purple-600/90 backdrop-blur-sm text-white border-0 shadow-lg px-2 py-1 text-[10px] font-bold leading-tight uppercase tracking-wide hover:bg-purple-700/90 transition-all duration-200 truncate block max-w-full">
                      {item.category}
                    </Badge>
                  </div>
                )}
                
                {/* Status Badges - Bottom Right */}
                <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1.5">
                  {verified && (
                    <Badge className="bg-emerald-600/90 backdrop-blur-sm text-white border-0 shadow-lg px-2 py-1 gap-1.5 h-auto hover:bg-emerald-700/90 transition-all duration-200">
                      <CheckCircle2 className="h-3 w-3 text-white fill-white shrink-0" />
                      <span className="text-[10px] font-bold leading-tight uppercase tracking-wide">Verified</span>
                    </Badge>
                  )}
                  {isOwnProfile && item.status === "pending" && (
                    <Badge variant="secondary" className="text-[10px] font-bold leading-tight uppercase tracking-wide px-2 py-1">
                      Pending
                    </Badge>
                  )}
                  {isOwnProfile && item.status === "rejected" && (
                    <Badge variant="destructive" className="text-[10px] font-bold leading-tight uppercase tracking-wide px-2 py-1">
                      Rejected
                    </Badge>
                  )}
                </div>
              </div>
            ) : isVideo ? (
              <div 
                className="relative aspect-square bg-muted overflow-hidden cursor-pointer"
                onClick={() => setSelectedVideo(item)}
              >
                <Image
                  src={getOptimizedImageUrl(item.thumbnail_url || item.url, 'gallery') || "/placeholder.svg"}
                  alt={item.title || "Video"}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  quality={90}
                  loading="lazy"
                  unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.thumbnail_url || item.url, 'gallery'))}
                />
                <div className="absolute inset-0 bg-black/40 opacity-100 transition-opacity duration-300 group-hover:opacity-0"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-60 group-hover:opacity-0 transition-opacity duration-300"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 backdrop-blur-md shadow-md border border-white/30 hover:shadow-lg group-hover:scale-110 transition-all duration-200">
                    <Play className="h-5 w-5 text-purple-600 fill-purple-600 ml-0.5" />
                  </div>
                </div>
                
                {/* Category Badge - Bottom Left */}
                {item.category && (
                  <div className="absolute bottom-1.5 left-1.5 z-10 max-w-[calc(100%-3rem)]">
                    <Badge className="bg-purple-600/90 backdrop-blur-sm text-white border-0 shadow-lg px-2 py-1 text-[10px] font-bold leading-tight uppercase tracking-wide hover:bg-purple-700/90 transition-all duration-200 truncate block max-w-full">
                      {item.category}
                    </Badge>
                  </div>
                )}
                
                {/* Status Badges - Bottom Right */}
                <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1.5">
                  {verified && (
                    <Badge className="bg-emerald-600/90 backdrop-blur-sm text-white border-0 shadow-lg px-2 py-1 gap-1.5 h-auto hover:bg-emerald-700/90 transition-all duration-200">
                      <CheckCircle2 className="h-3 w-3 text-white fill-white shrink-0" />
                      <span className="text-[10px] font-bold leading-tight uppercase tracking-wide">Verified</span>
                    </Badge>
                  )}
                  {isOwnProfile && item.status === "pending" && (
                    <Badge variant="secondary" className="text-[10px] font-bold leading-tight uppercase tracking-wide px-2 py-1">
                      Pending
                    </Badge>
                  )}
                  {isOwnProfile && item.status === "rejected" && (
                    <Badge variant="destructive" className="text-[10px] font-bold leading-tight uppercase tracking-wide px-2 py-1">
                      Rejected
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative aspect-square bg-muted overflow-hidden">
              <div 
                  className="relative w-full h-full cursor-pointer"
                onClick={() => setSelectedImage({ url: item.url, alt: item.title || "Work" })}
              >
                <Image
                  src={getOptimizedImageUrl(item.url, 'gallery') || "/placeholder.svg"}
                  alt={item.title || "Work"}
                  fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 50vw"
                    quality={90}
                    loading="lazy"
                    unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.url, 'gallery'))}
                />
                  <div className="absolute inset-0 bg-black/40 opacity-100 transition-opacity duration-300 group-hover:opacity-0"></div>
                </div>
                
                {/* Category Badge - Bottom Left */}
                {item.category && (
                  <div className="absolute bottom-1.5 left-1.5 z-10 max-w-[calc(100%-3rem)]">
                    <Badge className="bg-purple-600/90 backdrop-blur-sm text-white border-0 shadow-lg px-2 py-1 text-[10px] font-bold leading-tight uppercase tracking-wide hover:bg-purple-700/90 transition-all duration-200 truncate block max-w-full">
                      {item.category}
                    </Badge>
              </div>
            )}
                
                {/* Status Badges - Bottom Right */}
                <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1.5">
                  {verified && (
                    <Badge className="bg-emerald-600/90 backdrop-blur-sm text-white border-0 shadow-lg px-2 py-1 gap-1.5 h-auto hover:bg-emerald-700/90 transition-all duration-200">
                      <CheckCircle2 className="h-3 w-3 text-white fill-white shrink-0" />
                      <span className="text-[10px] font-bold leading-tight uppercase tracking-wide">Verified</span>
                    </Badge>
                  )}
                  {isOwnProfile && item.status === "pending" && (
                    <Badge variant="secondary" className="text-[10px] font-bold leading-tight uppercase tracking-wide px-2 py-1">
                      Pending
                    </Badge>
                  )}
                  {isOwnProfile && item.status === "rejected" && (
                    <Badge variant="destructive" className="text-[10px] font-bold leading-tight uppercase tracking-wide px-2 py-1">
                      Rejected
                  </Badge>
                )}
                </div>
              </div>
            )}
            
            {/* Content */}
            <div className="p-2.5 flex flex-col gap-1.5">
              {/* Title */}
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors break-words">
                {item.title || "Untitled Work"}
              </h3>
              
              {/* Description */}
              {item.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 truncate">{item.description}</p>
              )}
            </div>
          </div>
        )
      })}
        </div>
        </>
      )}

      {/* Floating Load More Button */}
      {portfolio.length > displayedItems.length && (
        <div className="fixed bottom-4 sm:bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-50">
          <Button
            onClick={handleLoadMore}
            className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300 rounded-full px-4 sm:px-6 py-2 sm:py-3 h-auto text-xs sm:text-sm font-semibold"
            size="lg"
          >
            Load More
            <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      )}

      {/* Full-Screen Image Viewer */}
      <FullscreenImageViewer
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage?.url}
        alt={selectedImage?.alt || "Portfolio image"}
      />

      {/* Video Player Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden">
          {selectedVideo && (
            <>
              <DialogTitle className="sr-only">{selectedVideo.title || "Video"}</DialogTitle>
              <div className="relative w-full aspect-video bg-black rounded-t-lg overflow-hidden">
                <video
                  src={getVideoPlaybackUrl(selectedVideo.url)}
                  controls
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                  poster={getOptimizedImageUrl(selectedVideo.thumbnail_url, 'gallery')}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              {selectedVideo.title && (
                <div className="p-4 sm:p-6 rounded-b-lg bg-background">
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">{selectedVideo.title}</h3>
                  {selectedVideo.description && (
                    <p className="text-sm sm:text-base text-muted-foreground">{selectedVideo.description}</p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
