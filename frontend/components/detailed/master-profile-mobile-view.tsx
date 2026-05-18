"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { MapPin, Phone, Star, Play } from "lucide-react"
import { FullscreenImageViewer } from "@/components/ui/fullscreen-image-viewer"
import type { Media } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { ActionButton } from "@/components/detailed/action-button"
import { ShareProfileButton } from "@/components/detailed/share-profile-button"
import { MasterFeaturedReview } from "@/components/detailed/master-featured-review"
import { ReviewsSection } from "@/components/detailed/reviews-section"
import { VideoPlayer } from "@/components/shared/video-player"

type TabId = "profile" | "photo" | "video" | "reviews"

type GalleryMediaItem = Media & {
  master_name?: string
  master_profile_id?: number
  master_verified?: boolean
}

interface MasterProfileMobileViewProps {
  profileId: number
  title: string
  professionLabel?: string | null
  rating?: number | null
  totalReviews?: number | null
  heroImage: string
  priceFromLabel?: string | null
  contactHref: string
  shareTitle: string
  shareDescription?: string | null
  availabilityLabel: string
  cityName?: string | null
  categories?: string[]
  about?: string | null
  galleryItems: GalleryMediaItem[]
  sellerId?: number | null
}

function isVideoItem(item: GalleryMediaItem): boolean {
  const type = item.media_type?.toLowerCase() ?? ""
  return type.includes("video")
}

function getItemImageUrl(item: GalleryMediaItem): string {
  if (isVideoItem(item)) {
    return item.thumbnail_url || item.url || "/placeholder.svg"
  }
  return item.thumbnail_url || item.url || "/placeholder.svg"
}

