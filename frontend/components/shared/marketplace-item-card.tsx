"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FavoriteButton } from "@/components/ui/favorite-button"
import { cn, getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"
import { CheckCircle2, Mail, MapPin, MessageCircle, Phone, Star } from "lucide-react"

export type CardVariant = "default" | "flat"

export interface MasterCardData {
  id: string
  href?: string
  name: string
  profession?: string
  category_id?: number | null // Category ID (preferred)
  category?: string // Category slug (deprecated, for backward compatibility)
  rating: number
  reviews: number
  location: string
  image: string
  priceLabel?: string
  priceFrom?: number
  verified: boolean
  distanceKm?: number
  contactPhone?: string
  contactEmail?: string
  canChat?: boolean
}

export interface ProductCardData {
  id: string
  href?: string
  name: string
  price: number
  image: string
  seller: string
  rating: number
  reviews?: number
  stock?: number
  brand?: string
  category_id?: number | null // Category ID (preferred)
  category?: string // Category slug (deprecated, for backward compatibility)
  city_name?: string | null
}

export interface RentalCardData {
  id: string
  href?: string
  name: string
  pricePerDay: number
  image: string
  owner: string
  available?: boolean
  stock?: number
  availableStock?: number | null
  rating?: number
  totalReviews?: number
  category_id?: number | null // Category ID (preferred)
  category?: string // Category slug (deprecated, for backward compatibility)
  city_name?: string | null
}

type BaseProps = {
  variant?: CardVariant
  className?: string
  onRemove?: () => void
  removeLabel?: string
  compact?: boolean
}

export type MarketplaceItemCardProps =
  | ({ type: "master"; data: MasterCardData } & BaseProps)
  | ({ type: "product"; data: ProductCardData } & BaseProps)
  | ({ type: "rental"; data: RentalCardData } & BaseProps)

const overlayButtonBaseClasses =
  "flex items-center justify-center rounded-full border border-border/60 bg-white/80 text-foreground shadow-sm transition-all duration-200 hover:bg-white supports-[backdrop-filter]:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 !h-9 !w-9 !min-h-9 !min-w-9"

export function MarketplaceItemCard(props: MarketplaceItemCardProps) {
  switch (props.type) {
    case "master":
      return (
        <MasterCardContent
          data={props.data}
          variant={props.variant}
          className={props.className}
          onRemove={props.onRemove}
          removeLabel={props.removeLabel}
          compact={props.compact}
        />
      )
    case "product":
      return (
        <ProductCardContent
          data={props.data}
          variant={props.variant}
          className={props.className}
          onRemove={props.onRemove}
          removeLabel={props.removeLabel}
          compact={props.compact}
        />
      )
    case "rental":
      return (
        <RentalCardContent
          data={props.data}
          variant={props.variant}
          className={props.className}
          onRemove={props.onRemove}
          removeLabel={props.removeLabel}
          compact={props.compact}
        />
      )
    default:
      return null
  }
}

function MasterCardContent({
  data,
  variant = "default",
  className,
  onRemove,
  removeLabel,
  compact = false,
}: BaseProps & { data: MasterCardData }) {
  const [imageError, setImageError] = useState(false)
  const router = useRouter()
  const targetHref = data.href ?? `/detailed/master/${data.id}`

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (typeof window === "undefined" || !data.contactPhone) return
    window.open(`tel:${data.contactPhone}`, "_self")
  }

  const handleEmailClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (typeof window === "undefined" || !data.contactEmail) return
    const subject = encodeURIComponent("Project inquiry via Allesinda")
    window.open(`mailto:${data.contactEmail}?subject=${subject}`, "_blank", "noopener")
  }

  const handleChatClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/detailed/master/${data.id}?intent=chat`)
  }

  const hasPriceFrom = typeof data.priceFrom === "number" && Number.isFinite(data.priceFrom) && data.priceFrom > 0
  const normalizedPriceLabel = data.priceLabel?.trim()
  const formattedPrice =
    normalizedPriceLabel && normalizedPriceLabel.length > 0
      ? normalizedPriceLabel
      : hasPriceFrom
        ? `€${data.priceFrom}`
        : null

  const isFlat = variant === "flat"

  const cardClasses = cn(
    "relative flex h-full flex-col overflow-hidden bg-white transition-all duration-200 border border-border/40",
    isFlat ? "rounded-none shadow-none hover:shadow-none" : "rounded-xl shadow-sm hover:shadow-md",
    className,
  )

  const imageWrapperClasses = cn("relative overflow-hidden bg-muted/20", "aspect-square")
  const ratingValue = data.rating > 0 ? data.rating.toFixed(1) : null
  const locationRow = data.location.trim().length > 0 ? data.location : null
  const professionValue = data.profession?.trim()
  const normalizeForCompare = (value?: string | null) =>
    value
      ?.toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim() ?? ""
  const normalizedLocation = normalizeForCompare(locationRow)
  const normalizedProfession = normalizeForCompare(professionValue)
  const professionLooksLikeLocation =
    normalizedLocation.length > 0 &&
    normalizedProfession.length > 0 &&
    (normalizedProfession === normalizedLocation ||
      normalizedProfession.includes(normalizedLocation) ||
      normalizedLocation.includes(normalizedProfession))
  const reviewsCount = data.reviews && data.reviews > 0 ? data.reviews : null
  const hasReviewsInfo = ratingValue !== null || reviewsCount !== null
  const showProfession = Boolean(professionValue && !professionLooksLikeLocation)

  const imageSrc = imageError || !data.image ? "/placeholder.svg" : getOptimizedImageUrl(data.image, 'card')
  const shouldUnoptimize = shouldUseUnoptimized(imageSrc)

  const handleRemove = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onRemove?.()
  }

  return (
    <Link href={targetHref} className="block h-full group">
      <div className={cardClasses}>
        <div className={imageWrapperClasses}>
          {onRemove && (
            <button
              type="button"
              onClick={handleRemove}
              className={cn(
                "absolute left-3 top-3 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100",
                overlayButtonBaseClasses,
                "hover:-translate-y-0.5",
              )}
              aria-label={removeLabel ?? "Element entfernen"}
            >
              <span className="text-lg font-semibold leading-none">×</span>
            </button>
          )}
          <Image
            src={imageSrc}
            alt={data.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
            quality={90}
            loading="lazy"
            unoptimized={shouldUnoptimize}
            onError={() => setImageError(true)}
          />
          <FavoriteButton
            favoriteType="profile"
            favoriteId={parseInt(data.id)}
            size="sm"
            variant="outline"
            className={cn(
              "absolute right-3 top-3",
              overlayButtonBaseClasses,
              "hover:-translate-y-0.5",
            )}
          />

          {((data.profession || data.category) || data.verified) && (
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 text-[11px] font-medium text-white/90">
              {(data.profession || data.category) && (
                <span className="rounded-none border border-white/40 bg-black/30 px-2 py-1 uppercase tracking-wide backdrop-blur">
                  {data.profession || data.category}
                </span>
              )}
              {data.verified && (
                <span className="flex items-center gap-1 rounded-full border border-white/40 bg-black/30 px-2 py-1 uppercase tracking-wide backdrop-blur">
                  <CheckCircle2 className="h-3 w-3" />
                  Verifiziert
                </span>
              )}
            </div>
          )}

          {hasReviewsInfo && (
            <div className={cn(
              "absolute left-3 z-10 flex items-center gap-0.5 rounded-full",
              "bg-gradient-to-r from-amber-500 to-amber-600",
              "shadow-[0_2px_8px_rgba(245,158,11,0.35)]",
              "px-1.5 py-0.5",
              "transition-all duration-200",
              "group-hover:shadow-[0_3px_10px_rgba(245,158,11,0.45)]",
              ((data.profession || data.category) || data.verified) ? "bottom-12" : "bottom-3",
              compact && "px-1 py-0.5"
            )}>
              {ratingValue && (
                <>
                  <Star className={cn("h-3 w-3 text-white", compact && "h-2.5 w-2.5")} fill="currentColor" />
                  <span className={cn("font-bold text-white leading-none", compact ? "text-[10px]" : "text-xs")}>{ratingValue}</span>
                </>
              )}
              {reviewsCount !== null && (
                <span className={cn("text-white/85 font-medium leading-none", compact ? "text-[9px]" : "text-[10px]")}>({reviewsCount})</span>
              )}
            </div>
          )}
        </div>

        <div className={cn("relative flex flex-1 flex-col p-3 gap-2", compact && "p-2 gap-1.5")}>
          <h3 className={cn("truncate text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary", compact && "text-[13px]")}>
            {data.name}
          </h3>

          {showProfession && (
            <div className="text-xs text-muted-foreground">
              <span className="truncate">{professionValue}</span>
            </div>
          )}

          {locationRow && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{locationRow}</span>
              </div>
            </div>
          )}

          {(data.contactPhone || data.contactEmail || data.canChat) && (
            <div className="mt-2 flex items-center gap-1">
              {data.contactPhone && (
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="rounded-full border-border text-foreground hover:bg-muted"
                  onClick={handlePhoneClick}
                  aria-label={`Call ${data.name}`}
                >
                  <Phone className="h-4 w-4" />
                </Button>
              )}
              {data.contactEmail && (
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="rounded-full border-border text-foreground hover:bg-muted"
                  onClick={handleEmailClick}
                  aria-label={`Email ${data.name}`}
                >
                  <Mail className="h-4 w-4" />
                </Button>
              )}
              {data.canChat && (
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="rounded-full border-border text-foreground hover:bg-muted"
                  onClick={handleChatClick}
                  aria-label={`Chat with ${data.name}`}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}


          <div className={cn("mt-[-8px] flex flex-col gap-2 pt-3", compact && "gap-1 pt-2")}>
            <div className="min-w-0 pr-12">
              <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-muted-foreground">
                {hasPriceFrom ? "Ab" : "Preis"}
              </span>
              <span className={cn("truncate text-base font-semibold text-foreground", compact && "text-sm")}>
                {formattedPrice ?? "Contact for pricing"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function ProductCardContent({
  data,
  variant = "default",
  className,
  onRemove,
  removeLabel,
  compact = false,
}: BaseProps & { data: ProductCardData }) {
  const [imageError, setImageError] = useState(false)

  const imageSrc = imageError || !data.image ? "/placeholder.svg" : getOptimizedImageUrl(data.image, 'card')
  const shouldUnoptimize = shouldUseUnoptimized(imageSrc)
  const isFlat = variant === "flat"
  const targetHref = data.href ?? `/detailed/product/${data.id}`

  const cardClasses = cn(
    "relative flex h-full flex-col overflow-hidden bg-white transition-all duration-200 border border-border/40",
    isFlat ? "rounded-none shadow-none hover:shadow-none" : "rounded-xl shadow-sm hover:shadow-md",
    className,
  )

  const imageWrapperClasses = cn("relative overflow-hidden bg-muted/20", "aspect-square")
  const ratingValue = data.rating > 0 ? data.rating.toFixed(1) : null
  const reviewsCount = data.reviews && data.reviews > 0 ? data.reviews : null
  const hasReviewsInfo = ratingValue !== null || reviewsCount !== null
  const location = [data.city_name].filter(Boolean).join(", ") || null
  const stockLabel =
    typeof data.stock === "number"
      ? data.stock > 0
        ? `${data.stock} in stock`
        : "Out of stock"
      : null

  const handleRemove = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onRemove?.()
  }

  return (
    <Link href={targetHref} className="block h-full group">
      <div className={cardClasses}>
        <div className={imageWrapperClasses}>
          {onRemove && (
            <button
              type="button"
              onClick={handleRemove}
              className={cn(
                "absolute left-3 top-3 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100",
                overlayButtonBaseClasses,
                "hover:-translate-y-0.5",
              )}
              aria-label={removeLabel ?? "Element entfernen"}
            >
              <span className="text-lg font-semibold leading-none">×</span>
            </button>
          )}
          <Image
            src={imageSrc}
            alt={data.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
            quality={90}
            loading="lazy"
            unoptimized={shouldUnoptimize}
            onError={() => setImageError(true)}
          />
          <FavoriteButton
            favoriteType="product"
            favoriteId={parseInt(data.id)}
            size="sm"
            variant="outline"
            className={cn(
              "absolute right-3 top-3",
              overlayButtonBaseClasses,
              "hover:-translate-y-0.5",
            )}
          />

          {hasReviewsInfo && (
            <div className={cn(
              "absolute bottom-3 left-3 z-10 flex items-center gap-0.5 rounded-full",
              "bg-gradient-to-r from-amber-500 to-amber-600",
              "shadow-[0_2px_8px_rgba(245,158,11,0.35)]",
              "px-1.5 py-0.5",
              "transition-all duration-200",
              "group-hover:shadow-[0_3px_10px_rgba(245,158,11,0.45)]",
              compact && "px-1 py-0.5"
            )}>
              {ratingValue && (
                <>
                  <Star className={cn("h-3 w-3 text-white", compact && "h-2.5 w-2.5")} fill="currentColor" />
                  <span className={cn("font-bold text-white leading-none", compact ? "text-[10px]" : "text-xs")}>{ratingValue}</span>
                </>
              )}
              {reviewsCount !== null && (
                <span className={cn("text-white/85 font-medium leading-none", compact ? "text-[9px]" : "text-[10px]")}>({reviewsCount})</span>
              )}
            </div>
          )}
        </div>

        <div className={cn("relative flex flex-1 flex-col gap-2 p-3", compact && "p-2 gap-1.5")}>
          <h3 className={cn("truncate text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary", compact && "text-[13px]")}>
            {data.name}
          </h3>

          {location && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            </div>
          )}

          <div className={cn("flex flex-col gap-2 text-xs text-muted-foreground", compact && "gap-1")}>
            {data.brand && data.category && (
              <span className="truncate font-medium text-foreground">{data.brand}</span>
            )}
          </div>

          <div className={cn("mt-[-8px] flex flex-col gap-1 pt-1", compact && "gap-0.5 pt-0.5")}>
            {stockLabel && <span className={cn("text-sm font-semibold text-foreground", compact && "text-[13px]")}>{stockLabel}</span>}
            <span className={cn("text-base font-semibold text-foreground", compact && "text-sm")}>€{data.price.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function RentalCardContent({
  data,
  variant = "default",
  className,
  onRemove,
  removeLabel,
  compact = false,
}: BaseProps & { data: RentalCardData }) {
  const [imageError, setImageError] = useState(false)

  const imageSrc = imageError || !data.image ? "/placeholder.svg" : getOptimizedImageUrl(data.image, 'card')
  const shouldUnoptimize = shouldUseUnoptimized(imageSrc)
  const isFlat = variant === "flat"
  const targetHref = data.href ?? `/detailed/rental/${data.id}`
  const remainingStock =
    typeof data.availableStock === "number"
      ? data.availableStock
      : typeof data.stock === "number"
        ? data.stock
        : undefined
  const isExplicitlyAvailable = data.available ?? true
  const isOutOfStock = typeof remainingStock === "number" ? remainingStock <= 0 : !isExplicitlyAvailable
  const isAvailable = !isOutOfStock
  const isLowStock = !isOutOfStock && typeof remainingStock === "number" && remainingStock <= 3
  const availabilityLabel = isOutOfStock
    ? "Out of stock"
    : typeof remainingStock === "number"
      ? `${remainingStock} verfügbar`
      : "Verfügbar"

  const cardClasses = cn(
    "relative flex h-full flex-col overflow-hidden bg-white transition-all duration-200 border border-border/40",
    isFlat ? "rounded-none shadow-none hover:shadow-none" : "rounded-xl shadow-sm hover:shadow-md",
    className,
  )

  const imageWrapperClasses = cn("relative overflow-hidden bg-muted/20", "aspect-square")
  const location = [data.city_name].filter(Boolean).join(", ") || null
  const ratingValue = data.rating !== undefined && data.rating > 0 ? data.rating.toFixed(1) : null
  const reviewsValue =
    data.totalReviews !== undefined && data.totalReviews > 0 ? data.totalReviews : null
  const hasReviewsInfo = ratingValue !== null || reviewsValue !== null
  const showOutOfStockChip = isOutOfStock

  const handleRemove = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onRemove?.()
  }

  return (
    <Link href={targetHref} className="block h-full group">
      <div className={cardClasses}>
        <div className={imageWrapperClasses}>
          {onRemove && (
            <button
              type="button"
              onClick={handleRemove}
              className={cn(
                "absolute left-3 top-3 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100",
                overlayButtonBaseClasses,
                "hover:-translate-y-0.5",
              )}
              aria-label={removeLabel ?? "Element entfernen"}
            >
              <span className="text-lg font-semibold leading-none">×</span>
            </button>
          )}
          <Image
            src={imageSrc}
            alt={data.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
            quality={90}
            loading="lazy"
            unoptimized={shouldUnoptimize}
            onError={() => setImageError(true)}
          />
          <FavoriteButton
            favoriteType="rental"
            favoriteId={parseInt(data.id)}
            size="sm"
            variant="outline"
            className={cn(
              "absolute right-3 top-3",
              overlayButtonBaseClasses,
              "hover:-translate-y-0.5",
            )}
          />

          {showOutOfStockChip && (
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 text-[11px] font-medium text-white/90">
              <span className="rounded-full border border-white/40 bg-black/30 px-2 py-1 uppercase tracking-wide backdrop-blur">
                Out of stock
              </span>
            </div>
          )}

          {hasReviewsInfo && (
            <div className={cn(
              "absolute left-3 z-10 flex items-center gap-0.5 rounded-full",
              "bg-gradient-to-r from-amber-500 to-amber-600",
              "shadow-[0_2px_8px_rgba(245,158,11,0.35)]",
              "px-1.5 py-0.5",
              "transition-all duration-200",
              "group-hover:shadow-[0_3px_10px_rgba(245,158,11,0.45)]",
              showOutOfStockChip ? "bottom-12" : "bottom-3",
              compact && "px-1 py-0.5"
            )}>
              {ratingValue && (
                <>
                  <Star className={cn("h-3 w-3 text-white", compact && "h-2.5 w-2.5")} fill="currentColor" />
                  <span className={cn("font-bold text-white leading-none", compact ? "text-[10px]" : "text-xs")}>{ratingValue}</span>
                </>
              )}
              {reviewsValue !== null && (
                <span className={cn("text-white/85 font-medium leading-none", compact ? "text-[9px]" : "text-[10px]")}>({reviewsValue})</span>
              )}
            </div>
          )}
        </div>

        {isOutOfStock && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-black/35 backdrop-blur-[0.5px]" />
        )}

        <div className={cn("relative flex flex-1 flex-col gap-2 p-3", compact && "p-2 gap-1.5")}>
          <h3 className={cn("truncate text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary", compact && "text-[13px]")}>
            {data.name}
          </h3>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location ?? "Location not specified"}</span>
            </div>
          </div>

          {!data.city_name && data.owner && (
            <p className="truncate text-xs text-muted-foreground">By {data.owner}</p>
          )}

          <div className={cn("mt-auto pt-1", compact && "pt-2")}>
            <div
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wide",
                isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : "text-emerald-600",
              )}
            >
              {availabilityLabel}
            </div>
            <span className={cn("text-base font-semibold text-foreground", compact && "text-sm")}>€{data.pricePerDay.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

