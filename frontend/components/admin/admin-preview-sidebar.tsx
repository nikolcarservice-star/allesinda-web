"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Loader2, AlertCircle } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { FullscreenImageViewer } from "@/components/ui/fullscreen-image-viewer"
import { getOptimizedImageUrl } from "@/lib/utils"

type PreviewType = "master" | "product" | "rental"

interface PreviewData {
  profile?: {
    id: number
    user_id: number
    user_name: string
    user_email: string
    city_id?: number | null
    city_name?: string | null
    about?: string
    image_url?: string
    category?: string
    verified: boolean
    rating: number
    total_reviews: number
    created_at: string
  }
  product?: {
    id: number
    seller_id: number
    seller_name?: string
    title: string
    description?: string
    price: number
    stock: number
    city_id?: number | null
    city_name?: string | null
    image_url?: string
    brand?: string
    category?: string
    rating: number
    total_reviews: number
    approved: boolean
    created_at: string
    updated_at?: string
  }
  rental?: {
    id: number
    seller_id: number
    owner_name?: string
    title: string
    description?: string
    price_per_day: number
    stock: number
    available: boolean
    city_id?: number | null
    city_name?: string | null
    image_url?: string
    category?: string
    approved: boolean
    created_at: string
    updated_at?: string
  }
  services?: Array<{
    id: number
    title: string
    description?: string
    price_from: number
    approved: boolean
    created_at: string
  }>
  media?: Array<{
    id: number
    url: string
    thumbnail_url?: string
    type: string
    status: string
    created_at: string
  }>
}

interface AdminPreviewSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: PreviewType | null
  loading: boolean
  data: PreviewData | null
}

