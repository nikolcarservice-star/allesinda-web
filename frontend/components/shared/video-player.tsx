"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { getVideoPlaybackFallbackUrl, getVideoPlaybackUrl, toMediaRelativePath } from "@/lib/utils"
import { tryEnterVideoFullscreen } from "@/lib/video-fullscreen"

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

function getPosterSrc(thumbnailUrl: string | null | undefined): string | undefined {
  if (!thumbnailUrl || isVideoUrl(thumbnailUrl)) return undefined
  return getVideoPlaybackUrl(thumbnailUrl) || undefined
}

export function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  title,
  isOpen,
  onClose,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mounted, setMounted] = useState(false)
  const primarySrc = videoUrl ? getVideoPlaybackUrl(videoUrl) : ""
  const fallbackSrc = videoUrl ? getVideoPlaybackFallbackUrl(videoUrl) : null
  const [videoSrc, setVideoSrc] = useState(primarySrc)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setVideoSrc(getVideoPlaybackUrl(videoUrl))
    setLoadError(false)
  }, [isOpen, videoUrl])

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handleEscape)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen, onClose])

  const handleVideoError = useCallback(() => {
    if (fallbackSrc && videoSrc !== fallbackSrc) {
      setVideoSrc(fallbackSrc)
      return
    }
    setLoadError(true)
  }, [fallbackSrc, videoSrc])

  const handleCanPlay = useCallback(() => {
    tryEnterVideoFullscreen(videoRef.current)
  }, [])

  if (!isOpen || !mounted) return null

  const posterSrc = getPosterSrc(thumbnailUrl ?? undefined)

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col bg-black"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Video"}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[10001] rounded-full bg-black/60 p-2 text-white backdrop-blur-sm"
        aria-label="Schließen"
      >
        <X className="h-6 w-6 sm:h-7 sm:w-7" />
      </button>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {loadError ? (
          <p className="px-4 text-center text-sm text-white">Video konnte nicht geladen werden.</p>
        ) : videoSrc ? (
          <video
            ref={videoRef}
            key={videoSrc}
            src={videoSrc}
            controls
            autoPlay
            playsInline
            muted
            preload="auto"
            onCanPlay={handleCanPlay}
            onLoadedData={handleCanPlay}
            onClick={() => tryEnterVideoFullscreen(videoRef.current)}
            onError={handleVideoError}
            className="h-full w-full object-contain"
            poster={posterSrc}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <p className="text-sm text-white">
            {videoUrl ? "Video URL konnte nicht geladen werden" : "Keine Video-URL"}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
