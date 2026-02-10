import type { FeaturedItem } from "@/lib/api/types"
import { formatPrice, getOptimizedImageUrl } from "@/lib/utils"
import type {
  MarketplaceItemCardProps,
  MasterCardData,
  ProductCardData,
  RentalCardData,
} from "@/components/shared/marketplace-item-card"

export function mapFeaturedItemToCard(item: FeaturedItem): MarketplaceItemCardProps | null {
  switch (item.type) {
    case "master": {
      const normalizedImage = item.image_url ? getOptimizedImageUrl(item.image_url, 'card') : undefined
      // Prefer city_name; gracefully fall back to subtitle if it looks like a location
      const fallbackLocation = (item.subtitle && item.subtitle.trim().length > 0) ? item.subtitle : undefined
      const location = [item.city_name ?? fallbackLocation].filter(Boolean).join(", ") || "Location not specified"
      const normalizeForCompare = (value?: string | null) =>
        value
          ?.toLowerCase()
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim() ?? ""
      const subtitle = item.subtitle?.trim()
      const normalizedLocation = normalizeForCompare(location)
      const normalizedSubtitle = normalizeForCompare(subtitle)
      const profession =
        subtitle &&
        !(
          normalizedSubtitle.length > 0 &&
          normalizedLocation.length > 0 &&
          (normalizedSubtitle === normalizedLocation ||
            normalizedSubtitle.includes(normalizedLocation) ||
            normalizedLocation.includes(normalizedSubtitle))
        )
          ? subtitle
          : undefined
      const data: MasterCardData = {
        id: String(item.id),
        name: item.title,
        // Avoid duplicating location in profession
        profession: profession && profession !== location ? profession : undefined,
        category_id: item.category_id ?? undefined,
        category: item.category ?? undefined, // Keep for backward compatibility in display
        rating: item.rating ?? 0,
        reviews: item.total_reviews ?? 0,
        location,
        image: normalizedImage && normalizedImage.trim().length > 0 ? normalizedImage : "/placeholder.svg",
        priceFrom: item.price ?? undefined,
        priceLabel:
          typeof item.price === "number" && Number.isFinite(item.price) && item.price > 0
            ? formatPrice(item.price, "EUR")
            : undefined,
        verified: false,
        distanceKm: undefined,
        contactPhone: undefined,
        contactEmail: undefined,
        canChat: false,
      }
      return { type: "master", data }
    }
    case "product": {
      const normalizedImage = item.image_url ? getOptimizedImageUrl(item.image_url, 'card') : undefined
      const data: ProductCardData = {
        id: String(item.id),
        name: item.title,
        price: item.price ?? 0,
        image: normalizedImage && normalizedImage.trim().length > 0 ? normalizedImage : "/placeholder.svg",
        seller: item.subtitle ?? "Featured seller",
        rating: item.rating ?? 0,
        reviews: item.total_reviews ?? undefined,
        stock: item.stock ?? undefined,
        brand: undefined,
        category_id: item.category_id ?? undefined,
        category: item.category ?? undefined, // Keep for backward compatibility in display
        city_name: item.city_name ?? undefined,
      }
      return { type: "product", data }
    }
    case "rental": {
      const normalizedImage = item.image_url ? getOptimizedImageUrl(item.image_url, 'card') : undefined
      const data: RentalCardData = {
        id: String(item.id),
        name: item.title,
        pricePerDay: item.price_per_day ?? item.price ?? 0,
        image: normalizedImage && normalizedImage.trim().length > 0 ? normalizedImage : "/placeholder.svg",
        owner: item.subtitle ?? "Rental owner",
        stock: item.stock ?? undefined,
        available: item.available ?? (typeof item.stock === "number" ? item.stock > 0 : true),
        rating: item.rating ?? undefined,
        totalReviews: item.total_reviews ?? undefined,
        category_id: item.category_id ?? undefined,
        category: item.category ?? undefined, // Keep for backward compatibility in display
        city_name: item.city_name ?? undefined,
      }
      return { type: "rental", data }
    }
    default:
      return null
  }
}

