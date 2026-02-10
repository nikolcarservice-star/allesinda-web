"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Loader2, ArrowLeft, CheckCircle2, XCircle, AlertCircle, ArrowUpRight, MapPin } from "lucide-react"
import { previewProduct, previewRental, previewMaster, approveProduct, rejectProduct, approveRental, rejectRental, approveService, rejectService } from "@/lib/api/admin"
import { toast } from "sonner"
import { getOptimizedImageUrl, formatPrice, cn } from "@/lib/utils"
import { ProductRentalGallery, type ProductRentalGalleryItem } from "@/components/detailed/product-rental-gallery"
import { MasterGallery } from "@/components/detailed/master-gallery"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type PreviewType = "product" | "rental" | "master"

const TYPE_CONFIG: Record<
  PreviewType,
  {
    label: string
    accent: string
    gradient: string
  }
> = {
  master: {
    label: "Meister",
    accent: "bg-emerald-500 text-white",
    gradient: "from-emerald-600/20 via-emerald-500/10 to-transparent",
  },
  product: {
    label: "Produkt",
    accent: "bg-blue-500 text-white",
    gradient: "from-blue-600/20 via-blue-500/10 to-transparent",
  },
  rental: {
    label: "Mieten",
    accent: "bg-purple-500 text-white",
    gradient: "from-purple-600/20 via-purple-500/10 to-transparent",
  },
}

const TYPE_BADGE_THEME: Record<
  PreviewType,
  {
    container: string
    icon: string
  }
