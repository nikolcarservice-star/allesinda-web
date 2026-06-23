"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { MapPin, Phone, Star, Play } from "lucide-react"
import { FullscreenImageViewer } from "@/components/ui/fullscreen-image-viewer"
import { BeforeAfterCard } from "@/components/gallery/before-after-card"
import { BeforeAfterFullscreenModal } from "@/components/gallery/gallery-fullscreen-modal"
import type { Media } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { ActionButton } from "@/components/detailed/action-button"
import { ShareProfileButton } from "@/components/detailed/share-profile-button"
import { MasterFeaturedReview } from "@/components/detailed/master-featured-review"
import { ReviewsSection } from "@/components/detailed/reviews-section"
import { VideoPlayer } from "@/components/shared/video-player"
import { ProfileReportButton } from "@/components/detailed/profile-report-button"

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
  profileId,
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
  const [activeTab, setActiveTab] = useState<TabId>("profile")
  const [selectedVideo, setSelectedVideo] = useState<GalleryMediaItem | null>(null)
  const [fullscreenPhotoIndex, setFullscreenPhotoIndex] = useState<number | null>(null)
  const [heroViewerOpen, setHeroViewerOpen] = useState(false)
  const [selectedBeforeAfter, setSelectedBeforeAfter] = useState<GalleryMediaItem | null>(null)

  const regularPhotos = useMemo(
    () => galleryItems.filter((item) => !isVideoItem(item) && !item.is_before_after),
    [galleryItems],
  )
  const beforeAfterItems = useMemo(
    () =>
      galleryItems.filter(
        (item) => item.is_before_after && item.before_url && item.after_url,
      ),
    [galleryItems],
  )
  const videos = useMemo(() => galleryItems.filter((item) => isVideoItem(item)), [galleryItems])
  const hasPhotoContent = regularPhotos.length > 0 || beforeAfterItems.length > 0

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
          <p className="flex items-center justify-center gap-1.5 text-sm text-neutral-700">
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
            variant="default"
            size="lg"
            className="h-11 flex-1 rounded-lg text-xs font-bold uppercase tracking-wide shadow-none hover:[&_svg]:text-black"
          >
            <Phone className="mr-2 h-4 w-4" />
            Kontakt
          </ActionButton>
          <ShareProfileButton
            title={shareTitle}
            description={shareDescription}
            label="Profil teilen"
            copiedLabel="Kopiert!"
            variant="default"
            size="lg"
            className="h-11 flex-1 rounded-lg text-xs font-bold uppercase tracking-wide shadow-none hover:[&_svg]:text-black"
          />
        </div>

        <p className="text-sm font-medium text-neutral-700">{availabilityLabel}</p>

        <div className="flex justify-center">
          <ProfileReportButton
            profileId={profileId}
            masterName={title}
            variant="ghost"
            size="sm"
            className="text-xs text-neutral-500 hover:text-neutral-800"
          />
        </div>
      </div>

      <div className="relative mx-auto w-[min(100%,280px)] px-sides">
        <button
          type="button"
          className="relative mx-auto block aspect-square w-full max-w-[280px] overflow-hidden rounded-full border border-neutral-100 bg-neutral-50 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
          onClick={() => setHeroViewerOpen(true)}
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
                  : "border-transparent text-neutral-500 hover:text-neutral-700",
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
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Stadt</h2>
              {cityName ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-neutral-600" aria-hidden />
                  {cityName}
                </p>
              ) : (
                <p className="text-sm text-neutral-600">Keine Angabe</p>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Kategorien</h2>
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
                <p className="text-sm text-neutral-600">Keine Kategorien angegeben</p>
              )}
            </section>

            <section className="space-y-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Über mich</h2>
              {about?.trim() ? (
                <p className="text-sm leading-relaxed text-neutral-700">{about.trim()}</p>
              ) : (
                <p className="text-sm text-neutral-600">Keine Beschreibung vorhanden</p>
              )}
            </section>
          </div>
        )}

        {activeTab === "photo" && (
          <div className="space-y-5 py-1" role="tabpanel">
            {!hasPhotoContent ? (
              <p className="py-4 text-center text-sm text-neutral-600">Noch keine Fotos</p>
            ) : (
              <>
                {beforeAfterItems.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                      Vorher & Nachher
                    </h2>
                    <div className="space-y-3">
                      {beforeAfterItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="group w-full overflow-hidden rounded-xl border border-neutral-200/80 bg-white text-left shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-transform active:scale-[0.99]"
                          onClick={() => setSelectedBeforeAfter(item)}
                          aria-label={item.title || "Vorher und Nachher anzeigen"}
                        >
                          <BeforeAfterCard
                            beforeUrl={item.before_url!}
                            afterUrl={item.after_url!}
                            className="pointer-events-none rounded-none"
                          />
                          {item.title?.trim() ? (
                            <p className="border-t border-neutral-100 px-3 py-2.5 text-sm font-medium text-foreground">
                              {item.title.trim()}
                            </p>
                          ) : (
                            <p className="border-t border-neutral-100 px-3 py-2 text-xs font-medium text-neutral-500">
                              Zum Vergleich antippen
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {regularPhotos.length > 0 && (
                  <section className="space-y-2">
                    {beforeAfterItems.length > 0 && (
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                        Weitere Fotos
                      </h2>
                    )}
                    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {regularPhotos.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 shadow-sm transition active:scale-95"
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
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "video" && (
          <div
            className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tabpanel"
          >
            {videos.length === 0 ? (
              <p className="w-full py-4 text-center text-sm text-neutral-600">Noch keine Videos</p>
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
          <p className="py-4 text-center text-sm text-neutral-600" role="tabpanel">
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
        isOpen={heroViewerOpen}
        onClose={() => setHeroViewerOpen(false)}
        imageUrl={heroImage}
        alt={title}
      />

      <FullscreenImageViewer
        isOpen={fullscreenPhotoIndex !== null}
        onClose={() => setFullscreenPhotoIndex(null)}
        imageUrl={
          fullscreenPhotoIndex !== null
            ? getItemImageUrl(regularPhotos[fullscreenPhotoIndex])
            : null
        }
        alt={
          fullscreenPhotoIndex !== null
            ? regularPhotos[fullscreenPhotoIndex]?.title || title
            : title
        }
        onPrevious={
          fullscreenPhotoIndex !== null && fullscreenPhotoIndex > 0
            ? () => setFullscreenPhotoIndex((index) => (index !== null ? index - 1 : null))
            : undefined
        }
        onNext={
          fullscreenPhotoIndex !== null && fullscreenPhotoIndex < regularPhotos.length - 1
            ? () => setFullscreenPhotoIndex((index) => (index !== null ? index + 1 : null))
            : undefined
        }
      />

      {selectedBeforeAfter && (
        <BeforeAfterFullscreenModal
          item={selectedBeforeAfter}
          isOpen={!!selectedBeforeAfter}
          onClose={() => setSelectedBeforeAfter(null)}
        />
      )}
    </div>
  )
}
