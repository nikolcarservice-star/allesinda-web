"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, startTransition, type ComponentProps, type ReactNode, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { LocateFixed, MapPin, Target, Loader2, Info, SlidersHorizontal, ChevronDown, X, RotateCcw, Search, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MarketplaceItemCard } from "@/components/shared/marketplace-item-card"
import { mapFeaturedItemToCard } from "@/components/shared/map-featured-item-to-card"
import { getCategoryTreeByType } from "@/lib/api"
import { getCategoriesByType } from "@/lib/api/categories"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type {
  CategoryType,
  CategoryTree,
  FeaturedItem,
  PaginatedResponse,
  Profile,
  Product,
  Rental,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import { getFeaturedItems } from "@/lib/api/featured"

const VALID_TYPES: readonly CategoryType[] = ["master", "product", "rental"]
const PRICE_LABELS: Record<CategoryType, { min: string; max: string }> = {
  master: { min: "", max: "" },
  product: { min: "Mindestpreis", max: "Höchstpreis" },
  rental: { min: "Mindestpreis pro Tag", max: "Höchstpreis pro Tag" },
}

type SortOption = "featured" | "trending_desc" | "price_asc" | "price_desc" | "rating_desc"

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "featured", label: "Empfohlene Artikel" },
  { value: "trending_desc", label: "Trending Artikel" },
  { value: "rating_desc", label: "Top bewertet" },
  { value: "price_asc", label: "Preis: Niedrig zu Hoch" },
  { value: "price_desc", label: "Preis: Hoch zu Niedrig" },
]

const PAGE_SIZE_OPTIONS = [12, 24, 36]
const MOBILE_FEED_PAGE_SIZE = 24

const DEFAULT_RADIUS_KM = 25

const SEARCH_ALERTS_ENABLED =
  typeof process.env.NEXT_PUBLIC_ENABLE_SEARCH_ALERTS === "string"
    ? process.env.NEXT_PUBLIC_ENABLE_SEARCH_ALERTS !== "false"
    : true

const SEARCH_ALERT_COOLDOWN_MINUTES = Number(
  process.env.NEXT_PUBLIC_SEARCH_ALERT_COOLDOWN_MINUTES ?? 60
)

const SEARCH_ALERT_MAX_RECIPIENTS = Number(
  process.env.NEXT_PUBLIC_SEARCH_ALERT_MAX_RECIPIENTS ?? 25
)

interface FeaturedState {
  data: PaginatedResponse<FeaturedItem> | null
  loading: boolean
  error?: string
}

