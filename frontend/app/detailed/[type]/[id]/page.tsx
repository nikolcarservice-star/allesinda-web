import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import type { CategoryType, FeaturedDetail, Media } from "@/lib/api"
import { getFeaturedDetail } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ProductRentalGallery, type ProductRentalGalleryItem } from "@/components/detailed/product-rental-gallery"
import { RecentWorkGallery } from "./recent-work-gallery"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { cn, formatPrice, getOptimizedImageUrl } from "@/lib/utils"
import { ViewTracker } from "./view-tracker"
import { FavoriteButton } from "@/components/ui/favorite-button"
import { ArrowUpRight, MapPin, ShoppingBag, Key, CalendarCheck, MessageSquare } from "lucide-react"
import { ReviewsSection } from "@/components/detailed/reviews-section"
import type { CartProduct } from "@/lib/context/cart-context"
import { DetailedAddToCartButton } from "@/components/detailed/add-to-cart-button"
import { ShareProfileButton } from "@/components/detailed/share-profile-button"
import { ActionButton } from "@/components/detailed/action-button"
import { ViewReviewsButton } from "./view-reviews-button"
import { RecentItemsSection } from "@/components/detailed/recent-items-section"
import { MasterProfileMobileView } from "@/components/detailed/master-profile-mobile-view"

interface DetailedPageProps {
  params: Promise<{ type: string; id: string }>
}

type StatItem = {
  label: string
  value: string
  hint?: string
}

type InfoItem = {
  label: string
  value: string
}

type GalleryItem =
  | {
      kind: "image"
      key: string
      title?: string | null
      url: string
    }
  | {
      kind: "video"
      key: string
      title?: string | null
      url: string
      thumbnail?: string | null
    }
  | {
      kind: "before-after"
      key: string
      title?: string | null
      before: string
      after: string
    }

const TYPE_CONFIG: Record<
  CategoryType,
  {
    label: string
    accent: string
    gradient: string
    bookingPath: (id: number) => string
    explorePath: string
  }
> = {
  master: {
      label: "Meister",
    accent: "bg-emerald-500 text-white",
    gradient: "from-emerald-600/20 via-emerald-500/10 to-transparent",
    bookingPath: (id) => `/booking/master/${id}`,
    explorePath: "/?types=master",
  },
  product: {
      label: "Produkt",
    accent: "bg-blue-500 text-white",
    gradient: "from-blue-600/20 via-blue-500/10 to-transparent",
    bookingPath: (id) => `/booking/product/${id}`,
    explorePath: "/?types=product",
  },
  rental: {
      label: "Mieten",
    accent: "bg-purple-500 text-white",
    gradient: "from-purple-600/20 via-purple-500/10 to-transparent",
    bookingPath: (id) => `/booking/rental/${id}`,
    explorePath: "/?types=rental",
  },
}

const TYPE_BADGE_THEME: Record<
  CategoryType,
  {
    container: string
    icon: string
  }
> = {
  master: {
    container:
      "bg-gradient-to-r from-emerald-500 via-emerald-500/95 to-emerald-600 text-white shadow-[0_10px_28px_-18px_rgba(16,185,129,0.85)] ring-1 ring-emerald-400/40 ring-offset-2 ring-offset-background dark:from-emerald-400 dark:via-emerald-500 dark:to-emerald-600/90",
    icon:
      "bg-white text-emerald-600 shadow-[0_4px_10px_rgba(255,255,255,0.35)] dark:bg-emerald-950/70 dark:text-emerald-200",
  },
  product: {
    container:
      "bg-gradient-to-r from-sky-500 via-sky-500/95 to-sky-600 text-white shadow-[0_10px_28px_-18px_rgba(56,189,248,0.8)] ring-1 ring-sky-400/40 ring-offset-2 ring-offset-background dark:from-sky-400 dark:via-sky-500 dark:to-sky-600/90",
    icon:
      "bg-white text-sky-600 shadow-[0_4px_10px_rgba(255,255,255,0.35)] dark:bg-sky-950/70 dark:text-sky-200",
  },
  rental: {
    container:
      "bg-gradient-to-r from-purple-500 via-purple-500/95 to-purple-600 text-white shadow-[0_10px_28px_-18px_rgba(168,85,247,0.8)] ring-1 ring-purple-400/40 ring-offset-2 ring-offset-background dark:from-purple-400 dark:via-purple-500 dark:to-purple-600/90",
    icon:
      "bg-white text-purple-600 shadow-[0_4px_10px_rgba(255,255,255,0.35)] dark:bg-purple-950/70 dark:text-purple-200",
  },
}

function VerifiedBadgeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" {...props}>
      <path fill="#16a34a" d="M16 2c7.732 0 14 6.268 14 14s-6.268 14-14 14S2 23.732 2 16 8.268 2 16 2Z" />
      <path
        d="m12.25 16.818 2.78 2.787 4.72-6.506"
        stroke="#ffffff"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function humanizeLabel(text: string): string {
  return text
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function formatBoolean(value: boolean): string {
  return value ? "Ja" : "Nein"
}

function formatNumeric(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString()
  }
  if (Number.isInteger(value)) {
    return value.toString()
  }
  return value.toFixed(1)
}

function buildStatItems(detail: FeaturedDetail): StatItem[] {
  const stats: StatItem[] = []

  if (typeof detail.rating === "number" && detail.rating > 0) {
    stats.push({
      label: "Bewertung",
      value: detail.rating.toFixed(1),
      hint: detail.total_reviews ? `${detail.total_reviews} Bewertungen` : undefined,
    })
  }

  const location = [(detail as any).city_name].filter(Boolean).join(", ")
  if (location) {
    stats.push({ label: "Standort", value: location })
  }

  if (detail.type === "master") {
    const extra = (detail.extra ?? {}) as Record<string, unknown>
    const servicePrices =
      detail.services?.map((service) => service.price_from).filter((price) => typeof price === "number" && price > 0) ??
      []
    if (servicePrices.length > 0) {
      const minPrice = Math.min(...servicePrices)
      stats.push({ label: "Ab", value: formatPrice(minPrice, "EUR") })
    }
    const verified = extra["verified"]
    if (typeof verified === "boolean") {
      stats.push({ label: "Verifizierung", value: verified ? "Verifiziert" : "Unverifiziert" })
    }
    const completedJobs = extra["completed_jobs"]
    if (typeof completedJobs === "number" && completedJobs >= 0) {
      stats.push({
        label: "Abgeschlossene Aufträge",
        value: formatNumeric(completedJobs),
      })
    }
    const responseTime = extra["response_time_hours"]
    if (typeof responseTime === "number" && responseTime >= 0) {
      stats.push({
        label: "Antwortzeit",
        value: `${responseTime}h Durchschnitt`,
      })
    }
  }

  if (detail.type === "product") {
    if (typeof detail.price === "number") {
      stats.push({ label: "Preis", value: formatPrice(detail.price, "EUR") })
    }
    if (typeof detail.stock === "number") {
      stats.push({ label: "Bestand", value: detail.stock > 0 ? `${detail.stock}` : "Nicht vorrätig" })
    }
    if (typeof detail.available === "boolean") {
      stats.push({ label: "Verfügbarkeit", value: detail.available ? "Verfügbar" : "Nicht verfügbar" })
    }
    if (detail.brand) {
      stats.push({ label: "Marke", value: detail.brand })
    }
  }

  if (detail.type === "rental") {
    if (typeof detail.price_per_day === "number") {
      stats.push({ label: "Tagespreis", value: `${formatPrice(detail.price_per_day, "EUR")}` })
    }
    if (typeof detail.stock === "number") {
      stats.push({
        label: "Verfügbare Einheiten",
        value: detail.stock > 0 ? `${detail.stock} Einheiten` : "Vollständig gebucht",
      })
    }
    if (typeof detail.available === "boolean") {
      stats.push({
        label: "Status",
        value: detail.available ? "Buchungen akzeptiert" : "Nicht verfügbar",
      })
    }
  }

  return stats
}