> = {
  master: {
    container: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-100",
    icon: "bg-emerald-500 text-white",
  },
  product: {
    container: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-100",
    icon: "bg-blue-500 text-white",
  },
  rental: {
    container: "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-100",
    icon: "bg-purple-500 text-white",
  },
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

function buildGalleryItems(media: any[]): GalleryItem[] {
  return media.reduce<GalleryItem[]>((acc, item) => {
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

    if (item.type === "video") {
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

function buildProductRentalGalleryImages(media: any[], fallbackImage: string): ProductRentalGalleryItem[] {
  const items = buildGalleryItems(media)
  const images: ProductRentalGalleryItem[] = []

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
    images.push({ key: "primary", url: fallbackImage, alt: "Vorschau" })
  } else if (!images.some((image) => image.url === fallbackImage)) {
    images.unshift({ key: "primary", url: fallbackImage, alt: "Vorschau" })
  }

  return images
}

export default function AdminPreviewPage() {
  const params = useParams()
  const router = useRouter()
  const type = params?.type as PreviewType
  const id = parseInt(params?.id as string)

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [data, setData] = useState<any>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "approve" | "reject" | null;
    itemId: number | null;
    itemTitle: string;
    itemType?: "main" | "service";
  }>({ open: false, action: null, itemId: null, itemTitle: "", itemType: "main" })

  useEffect(() => {
    if (type && id) {
      loadData()
    }
  }, [type, id])

  const loadData = async () => {
    try {
      setLoading(true)
      let result
      if (type === "product") {
        result = await previewProduct(id)
      } else if (type === "rental") {
        result = await previewRental(id)
      } else if (type === "master") {
        result = await previewMaster(id)
      } else {
        toast.error("Ungültiger Vorschautyp")
        router.back()
        return
      }
      setData(result)
    } catch (error: any) {
      console.error("Failed to load preview:", error)
      toast.error(error.message || "Vorschau konnte nicht geladen werden")
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!confirmDialog.itemId) return
    try {
      setProcessing(true)
      if (confirmDialog.itemType === "service") {
        await approveService(confirmDialog.itemId)
        toast.success("Service approved successfully")
      } else if (type === "product") {
        await approveProduct(confirmDialog.itemId)
        toast.success("Produkt erfolgreich genehmigt")
      } else if (type === "rental") {
        await approveRental(confirmDialog.itemId)
        toast.success("Verleih erfolgreich genehmigt")
      }
      loadData()
      setConfirmDialog({ open: false, action: null, itemId: null, itemTitle: "", itemType: "main" })
    } catch (error: any) {
      toast.error(error.message || "Failed to approve")
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!confirmDialog.itemId) return
    try {
      setProcessing(true)
      if (type === "product") {
        await rejectProduct(confirmDialog.itemId)
        toast.success("Produkt erfolgreich abgelehnt")
      } else if (type === "rental") {
        await rejectRental(confirmDialog.itemId)
        toast.success("Verleih erfolgreich abgelehnt")
      }
      loadData()
      setConfirmDialog({ open: false, action: null, itemId: null, itemTitle: "", itemType: "main" })
    } catch (error: any) {
      toast.error(error.message || "Failed to reject")
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-muted-foreground">Vorschau konnte nicht geladen werden</p>
          <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
        </div>
      </div>
    )
  }

  const item = type === "product" ? data.product : type === "rental" ? data.rental : data.profile
  const media = data.media || []
  const services = type === "master" ? (data.services || []) : []

  const typeConfig = TYPE_CONFIG[type]
  const typeBadgeTheme = TYPE_BADGE_THEME[type]
  const typeInitial = typeConfig.label.charAt(0)
  const heroImage = getOptimizedImageUrl(item.image_url, 'full') || "/placeholder.svg"
  const description = item.description?.trim() || "Keine Beschreibung verfügbar."
  const isProductLike = type === "product" || type === "rental"
  const locationDisplay = [(item as any).city_name as string | undefined].filter(Boolean).join(", ")

  const galleryItems = buildGalleryItems(media)
  const galleryImages = isProductLike ? buildProductRentalGalleryImages(media, heroImage) : []
  const masterGalleryImages = !isProductLike
    ? [buildProductRentalGalleryImages(media, heroImage)[0] ?? { key: "primary", url: heroImage, alt: item.title || item.user_name || "Vorschau" }]
    : []

  // Build stats
  const stats: Array<{ label: string; value: string }> = []
  if (type === "product") {
    if (typeof item.price === "number") {
      stats.push({ label: "Preis", value: formatPrice(item.price, "EUR") })
    }
    if (typeof item.stock === "number") {
      stats.push({ label: "Bestand", value: item.stock > 0 ? `${item.stock}` : "Nicht vorrätig" })
    }
    if (item.brand) {
      stats.push({ label: "Marke", value: item.brand })
    }
  }
  if (type === "rental") {
    if (typeof item.price_per_day === "number") {
      stats.push({ label: "Tagespreis", value: `${formatPrice(item.price_per_day, "EUR")} / Tag` })
    }
    if (typeof item.stock === "number") {
      stats.push({
        label: "Verfügbare Einheiten",
        value: item.stock > 0 ? `${item.stock} Einheiten` : "Vollständig gebucht",
      })
    }
  }
  if (type === "master") {
    if (typeof item.rating === "number" && item.rating > 0) {
      stats.push({ label: "Bewertung", value: `${item.rating.toFixed(1)} ⭐` })
    }
    if (item.total_reviews) {
      stats.push({ label: "Bewertungen", value: `${item.total_reviews}` })
    }
  }

  // Build info items
  const infoItems: Array<{ label: string; value: string }> = []
  infoItems.push({ label: "Typ", value: typeConfig.label })
  if (item.category) {
    infoItems.push({ label: "Kategorie", value: item.category })
  }
  if (locationDisplay) {
    infoItems.push({ label: "Standort", value: locationDisplay })
  }
  if (item.created_at) {
    const createdAt = new Date(item.created_at)
    if (!Number.isNaN(createdAt.getTime())) {
      infoItems.push({
        label: "Hinzugefügt",
        value: new Intl.DateTimeFormat("de-DE", { year: "numeric", month: "short", day: "numeric" }).format(createdAt),
      })
    }
  }
  if (type === "master" && services.length) {
    infoItems.push({ label: "Angebotene Dienstleistungen", value: String(services.length) })
  }
  if (type === "product" && item.brand) {
    infoItems.push({ label: "Marke", value: item.brand })
  }
  if (type === "product" && typeof item.stock === "number") {
    infoItems.push({ label: "Bestand", value: `${item.stock} Einheiten` })
  }
  if (type === "rental" && typeof item.stock === "number") {
    infoItems.push({ label: "Gesamte Einheiten", value: `${item.stock} verfügbar` })
  }

  const priceDisplay =
    type === "product"
      ? typeof item.price === "number"
        ? formatPrice(item.price, "EUR")
        : null
      : type === "rental"
      ? typeof item.price_per_day === "number"
        ? `${formatPrice(item.price_per_day, "EUR")} / Tag`
        : null
        : null

  if (isProductLike) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <section className="border-b border-muted/60 bg-background">
          <div className="container mx-auto grid gap-10 px-4 py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="relative">
              <ProductRentalGallery items={galleryImages} />
            </div>
            <div className="flex flex-col gap-6 md:gap-7">
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                    <Link href="/admin">
                      <span className="hidden sm:inline">Zurück zum Admin</span>
                      <span className="sm:hidden">Zurück</span>
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{item.title || "Ohne Titel"}</h1>
                    <Badge variant={item.approved ? "default" : "destructive"} className="bg-background/90 backdrop-blur-sm shrink-0">
                      {item.approved ? "Genehmigt" : "Nicht genehmigt"}
                    </Badge>
                  </div>
                  {locationDisplay && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium text-muted-foreground">{locationDisplay}</span>
                    </div>
                  )}
                  {typeof item.rating === "number" && item.rating > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <span className="text-yellow-500">★</span>
                        <span className="text-foreground">{item.rating.toFixed(1)}</span>
                        {item.total_reviews ? (
                          <span className="text-sm text-muted-foreground">({item.total_reviews})</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3 border-y border-muted/50 py-4">
                {priceDisplay && <p className="text-3xl font-semibold text-foreground">{priceDisplay}</p>}
                <div className="flex gap-2">
                  {!item.approved ? (
                    <Button
                      onClick={() => setConfirmDialog({ open: true, action: "approve", itemId: item.id, itemTitle: item.title, itemType: "main" })}
                      disabled={processing}
                      className="flex-1"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Genehmigen
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setConfirmDialog({ open: true, action: "reject", itemId: item.id, itemTitle: item.title, itemType: "main" })}
                      disabled={processing}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Ablehnen
                    </Button>
                  )}
                </div>
              </div>

              {stats.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">Hervorhebungen</h3>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {stats.map((stat) => (
                      <li key={`${stat.label}-${stat.value}`} className="space-y-0.5">
                        <span className="block text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</span>
                        <span className="block text-sm font-medium text-foreground">{stat.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Accordion type="single" collapsible defaultValue="detail" className="border-none">
                <AccordionItem value="detail" className="border-border/70">
                  <AccordionTrigger className="group px-0 text-base font-semibold tracking-tight [&>svg]:hidden">
                    <span className="flex-1">Details</span>
                    <span className="text-lg font-semibold text-muted-foreground group-data-[state=open]:hidden">+</span>
                    <span className="hidden text-lg font-semibold text-muted-foreground group-data-[state=open]:block">
                      &minus;
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-1">
                    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                  </AccordionContent>
                </AccordionItem>
                {infoItems.length > 0 && (
                  <AccordionItem value="additional-info" className="border-border/70">
                    <AccordionTrigger className="group px-0 text-base font-semibold tracking-tight [&>svg]:hidden">
                      <span className="flex-1">Zusätzliche Informationen</span>
                      <span className="text-lg font-semibold text-muted-foreground group-data-[state=open]:hidden">+</span>
                      <span className="hidden text-lg font-semibold text-muted-foreground group-data-[state=open]:block">
                        &minus;
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-1">
                      <ul className="divide-y divide-border/50 rounded-sm border border-border/60 bg-background/80">
                        {infoItems.map((item) => (
                          <li key={`${item.label}-${item.value}`} className="flex items-start justify-between gap-4 px-4 py-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {item.label}
                            </span>
                            <span className="text-sm font-medium text-foreground">{item.value}</span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-muted/60 bg-background">
        <div className="container mx-auto grid gap-8 px-4 py-10 md:gap-10 md:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="relative">
            <ProductRentalGallery items={masterGalleryImages} variant="hero" />
            <div className="absolute right-3 top-3 z-10 flex gap-2">
              <Badge variant={item.approved !== false ? "default" : "destructive"} className="bg-background/90 backdrop-blur-sm">
                {item.approved !== false ? "Genehmigt" : "Nicht genehmigt"}
              </Badge>
              {item.verified !== undefined && (
                <Badge variant={item.verified ? "default" : "outline"} className="bg-background/90 backdrop-blur-sm">
                  {item.verified ? "Verifiziert" : "Nicht verifiziert"}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-6 md:gap-7">
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                  <Link href="/admin">
                    <span className="hidden sm:inline">Back to Admin</span>
                    <span className="sm:hidden">Back</span>
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">{item.title || item.user_name || "Ohne Titel"}</h1>
                {locationDisplay && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium text-muted-foreground">{locationDisplay}</span>
                  </div>
                )}
                {(typeof item.rating === "number" && item.rating > 0) || type === "master" ? (
                  <div className="flex items-center gap-2">
                    {typeof item.rating === "number" && item.rating > 0 && (
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <span className="text-yellow-500">★</span>
                        <span className="text-foreground">{item.rating.toFixed(1)}</span>
                        {item.total_reviews ? (
                          <span className="text-sm text-muted-foreground">({item.total_reviews})</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {stats.length > 0 && (
              <div className="space-y-3 border-y border-muted/50 py-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-semibold text-foreground sm:text-3xl">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground sm:text-lg">Über</h3>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
            </div>

            {stats.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground sm:text-lg">Highlights</h3>
                <ul className="grid grid-cols-2 gap-3">
                  {stats.map((stat) => (
                    <li key={`${stat.label}-${stat.value}`} className="space-y-0.5">
                      <span className="block text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</span>
                      <span className="block text-sm font-medium text-foreground">{stat.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {type === "master" && services.length > 0 && (
              <Accordion type="single" collapsible defaultValue="featured-services" className="border-none">
                <AccordionItem value="featured-services" className="border-border/70">
                  <AccordionTrigger className="group px-0 text-base font-semibold tracking-tight [&>svg]:hidden">
                    <span className="flex-1">Empfohlene Dienstleistungen</span>
                    <span className="text-lg font-semibold text-muted-foreground group-data-[state=open]:hidden">+</span>
                    <span className="hidden text-lg font-semibold text-muted-foreground group-data-[state=open]:block">
                      &minus;
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-1">
                    <div className="divide-y divide-border/50 rounded-none border border-border/60 bg-background/80">
                      {services.map((service: any) => (
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
                              <Badge variant={service.approved ? "default" : "destructive"} className="text-xs">
                                {service.approved ? "Genehmigt" : "Nicht genehmigt"}
                              </Badge>
                            </div>

                            <div className="hidden sm:flex sm:flex-col sm:items-end sm:gap-1">
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Ab
                              </span>
                              <span className="text-lg font-semibold text-foreground">
                                {formatPrice(service.price_from, "EUR")}
                              </span>
                            </div>

                            <div className="hidden sm:flex sm:justify-end sm:items-center sm:gap-2">
                              <Badge variant={service.approved ? "default" : "destructive"} className="text-xs">
                                {service.approved ? "Genehmigt" : "Nicht genehmigt"}
                              </Badge>
                              {!service.approved && (
                                <Button
                                  size="sm"
                                  onClick={() => setConfirmDialog({ open: true, action: "approve", itemId: service.id, itemTitle: service.title, itemType: "service" })}
                                  disabled={processing}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Genehmigen
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {galleryItems.length > 0 && (
              <Accordion type="single" collapsible className="border-none">
                <AccordionItem value="recent-work" className="border-border/70">
                  <AccordionTrigger className="group px-0 text-base font-semibold tracking-tight [&>svg]:hidden">
                    <span className="flex-1">Aktuelle Arbeiten</span>
                    <span className="text-lg font-semibold text-muted-foreground group-data-[state=open]:hidden">+</span>
                    <span className="hidden text-lg font-semibold text-muted-foreground group-data-[state=open]:block">
                      &minus;
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-1 md:px-2" containerClassName="overflow-visible">
                    <MasterGallery items={galleryItems} edgeToEdge={false} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </div>
      </section>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, action: null, itemId: null, itemTitle: "", itemType: "main" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "approve" ? "Artikel genehmigen" : "Artikel ablehnen"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "approve"
                ? `Sind Sie sicher, dass Sie "${confirmDialog.itemTitle}" genehmigen möchten? Dieser Artikel wird für Benutzer sichtbar sein.`
                : `Sind Sie sicher, dass Sie "${confirmDialog.itemTitle}" ablehnen möchten? Dieser Artikel wird vor Benutzern verborgen sein.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.action === "approve") {
                  handleApprove()
                } else if (confirmDialog.action === "reject") {
                  handleReject()
                }
              }}
              disabled={processing}
            >
              {confirmDialog.action === "approve" ? "Genehmigen" : "Ablehnen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