function mergeFeaturedItems(
  previous: FeaturedItem[],
  incoming: FeaturedItem[],
): FeaturedItem[] {
  const seen = new Set<string>()
  const merged: FeaturedItem[] = []
  for (const item of [...previous, ...incoming]) {
    const key = `${item.type}-${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged
}

interface MasterSearchResult extends Profile {
  lowest_service_price?: number | null
  image_url?: string | null // Profile image URL
}

function mapMasterToFeaturedItem(master: MasterSearchResult): FeaturedItem {
  const priceFromServices =
    typeof master.lowest_service_price === "number" && Number.isFinite(master.lowest_service_price)
      ? master.lowest_service_price
      : undefined
  const priceValue = priceFromServices && priceFromServices > 0 ? priceFromServices : undefined

  return {
    id: master.id,
    type: "master",
    title: master.user_name || master.about || `Meister ${master.id}`,
    subtitle: undefined,
    description: master.about || undefined,
    image_url: master.image_url || undefined, // Use profile image_url for master cards
    rating: master.rating ?? undefined,
    total_reviews: master.total_reviews ?? undefined,
    price: priceValue ?? null,
    price_per_day: null,
    city_id: master.city_id ?? undefined,
    city_name: master.city_name ?? undefined,
    category_id: master.category_id ?? undefined,
    category: master.category || undefined, // Keep for backward compatibility
    created_at: master.created_at || undefined,
    likes_count: typeof master.likes_count === "number" ? master.likes_count : undefined,
  }
}

function mapProductToFeaturedItem(product: Product): FeaturedItem {
  return {
    id: product.id,
    type: "product",
    title: product.title,
    subtitle: product.brand || undefined,
    description: product.description || undefined,
    image_url: product.image_url || undefined,
    rating: product.rating ?? undefined,
    total_reviews: product.total_reviews ?? undefined,
    price: product.price ?? undefined,
    price_per_day: null,
    city_id: product.city_id ?? undefined,
    city_name: product.city_name ?? undefined,
    category_id: product.category_id ?? undefined,
    category: product.category || undefined, // Keep for backward compatibility
    created_at: product.created_at || undefined,
  likes_count: typeof product.likes_count === "number" ? product.likes_count : undefined,
  }
}

function mapRentalToFeaturedItem(rental: Rental): FeaturedItem {
  const location = rental.city_name || undefined
  const isLowStock = typeof rental.stock === "number" && rental.stock > 0 && rental.stock <= 3
  const isOutOfStock = typeof rental.stock === "number" && rental.stock <= 0
  const stockLabel = isOutOfStock
    ? "Nicht vorrätig"
    : isLowStock
      ? `${rental.stock} übrig`
      : undefined
  const subtitle = [location, stockLabel].filter((value): value is string => Boolean(value)).join(" • ")

  return {
    id: rental.id,
    type: "rental",
    title: rental.title,
    subtitle: subtitle || undefined,
    description: rental.description || undefined,
    image_url: rental.image_url || undefined,
    rating: undefined,
    total_reviews: undefined,
    price: null,
    price_per_day: rental.price_per_day ?? undefined,
    city_id: rental.city_id ?? undefined,
    city_name: rental.city_name ?? undefined,
    category_id: rental.category_id ?? undefined,
    category: rental.category || undefined, // Keep for backward compatibility
    created_at: rental.created_at || undefined,
    stock: rental.stock,
    available: rental.available,
  likes_count: typeof rental.likes_count === "number" ? rental.likes_count : undefined,
  }
}

function sortFeaturedItems(items: FeaturedItem[], sortOption: SortOption): FeaturedItem[] {
  if (sortOption === "featured") {
    return items
  }

  if (sortOption === "trending_desc") {
    const sortedByLikes = [...items]
    sortedByLikes.sort((a, b) => {
      const likesA = typeof a.likes_count === "number" ? a.likes_count : 0
      const likesB = typeof b.likes_count === "number" ? b.likes_count : 0
      if (likesA === likesB) {
        const ratingA = typeof a.rating === "number" ? a.rating : -Infinity
        const ratingB = typeof b.rating === "number" ? b.rating : -Infinity
        if (ratingA === ratingB) {
          const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
          const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
          return createdB - createdA
        }
        return ratingB - ratingA
      }
      return likesB - likesA
    })
    return sortedByLikes
  }

  const sorted = [...items]

  const getPriceValue = (item: FeaturedItem): number | null => {
    if (item.type === "product") {
      return typeof item.price === "number" ? item.price : null
    }
    if (item.type === "rental") {
      return typeof item.price_per_day === "number" ? item.price_per_day : null
    }
    return typeof item.price === "number" ? item.price : null
  }

  sorted.sort((a, b) => {
    if (sortOption === "price_asc" || sortOption === "price_desc") {
      const priceA = getPriceValue(a)
      const priceB = getPriceValue(b)
      const fallbackA = sortOption === "price_asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
      const fallbackB = sortOption === "price_asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
      const normalizedA = priceA ?? fallbackA
      const normalizedB = priceB ?? fallbackB

      if (normalizedA === normalizedB) {
        const ratingA = typeof a.rating === "number" ? a.rating : -Infinity
        const ratingB = typeof b.rating === "number" ? b.rating : -Infinity
        return sortOption === "price_asc" ? ratingB - ratingA : ratingA - ratingB
      }

      return sortOption === "price_asc" ? normalizedA - normalizedB : normalizedB - normalizedA
    }

    const ratingA = typeof a.rating === "number" ? a.rating : -Infinity
    const ratingB = typeof b.rating === "number" ? b.rating : -Infinity
    if (ratingA === ratingB) {
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    }
    return ratingB - ratingA
  })

  return sorted
}

function findCategoryNode(tree: CategoryTree[], slug: string): CategoryTree | null {
  for (const node of tree) {
    if (node.slug === slug) {
      return node
    }
    if (node.children?.length) {
      const match = findCategoryNode(node.children, slug)
      if (match) {
        return match
      }
    }
  }
  return null
}

function findCategorySelection(tree: CategoryTree[], slug: string): { parentSlug?: string; subcategorySlug?: string } {
  for (const node of tree) {
    if (node.slug === slug) {
      return { parentSlug: node.slug }
    }
    if (node.children?.length) {
      if (node.children.some((child) => child.slug === slug)) {
        return { parentSlug: node.slug, subcategorySlug: slug }
      }
      const nested = findCategorySelection(node.children, slug)
      if (nested.parentSlug) {
        return {
          parentSlug: node.slug,
          subcategorySlug: nested.subcategorySlug ?? nested.parentSlug,
        }
      }
    }
  }
  return {}
}

function MarketplaceItemCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-none">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="mt-auto space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    </div>
  )
}

interface FilterDropdownProps {
  label: string
  activeDescription?: string | null
  disabled?: boolean
  onClear?: () => void
  align?: ComponentProps<typeof DropdownMenuContent>["align"]
  className?: string
  buttonClassName?: string
  children: ReactNode | ((context: { close: () => void }) => ReactNode)
  renderTag?: ReactNode
}

function FilterDropdown({
  label,
  activeDescription,
  disabled,
  onClear,
  align = "start",
  className,
  buttonClassName,
  children,
  renderTag,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)

  const content = typeof children === "function" ? children({ close: () => setOpen(false) }) : children

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 w-auto min-w-[120px] justify-between rounded-sm border border-border/60 bg-white px-3 text-sm font-normal text-foreground transition-colors hover:border-primary/60 hover:bg-white hover:text-foreground focus-visible:border-border/60 focus-visible:ring-0 focus-visible:ring-offset-0",
            buttonClassName,
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <div className="flex flex-1 items-center gap-2 overflow-hidden text-left">
            <span className="truncate text-left">{label}</span>
            {renderTag}
            {activeDescription ? (
              <span className="max-w-[8rem] truncate text-xs font-normal text-muted-foreground">{activeDescription}</span>
            ) : null}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={8}
        className={cn(
          "w-[min(calc(100vw-2rem),320px)] overflow-hidden rounded-sm border border-border/60 bg-white p-0 shadow-xl z-[60]",
          className
        )}
      >
        <div className="max-h-[70vh] overflow-y-auto p-4">{content}</div>
        {onClear ? (
          <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-3 py-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={onClear}>
              Zurücksetzen
            </Button>
            <Button size="sm" className="text-xs" onClick={() => setOpen(false)}>
              Apply
            </Button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function FeaturedPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams?.get("q") ?? searchParams?.get("search") ?? ""
  const initialTypeParam = searchParams?.get("types") ?? searchParams?.get("type")
  const categoryParam = searchParams?.get("category") ?? null
  const derivedType = initialTypeParam && VALID_TYPES.includes(initialTypeParam as CategoryType)
    ? (initialTypeParam as CategoryType)
    : VALID_TYPES[0]
  const [activeSearchTerm, setActiveSearchTerm] = useState(initialQuery)
  const [activeType, setActiveType] = useState<CategoryType>(derivedType)
  const [city, setCity] = useState(searchParams?.get("city") ?? "")
  const [cityId, setCityId] = useState<number | undefined>(() => {
    const raw = searchParams?.get("city_id")
    if (!raw) return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  })
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams?.get("verified_only") === "true")
  const [minRating, setMinRating] = useState<number | undefined>(() => {
    const value = searchParams?.get("min_rating")
    return value ? Number(value) : undefined
  })
  const [minPrice, setMinPrice] = useState<number | undefined>(() => {
    const value = searchParams?.get("min_price")
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  })
  const [maxPrice, setMaxPrice] = useState<number | undefined>(() => {
    const value = searchParams?.get("max_price")
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  })
  const [latitude, setLatitude] = useState<number | null>(() => {
    const value = searchParams?.get("latitude")
    return value ? Number(value) : null
  })
  const [longitude, setLongitude] = useState<number | null>(() => {
    const value = searchParams?.get("longitude")
    return value ? Number(value) : null
  })
  const [radiusKm, setRadiusKm] = useState<number>(() => {
    const value = searchParams?.get("radius_km")
    return value ? Number(value) : DEFAULT_RADIUS_KM
  })
  const [geolocating, setGeolocating] = useState(false)
  const [categoryTree, setCategoryTree] = useState<Record<CategoryType, CategoryTree[]>>({
    master: [],
    product: [],
    rental: [],
  })
  const [selectedParentCategory, setSelectedParentCategory] = useState<string>("all")
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all")
  const [parentCategories, setParentCategories] = useState<Array<{ id: number; name: string; slug: string }>>([])
  const [subcategories, setSubcategories] = useState<Array<{ id: number; name: string; slug: string; parent_id: number | null }>>([])
  const [allSubcategories, setAllSubcategories] = useState<Array<{ id: number; name: string; slug: string; parent_id: number | null }>>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const determineInitialSortOption = (): SortOption => {
    const sortParam = searchParams?.get("sort")
    if (sortParam && ["featured", "trending_desc", "price_asc", "price_desc", "rating_desc"].includes(sortParam)) {
      return sortParam as SortOption
    }
    const legacySortBy = searchParams?.get("sort_by")
    const legacySortOrder = searchParams?.get("sort_order")
    if (legacySortBy === "price") {
      return legacySortOrder === "asc" ? "price_asc" : "price_desc"
    }
    if (legacySortBy === "rating") {
      return "rating_desc"
    }
    if (legacySortBy === "likes") {
      return "trending_desc"
    }
    return "featured"
  }
  const initialSortOptionRef = useRef<SortOption>(determineInitialSortOption())
  const initialPageSize = Number(searchParams?.get("page_size")) || PAGE_SIZE_OPTIONS[0]
  const [sortOption, setSortOption] = useState<SortOption>(initialSortOptionRef.current)
  const currentSortFromParams = useMemo(() => determineInitialSortOption(), [searchParams])
  const lastSyncedSortParamRef = useRef<SortOption>(initialSortOptionRef.current)
  const [page, setPage] = useState(() => Number(searchParams?.get("page")) || 1)
  const [pageSize, setPageSize] = useState(() => initialPageSize)
  const [{ data, loading, error }, setState] = useState<FeaturedState>({ data: null, loading: true })
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false) // Default to closed
  const [isSheetClosing, setIsSheetClosing] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const appendResultsRef = useRef(false)
  const loadMoreLockRef = useRef(false)
  const feedSentinelRef = useRef<HTMLDivElement | null>(null)
  const lastRequestSignatureRef = useRef<string | null>(null)
  const isUpdatingUrlRef = useRef(false) // Track when we're updating URL after API call to prevent sort useEffect from triggering
  const isLoadingRef = useRef(false) // Track if a request is currently in progress to prevent duplicate calls
  const requestTimeoutRef = useRef<NodeJS.Timeout | null>(null) // Track debounce timeout

  // Temporary filter states for mobile sidebar (don't trigger API calls until Apply is clicked)
  const [tempActiveSearchTerm, setTempActiveSearchTerm] = useState(activeSearchTerm)
  const [tempSortOption, setTempSortOption] = useState<SortOption>(sortOption)
  const [tempCity, setTempCity] = useState(city)
  const [tempLatitude, setTempLatitude] = useState<number | null>(latitude)
  const [tempLongitude, setTempLongitude] = useState<number | null>(longitude)
  const [tempRadiusKm, setTempRadiusKm] = useState(radiusKm)
  const [tempMinPrice, setTempMinPrice] = useState<number | undefined>(minPrice)
  const [tempMaxPrice, setTempMaxPrice] = useState<number | undefined>(maxPrice)
  const [tempPageSize, setTempPageSize] = useState(pageSize)

  // Sync temporary states when actual states change (e.g., from desktop filters or URL changes)
  useEffect(() => {
    if (!mobileFiltersOpen) {
      setTempActiveSearchTerm(activeSearchTerm)
      setTempSortOption(sortOption)
      setTempCity(city)
      setTempLatitude(latitude)
      setTempLongitude(longitude)
      setTempRadiusKm(radiusKm)
      setTempMinPrice(minPrice)
      setTempMaxPrice(maxPrice)
      setTempPageSize(pageSize)
    }
  }, [activeSearchTerm, sortOption, city, latitude, longitude, radiusKm, minPrice, maxPrice, pageSize, mobileFiltersOpen])

  // Sync search from URL before paint so loadFeatured (useEffect) sees the same q as the address bar.
  // Otherwise the first fetch runs with a stale empty activeSearchTerm, then strips q from the URL on replace.
  useLayoutEffect(() => {
    setActiveSearchTerm(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    setPage(1)
  }, [initialQuery])

  // Sync city and cityId with URL params whenever they change
  useEffect(() => {
    const urlCity = searchParams?.get("city") ?? ""
    const urlCityIdRaw = searchParams?.get("city_id")
    const urlCityId = urlCityIdRaw
      ? (() => {
          const parsed = Number(urlCityIdRaw)
          return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
        })()
      : undefined
    
    // Always sync to URL params - if URL doesn't have city_id, state should be undefined
    setCity(urlCity)
    setCityId(urlCityId)
  }, [searchParams]) // Only depend on searchParams - sync state to URL always

  useEffect(() => {
    // Skip if we're currently updating the URL after an API call
    // This prevents the sort useEffect from triggering another API call
    if (isUpdatingUrlRef.current) {
      return
    }
    
    // Only sync sort from URL if URL explicitly has a sort parameter
    // This prevents resetting to "featured" when navigating from header search (which doesn't include sort)
    const hasSortInUrl = searchParams?.has("sort") || searchParams?.has("sort_by")
    
    if (hasSortInUrl && lastSyncedSortParamRef.current !== currentSortFromParams) {
      initialSortOptionRef.current = currentSortFromParams
      lastSyncedSortParamRef.current = currentSortFromParams
      setSortOption(currentSortFromParams)
      setPage(1)
    } else if (!hasSortInUrl) {
      // If URL doesn't have sort, just update the ref to prevent unnecessary updates
      // but don't change the sort option (keep current user selection)
      lastSyncedSortParamRef.current = currentSortFromParams
    }
  }, [currentSortFromParams, searchParams])

  useEffect(() => {
    if (typeof window === "undefined") return
    const mediaQuery = window.matchMedia("(min-width: 768px)")

    const applyMatches = (matches: boolean) => {
      setIsDesktop(matches)
      // Keep filters closed by default on both desktop and mobile
      // User can open them by clicking the Filter button
    }

    applyMatches(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      applyMatches(event.matches)
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const mobileQuery = window.matchMedia("(max-width: 1023px)")
    const applyMobile = (matches: boolean) => setIsMobileViewport(matches)
    applyMobile(mobileQuery.matches)
    const onMobileChange = (event: MediaQueryListEvent) => applyMobile(event.matches)
    mobileQuery.addEventListener("change", onMobileChange)
    return () => mobileQuery.removeEventListener("change", onMobileChange)
  }, [])

  useEffect(() => {
    const typeParam = searchParams?.get("types") ?? searchParams?.get("type")
    const nextType = typeParam && VALID_TYPES.includes(typeParam as CategoryType)
      ? (typeParam as CategoryType)
      : VALID_TYPES[0]

    if (nextType === activeType) {
      return
    }

    setActiveType(nextType)
    setPage(1)
    setSelectedParentCategory("all")
    setSelectedSubcategory("all")
    if (nextType === "master") {
      setMinPrice(undefined)
      setMaxPrice(undefined)
    } else {
      setVerifiedOnly(false)
      setLatitude(null)
      setLongitude(null)
      setRadiusKm(DEFAULT_RADIUS_KM)
    }
  }, [searchParams, activeType])

  useEffect(() => {
    async function loadCategories() {
      try {
        const [masterTree, productTree, rentalTree] = await Promise.all([
          getCategoryTreeByType("master"),
          getCategoryTreeByType("product"),
          getCategoryTreeByType("rental"),
        ])
        setCategoryTree({
          master: masterTree,
          product: productTree,
          rental: rentalTree,
        })
      } catch (err) {
        console.error("Failed to load categories", err)
        setCategoryTree({
          master: [],
          product: [],
          rental: [],
        })
      }
    }
    loadCategories()
  }, [])

  // Load flat categories for dropdowns
  useEffect(() => {
    async function loadFlatCategories() {
      try {
        setCategoriesLoading(true)
        const data = await getCategoriesByType(activeType, { activeOnly: true, rootOnly: false })
        const parents = data.filter((category) => !category.parent_id)
        const subs = data.filter((category) => category.parent_id)
        setParentCategories(parents.map(cat => ({ id: cat.id, name: cat.name, slug: cat.slug })))
        setAllSubcategories(subs.map(cat => ({ id: cat.id, name: cat.name, slug: cat.slug, parent_id: cat.parent_id ?? null })))
        setSubcategories(subs.map(cat => ({ id: cat.id, name: cat.name, slug: cat.slug, parent_id: cat.parent_id ?? null })))
      } catch (err) {
        console.error("Failed to load flat categories", err)
        setParentCategories([])
        setAllSubcategories([])
        setSubcategories([])
      } finally {
        setCategoriesLoading(false)
      }
    }
    loadFlatCategories()
  }, [activeType])

  // Filter subcategories based on selected parent category
  useEffect(() => {
    if (selectedParentCategory === "all") {
      setSubcategories(allSubcategories)
    } else {
      // Find parent category by slug to get its ID
      const parentCategory = parentCategories.find(cat => cat.slug === selectedParentCategory)
      if (parentCategory) {
        const filtered = allSubcategories.filter(
          (cat) => cat.parent_id === parentCategory.id
        )
        setSubcategories(filtered)
        // Reset subcategory selection if current selection is not in filtered list
        setSelectedSubcategory((current) => {
          if (current !== "all" && !filtered.find((cat) => cat.slug === current)) {
            return "all"
          }
          return current
        })
      } else {
        setSubcategories([])
      }
    }
  }, [selectedParentCategory, allSubcategories, parentCategories])

  useEffect(() => {
    const treeForType = categoryTree[activeType] ?? []

    if (!categoryParam) {
      let shouldResetPage = false
      if (selectedParentCategory !== "all") {
        setSelectedParentCategory("all")
        shouldResetPage = true
      }
      if (selectedSubcategory !== "all") {
        setSelectedSubcategory("all")
        shouldResetPage = true
      }
      if (shouldResetPage) {
        setPage(1)
      }
      return
    }

    if (!treeForType.length) {
      return
    }

    const slugs = categoryParam.split(",").map((value) => value.trim()).filter(Boolean)
    if (!slugs.length) {
      if (selectedParentCategory !== "all") {
        setSelectedParentCategory("all")
      }
      if (selectedSubcategory !== "all") {
        setSelectedSubcategory("all")
      }
      return
    }

    const firstSlug = slugs[0]
    const selection = findCategorySelection(treeForType, firstSlug)
    const nextParent = selection.parentSlug ?? "all"
    const nextSubcategory = selection.subcategorySlug ?? "all"

    let shouldResetPage = false
    if (selectedParentCategory !== nextParent) {
      setSelectedParentCategory(nextParent)
      shouldResetPage = true
    }
    if (selectedSubcategory !== nextSubcategory) {
      setSelectedSubcategory(nextSubcategory)
      shouldResetPage = true
    }
    if (shouldResetPage) {
      setPage(1)
    }
  }, [categoryParam, categoryTree, activeType, selectedParentCategory, selectedSubcategory])

  const locationEnabled = latitude !== null && longitude !== null

  const radiusLabel = useMemo(() => {
    if (!locationEnabled) return "Standort hinzufügen, um Radiusfilter freizuschalten"
    if (radiusKm < 1) return "< 1 km"
    if (radiusKm >= 200) return "200+ km"
    return `${radiusKm} km`
  }, [locationEnabled, radiusKm])
  const isMasterType = activeType === "master"
  const activeCategoryTree = categoryTree[activeType] ?? []

  const priceLabels = PRICE_LABELS[activeType]
  const showPriceControls = activeType !== "master"

  const combinedCategoryFilter = useMemo(() => {
    if (selectedParentCategory === "all" && selectedSubcategory === "all") {
      return null
    }
    const allowed = new Set<string>()
    if (selectedSubcategory !== "all") {
      allowed.add(selectedSubcategory)
    }
    if (selectedParentCategory !== "all") {
      allowed.add(selectedParentCategory)
      const parentNode = findCategoryNode(activeCategoryTree, selectedParentCategory)
      parentNode?.children?.forEach((child) => allowed.add(child.slug))
    }
    return allowed
  }, [selectedParentCategory, selectedSubcategory, activeCategoryTree])

  const locationTags = useMemo(() => {
    const tags: Array<{ label: string; onRemove: () => void }> = []
    if (city) {
      tags.push({
        label: city,
        onRemove: () => setCity(""),
      })
    }
    if (isMasterType && locationEnabled) {
      tags.push({
        label: radiusLabel,
        onRemove: () => {
          setLatitude(null)
          setLongitude(null)
          setRadiusKm(DEFAULT_RADIUS_KM)
        },
      })
    }
    return tags
  }, [city, isMasterType, locationEnabled, radiusLabel])

  const priceTags = useMemo(() => {
    const tags: Array<{ label: string; onRemove: () => void }> = []
    if (typeof minPrice === "number") {
      tags.push({
        label: `Min ${minPrice}`,
        onRemove: () => setMinPrice(undefined),
      })
    }
    if (typeof maxPrice === "number") {
      tags.push({
        label: `Max ${maxPrice}`,
        onRemove: () => setMaxPrice(undefined),
      })
    }
    return tags
  }, [minPrice, maxPrice])

  const locationButtonLabel = locationTags.length > 0 ? "Gefiltert" : "Alle"
  const priceButtonLabel = priceTags.length > 0 ? "Gefiltert" : showPriceControls ? "Beliebiger Preis" : ""

  const renderInlineTags = useCallback(
    (tags: Array<{ label: string; onRemove: () => void }>) => {
      if (tags.length === 0) return null
      return (
        <div className="flex items-center gap-1">
          {tags.map((tag) => (
            <span
              key={`inline-tag-${tag.label}`}
              className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-xs text-foreground"
            >
              {tag.label}
            </span>
          ))}
        </div>
      )
    },
    []
  )

  const masterCategoryFilter = useMemo(() => {
    if (activeType !== "master") {
      return null
    }
    return combinedCategoryFilter
  }, [activeType, combinedCategoryFilter])

  // Build breadcrumb path
  const breadcrumbItems = useMemo(() => {
    const items: Array<{ label: string; slug: string | null; isLast: boolean }> = []
    
    // Type label in breadcrumb (master omits "Meister" — categories only)
    if (activeType !== "master") {
      const typeLabels: Record<Exclude<CategoryType, "master">, string> = {
        product: "Produkt",
        rental: "Mieten",
      }
      items.push({
        label: typeLabels[activeType],
        slug: null, // null means "all categories" for this type
        isLast: selectedParentCategory === "all" && selectedSubcategory === "all",
      })
    }

    // Second item: Parent category (if selected)
    if (selectedParentCategory !== "all") {
      const parentCat = parentCategories.find(cat => cat.slug === selectedParentCategory)
      items.push({
        label: parentCat?.name || selectedParentCategory,
        slug: selectedParentCategory,
        isLast: selectedSubcategory === "all",
      })
    }

    // Third item: Subcategory (if selected)
    if (selectedSubcategory !== "all") {
      const subCat = subcategories.find(cat => cat.slug === selectedSubcategory)
      items.push({
        label: subCat?.name || selectedSubcategory,
        slug: selectedSubcategory,
        isLast: true,
      })
    }

    return items
  }, [activeType, selectedParentCategory, selectedSubcategory, parentCategories, subcategories])

  const handleBreadcrumbClick = useCallback((index: number) => {
    const item = breadcrumbItems[index]
    if (!item || item.isLast) return

    // Clear request signature to force reload
    lastRequestSignatureRef.current = null

    // Build new URL params - preserve other filters but reset page
    const params = new URLSearchParams(searchParams?.toString() || "")
    params.set("types", activeType)
    params.set("page", "1")

    // Type segment (slug null): clear all categories
    if (item.slug === null) {
      params.delete("category")
      router.replace(`/?${params.toString()}`)
      return
    }

    // Parent category: keep parent, clear subcategory
    if (item.slug && !item.isLast) {
      params.set("category", item.slug)
      router.replace(`/?${params.toString()}`)
      return
    }
  }, [breadcrumbItems, activeType, router, searchParams])


  const loadFeatured = useCallback(async () => {
    // Skip if we're currently updating the URL to prevent duplicate calls
    if (isUpdatingUrlRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Featured Page] loadFeatured skipped - URL update in progress')
      }
      return
    }

    const paramType = searchParams?.get("types") ?? searchParams?.get("type")
    const normalizedParamType =
      paramType && VALID_TYPES.includes(paramType as CategoryType)
        ? (paramType as CategoryType)
        : VALID_TYPES[0]

    if (normalizedParamType !== activeType) {
      return
    }

    // Get cityId directly from URL params to avoid race conditions with state updates
    const urlCityIdRaw = searchParams?.get("city_id")
    const urlCityId = urlCityIdRaw
      ? (() => {
          const parsed = Number(urlCityIdRaw)
          return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
        })()
      : undefined

    // Debug: Log city ID from URL
    if (process.env.NODE_ENV === 'development') {
      console.log('[Featured Page] loadFeatured - cityId from URL:', {
        urlCityIdRaw,
        urlCityId,
        stateCityId: cityId,
        searchParams: searchParams?.toString(),
      })
    }

    const fromUrl = (searchParams?.get("q") ?? searchParams?.get("search") ?? "").trim()
    const trimmedSearch = (fromUrl || activeSearchTerm.trim()).trim()
    
    // Get category only from URL. Do not fall back to selectedParentCategory / selectedSubcategory:
    // after text search the URL drops `category`, but React state can still be one render behind,
    // which previously sent the old category to the API and returned 0 results.
    const urlCategoryParam = searchParams?.get("category") ?? null
    const categoryParamValueForUrl = urlCategoryParam
    const categoryQueryParamForRequest = categoryParamValueForUrl
    const normalizedMinPrice =
      activeType === "master" || minPrice === undefined || Number.isNaN(minPrice) ? undefined : minPrice
    const normalizedMaxPrice =
      activeType === "master" || maxPrice === undefined || Number.isNaN(maxPrice) ? undefined : maxPrice
    const combinedCategoryValues = combinedCategoryFilter
      ? Array.from(combinedCategoryFilter).sort()
      : null
    const searchQuery = trimmedSearch.length > 0 ? trimmedSearch : undefined
    // Map sort options to backend-supported values
    // "trending_desc" uses "likes" sort, "featured" will be handled client-side
    const sortByParam = 
      sortOption === "price_asc" || sortOption === "price_desc" ? "price" :
      sortOption === "rating_desc" ? "rating" :
      sortOption === "trending_desc" ? "likes" :
      undefined
    const sortOrderParam = 
      sortOption === "price_asc" ? "asc" :
      sortOption === "price_desc" || sortOption === "rating_desc" || sortOption === "trending_desc" ? "desc" :
      undefined

    const effectivePageSize = isMobileViewport ? MOBILE_FEED_PAGE_SIZE : pageSize

    const requestSignature = JSON.stringify({
      type: activeType,
      search: searchQuery ?? "",
      city,
      cityId: urlCityId ?? cityId ?? null,
      verifiedOnly: isMasterType ? verifiedOnly : undefined,
      minRating,
      latitude: locationEnabled ? latitude : null,
      longitude: locationEnabled ? longitude : null,
      radiusKm: locationEnabled ? radiusKm : null,
      page,
      pageSize: effectivePageSize,
      sortOption,
      category: categoryQueryParamForRequest,
      minPrice: normalizedMinPrice ?? null,
      maxPrice: normalizedMaxPrice ?? null,
      masterCategories: isMasterType ? combinedCategoryValues : undefined,
      parentCategory: selectedParentCategory,
      subcategory: selectedSubcategory,
    })

    // Check BEFORE making the API call to prevent duplicate requests
    // Only block if it's the exact same request (same signature) AND already loading
    // If signature is different, allow the new request (will ignore old response when it completes)
    if (lastRequestSignatureRef.current === requestSignature && isLoadingRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Featured Page] loadFeatured skipped - duplicate request:', {
          lastSignature: lastRequestSignatureRef.current,
          currentSignature: requestSignature,
          isLoading: isLoadingRef.current
        })
      }
      if (appendResultsRef.current && page > 1) {
        appendResultsRef.current = false
        loadMoreLockRef.current = false
        setLoadingMore(false)
      }
      return
    }

    // If a different request is in progress, cancel it by clearing the signature
    // This allows the new request to proceed
    if (isLoadingRef.current && lastRequestSignatureRef.current !== requestSignature) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Featured Page] Cancelling previous request, starting new one:', {
          lastSignature: lastRequestSignatureRef.current,
          currentSignature: requestSignature
        })
      }
      // Clear the old signature so its response will be ignored
      lastRequestSignatureRef.current = null
      // Reset loading flag to allow new request
      isLoadingRef.current = false
    }

    // Set flags BEFORE the async call to prevent race conditions
    // Check if we already have a pending request with the same signature
    if (lastRequestSignatureRef.current === requestSignature && isLoadingRef.current) {
      // Same request already in progress, skip
      if (process.env.NODE_ENV === 'development') {
        console.log('[Featured Page] Request already in progress with same signature, skipping')
      }
      return
    }

    // Clear any pending debounce timeout
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current)
      requestTimeoutRef.current = null
    }

    // Set the signature and loading flag immediately (synchronously) to prevent double calls
    lastRequestSignatureRef.current = requestSignature
    isLoadingRef.current = true

    const isAppendLoad = appendResultsRef.current && page > 1
    if (isAppendLoad) {
      setLoadingMore(true)
    } else {
      setState((prev) => ({ ...prev, loading: true, error: undefined }))
    }
    try {
      // Use the featured endpoint which already returns FeaturedItem format
      // Use urlCityId (from URL params) instead of cityId (from state) to avoid race conditions
      const finalCityId = urlCityId ?? cityId ?? undefined
      
      // Debug: Log API call params
      if (process.env.NODE_ENV === 'development') {
        console.log('[Featured Page] Making API call with:', {
          types: [activeType],
          q: searchQuery,
          city_id: finalCityId,
          urlCityId,
          stateCityId: cityId,
        })
      }
      
      const featuredResponse = await getFeaturedItems({
        types: [activeType],
        q: searchQuery,
        city_id: finalCityId,
        category: categoryQueryParamForRequest ?? undefined,
        min_price: normalizedMinPrice,
        max_price: normalizedMaxPrice,
        min_rating: minRating,
        page,
        page_size: effectivePageSize,
        sort_by: sortByParam,
        sort_order: sortOrderParam,
      })

      // Backend already filters by category_id, so no need for client-side category filtering
      // Only apply client-side sorting for "featured" and "trending_desc" options
      const orderedItems = sortFeaturedItems(featuredResponse.items ?? [], sortOption)
      
      const filteredTotal = featuredResponse.total ?? orderedItems.length

      const response: PaginatedResponse<FeaturedItem> = {
        items: orderedItems,
        total: filteredTotal,
        page: featuredResponse.page ?? page,
        page_size: featuredResponse.page_size ?? effectivePageSize,
        total_pages:
          featuredResponse.total_pages ??
          Math.max(1, Math.ceil(filteredTotal / effectivePageSize)),
      }

      const shouldAppendItems = appendResultsRef.current && page > 1
      if (shouldAppendItems) {
        appendResultsRef.current = false
        loadMoreLockRef.current = false
        setLoadingMore(false)
      }

      const applyFeaturedState = (prev: FeaturedState): FeaturedState => {
        const items =
          shouldAppendItems && prev.data?.items?.length
            ? mergeFeaturedItems(prev.data.items, response.items)
            : response.items
        return {
          data: { ...response, items },
          loading: false,
          error: undefined,
        }
      }

      const skipUrlUpdateForMobileAppend = isMobileViewport && page > 1

      // Verify the request signature is still valid before updating state
      // This prevents race conditions where multiple calls complete out of order
      if (lastRequestSignatureRef.current !== requestSignature) {
        isLoadingRef.current = false
        return
      }

      // Debug: Log response to see what we're getting
      if (process.env.NODE_ENV === 'development') {
        console.log('[Featured Page] Response data:', {
          itemsCount: response.items.length,
          total: response.total,
          searchQuery,
          activeType,
          rawResponseItems: featuredResponse.items?.length ?? 0,
          rawResponseTotal: featuredResponse.total,
        })
      }

      // Only update state if this is still the current request (prevents flickering from stale updates)
      if (lastRequestSignatureRef.current !== requestSignature) {
        // Request was cancelled, ignore response
        isLoadingRef.current = false
        return
      }
      
      const currentParams = new URLSearchParams(searchParams?.toString())
      const nextParams = new URLSearchParams(searchParams?.toString())

      nextParams.set("types", activeType)
      if (trimmedSearch) {
        nextParams.set("q", trimmedSearch)
      } else {
        nextParams.delete("q")
      }

      if (activeType === "master") {
        nextParams.delete("min_price")
        nextParams.delete("max_price")
      } else {
        if (normalizedMinPrice !== undefined) {
          nextParams.set("min_price", String(normalizedMinPrice))
        } else {
          nextParams.delete("min_price")
        }
        if (normalizedMaxPrice !== undefined) {
          nextParams.set("max_price", String(normalizedMaxPrice))
        } else {
          nextParams.delete("max_price")
        }
      }

      // Category filter applies to all types including master
      if (categoryParamValueForUrl) {
        nextParams.set("category", categoryParamValueForUrl)
      } else {
        nextParams.delete("category")
      }

      if (city) {
        nextParams.set("city", city)
      } else {
        nextParams.delete("city")
      }
      // Use urlCityId (from URL params) instead of cityId (from state) to preserve city_id
      // when sort option changes and triggers a second API call
      const cityIdForUrl = urlCityId ?? cityId
      if (typeof cityIdForUrl === "number") {
        nextParams.set("city_id", String(cityIdForUrl))
      } else {
        nextParams.delete("city_id")
      }

      if (isMasterType && verifiedOnly) {
        nextParams.set("verified_only", "true")
      } else {
        nextParams.delete("verified_only")
      }

      if (isMasterType && locationEnabled && latitude !== null && longitude !== null) {
        nextParams.set("latitude", String(latitude))
        nextParams.set("longitude", String(longitude))
        nextParams.set("radius_km", String(radiusKm))
      } else {
        nextParams.delete("latitude")
        nextParams.delete("longitude")
        nextParams.delete("radius_km")
      }

      nextParams.delete("sort_by")
      nextParams.delete("sort_order")
      // Only add sort to URL if it's not the default "featured" OR if it was already in the URL
      // This prevents adding sort=featured when navigating from header search, which would trigger a second API call
      const hadSortInOriginalUrl = currentParams?.has("sort") || currentParams?.has("sort_by")
      if (sortOption !== "featured" || hadSortInOriginalUrl) {
        nextParams.set("sort", sortOption)
      } else {
        nextParams.delete("sort")
      }
      nextParams.set("page", String(page))
      nextParams.set("page_size", String(effectivePageSize))

      // Only update URL if it's different and the request signature is still valid
      // This prevents unnecessary URL updates that would trigger another loadFeatured call
        const nextQuery = nextParams.toString()
      if (
        nextQuery !== currentParams.toString() &&
        lastRequestSignatureRef.current === requestSignature &&
        !skipUrlUpdateForMobileAppend
      ) {
          // Update the sort ref BEFORE updating URL to prevent the sort useEffect from triggering another API call
          // This ensures that when the URL changes and searchParams updates, the useEffect sees the ref is already in sync
          lastSyncedSortParamRef.current = sortOption
        // Set flag to prevent sort useEffect and loadFeatured from running during URL update
          isUpdatingUrlRef.current = true
        // Clear the request signature temporarily to prevent loadFeatured from running when URL updates
        const savedSignature = lastRequestSignatureRef.current
        lastRequestSignatureRef.current = null
        
        // Batch state update and URL update together using startTransition to reduce flicker
        startTransition(() => {
          // Update state first
          setState(applyFeaturedState)
          
          // Then update URL in the same transition
          router.replace(nextQuery ? `/?${nextQuery}` : "/")
          
          // Restore the signature and clear flag after URL update completes
          setTimeout(() => {
            lastRequestSignatureRef.current = savedSignature
            isUpdatingUrlRef.current = false
            isLoadingRef.current = false // Clear loading flag after URL update completes
            if (process.env.NODE_ENV === 'development') {
              console.log('[Featured Page] URL update completed, flag cleared')
            }
          }, 50)
        })
      } else {
        // No URL update needed, just update state
        setState(applyFeaturedState)
        isLoadingRef.current = false
      }
    } catch (err) {
      console.error("Failed to load featured items", err)
      isLoadingRef.current = false
      setLoadingMore(false)
      appendResultsRef.current = false
      loadMoreLockRef.current = false
      // Only update state if this is still the current request
      if (lastRequestSignatureRef.current === requestSignature) {
        isLoadingRef.current = false
        setState({ data: null, loading: false, error: 'Artikel konnten nicht geladen werden. Bitte versuchen Sie es erneut.' })
      } else {
        isLoadingRef.current = false
      }
    }
  }, [
    activeSearchTerm,
    activeType,
    city,
    cityId,
    verifiedOnly,
    minRating,
    locationEnabled,
    latitude,
    longitude,
    radiusKm,
    masterCategoryFilter,
    combinedCategoryFilter,
    selectedParentCategory,
    selectedSubcategory,
    parentCategories,
    allSubcategories,
    minPrice,
    maxPrice,
    sortOption,
    page,
    pageSize,
    isMobileViewport,
    router,
    searchParams,
    isMasterType,
  ])

  const handleSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      // Set closing state first to disable Select components
      setIsSheetClosing(true)
      
      // Immediately blur any focused elements to prevent aria-hidden warning
      const activeElement = document.activeElement as HTMLElement
      if (activeElement && typeof activeElement.blur === 'function' && activeElement !== document.body) {
        activeElement.blur()
      }
      
      // Close any open Select dropdowns by dispatching Escape key
      const openSelectTriggers = document.querySelectorAll('[data-slot="select-trigger"]')
      openSelectTriggers.forEach((trigger) => {
        const element = trigger as HTMLElement
        if (element.getAttribute('data-state') === 'open' || element === activeElement) {
          element.blur()
          // Dispatch Escape to close the dropdown
          const escapeEvent = new KeyboardEvent('keydown', { 
            key: 'Escape', 
            code: 'Escape',
            keyCode: 27,
            bubbles: true, 
            cancelable: true 
          })
          element.dispatchEvent(escapeEvent)
        }
      })
      
      // Use requestAnimationFrame to ensure blur completes before state update
      requestAnimationFrame(() => {
        setMobileFiltersOpen(false)
        // Reset closing state after a brief delay
        setTimeout(() => setIsSheetClosing(false), 100)
      })
      return
    }
    setIsSheetClosing(false)
    setMobileFiltersOpen(open)
  }, [])

  const handleClearFilters = useCallback(() => {
    // Reset Search
    setActiveSearchTerm("")
    
    // Reset Category filters
    setSelectedParentCategory("all")
    setSelectedSubcategory("all")
    
    // Reset Location filters
    setCity("")
    setLatitude(null)
    setLongitude(null)
    setRadiusKm(DEFAULT_RADIUS_KM)
    
    // Reset Price filters
    setMinPrice(undefined)
    setMaxPrice(undefined)
    
    // Reset Rating and Verification
    setMinRating(undefined)
    setVerifiedOnly(false)
    
    // Sortierung auf Standard zurücksetzen: "Empfohlene Artikel"
    setSortOption("featured")
    
    // Reset Results per page to default: 12
    setPageSize(12)
    
    // Reset to first page
    setPage(1)
    
    // Clear request signature to allow reload
    lastRequestSignatureRef.current = null
  }, [initialQuery])

  // Close any open Select dropdowns when Sheet closes to prevent aria-hidden warning
  useEffect(() => {
    if (!mobileFiltersOpen && !isDesktop) {
      // Blur any focused elements when Sheet closes
      const activeElement = document.activeElement as HTMLElement
      if (activeElement && typeof activeElement.blur === 'function' && activeElement !== document.body) {
        activeElement.blur()
      }
    }
  }, [mobileFiltersOpen, isDesktop])

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Featured Page] useEffect triggered - calling loadFeatured', {
        isUpdatingUrl: isUpdatingUrlRef.current,
        searchParams: searchParams?.toString()
      })
    }
    void loadFeatured()
  }, [loadFeatured])

  const handleGeolocate = () => {
    if (!("geolocation" in navigator)) {
      console.error("Geolocation is not supported in this browser.")
      return
    }
    setGeolocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude)
        setLongitude(position.coords.longitude)
        setGeolocating(false)
        setPage(1)
      },
      (geoError) => {
        console.error("Geolocation error", geoError)
        setGeolocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60_000,
      }
    )
  }

  const totalPages = data?.total_pages ?? 1

  const renderPagination = totalPages > 1 && data

  const loadingPlaceholders = useMemo(
    () => Array.from({ length: pageSize }, (_, index) => <MarketplaceItemCardSkeleton key={`skeleton-${index}`} />),
    [pageSize]
  )
  const hasResults = Boolean(data?.items && data.items.length > 0)
  const showLoadingPlaceholders = loading && !hasResults
  const canLoadMoreOnMobile =
    isMobileViewport && hasResults && page < totalPages && !loading && !loadingMore

  useEffect(() => {
    if (!canLoadMoreOnMobile) return
    const node = feedSentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        if (loadMoreLockRef.current || isLoadingRef.current) return
        if (page >= totalPages) return

        loadMoreLockRef.current = true
        appendResultsRef.current = true
        setPage((current) => current + 1)
      },
      { root: null, rootMargin: "280px 0px", threshold: 0 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [canLoadMoreOnMobile, page, totalPages])

  const mobileLoadMorePlaceholders = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => (
        <MarketplaceItemCardSkeleton key={`load-more-skeleton-${index}`} />
      )),
    [],
  )

  return (
    <div className="bg-background">
      {/* Breadcrumb Header */}
      <div className="relative bg-background overflow-hidden">
        <div className="border-b border-border/40 w-full"></div>
        <div className="container mx-auto px-sides py-1.5 sm:py-3.5 md:py-4 relative z-10">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Brotkrümelnavigation">
            {breadcrumbItems.map((item, index) => {
              const isLast = item.isLast
              // All segments except the last one should be clickable
              const isClickable = !isLast
              
              return (
                <div key={`${item.slug || 'type'}-${index}`} className="flex items-center gap-2">
                  {index > 0 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  )}
                  {isClickable ? (
                    <button
                      type="button"
                      onClick={() => handleBreadcrumbClick(index)}
                      className="hover:text-foreground transition-colors duration-200 font-medium text-left"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span className={cn(
                      "font-semibold",
                      isLast ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {item.label}
                    </span>
                  )}
                </div>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Filter Content */}
      <div className="container mx-auto px-sides pb-1">
        <div className="w-full space-y-4">
          <Sheet 
            open={mobileFiltersOpen} 
            onOpenChange={handleSheetOpenChange}
          >
                <SheetContent 
                  side={isDesktop ? "right" : "bottom"}
                  className={cn(
                    "p-0 flex flex-col",
                    "!transition-transform !duration-200 !ease-linear",
                    "data-[state=open]:!duration-200 data-[state=closed]:!duration-200",
                    isDesktop 
                      ? "w-full sm:w-[400px] h-full" 
                      : "w-full max-h-[85vh] rounded-t-lg"
                  )}
                  overlayClassName="!transition-opacity !duration-200 !ease-linear data-[state=open]:!duration-200 data-[state=closed]:!duration-200"
                  onInteractOutside={(e) => {
                    // Prevent closing when clicking on Select or DropdownMenu content (which are portaled outside)
                    const target = e.target as HTMLElement
                    if (!target) return
                    
                    // Check if the click is on any portaled content (Select or DropdownMenu)
                    const isPortaledContent = 
                      target.closest('[data-slot="select-content"]') ||
                      target.closest('[data-slot="dropdown-menu-content"]') ||
                      target.closest('[data-slot="dropdown-menu-portal"]') ||
                      target.closest('[role="menu"]') ||
                      target.closest('[data-radix-popper-content-wrapper]')
                    
                    if (isPortaledContent) {
                      e.preventDefault()
                    }
                  }}
                  onEscapeKeyDown={(e) => {
                    // Close any open Select dropdowns first
                    const openSelectContent = document.querySelector('[data-slot="select-content"][data-state="open"]')
                    if (openSelectContent) {
                      e.preventDefault()
                      // Blur and close Select
                      const activeElement = document.activeElement as HTMLElement
                      if (activeElement) {
                        activeElement.blur()
                      }
                      // Then close the Sheet
                      setTimeout(() => setMobileFiltersOpen(false), 0)
                    }
                  }}
                >
                  <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/40">
                    <SheetTitle className="text-base font-semibold">Filter</SheetTitle>
                  </SheetHeader>
                  <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Sortieren nach</label>
                      <Select
                        value={tempSortOption}
                        onValueChange={(value) => {
                          const typedValue = value as SortOption
                          setTempSortOption(typedValue)
                        }}
                        disabled={isSheetClosing}
                      >
                        <SelectTrigger
                          className="h-9 w-full rounded-sm border border-border/60 bg-background text-sm focus:ring-0 focus:ring-offset-0 transition-colors hover:border-primary hover:bg-white hover:text-foreground focus-visible:border-border/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-sm border border-border/60">
                          {SORT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Standort</label>
                        <FilterDropdown
                          label={locationButtonLabel}
                          onClear={() => {
                            setTempCity("")
                            setTempLatitude(null)
                            setTempLongitude(null)
                            setTempRadiusKm(DEFAULT_RADIUS_KM)
                          }}
                          renderTag={renderInlineTags(locationTags)}
                        >
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">Stadt oder Region</p>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    value={tempCity}
                                    onChange={(event) => {
                                      setTempCity(event.target.value)
                                    }}
                                    placeholder="Beliebiger Standort"
                                    className="pl-8 h-9 text-sm"
                                  />
                                </div>
                                {isMasterType ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="icon"
                                    className="h-9 w-9"
                                    onClick={() => {
                                      if (!("geolocation" in navigator)) {
                                        console.error("Geolocation is not supported in this browser.")
                                        return
                                      }
                                      setGeolocating(true)
                                      navigator.geolocation.getCurrentPosition(
                                        (position) => {
                                          setTempLatitude(position.coords.latitude)
                                          setTempLongitude(position.coords.longitude)
                                          setGeolocating(false)
                                        },
                                        (geoError) => {
                                          console.error("Geolocation error", geoError)
                                          setGeolocating(false)
                                        },
                                        {
                                          enableHighAccuracy: true,
                                          timeout: 10000,
                                          maximumAge: 0,
                                        }
                                      )
                                    }}
                                    disabled={geolocating}
                                    aria-label="Aktuellen Standort verwenden"
                                  >
                                    {geolocating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                                  </Button>
                                ) : null}
                              </div>
                            </div>

                            {isMasterType ? (() => {
                              const tempLocationEnabled = tempLatitude !== null && tempLongitude !== null
                              return (
                                <div
                                  className={cn(
                                    "space-y-2 rounded-md border border-dashed border-border/60 bg-muted/20 p-2.5 transition",
                                    { "opacity-60": !tempLocationEnabled },
                                  )}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <Target className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-xs font-medium">Suchradius</span>
                                  </div>
                                  <Slider
                                    value={[tempRadiusKm]}
                                    min={5}
                                    max={200}
                                    step={5}
                                    disabled={!tempLocationEnabled}
                                    onValueChange={(value) => {
                                      setTempRadiusKm(value[0])
                                    }}
                                  />
                                  {!tempLocationEnabled && (
                                    <p className="text-xs text-muted-foreground leading-tight">
                                      Fügen Sie eine Stadt hinzu oder teilen Sie Ihren aktuellen Standort, um ergebnisse mit Entfernungsangabe freizuschalten.
                                    </p>
                                  )}
                                </div>
                              )
                            })() : null}
                          </div>
                        </FilterDropdown>
                    </div>

                    {showPriceControls ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Preis</label>
                        <FilterDropdown
                          label={priceButtonLabel}
                          onClear={() => {
                            setMinPrice(undefined)
                            setMaxPrice(undefined)
                            setPage(1)
                          }}
                          renderTag={renderInlineTags(priceTags)}
                        >
                          <div className="space-y-2.5">
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">
                                {priceLabels.min || "Mindestpreis"}
                              </p>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                value={tempMinPrice ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value
                                  if (!value) {
                                    setTempMinPrice(undefined)
                                    return
                                  }
                                  const parsed = Number(value)
                                  setTempMinPrice(Number.isNaN(parsed) ? undefined : parsed)
                                }}
                                placeholder={priceLabels.min || "Mindestpreis"}
                                className="h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">
                                {priceLabels.max || "Höchstpreis"}
                              </p>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                value={tempMaxPrice ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value
                                  if (!value) {
                                    setTempMaxPrice(undefined)
                                    return
                                  }
                                  const parsed = Number(value)
                                  setTempMaxPrice(Number.isNaN(parsed) ? undefined : parsed)
                                }}
                                placeholder={priceLabels.max || "Höchstpreis"}
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>
                        </FilterDropdown>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Ergebnisse pro Seite</label>
                      <Select
                        value={String(tempPageSize)}
                        onValueChange={(value) => {
                          setTempPageSize(Number(value))
                        }}
                        disabled={isSheetClosing}
                      >
                        <SelectTrigger
                          className="h-9 w-full rounded-sm border border-border/60 bg-white text-sm focus:ring-0 focus:ring-offset-0 transition-colors hover:border-primary hover:bg-white hover:text-foreground focus-visible:border-border/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-sm border border-border/60">
                          {PAGE_SIZE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={String(option)}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="border-t border-border/40 bg-muted/20 px-4 py-3 mt-auto">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 h-9 text-sm"
                        onClick={() => {
                          // Reset all filters to defaults (same as handleClearFilters)
                          // Reset temporary states
                          setTempSortOption("featured")
                          setTempCity("")
                          setTempLatitude(null)
                          setTempLongitude(null)
                          setTempRadiusKm(DEFAULT_RADIUS_KM)
                          setTempMinPrice(undefined)
                          setTempMaxPrice(undefined)
                          setTempPageSize(12)
                          
                          // Apply reset values to actual states (triggers API call)
                          setSortOption("featured")
                          setCity("")
                          setLatitude(null)
                          setLongitude(null)
                          setRadiusKm(DEFAULT_RADIUS_KM)
                          setMinPrice(undefined)
                          setMaxPrice(undefined)
                          setPageSize(12)
                          
                          // Reset other filters that don't have temporary states
                          setMinRating(undefined)
                          setVerifiedOnly(false)
                          setSelectedParentCategory("all")
                          setSelectedSubcategory("all")
                          setTempActiveSearchTerm("")
                          setActiveSearchTerm("")
                          setPage(1)
                          
                          // Clear request signature to allow reload
                          lastRequestSignatureRef.current = null
                          
                          // Close the mobile filters sidebar
                          setMobileFiltersOpen(false)
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Zurücksetzen
                      </Button>
                      <Button
                        className="flex-1 h-9 text-sm"
                        onClick={() => {
                          // Apply temporary filter states to actual states (triggers API call)
                          setSortOption(tempSortOption)
                          setCity(tempCity)
                          setLatitude(tempLatitude)
                          setLongitude(tempLongitude)
                          setRadiusKm(tempRadiusKm)
                          setMinPrice(tempMinPrice)
                          setMaxPrice(tempMaxPrice)
                          setPageSize(tempPageSize)
                          setPage(1)
                          setMobileFiltersOpen(false)
                        }}
                      >
                        Filter anwenden
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
        </div>
      </div>

      <section className="bg-background">
        <div className="container mx-auto px-sides py-1 space-y-6">
          {isMasterType && locationEnabled && SEARCH_ALERTS_ENABLED && (
            <Alert className="bg-primary/5 border-primary/30 text-primary">
              <Info className="h-4 w-4" />
              <AlertTitle>Lokalisierte Suchbenachrichtigungen aktiv</AlertTitle>
              <AlertDescription>
                <p>
                  Nahegelegene verifizierte Meister erhalten eine diskrete Benachrichtigung, wenn Sie eine standortbasierte Suche durchführen. Erwarten Sie schnellere Antworten, sobald Ihre Filter angewendet wurden.
                </p>
                <p className="text-xs text-primary/80">
                  Benachrichtigungen haben eine {SEARCH_ALERT_COOLDOWN_MINUTES}-Minuten-Abklingzeit pro Meister und erreichen bis zu {SEARCH_ALERT_MAX_RECIPIENTS} lokale Profis pro Suche.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {isMasterType && locationEnabled && !SEARCH_ALERTS_ENABLED && (
            <Alert className="bg-amber-50 border-amber-200 text-amber-700">
              <Info className="h-4 w-4" />
              <AlertTitle>Lokalisierte Benachrichtigungen sind pausiert</AlertTitle>
              <AlertDescription>
                <p>Das Betriebsteam hat automatisierte Benachrichtigungen vorübergehend deaktiviert. Sie können weiterhin nahegelegene Meister direkt über die Ergebnisse unten kontaktieren.</p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </section>

      <section className="container mx-auto px-sides pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-10">
        {/* Desktop Filters - visible on large screens */}
        <div className="hidden lg:block mb-6 bg-background">
          <div className="py-1">
            <div className="flex items-end gap-3 flex-wrap">
              {/* Sort by */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground mb-0.5">Sortieren nach</label>
                <Select
                  value={sortOption}
                  onValueChange={(value) => {
                    const typedValue = value as SortOption
                    setSortOption(typedValue)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-auto min-w-[180px] rounded-sm border border-border/60 bg-white text-sm hover:border-primary/60 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border border-border/60">
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Price */}
              {showPriceControls ? (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground mb-0.5">Preis</label>
                  <div className="w-auto">
                    <FilterDropdown
                      label={priceButtonLabel}
                      buttonClassName="min-w-[180px]"
                      onClear={() => {
                        setMinPrice(undefined)
                        setMaxPrice(undefined)
                        setPage(1)
                      }}
                      renderTag={renderInlineTags(priceTags)}
                    >
                      <div className="space-y-2.5">
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            {priceLabels.min || "Mindestpreis"}
                          </p>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            value={minPrice ?? ""}
                            onChange={(event) => {
                              const value = event.target.value
                              if (!value) {
                                setMinPrice(undefined)
                                setPage(1)
                                return
                              }
                              const parsed = Number(value)
                              setMinPrice(Number.isNaN(parsed) ? undefined : parsed)
                              setPage(1)
                            }}
                            placeholder={priceLabels.min || "Mindestpreis"}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            {priceLabels.max || "Höchstpreis"}
                          </p>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            value={maxPrice ?? ""}
                            onChange={(event) => {
                              const value = event.target.value
                              if (!value) {
                                setMaxPrice(undefined)
                                setPage(1)
                                return
                              }
                              const parsed = Number(value)
                              setMaxPrice(Number.isNaN(parsed) ? undefined : parsed)
                              setPage(1)
                            }}
                            placeholder={priceLabels.max || "Höchstpreis"}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    </FilterDropdown>
                  </div>
                </div>
              ) : null}

              {/* Results per page */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground mb-0.5">Ergebnisse pro Seite</label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-auto min-w-[100px] rounded-sm border border-border/60 bg-white text-sm hover:border-primary/60 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border border-border/60">
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reset button */}
              <div className="flex items-end pb-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-sm transition-all duration-200"
                  onClick={() => {
                    // Reset all filters to defaults
                    setSortOption("featured")
                    setCity("")
                    setLatitude(null)
                    setLongitude(null)
                    setRadiusKm(DEFAULT_RADIUS_KM)
                    setMinPrice(undefined)
                    setMaxPrice(undefined)
                    setPageSize(12)
                    setMinRating(undefined)
                    setVerifiedOnly(false)
                    setSelectedParentCategory("all")
                    setSelectedSubcategory("all")
                    setActiveSearchTerm("")
                    setPage(1)
                    
                    // Clear request signature to allow reload
                    lastRequestSignatureRef.current = null
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                  Zurücksetzen
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pb-2 lg:hidden">
          {/* Filter button - hidden on large screens */}
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden h-10 inline-flex items-center gap-2 rounded-sm border border-border/60 bg-white px-4 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            aria-expanded={mobileFiltersOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </Button>
        </div>

        {error ? (
          <div className="rounded-sm border border-destructive bg-destructive/10 p-6 text-center">
            <p className="font-medium text-destructive-foreground">{error}</p>
            <p className="text-sm text-destructive/70">Versuchen Sie, Ihre Filter anzupassen oder die Seite neu zu laden.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-y-4 gap-x-2 lg:grid-cols-5 xl:grid-cols-6">
            {showLoadingPlaceholders ? (
              loadingPlaceholders
            ) : hasResults ? (
              data?.items?.map((item) => {
                const cardProps = mapFeaturedItemToCard(item)
                if (!cardProps) return null
                return (
                  <MarketplaceItemCard
                    key={`${item.type}-${item.id}`}
                    variant="flat"
                    {...cardProps}
                  />
                )
              })
            ) : (
              <div className="col-span-full flex flex-col items-center gap-2 rounded-sm border p-10 text-center">
                <Skeleton className="h-12 w-12 rounded-full" />
                <p className="text-lg font-semibold">No results</p>
                <p className="text-sm text-muted-foreground">Try changing filters or search terms.</p>
              </div>
            )}
            {loadingMore ? mobileLoadMorePlaceholders : null}
          </div>
        )}

        {canLoadMoreOnMobile ? (
          <div ref={feedSentinelRef} className="h-px w-full" aria-hidden />
        ) : null}

        {renderPagination ? (
          <div className="mt-10 hidden items-center justify-center lg:flex">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      if (page > 1) {
                        setPage((prev) => Math.max(1, prev - 1))
                      }
                    }}
                    aria-disabled={page === 1}
                    className={cn({ 'pointer-events-none opacity-50': page === 1 })}
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }).map((_, index) => {
                  const pageNumber = index + 1
                  return (
                    <PaginationItem key={`page-${pageNumber}`}>
                      <PaginationLink
                        href="#"
                        isActive={pageNumber === page}
                        onClick={(event) => {
                          event.preventDefault()
                          if (pageNumber !== page) {
                            setPage(pageNumber)
                          }
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      if (page < totalPages) {
                        setPage((prev) => Math.min(totalPages, prev + 1))
                      }
                    }}
                    aria-disabled={page >= totalPages}
                    className={cn({ 'pointer-events-none opacity-50': page >= totalPages })}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        ) : null}
      </section>
    </div>
  )
}