function buildInfoItems(detail: FeaturedDetail): InfoItem[] {
  const info: InfoItem[] = []

  info.push({ label: "Typ", value: TYPE_CONFIG[detail.type].label })

  if (detail.category) {
    info.push({ label: "Kategorie", value: humanizeLabel(detail.category) })
  }

  if (detail.subtitle) {
    info.push({ label: "Untertitel", value: detail.subtitle })
  }

  if (detail.created_at) {
    const createdAt = new Date(detail.created_at)
    if (!Number.isNaN(createdAt.getTime())) {
      info.push({
        label: "Hinzugefügt",
        value: new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(createdAt),
      })
    }
  }

  if (detail.type === "master" && detail.services?.length) {
    info.push({ label: "Angebotene Service", value: String(detail.services.length) })
  }

  if (detail.type === "product") {
    if (detail.brand) {
      info.push({ label: "Marke", value: detail.brand })
    }
    if (typeof detail.stock === "number") {
      info.push({ label: "Bestand", value: `${detail.stock} Einheiten` })
    }
    if (typeof detail.available === "boolean") {
      info.push({ label: "Verfügbarkeit", value: detail.available ? "Verfügbar" : "Nicht verfügbar" })
    }
    if (typeof detail.price === "number") {
      info.push({ label: "Preis", value: formatPrice(detail.price, "EUR") })
    }
  }

  if (detail.type === "rental") {
    if (typeof detail.stock === "number") {
      info.push({ label: "Gesamteinheiten", value: `${detail.stock} verfügbar` })
    }
    if (typeof detail.available === "boolean") {
      info.push({ label: "Status", value: detail.available ? "Buchungen akzeptiert" : "Nicht verfügbar" })
    }
    if (typeof detail.price_per_day === "number") {
      info.push({ label: "Tagespreis", value: `${formatPrice(detail.price_per_day, "EUR")}` })
    }
  }

  if (detail.extra) {
    for (const [key, rawValue] of Object.entries(detail.extra)) {
      if (rawValue == null) continue
      if (typeof rawValue === "object") continue
      if (key.toLowerCase().endsWith("_id")) continue

      let value: string
      if (typeof rawValue === "boolean") {
        value = formatBoolean(rawValue)
      } else if (typeof rawValue === "number") {
        value = formatNumeric(rawValue)
      } else {
        value = String(rawValue)
      }

      if (!value.trim()) continue
      info.push({ label: humanizeLabel(key), value })
    }
  }

  return info
}

function buildGalleryItems(detail: FeaturedDetail): GalleryItem[] {
  const source: Media[] =
    detail.type === "master"
      ? detail.portfolio?.length
        ? detail.portfolio
        : detail.media ?? []
      : detail.media?.length
        ? detail.media
        : detail.portfolio ?? []

  return (source ?? []).reduce<GalleryItem[]>((acc, item) => {
    if (item.is_before_after && item.before_url && item.after_url) {
      acc.push({
        kind: "before-after",
        key: `before-after-${item.id}`,
        title: item.title,
        before: getOptimizedImageUrl(item.before_url, 'gallery') || "/placeholder.svg",
        after: getOptimizedImageUrl(item.after_url, 'gallery') || "/placeholder.svg",
      })
      return acc
    }

    if (item.media_type === "video") {
      acc.push({
        kind: "video",
        key: `video-${item.id}`,
        title: item.title,
        url: getOptimizedImageUrl(item.url, 'original') || "",
        thumbnail: getOptimizedImageUrl(item.thumbnail_url, 'gallery') || null,
      })
      return acc
    }

    acc.push({
      kind: "image",
      key: `image-${item.id}`,
      title: item.title,
      url: getOptimizedImageUrl(item.url, 'gallery') || "/placeholder.svg",
    })
    return acc
  }, [])
}

function buildProductRentalGalleryImages(detail: FeaturedDetail, fallbackImage: string): ProductRentalGalleryItem[] {
  const items = buildGalleryItems(detail)
  const images: ProductRentalGalleryItem[] = []

  // Normalize fallback to gallery size to avoid duplicate of the same image in different sizes
  const normalizedFallback =
    getOptimizedImageUrl(detail.image_url, 'gallery') || fallbackImage

  for (const item of items) {
    if (item.kind === "before-after") {
      images.push({
        key: `${item.key}-before`,
        url: item.before,
        alt: item.title ? `${item.title} – vorher` : "Vorher",
      })
      images.push({
        key: `${item.key}-after`,
        url: item.after,
        alt: item.title ? `${item.title} – nachher` : "Nachher",
      })
      continue
    }

    if (item.kind === "video") {
      const preview = item.thumbnail || item.url || fallbackImage
      images.push({
        key: `${item.key}-video`,
        url: preview,
        alt: item.title ? `${item.title} – Vorschau` : "Video-Vorschau",
      })
      continue
    }

    images.push({
      key: item.key,
      url: item.url,
      alt: item.title,
    })
  }

  if (!images.length) {
    images.push({ key: "primary", url: normalizedFallback, alt: detail.title })
  } else if (!images.some((image) => image.url === normalizedFallback)) {
    images.unshift({ key: "primary", url: normalizedFallback, alt: detail.title })
  }

  return images
}

