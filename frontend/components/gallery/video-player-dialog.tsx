"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { getOptimizedImageUrl, getVideoPlaybackUrl } from "@/lib/utils"
import type { Media } from "@/lib/api/types"

interface VideoPlayerDialogProps {
  video: Media | null
  isOpen: boolean
  onClose: () => void
}

export function VideoPlayerDialog({ video, isOpen, onClose }: VideoPlayerDialogProps) {
  if (!video || !video.url) return null

  const videoSrc = getVideoPlaybackUrl(video.url)
  const thumbnailUrl = video.thumbnail_url ? getOptimizedImageUrl(video.thumbnail_url, 'gallery') : undefined

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-3xl overflow-hidden border-none bg-black p-0 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:right-4 sm:[&_[data-slot=dialog-close]]:top-6 sm:[&_[data-slot=dialog-close]]:right-6">
        <DialogTitle className="sr-only">{video.title || "Video"}</DialogTitle>
        <div className="relative aspect-video w-full bg-black">
          <video
            src={videoSrc}
            controls
            autoPlay
            playsInline
            muted
            className="h-full w-full object-contain"
            poster={thumbnailUrl}
          >
            Your browser does not support the video tag.
          </video>
        </div>
        {video.title && (
          <div className="bg-background p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold mb-2">{video.title}</h3>
            {video.description && (
              <p className="text-sm sm:text-base text-muted-foreground">{video.description}</p>
            )}
            {video.master_name && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                by {video.master_name}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