export function MasterProfileMobileView({
  title,
  professionLabel,
  rating,
  totalReviews,
  heroImage,
  priceFromLabel,
  contactHref,
  shareTitle,
  shareDescription,
  availabilityLabel,
  cityName,
  categories = [],
  about,
  galleryItems,
  sellerId,
}: MasterProfileMobileViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("photo")
  const [selectedVideo, setSelectedVideo] = useState<GalleryMediaItem | null>(null)
  const [fullscreenPhotoIndex, setFullscreenPhotoIndex] = useState<number | null>(null)

  const photos = useMemo(
    () => galleryItems.filter((item) => !isVideoItem(item) && !item.is_before_after),
    [galleryItems],
  )
  const videos = useMemo(() => galleryItems.filter((item) => isVideoItem(item)), [galleryItems])

  const photoItems = useMemo(() => {
    if (photos.length > 0) return photos
    return [
      {
        id: 0,
        owner_id: 0,
        url: heroImage,
        media_type: "image",
        status: "approved",
        is_before_after: false,
        created_at: new Date().toISOString(),
      } satisfies GalleryMediaItem,
    ]
  }, [photos, heroImage])

  const displayTitle = professionLabel
    ? `${title} | ${professionLabel}`.toUpperCase()
    : title.toUpperCase()

  const tabs: { id: TabId; label: string }[] = [
    { id: "profile", label: "Profil" },
    { id: "photo", label: "Foto" },
    { id: "video", label: "Video" },
    { id: "reviews", label: "Bewertungen" },
  ]

  return (
    <div className="space-y-6 pb-6 lg:hidden">
      <div className="space-y-4 px-sides pt-2 text-center">
        <h1 className="text-base font-bold uppercase leading-snug tracking-wide text-foreground sm:text-lg">
          {displayTitle}
        </h1>

        {typeof rating === "number" && rating > 0 && (
          <p className="flex items-center justify-center gap-1.5 text-sm text-neutral-600">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
            <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
            {typeof totalReviews === "number" && totalReviews > 0 && (
              <span>({totalReviews} Bewertungen)</span>
            )}
          </p>
        )}

        <div className="flex gap-2">
          <ActionButton
            href={contactHref}
            actionLabel="kontaktieren"
            variant="outline"
            size="lg"
            className="h-11 flex-1 rounded-lg border-neutral-300 bg-white text-xs font-bold uppercase tracking-wide text-foreground shadow-none hover:bg-neutral-50"
          >
            <Phone className="mr-2 h-4 w-4" />
            Kontakt
          </ActionButton>
          <ShareProfileButton
            title={shareTitle}
            description={shareDescription}
            label="Profil teilen"
            copiedLabel="Kopiert!"
            variant="outline"
            size="lg"
            className="h-11 flex-1 rounded-lg border-neutral-300 bg-white text-xs font-bold uppercase tracking-wide text-foreground shadow-none hover:bg-neutral-50"
          />
        </div>

        <p className="text-sm font-medium text-neutral-600">{availabilityLabel}</p>
      </div>

      <div className="relative mx-auto w-[min(100%,280px)] px-sides">
        <button
          type="button"
          className="relative mx-auto block aspect-square w-full max-w-[280px] overflow-hidden rounded-full border border-neutral-100 bg-neutral-50 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
          onClick={() => setFullscreenPhotoIndex(0)}
          aria-label="Profilfoto vergrößern"
        >
          <Image
            src={heroImage}
            alt={title}
            fill
            className="object-cover"
            sizes="280px"
            priority
          />
        </button>
        {priceFromLabel && (
          <div className="absolute right-3 top-3 z-10 rounded-md border border-neutral-200 bg-white/95 px-2.5 py-1 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur-sm sm:right-4">
            <span className="text-neutral-500">Ab </span>
            <span className="font-bold text-foreground">{priceFromLabel.replace(/^Ab\s*/i, "")}</span>
          </div>
        )}
      </div>

      <div className="border-b border-neutral-200 px-sides">
        <div
          className="flex justify-between gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center sm:gap-6"
          role="tablist"
          aria-label="Portfolio"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "shrink-0 border-b-2 pb-2.5 text-xs font-semibold uppercase tracking-wide transition-colors sm:text-sm",
                activeTab === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-neutral-400 hover:text-neutral-600",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[100px] px-sides">
        {activeTab === "profile" && (
          <div className="space-y-5 py-1 text-left" role="tabpanel">
            <section className="space-y-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Stadt</h2>
              {cityName ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                  {cityName}
                </p>
              ) : (
                <p className="text-sm text-neutral-500">Keine Angabe</p>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Kategorien</h2>
              {categories.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <li
                      key={category}
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-foreground"
                    >
                      {category}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500">Keine Kategorien angegeben</p>
              )}
            </section>

            <section className="space-y-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Über mich</h2>
              {about?.trim() ? (
                <p className="text-sm leading-relaxed text-neutral-600">{about.trim()}</p>
              ) : (
                <p className="text-sm text-neutral-500">Keine Beschreibung vorhanden</p>
              )}
            </section>
          </div>
        )}

        {activeTab === "photo" && (
          <div
            className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tabpanel"
          >
            {photoItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm border border-neutral-200 bg-neutral-100"
                onClick={() => setFullscreenPhotoIndex(index)}
                aria-label={item.title || `Foto ${index + 1} anzeigen`}
              >
                <Image
                  src={getItemImageUrl(item)}
                  alt={item.title || "Arbeit"}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </button>
            ))}
          </div>
        )}

        {activeTab === "video" && (
          <div
            className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tabpanel"
          >
            {videos.length === 0 ? (
              <p className="w-full py-4 text-center text-sm text-neutral-500">Noch keine Videos</p>
            ) : (
              videos.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm border border-neutral-200 bg-neutral-900"
                  onClick={() => setSelectedVideo(item)}
                  aria-label={item.title || "Video abspielen"}
                >
                  <Image
                    src={getItemImageUrl(item)}
                    alt={item.title || "Video"}
                    fill
                    className="object-cover opacity-90"
                    sizes="80px"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <Play className="h-6 w-6 fill-white text-white" />
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === "reviews" && sellerId && (
          <div role="tabpanel" className="-mx-sides">
            <ReviewsSection
              sellerId={sellerId}
              rating={rating ?? null}
              totalReviews={totalReviews ?? null}
              itemTitle={shareTitle}
              className="rounded-none border-x-0 border-t-0"
            />
          </div>
        )}

        {activeTab === "reviews" && !sellerId && (
          <p className="py-4 text-center text-sm text-neutral-500" role="tabpanel">
            Noch keine Bewertungen
          </p>
        )}
      </div>

      {sellerId && activeTab !== "reviews" && (
        <div className="px-sides">
          <MasterFeaturedReview sellerId={sellerId} />
        </div>
      )}

      {selectedVideo && (
        <VideoPlayer
          videoUrl={selectedVideo.url || ""}
          thumbnailUrl={selectedVideo.thumbnail_url || undefined}
          title={selectedVideo.title || undefined}
          isOpen
          onClose={() => setSelectedVideo(null)}
        />
      )}

      <FullscreenImageViewer
        isOpen={fullscreenPhotoIndex !== null}
        onClose={() => setFullscreenPhotoIndex(null)}
        imageUrl={
          fullscreenPhotoIndex !== null ? getItemImageUrl(photoItems[fullscreenPhotoIndex]) : null
        }
        alt={
          fullscreenPhotoIndex !== null
            ? photoItems[fullscreenPhotoIndex]?.title || title
            : title
        }
        onPrevious={
          fullscreenPhotoIndex !== null && fullscreenPhotoIndex > 0
            ? () => setFullscreenPhotoIndex((index) => (index !== null ? index - 1 : null))
            : undefined
        }
        onNext={
          fullscreenPhotoIndex !== null && fullscreenPhotoIndex < photoItems.length - 1
            ? () => setFullscreenPhotoIndex((index) => (index !== null ? index + 1 : null))
            : undefined
        }
      />
    </div>
  )
}