function buildServiceCartProduct(
  detail: FeaturedDetail,
  service: { id: number; title: string; price_from: number; description?: string | null },
  sellerId: number | null,
  fallbackImage: string,
): CartProduct {
  const syntheticId = Number(`${detail.id}000${service.id}`.slice(0, 12))
  return {
    id: syntheticId,
    itemType: "master",
    title: `${detail.title} – ${service.title}`,
    description: service.description ?? "",
    price: typeof service.price_from === "number" ? service.price_from : 0,
    stock: 9999,
    image_url: fallbackImage,
    brand: undefined,
    category_id: (detail as any).category_id ?? undefined,
    category: detail.category ?? undefined, // Keep for backward compatibility in display
    city_id: (detail as any).city_id ?? undefined,
    city_name: (detail as any).city_name ?? undefined,
    seller_id: sellerId ?? 0,
    rating: 0,
    total_reviews: 0,
    created_at: detail.created_at ?? new Date().toISOString(),
    updated_at: detail.created_at ?? new Date().toISOString(),
    media: detail.media ?? undefined,
    seller_name: (detail.extra as Record<string, unknown> | undefined)?.["seller_name"] as string | undefined,
    likes_count: (detail as unknown as { likes_count?: number }).likes_count ?? 0,
    price_per_day: null,
  }
}

function resolveCartStock(detail: FeaturedDetail): number {
  if (typeof detail.stock === "number") {
    return Math.max(detail.stock, 0)
  }
  const extra = detail.extra as Record<string, unknown> | undefined
  const availableStock = extra && typeof extra["available_stock"] === "number" ? (extra["available_stock"] as number) : undefined
  if (typeof availableStock === "number") {
    return Math.max(availableStock, 0)
  }
  return 5
}

function buildCartProductPayload(
  detail: FeaturedDetail,
  type: CategoryType,
  sellerId: number | null,
  stock: number,
  fallbackImage: string,
): CartProduct {
  const createdAt = detail.created_at ?? new Date().toISOString()
  const price =
    type === "product"
      ? typeof detail.price === "number"
        ? detail.price
        : 0
      : typeof detail.price_per_day === "number"
        ? detail.price_per_day
        : typeof detail.price === "number"
          ? detail.price
          : 0
  const detailLikes = (detail as unknown as { likes_count?: number }).likes_count ?? 0
  const extra = detail.extra as Record<string, unknown> | undefined
  const sellerName =
    extra && typeof extra["seller_name"] === "string"
      ? (extra["seller_name"] as string)
      : extra && typeof extra["owner_name"] === "string"
        ? (extra["owner_name"] as string)
        : undefined

  return {
    id: detail.id,
    itemType: type,
    title: detail.title,
    description: detail.description ?? "",
    price,
    stock,
    image_url: fallbackImage,
    brand: detail.brand ?? (type === "rental" ? detail.subtitle ?? undefined : undefined),
    category_id: (detail as any).category_id ?? undefined,
    category: detail.category ?? undefined, // Keep for backward compatibility in display
    city_id: (detail as any).city_id ?? undefined,
    city_name: (detail as any).city_name ?? undefined,
    seller_id: sellerId ?? 0,
    rating: typeof detail.rating === "number" ? detail.rating : 0,
    total_reviews: detail.total_reviews ?? 0,
    created_at: createdAt,
    updated_at: createdAt,
    media: detail.media ?? undefined,
    seller_name: sellerName,
    likes_count: detailLikes,
    price_per_day: detail.price_per_day ?? null,
  }
}