export function AdminPreviewSidebar({
  open,
  onOpenChange,
  type,
  loading,
  data,
}: AdminPreviewSidebarProps) {
  const [fullscreenImage, setFullscreenImage] = useState<{
    url: string | null
    index: number | null
    allImages: string[]
  }>({ url: null, index: null, allImages: [] })
  const touchStartXRef = useRef<number | null>(null)

  const getTitle = () => {
    if (type === "master") return "Master Details"
    if (type === "product") return "Product Details"
    return "Rental Details"
  }

  const renderMainImage = (
    imageUrl: string | null | undefined,
    alt: string,
    allImages: string[],
    currentIndex: number
  ) => {
    if (!imageUrl) return null

    const normalizedUrl = getOptimizedImageUrl(imageUrl, 'card')

    const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartXRef.current = e.touches[0].clientX
      }
    }

    const handleTouchEnd = (e: React.TouchEvent) => {
      if (touchStartXRef.current === null) return
      const touch = e.changedTouches[0]
      if (!touch) return

      const deltaX = touch.clientX - touchStartXRef.current
      touchStartXRef.current = null

      const threshold = 40
      if (Math.abs(deltaX) < threshold) {
        setFullscreenImage({ url: normalizedUrl || null, index: currentIndex, allImages })
        return
      }

      if (deltaX > 0 && currentIndex > 0) {
        const prevIndex = currentIndex - 1
        setFullscreenImage({ url: allImages[prevIndex] || null, index: prevIndex, allImages })
      } else if (deltaX < 0 && currentIndex < allImages.length - 1) {
        const nextIndex = currentIndex + 1
        setFullscreenImage({ url: allImages[nextIndex] || null, index: nextIndex, allImages })
      } else {
        setFullscreenImage({ url: normalizedUrl || null, index: currentIndex, allImages })
      }
    }

    return (
      <div
        className="relative w-full aspect-square rounded-none overflow-hidden border border-border/40 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          setFullscreenImage({ url: normalizedUrl || null, index: currentIndex, allImages })
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={normalizedUrl || "/placeholder.svg"}
          alt={alt}
          fill
          className="object-cover"
          sizes="400px"
        />
      </div>
    )
  }

  const renderMediaGrid = (
    media: PreviewData["media"],
    mainImageUrl: string | null | undefined
  ) => {
    if (!media || media.length === 0) return null

    const mainImageNormalized = mainImageUrl ? getOptimizedImageUrl(mainImageUrl, 'card') : null
    const mediaImages = media.map((m) => getOptimizedImageUrl(m.thumbnail_url || m.url, 'thumbnail')).filter(Boolean)
    const allImages = [mainImageNormalized, ...mediaImages].filter(Boolean) as string[]

    return (
      <Accordion type="single" collapsible className="w-full" defaultValue="media">
        <AccordionItem value="media" className="border border-border/40 rounded-md">
          <AccordionTrigger className="py-2 px-2 hover:no-underline">
            <h4 className="text-xs font-medium">Media ({media.length})</h4>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-3 px-2">
            <div className="grid grid-cols-3 gap-2">
              {media.map((item, index) => {
                const mediaUrl = getOptimizedImageUrl(item.thumbnail_url || item.url, 'thumbnail') || "/placeholder.svg"
                const imageIndex = mainImageNormalized
                  ? allImages.findIndex((url) => url === mediaUrl) >= 0
                    ? allImages.findIndex((url) => url === mediaUrl)
                    : index + 1
                  : allImages.findIndex((url) => url === mediaUrl) >= 0
                    ? allImages.findIndex((url) => url === mediaUrl)
                    : index

                return (
                  <div
                    key={item.id}
                    className="relative aspect-square rounded-none overflow-hidden border border-border/40 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFullscreenImage({ url: mediaUrl, index: imageIndex, allImages })
                    }}
                  >
                    <Image
                      src={mediaUrl}
                      alt="Media"
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  </div>
                )
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    )
  }

  return (
    <>
      <Sheet 
        open={open} 
        onOpenChange={(shouldClose: boolean) => {
          // If trying to close and fullscreen viewer is open, close the fullscreen viewer first
          // but prevent the sheet from closing
          if (!shouldClose && fullscreenImage.url) {
            setFullscreenImage({ url: null, index: null, allImages: [] })
            // Keep the sheet open by not calling onOpenChange(false)
            return
          }
          // If trying to open, allow it
          if (shouldClose) {
            setFullscreenImage({ url: null, index: null, allImages: [] })
            onOpenChange(true)
          } else {
            // If trying to close and fullscreen is not open, close the sheet
            setFullscreenImage({ url: null, index: null, allImages: [] })
            onOpenChange(false)
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:w-[500px] overflow-y-auto p-0"
          onInteractOutside={(e) => {
            if (fullscreenImage.url) {
              e.preventDefault()
            }
          }}
          onEscapeKeyDown={(e) => {
            if (fullscreenImage.url) {
              e.preventDefault()
              return
            }
          }}
          onPointerDownOutside={(e) => {
            if (fullscreenImage.url) {
              e.preventDefault()
            }
          }}
        >
          <SheetHeader className="pb-3 border-b px-4 pt-4 pr-12">
            <SheetTitle className="text-base font-semibold">{getTitle()}</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-4 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : data ? (
              <div className="space-y-4">
                {/* Master Preview */}
                {type === "master" && data.profile && (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-16 w-16 sm:h-20 sm:w-20 rounded-full">
                        <AvatarFallback className="text-base sm:text-lg rounded-full">{data.profile.user_name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-base sm:text-lg">{data.profile.user_name}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">{data.profile.user_email}</p>
                        {data.profile.city_name && (
                          <p className="text-xs sm:text-sm text-muted-foreground">{data.profile.city_name}</p>
                        )}
                      </div>
                    </div>
                    {data.profile.about && (
                      <div>
                        <h4 className="text-xs sm:text-sm font-medium mb-1">About</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">{data.profile.about}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-3">
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {data.profile.rating.toFixed(1)} ⭐ ({data.profile.total_reviews} reviews)
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] sm:text-xs px-2 py-0.5 font-medium ${
                          data.profile.verified
                            ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                            : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                        }`}
                      >
                        {data.profile.verified ? "Verifiziert" : "Unverifiziert"}
                      </Badge>
                    </div>
                    {data.services && data.services.length > 0 && (
                      <Accordion type="single" collapsible className="w-full" defaultValue="services">
                        <AccordionItem value="services" className="border border-border/40 rounded-md">
                          <AccordionTrigger className="py-2 px-2 hover:no-underline">
                            <h4 className="text-xs font-medium">Services ({data.services.length})</h4>
                          </AccordionTrigger>
                          <AccordionContent className="pt-0 pb-3 px-2">
                            <div className="space-y-2">
                              {data.services.map((service) => (
                                <Card key={service.id} className="border border-border/40 p-2 sm:p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-xs sm:text-sm">{service.title}</p>
                                      {service.description && (
                                        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                          {service.description}
                                        </p>
                                      )}
                                      <div className="flex items-center justify-between gap-2 mt-1">
                                        <span className="text-sm sm:text-base font-bold text-foreground">
                                          €{service.price_from.toFixed(2)} from
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 font-medium ${
                                            service.approved
                                              ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                              : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                                          }`}
                                        >
                                          {service.approved ? "Genehmigt" : "Ausstehend"}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                    {renderMediaGrid(data.media, data.profile.image_url)}
                  </>
                )}

                {/* Product Preview */}
                {type === "product" && data.product && (
                  <>
                    {renderMainImage(
                      data.product.image_url,
                      data.product.title,
                      (() => {
                        const productImageUrl = getOptimizedImageUrl(data.product.image_url, 'card')
                        const mediaImages = (data.media || []).map((m) => getOptimizedImageUrl(m.thumbnail_url || m.url, 'thumbnail')).filter(Boolean)
                        return [productImageUrl, ...mediaImages].filter(Boolean) as string[]
                      })(),
                      0
                    )}
                    <div>
                      <h3 className="font-semibold text-base sm:text-lg mb-1">{data.product.title}</h3>
                      {data.product.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground">{data.product.description}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <h4 className="text-xs sm:text-sm font-medium mb-1">Price</h4>
                        <p className="text-sm sm:text-base font-bold text-foreground">€{data.product.price.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <h4 className="text-xs sm:text-sm font-medium mb-1">Stock</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">{data.product.stock}</p>
                      </div>
                      {data.product.seller_name && (
                        <div className="text-right">
                          <h4 className="text-xs sm:text-sm font-medium mb-1">Seller</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground">{data.product.seller_name}</p>
                        </div>
                      )}
                    </div>
                    {data.product.brand && (
                      <div>
                        <h4 className="text-xs sm:text-sm font-medium mb-1">Brand</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">{data.product.brand}</p>
                      </div>
                    )}
                    {data.product.category && (
                      <div className="w-full">
                        <h4 className="text-xs sm:text-sm font-medium mb-1">Category</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground break-words">{data.product.category}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      {data.product.rating > 0 ? (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {data.product.rating.toFixed(1)} ⭐ ({data.product.total_reviews} reviews)
                        </p>
                      ) : (
                        <div />
                      )}
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] sm:text-xs px-2 py-0.5 font-medium ${
                            data.product.stock > 0
                              ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }`}
                        >
                          {data.product.stock > 0 ? "Auf Lager" : "Ausverkauft"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] sm:text-xs px-2 py-0.5 font-medium ${
                            data.product.approved
                              ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                          }`}
                        >
                          {data.product.approved ? "Genehmigt" : "Ausstehend"}
                        </Badge>
                      </div>
                    </div>
                    {renderMediaGrid(data.media, data.product.image_url)}
                  </>
                )}

                {/* Rental Preview */}
                {type === "rental" && data.rental && (
                  <>
                    {renderMainImage(
                      data.rental.image_url,
                      data.rental.title,
                      (() => {
                        const rentalImageUrl = getOptimizedImageUrl(data.rental.image_url, 'card')
                        const mediaImages = (data.media || []).map((m) => getOptimizedImageUrl(m.thumbnail_url || m.url, 'thumbnail')).filter(Boolean)
                        return [rentalImageUrl, ...mediaImages].filter(Boolean) as string[]
                      })(),
                      0
                    )}
                    <div>
                      <h3 className="font-semibold text-base sm:text-lg mb-1">{data.rental.title}</h3>
                      {data.rental.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground">{data.rental.description}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <h4 className="text-xs sm:text-sm font-medium mb-1">Price/Day</h4>
                        <p className="text-sm sm:text-base font-bold text-foreground">€{data.rental.price_per_day.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <h4 className="text-xs sm:text-sm font-medium mb-1">Stock</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">{data.rental.stock}</p>
                      </div>
                      {data.rental.owner_name && (
                        <div className="text-right">
                          <h4 className="text-xs sm:text-sm font-medium mb-1">Owner</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground">{data.rental.owner_name}</p>
                        </div>
                      )}
                    </div>
                    {data.rental.city_name && (
                      <div>
                        <h4 className="text-xs sm:text-sm font-medium mb-1">Location</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">{data.rental.city_name}</p>
                      </div>
                    )}
                    {data.rental.category && (
                      <div className="w-full">
                        <h4 className="text-xs sm:text-sm font-medium mb-1">Category</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground break-words">{data.rental.category}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div />
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] sm:text-xs px-2 py-0.5 font-medium ${
                            data.rental.available && data.rental.stock > 0
                              ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }`}
                        >
                          {data.rental.available && data.rental.stock > 0 ? "Verfügbar" : "Ausverkauft"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] sm:text-xs px-2 py-0.5 font-medium ${
                            data.rental.approved
                              ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                          }`}
                        >
                          {data.rental.approved ? "Genehmigt" : "Ausstehend"}
                        </Badge>
                      </div>
                    </div>
                    {renderMediaGrid(data.media, data.rental.image_url)}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm">Failed to load details</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Fullscreen Image Viewer */}
      {fullscreenImage.url && fullscreenImage.allImages.length > 0 && (
        <FullscreenImageViewer
          isOpen={fullscreenImage.url !== null}
          onClose={() => setFullscreenImage({ url: null, index: null, allImages: [] })}
          imageUrl={fullscreenImage.url}
          alt="Fullscreen view"
          onPrevious={
            fullscreenImage.index !== null && fullscreenImage.index > 0 && fullscreenImage.allImages.length > 1
              ? () => {
                  const prevIndex = fullscreenImage.index! - 1
                  setFullscreenImage({
                    url: fullscreenImage.allImages[prevIndex] || null,
                    index: prevIndex,
                    allImages: fullscreenImage.allImages,
                  })
                }
              : undefined
          }
          onNext={
            fullscreenImage.index !== null && fullscreenImage.index < fullscreenImage.allImages.length - 1 && fullscreenImage.allImages.length > 1
              ? () => {
                  const nextIndex = fullscreenImage.index! + 1
                  setFullscreenImage({
                    url: fullscreenImage.allImages[nextIndex] || null,
                    index: nextIndex,
                    allImages: fullscreenImage.allImages,
                  })
                }
              : undefined
          }
        />
      )}
    </>
  )
}

