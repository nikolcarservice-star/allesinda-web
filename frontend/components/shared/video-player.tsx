"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { getVideoPlaybackFallbackUrl, getVideoPlaybackUrl, toMediaRelativePath } from "@/lib/utils"

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

  if (!isOpen || !mounted) return null

  const posterSrc = getPosterSrc(thumbnailUrl ?? undefined)

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Video"}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-[10000] rounded-full bg-black/70 p-2 text-white shadow-lg transition hover:bg-black/90 hover:scale-110 active:scale-95"
        aria-label="Schließen"
      >
        <X className="h-6 w-6 sm:h-8 sm:w-8" />
      </button>
      <div
        className="relative flex h-full w-full max-h-[100vh] max-w-[100vw] items-center justify-center p-4 pt-14"
        onClick={(e) => e.stopPropagation()}
      >
        {loadError ? (
          <p className="px-4 text-center text-sm text-white">Video konnte nicht geladen werden.</p>
        ) : videoSrc ? (
          <video
            key={videoSrc}
            src={videoSrc}
            controls
            autoPlay
            playsInline
            muted
            preload="metadata"
            onError={handleVideoError}
            className="max-h-full max-w-full object-contain"
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