export default async function DetailedPage({ params }: DetailedPageProps) {
  const { type: rawType, id: rawId } = await params
  const type = rawType as CategoryType

  if (!["master", "product", "rental"].includes(type)) {
    notFound()
  }

  const id = Number(rawId)
  if (!Number.isInteger(id)) {
    notFound()
  }

  let detail: FeaturedDetail | null = null
  try {
    detail = await getFeaturedDetail(type, id)
  } catch (error) {
    console.error("Failed to load featured detail", error)
  }

  if (!detail) {
    notFound()
  }

  const typeConfig = TYPE_CONFIG[type]
  const typeBadgeTheme = TYPE_BADGE_THEME[type]
  const typeInitial = typeConfig.label.charAt(0)
  const stats = buildStatItems(detail)
  const infoItems = buildInfoItems(detail)
  const galleryItems = buildGalleryItems(detail)
  // Get original Media items for GalleryCard
  const galleryMediaItems: (Media & { master_name?: string; master_profile_id?: number; master_verified?: boolean })[] =
    (detail.type === "master"
      ? detail.portfolio?.length
        ? detail.portfolio
        : detail.media ?? []
      : detail.media?.length
        ? detail.media
        : detail.portfolio ?? []
    ).map((item) => ({
      ...item,
      master_name: detail.subtitle || detail.title,
      master_profile_id: detail.id,
      master_verified: (detail as unknown as { verified?: boolean }).verified ?? false,
    }))

  // For masters, use profile image_url as the hero image
  const heroImage = getOptimizedImageUrl(detail.image_url, 'full') || "/placeholder.svg"
  const description =
    detail.description?.trim() || "Details für diese Anzeige werden bald aktualisiert. Bitte schauen Sie später noch einmal vorbei."
  const masterPrimaryStat =
    stats.find((stat) => stat.label === "Ab") ?? null
  const masterSecondaryStat =
    stats.find((stat) => stat.label === "Standort") ??
    stats.find((stat) => stat.label === "Verifizierung") ??
    stats.find((stat) => stat.label === "Antwortzeit") ??
    null
  const fullMasterGalleryImages = buildProductRentalGalleryImages(detail, heroImage)
  // For masters, use profile image as the primary/main image in the gallery
  const masterGalleryImages = type === "master" && detail.image_url
    ? [{ key: "profile", url: heroImage, alt: detail.title }, ...fullMasterGalleryImages]
    : [fullMasterGalleryImages[0] ?? { key: "primary", url: heroImage, alt: detail.title }]
  const galleryImagesAll = fullMasterGalleryImages
  const masterHighlightStats =
    stats
      .filter((stat) => stat !== masterPrimaryStat && stat !== masterSecondaryStat)
      .filter((stat) => (type === "master" ? true : (stat.label !== "Preis" && stat.label !== "Tagespreis")))
  const productPrimaryStat =
    type !== "master"
      ? stats.find((stat) => stat.label === "Preis") ??
        stats.find((stat) => stat.label === "Tagespreis") ??
        null
      : null
  const subtitle = detail.subtitle?.trim()
  const cityDisplay = ((detail as any).city_name as string | undefined)?.trim() ?? ""
  const locationDisplay = [ (detail as any).city_name as string | undefined ].filter(Boolean).join(", ")
  const showSubtitle =
    Boolean(subtitle) &&
    subtitle!.toLowerCase() !== cityDisplay.toLowerCase() &&
    subtitle!.toLowerCase() !== locationDisplay.toLowerCase()
  const primaryActionLabel = type === "master" ? "Kontakt" : type === "product" ? "Kaufen" : "Mieten"
  const secondaryActionLabel = "Mehr entdecken"
  const extra = (detail.extra ?? {}) as Record<string, unknown>
  const masterExtra = extra
  const sellerId = typeof extra["seller_id"] === "number" ? (extra["seller_id"] as number) : null
  const masterSellerId = sellerId
  const primaryActionHref =
    type === "master"
      ? masterSellerId
        ? `/messages?seller_id=${masterSellerId}`
        : "/messages"
      : TYPE_CONFIG[type].bookingPath(id)

  // Cart setup for product/rental
  const cartStock = type !== "master" ? resolveCartStock(detail) : 0
  const cartProduct = type !== "master" ? buildCartProductPayload(detail, type, sellerId, cartStock, heroImage) : null
  const isAvailableForCart = type !== "master" ? detail.available !== false && cartStock > 0 : false

  const masterProfessionLabel = detail.category
    ? humanizeLabel(detail.category)
    : showSubtitle
      ? subtitle
      : null

  const masterAvailabilityLabel = (() => {
    if (typeof masterExtra.available === "boolean") {
      return masterExtra.available ? "Verfügbar" : "Nicht verfügbar"
    }
    if (typeof masterExtra.is_available === "boolean") {
      return masterExtra.is_available ? "Verfügbar" : "Nicht verfügbar"
    }
    return "Verfügbar"
  })()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={null}>
        <ViewTracker type={type} id={id} detail={detail} />
      </Suspense>

      <section className="border-b border-muted/60 bg-background overflow-x-hidden">
        {type === "master" && (
          <MasterProfileMobileView
            profileId={id}
            title={detail.title}
            professionLabel={masterProfessionLabel}
            rating={detail.rating ?? null}
            totalReviews={detail.total_reviews ?? null}
            heroImage={heroImage}
            priceFromLabel={masterPrimaryStat?.value ?? null}
            contactHref={primaryActionHref}
            shareTitle={detail.title}
            shareDescription={detail.description}
            availabilityLabel={masterAvailabilityLabel}
            galleryItems={galleryMediaItems}
            sellerId={sellerId}
          />
        )}

        <div className={cn(
          "container mx-auto grid gap-8 px-sides py-5 md:gap-5 md:py-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:h-[720px] lg:max-h-[720px]",
          type === "master" && "hidden lg:grid",
        )}>
          <div className="relative lg:sticky lg:top-0 lg:h-[720px] lg:max-h-[720px] min-w-0">
            <ProductRentalGallery items={type === "master" ? masterGalleryImages : galleryImagesAll} variant={type === "master" ? "hero" : "default"} />
            <div
              className={cn(
                "absolute right-3 top-3 z-10",
                type === "master" && "hidden lg:block",
              )}
            >
              <FavoriteButton
                favoriteType={type === "master" ? "profile" : (type === "product" ? "product" : "rental")}
                favoriteId={id}
                variant="outline"
                className="h-11 w-11 rounded-full border-white/50 bg-white/90 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:bg-white hover:shadow-xl"
                size="lg"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 md:gap-5 lg:overflow-y-auto lg:pr-3 lg:max-h-[720px] min-w-0">
            {/* Header Section */}
            <div className="space-y-3 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.38em] transition-all",
                    typeBadgeTheme.container,
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-bold leading-none tracking-[0]",
                      typeBadgeTheme.icon,
                    )}
                    aria-hidden="true"
                  >
                    {typeInitial}
                  </span>
                  <span>{typeConfig.label}</span>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="group ml-auto inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/80 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                >
                  <Link href={typeConfig.explorePath} aria-label={`Mehr ${typeConfig.label.toLowerCase()}e entdecken`}>
                    <span className="hidden sm:inline">{secondaryActionLabel}</span>
                    <span className="sm:hidden">Mehr</span>
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </Button>
              </div>

              {/* Title and Meta */}
              <div className="space-y-3">
                <h1 className="text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">{detail.title}</h1>
                {showSubtitle && <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
                <div className="flex flex-col gap-2 w-full">
                  {locationDisplay && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium text-muted-foreground">{locationDisplay}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 w-full">
                    {(typeof detail.rating === "number" && detail.rating > 0) ? (
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <span className="text-yellow-500">★</span>
                        <span className="text-foreground">{detail.rating.toFixed(1)}</span>
                        {detail.total_reviews && (
                          <span className="text-sm text-muted-foreground">({detail.total_reviews})</span>
                        )}
                      </div>
                    ) : <span />}
                    {detail.type === "master" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 shadow-[0_6px_18px_-12px_rgba(16,185,129,0.65)] dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-100 ml-auto">
                        <VerifiedBadgeIcon className="h-[0.9rem] w-[0.9rem] shrink-0" />
                        <span>{stats.find((stat) => stat.label === "Verifizierung")?.value ?? "Verifiziert"}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Primary Stats */}
            {type === "master" && (masterPrimaryStat || masterSecondaryStat) && (
              <div className="space-y-2 border-y border-muted/50 py-3">
                <div className="grid grid-cols-3 items-start gap-4">
                  {masterPrimaryStat && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {masterPrimaryStat.label}
                      </p>
                      <p className="text-2xl font-semibold text-foreground sm:text-3xl">{masterPrimaryStat.value}</p>
                      {masterPrimaryStat.hint && (
                        <p className="text-xs text-muted-foreground">{masterPrimaryStat.hint}</p>
                      )}
                    </div>
                  )}
                  {detail.type === "master" && detail.services?.length ? (
                    <div className="space-y-1 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Service
                      </p>
                      <p className="text-2xl font-semibold text-foreground sm:text-3xl">{detail.services.length}</p>
                    </div>
                  ) : (
                    <div></div>
                  )}
                  <div></div>
                </div>
                {masterSecondaryStat && masterSecondaryStat.label !== "Standort" && (
                  <p className="text-sm text-muted-foreground">
                    {masterSecondaryStat.label}: {masterSecondaryStat.value}
                  </p>
                )}
              </div>
            )}

            {/* Product/Rental Price (styled like master primary stat) */}
            {type !== "master" && productPrimaryStat && (
              <div className="space-y-2 border-y border-muted/50 py-3">
                <div className="grid grid-cols-3 items-start gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {productPrimaryStat.label}
                    </p>
                    <p className="text-2xl font-semibold text-foreground sm:text-3xl">{productPrimaryStat.value}</p>
                    {productPrimaryStat.hint && (
                      <p className="text-xs text-muted-foreground">{productPrimaryStat.hint}</p>
                    )}
                  </div>
                  <div></div>
                  <div></div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <ActionButton
                href={primaryActionHref}
                actionLabel={primaryActionLabel.toLowerCase()}
                size="lg"
                className="min-w-[6.5rem] flex-1"
              >
                {type === "master" ? (
                  <MessageSquare className="mr-2 h-4 w-4" />
                ) : type === "product" ? (
                  <ShoppingBag className="mr-2 h-4 w-4" />
                ) : (
                  <Key className="mr-2 h-4 w-4" />
                )}
                {primaryActionLabel}
              </ActionButton>
              {type === "master" ? (
                typeof detail.total_reviews === "number" && detail.total_reviews > 0 ? (
                  <ViewReviewsButton className="min-w-[6.5rem] flex-1" />
                ) : (
                  <ShareProfileButton
                    title={detail.title}
                    description={detail.description}
                    className="min-w-[6.5rem] flex-1"
                  />
                )
              ) : (
                <DetailedAddToCartButton
                  product={cartProduct as CartProduct}
                  available={isAvailableForCart}
                  stock={cartStock}
                  type={type}
                  variant="outline"
                  className="min-w-[6.5rem] flex-1"
                />
              )}
            </div>

            {/* About Section */}
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground sm:text-lg">Über</h3>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
            </div>

            {/* Highlights Grid */}
            {masterHighlightStats.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-foreground sm:text-lg">Hervorhebungen</h3>
                <ul className="grid grid-cols-2 gap-3">
                  {masterHighlightStats
                    .filter((stat) => stat.label !== "Bewertung" && stat.label !== "Verifizierung" && stat.label !== "Standort")
                    .map((stat) => (
                      <li key={`${stat.label}-${stat.value}`} className="space-y-0.5">
                        <span className="block text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</span>
                        <span className="block text-sm font-medium text-foreground">{stat.value}</span>
                        {stat.hint && <span className="block text-xs text-muted-foreground">{stat.hint}</span>}
                      </li>
                    ))}
                </ul>
              </div>
            )}


          </div>
        </div>

        {detail.type === "master" && (detail.services?.length || galleryItems.length > 0 || sellerId) ? (
          <div className="container mx-auto hidden px-sides pt-1 md:pt-10 lg:block lg:pt-12 pb-1 md:pb-2 lg:pb-3">
            <Accordion type="single" collapsible className="border-none" defaultValue={galleryItems.length > 0 ? "recent-work" : undefined}>
              {detail.services?.length ? (
                <AccordionItem value="featured-services" className="border-border/70">
                  <AccordionTrigger className="group px-0 text-base font-semibold tracking-tight [&>svg]:hidden">
                    <span className="flex-1">Empfohlene Service</span>
                    <span className="text-lg font-semibold text-muted-foreground group-data-[state=open]:hidden">+</span>
                    <span className="hidden text-lg font-semibold text-muted-foreground group-data-[state=open]:block">
                      &minus;
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-1">
                    <div className="divide-y divide-border/50 rounded-none border border-border/60 bg-background/80">
                      {detail.services.map((service) => (
                        <div key={service.id} className="px-4 py-3 transition hover:bg-muted/30">
                          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.6fr)_minmax(0,0.4fr)] sm:items-center sm:gap-3">
                            <div className="space-y-1">
                              <h4 className="text-base font-semibold text-foreground">{service.title}</h4>
                              {service.description && (
                                <p className="text-sm leading-relaxed text-muted-foreground">{service.description}</p>
                              )}
                            </div>

                            <div className="flex w-full items-center justify-between gap-3 sm:hidden">
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                  Ab
                                </span>
                                <span className="text-lg font-semibold text-foreground">
                                  {formatPrice(service.price_from, "EUR")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <ActionButton
                                  href={typeConfig.bookingPath(id)}
                                  actionLabel="book"
                                  size="sm"
                                  className="h-10 px-4"
                                >
                                  <CalendarCheck className="mr-2 h-4 w-4" />
                                  Buchen
                                </ActionButton>
                                <DetailedAddToCartButton
                                  product={buildServiceCartProduct(detail, service, sellerId, heroImage)}
                                  available={true}
                                  stock={9999}
                                  type={"master"}
                                  variant="outline"
                                  className="h-10 px-3"
                                />
                              </div>
                            </div>

                            <div className="hidden sm:flex sm:flex-col sm:items-center sm:gap-1 text-center">
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                From
                              </span>
                              <span className="text-lg font-semibold text-foreground">
                                {formatPrice(service.price_from, "EUR")}
                              </span>
                            </div>

                            <div className="hidden sm:flex sm:justify-end">
                              <div className="flex items-center gap-2">
                                <ActionButton
                                  href={typeConfig.bookingPath(id)}
                                  actionLabel="book"
                                  size="lg"
                                  className="h-11 px-5"
                                >
                                  <CalendarCheck className="mr-2 h-4 w-4" />
                                  Buchen
                                </ActionButton>
                                <DetailedAddToCartButton
                                  product={buildServiceCartProduct(detail, service, sellerId, heroImage)}
                                  available={true}
                                  stock={9999}
                                  type={"master"}
                                  variant="outline"
                                  className="h-11 px-4"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ) : null}

              {galleryItems.length > 0 && (
                <AccordionItem value="recent-work" className="border-border/70">
                  <AccordionTrigger className="group px-0 text-base font-semibold tracking-tight [&>svg]:hidden">
                    <span className="flex-1">Kürzliche Arbeiten</span>
                    <span className="text-lg font-semibold text-muted-foreground group-data-[state=open]:hidden">+</span>
                    <span className="hidden text-lg font-semibold text-muted-foreground group-data-[state=open]:block">
                      &minus;
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-0" containerClassName="overflow-visible">
                    <RecentWorkGallery items={galleryMediaItems} href={`/detailed/${type}/${id}`} />
                  </AccordionContent>
                </AccordionItem>
              )}

              {sellerId ? (
                <AccordionItem value="ratings-reviews" className="border-border/70" id="reviews-section">
                  <AccordionTrigger className="group px-0 text-base font-semibold tracking-tight [&>svg]:hidden">
                    <span className="flex-1">Bewertungen</span>
                    <span className="text-lg font-semibold text-muted-foreground group-data-[state=open]:hidden">+</span>
                    <span className="hidden text-lg font-semibold text-muted-foreground group-data-[state=open]:block">
                      &minus;
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-0" containerClassName="overflow-visible">
                    <ReviewsSection
                      sellerId={sellerId}
                      rating={detail.rating ?? null}
                      totalReviews={detail.total_reviews ?? null}
                      itemTitle={detail.title}
                    />
                  </AccordionContent>
                </AccordionItem>
              ) : null}
            </Accordion>
          </div>
        ) : null}

        {type !== "master" && sellerId ? (
          <div className="container mx-auto px-sides pt-3 md:pt-6 lg:pt-14 pb-3 md:pb-6 lg:pb-6">
            <Accordion type="single" collapsible className="border-none">
              <AccordionItem value="ratings-reviews" className="border-border/70" id="reviews-section">
                <AccordionTrigger className="group px-0 text-base font-semibold tracking-tight [&>svg]:hidden">
                  <span className="flex-1">Bewertungen</span>
                  <span className="text-lg font-semibold text-muted-foreground group-data-[state=open]:hidden">+</span>
                  <span className="hidden text-lg font-semibold text-muted-foreground group-data-[state=open]:block">
                    &minus;
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-0" containerClassName="overflow-visible">
                  <ReviewsSection
                    sellerId={sellerId}
                    rating={detail.rating ?? null}
                    totalReviews={detail.total_reviews ?? null}
                    itemTitle={detail.title}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        ) : null}

        <div className="container mx-auto px-sides py-1">
          <RecentItemsSection currentType={type} currentItemHref={`/detailed/${type}/${id}`} />
        </div>
      </section>
    </div>
  )
}
