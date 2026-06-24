"use client"

import { useCallback, useRef } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { getOptimizedImageUrl, getVideoPlaybackUrl } from "@/lib/utils"
import { tryEnterVideoFullscreen } from "@/lib/video-fullscreen"
import type { Media } from "@/lib/api/types"

interface VideoPlayerDialogProps {
  video: Media | null
  isOpen: boolean
  onClose: () => void
}

export function VideoPlayerDialog({ video, isOpen, onClose }: VideoPlayerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleCanPlay = useCallback(() => {
    tryEnterVideoFullscreen(videoRef.current)
  }, [])

  if (!video || !video.url) return null

  const videoSrc = getVideoPlaybackUrl(video.url)
  const thumbnailUrl = video.thumbnail_url ? getOptimizedImageUrl(video.thumbnail_url, 'gallery') : undefined

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="fixed inset-0 z-[9999] flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-none bg-black p-0 [&_[data-slot=dialog-close]]:top-[max(0.75rem,env(safe-area-inset-top))] [&_[data-slot=dialog-close]]:right-3 [&_[data-slot=dialog-close]]:text-white">
        <DialogTitle className="sr-only">{video.title || "Video"}</DialogTitle>
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            autoPlay
            playsInline
            muted
            preload="auto"
            onCanPlay={handleCanPlay}
            onLoadedData={handleCanPlay}
            onClick={() => tryEnterVideoFullscreen(videoRef.current)}
            className="h-full w-full object-contain"
            poster={thumbnailUrl}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </DialogContent>
    </Dialog>
  )
}

