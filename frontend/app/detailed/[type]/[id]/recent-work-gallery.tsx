"use client"

import { useState } from "react"
import { GalleryCardCarousel } from "@/components/gallery/gallery-card-carousel"
import { VideoPlayer } from "@/components/shared/video-player"
import type { Media } from "@/lib/api/types"

type GalleryMediaItem = Media & {
  master_name?: string
  master_profile_id?: number
  master_verified?: boolean
}

interface RecentWorkGalleryProps {
  items: GalleryMediaItem[]
  href: string
}

export function RecentWorkGallery({ items, href }: RecentWorkGalleryProps) {
  const [selectedVideo, setSelectedVideo] = useState<Media | null>(null)

  const handleVideoClick = (item: GalleryMediaItem) => {
    setSelectedVideo(item)
  }

  return (
    <>
      <GalleryCardCarousel
        items={items}
        href={href}
        onVideoClick={handleVideoClick}
        ariaLabel="Recent Work gallery"
        hideProfile={true}
      />

      {selectedVideo && (
        <VideoPlayer
          videoUrl={selectedVideo.url || ""}
          thumbnailUrl={selectedVideo.thumbnail_url || undefined}
          title={selectedVideo.title || undefined}
          isOpen={true}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </>
  )
}

