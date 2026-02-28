"use client"

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { toMediaRelativePath } from "@/lib/utils"

interface VideoPlayerProps {
  videoUrl: string
  thumbnailUrl?: string | null
  title?: string | null
  isOpen: boolean
  onClose: () => void
}

const VIDEO_EXT = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i
function isVideoUrl(url: string): boolean {
  const path = toMediaRelativePath(url) || url
  return VIDEO_EXT.test(path)
}

/** Build a URL the browser can load for video. Same-origin path so Next.js rewrite applies (avoids CORS). */
function getVideoSrc(pathOrUrl: string): string {
  if (!pathOrUrl) return ""
  const path = toMediaRelativePath(pathOrUrl)
  if (!path) return ""
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return path.startsWith("/") ? path : `/${path}`
}

/** Same-origin URL for poster image so it loads on mobile; undefined if no valid thumbnail (e.g. backend sent video URL). */
function getPosterSrc(thumbnailUrl: string | null | undefined): string | undefined {
  if (!thumbnailUrl || isVideoUrl(thumbnailUrl)) return undefined
  const path = toMediaRelativePath(thumbnailUrl)
  if (!path) return undefined
  return path.startsWith("/") ? path : `/${path}`
}

export function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  title,
  isOpen,
  onClose,
}: VideoPlayerProps) {
  const videoSrc = videoUrl ? getVideoSrc(videoUrl) : ""
  const posterSrc = getPosterSrc(thumbnailUrl ?? undefined)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!grid max-w-3xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden border-none bg-black rounded-sm [&_[data-slot=dialog-close]]:!absolute [&_[data-slot=dialog-close]]:!top-0 [&_[data-slot=dialog-close]]:!right-0 [&_[data-slot=dialog-close]]:!z-50 [&_[data-slot=dialog-close]]:bg-transparent [&_[data-slot=dialog-close]]:backdrop-blur-sm [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:p-2.5 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-transparent [&_[data-slot=dialog-close]]:h-9 [&_[data-slot=dialog-close]]:w-9 [&_[data-slot=dialog-close]]:flex [&_[data-slot=dialog-close]]:items-center [&_[data-slot=dialog-close]]:justify-center [&_[data-slot=dialog-close]]:border-none sm:[&_[data-slot=dialog-close]]:h-10 sm:[&_[data-slot=dialog-close]]:w-10 sm:[&_[data-slot=dialog-close]]:p-3">
        <VisuallyHidden>
          <DialogTitle>{title ?? "Video"}</DialogTitle>
          <DialogDescription>Video player dialog</DialogDescription>
        </VisuallyHidden>
        {videoSrc ? (
          <div className="relative w-full aspect-video bg-black rounded-sm overflow-hidden">
            <video
              src={videoSrc}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain rounded-sm"
              poster={posterSrc}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          <div className="relative w-full aspect-video bg-black flex items-center justify-center text-white rounded-sm">
            <p>{videoUrl ? "Video URL konnte nicht geladen werden" : "No video URL provided"}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

