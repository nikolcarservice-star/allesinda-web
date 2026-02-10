"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Menu,
  Search as SearchIcon,
  User,
  Heart,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Star,
  X,
  ShoppingCart,
  LogIn,
  Bell,
  CalendarCheck,
  MessageSquare,
  Shield,
  Award,
  Store,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"
import { useAuth } from "@/lib/context/auth-context"
import { AllesindaCartModal } from "@/components/cart/allesinda-cart-modal"
import { NotificationDropdown } from "@/components/layout/notification-dropdown"
import { cn, formatPrice, getOptimizedImageUrl } from "@/lib/utils"
import { ApiClientError, getCategoryTreeByType } from "@/lib/api"
import { logger } from "@/lib/logger"
import { getCuratedFeaturedItems, getFeaturedDetail, getFeaturedItems } from "@/lib/api/featured"
import type {
  CategoryTree,
  CategoryType,
  FeaturedDetail,
  FeaturedItem,
  Media,
  Product,
  Profile,
  Rental,
} from "@/lib/api/types"
import {
  clearRecentlyViewedItems,
  readRecentlyViewedItems,
  RECENTLY_VIEWED_EVENT,
  setRecentlyViewedFilter,
  parsePriceLabel,
  upsertRecentlyViewedItem,
  removeRecentlyViewedItem,
  type RecentlyViewedItem,
} from "@/lib/utils/recently-viewed"
import { HeaderSearchBar, type HighlightItem } from "@/components/layout/HeaderSearchBar"
import type { RecentlyViewedDisplayItem } from "@/components/shared/recently-viewed-strip"

type NavItem = {
  label: string
  href: string
  type: CategoryType
}

const NAV_ITEMS: NavItem[] = [
  { label: "Meister", href: "/", type: "master" },
 { label: "Produkt", href: "/", type: "product" },
  { label: "Verleih", href: "/", type: "rental" },
]

const DEFAULT_NAV = NAV_ITEMS.find((item) => item.type === "product") as NavItem

const createEmptyTree = (): Record<CategoryType, CategoryTree[]> => ({
  master: [],
  product: [],
  rental: [],
})

const PLACEHOLDER_IMAGE = "/placeholder.jpg"
// Use the same image loading pattern as products/categories-table

const mapStoredItemToHighlight = (item: RecentlyViewedItem): HighlightItem => ({
  id: item.id,
  title: item.title,
  subtitle: item.subtitle,
  image: item.image,
  priceLabel: item.priceLabel,
  rating: item.rating,
  href: item.href,
  itemType: item.itemType,
  soldCount: item.soldCount,
})

const mapRecentlyViewedItemToDisplay = (item: RecentlyViewedItem): RecentlyViewedDisplayItem => {
  const parsedPrice = item.price ?? parsePriceLabel(item.priceLabel)
  const parsedPerDay =
    item.pricePerDay ?? (item.itemType === "rental" ? parsePriceLabel(item.priceLabel) : undefined)
  const normalizedLabel =
    item.priceLabel && item.priceLabel.trim().length > 0
      ? item.priceLabel
      : typeof parsedPrice === "number" && parsedPrice > 0
        ? formatPrice(parsedPrice, "EUR")
        : undefined

  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    image: item.image,
    priceLabel: normalizedLabel,
    rating: item.rating,
    href: item.href,
    itemType: item.itemType,
    soldCount: item.soldCount,
    price: parsedPrice,
    pricePerDay: parsedPerDay,
    city_name: (item as any).city_name ?? null,
    category: item.category,
    totalReviews: item.totalReviews,
  }
}

const mapHighlightToDisplay = (item: HighlightItem): RecentlyViewedDisplayItem => ({
  id: item.id,
  title: item.title,
  subtitle: item.subtitle,
  image: item.image,
  priceLabel: item.priceLabel,
  rating: item.rating,
  href: item.href,
  itemType: item.itemType ?? "product",
  soldCount: item.soldCount,
})

const mapDisplayToHighlight = (item: RecentlyViewedDisplayItem): HighlightItem => ({
  id: typeof item.id === "number" ? item.id : Number(item.id),
  title: item.title,
  subtitle: item.subtitle,
  image: item.image,
  priceLabel: item.priceLabel,
  rating: item.rating,
  href: item.href,
  itemType: item.itemType ?? "product",
  soldCount: item.soldCount,
})

const shouldBackfillMasterPrice = (item: RecentlyViewedItem) => {
  if (item.itemType !== "master") return false
  if (!item.priceLabel || item.priceLabel.trim().length === 0) return true
  const numeric = parsePriceLabel(item.priceLabel)
  return !numeric || numeric <= 0
}

const deriveMasterPriceFromDetail = (detail: FeaturedDetail): { priceLabel?: string; price?: number } => {
  const lowestServicePrice = detail.services?.reduce<number | undefined>((lowest, service) => {
    if (typeof service.price_from !== "number" || !Number.isFinite(service.price_from) || service.price_from <= 0) {
      return lowest
    }
    if (typeof lowest !== "number" || service.price_from < lowest) {
      return service.price_from
    }
    return lowest
  }, undefined)

  const extraLabel =
    detail.extra && typeof (detail.extra as { price_label?: unknown }).price_label === "string"
      ? ((detail.extra as { price_label?: string }).price_label ?? "").trim()
      : undefined

  if (extraLabel && extraLabel.length > 0) {
    const numeric = parsePriceLabel(extraLabel)
    return {
      priceLabel: extraLabel,
      price: numeric,
    }
  }

  if (typeof lowestServicePrice === "number" && Number.isFinite(lowestServicePrice) && lowestServicePrice > 0) {
    return {
      priceLabel: formatPrice(lowestServicePrice, "EUR"),
      price: lowestServicePrice,
    }
  }

  if (typeof detail.price === "number" && Number.isFinite(detail.price) && detail.price > 0) {
    return {
      priceLabel: formatPrice(detail.price, "EUR"),
      price: detail.price,
    }
  }

  return {}
}

type HighlightStatus = "idle" | "loading" | "ready" | "error"

type TrendingState = Record<
  CategoryType,
  {
    status: HighlightStatus
    items: HighlightItem[]
  }
>

type HighlightsState = Record<
  string,
  {
    status: HighlightStatus
    items: HighlightItem[]
  }
>

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading, logout } = useAuth()

  const routeNav = useMemo<NavItem>(() => {
    // Check if we're on homepage
    if (pathname === "/") {
      const typeParam = searchParams?.get("types") ?? searchParams?.get("type")
      if (typeParam) {
        const requestedType = typeParam.split(",").find((value) =>
          ["master", "product", "rental"].includes(value)
        ) as CategoryType | undefined
        if (requestedType) {
          const nav = NAV_ITEMS.find((item) => item.type === requestedType)
          if (nav) {
            return nav
          }
        }
      }
      return DEFAULT_NAV
    }

    const match = NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    return match ?? DEFAULT_NAV
  }, [pathname, searchParams])

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [mobileNavView, setMobileNavView] = useState<"root" | "categories" | "subcategories">("root")
  const [mobileSelectedNav, setMobileSelectedNav] = useState<NavItem | null>(null)
  const [mobileSelectedCategory, setMobileSelectedCategory] = useState<CategoryTree | null>(null)
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false)
  const searchPanelInputRef = useRef<HTMLInputElement | null>(null)
  const [searchValue, setSearchValue] = useState("")
  const [searchCityId, setSearchCityId] = useState<number | undefined>(undefined)
  
  // Debug: Log when searchCityId changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Header] searchCityId changed:', searchCityId)
    }
  }, [searchCityId])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [recentlyViewedItems, setRecentlyViewedItems] = useState<RecentlyViewedItem[]>([])
  const [categoryTree, setCategoryTree] = useState<Record<CategoryType, CategoryTree[]>>(createEmptyTree)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [hoveredCategory, setHoveredCategory] = useState<CategoryTree | null>(null)
  const [hoveredNavType, setHoveredNavType] = useState<CategoryType | null>(null)
  const [activeHighlightCategory, setActiveHighlightCategory] = useState<CategoryTree | null>(null)
  const [selectedNavType, setSelectedNavType] = useState<CategoryType>(routeNav.type)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [canScrollLeftMobile, setCanScrollLeftMobile] = useState(false)
  const [canScrollRightMobile, setCanScrollRightMobile] = useState(false)
  const desktopCategoryScrollRef = useRef<HTMLDivElement | null>(null)
  const mobileCategoryScrollRef = useRef<HTMLDivElement | null>(null)
  const [categoryHighlights, setCategoryHighlights] = useState<HighlightsState>({})
  const [trendingByType, setTrendingByType] = useState<TrendingState>({
    master: { status: "idle", items: [] },
    product: { status: "idle", items: [] },
    rental: { status: "idle", items: [] },
  })
  const isDesktopMegaMenuOpen = Boolean(
    hoveredCategory && (hoveredCategory.children?.length ?? 0) > 0,
  )
  const closeDesktopMegaMenu = useCallback(() => {
    setHoveredCategory(null)
    setHoveredNavType(null)
    setActiveHighlightCategory(null)
  }, [])
  const headerRef = useRef<HTMLElement | null>(null)
  const [headerHeight, setHeaderHeight] = useState(0)
  const megaMenuContainerRef = useRef<HTMLDivElement | null>(null)
  const [megaMenuHeight, setMegaMenuHeight] = useState(0)
  const [isDesktopSearchSuggestionsOpen, setIsDesktopSearchSuggestionsOpen] = useState(false)

  const featuredSearchParams = useMemo(() => {
    return pathname === "/" ? searchParams : null
  }, [pathname, searchParams])

  const selectedNav = useMemo<NavItem>(() => {
    const nav = NAV_ITEMS.find((item) => item.type === selectedNavType)
    return nav ?? DEFAULT_NAV
  }, [selectedNavType])
  const filteredRecentlyViewedItems = useMemo(
    () => recentlyViewedItems.filter((item) => item.itemType === selectedNav.type),
    [recentlyViewedItems, selectedNav.type],
  )
  const recentlyViewedHighlights = useMemo(
    () => filteredRecentlyViewedItems.map(mapStoredItemToHighlight),
    [filteredRecentlyViewedItems],
  )
  // Backend already returns profile image_url for masters in all FeaturedItemOut responses
  // The stored image in localStorage should already be the profile image (from view-tracker.tsx)
  // So we can trust the stored image for masters - it's already the profile image
  const recentlyViewedDisplayItems = useMemo<RecentlyViewedDisplayItem[]>(
    () => filteredRecentlyViewedItems.map(mapRecentlyViewedItemToDisplay),
    [filteredRecentlyViewedItems],
  )
  const recentlyViewedHighlightLookup = useMemo(() => {
    const lookup = new Map<string, HighlightItem>()
    for (const item of recentlyViewedHighlights) {
      if (item.href) {
        lookup.set(item.href, item)
      }
    }
    return lookup
  }, [recentlyViewedHighlights])

  useEffect(() => {
    setSelectedNavType(routeNav.type)
  }, [routeNav.type])

  useEffect(() => {
    setRecentlyViewedFilter(selectedNavType)
  }, [selectedNavType])

  useEffect(() => {
    const measureHeader = () => {
      if (!headerRef.current) return
      const rect = headerRef.current.getBoundingClientRect()
      setHeaderHeight(rect.height)
    }

    measureHeader()
    window.addEventListener("resize", measureHeader)

    return () => {
      window.removeEventListener("resize", measureHeader)
    }
  }, [])

  useEffect(() => {
    if (!headerRef.current) return
    const rect = headerRef.current.getBoundingClientRect()
    setHeaderHeight(rect.height)
  }, [isDesktopMegaMenuOpen])

  const selectedCategories = categoryTree[selectedNav.type] ?? []

  useEffect(() => {
    let isMounted = true

    async function loadNavigationCategories() {
      try {
        setCategoriesLoading(true)
        const results = await Promise.all(
          NAV_ITEMS.map(async (item) => {
            const data = await getCategoryTreeByType(item.type)
            return [item.type, data] as const
          })
        )

        if (!isMounted) return

        const nextTree = createEmptyTree()
        for (const [type, data] of results) {
          nextTree[type] = data
        }
        setCategoryTree(nextTree)
      } catch (error) {
        logger.error("Failed to load navigation categories:", error)
      } finally {
        if (isMounted) {
          setCategoriesLoading(false)
        }
      }
    }

    loadNavigationCategories()

    return () => {
      isMounted = false
    }
  }, [])

  // Sync search state from URL params (when navigating back/forward)
  // This does NOT trigger a search - it only updates the UI state
  // Note: searchCityId is NOT in dependencies to avoid resetting when user changes city in combobox
  // The effect only runs when URL params change (navigation), not when state changes
  useEffect(() => {
    const qParam = searchParams?.get("q") ?? searchParams?.get("search") ?? ""
    setSearchValue(qParam)
    const cid = searchParams?.get("city_id")
    const parsed = cid ? Number(cid) : NaN
    const newCityId = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
    
    // Sync cityId from URL when URL params change (navigation)
    // This ensures the UI reflects the URL state when navigating to a new URL
    // When user changes city in combobox, it updates state directly via onCityChange,
    // and then when they click Search, the URL is updated with the city_id, which triggers this effect
    setSearchCityId((currentCityId) => {
      if (newCityId !== currentCityId) {
        // Debug: Log cityId sync
        if (process.env.NODE_ENV === 'development') {
          console.log('[Header] Syncing cityId from URL:', {
            urlCityId: cid,
            parsedCityId: newCityId,
            currentSearchCityId: currentCityId,
            willUpdate: true,
            routeNavHref: routeNav.href,
            searchParamsString: searchParams?.toString(),
          })
        }
        return newCityId
      }
      return currentCityId
    })
  }, [searchParams, routeNav.href])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = localStorage.getItem("allesinda-recent-searches")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, 8))
        }
      }
    } catch (error) {
      logger.error("Failed to read recent searches:", error)
    }
  }, [])

  const syncRecentlyViewedFromStorage = useCallback(() => {
    const items = readRecentlyViewedItems()
    setRecentlyViewedItems(items)
    return items
  }, [])

  const backfillMasterPrices = useCallback(
    async (items?: RecentlyViewedItem[]) => {
      const source = items ?? readRecentlyViewedItems()
      const mastersToBackfill = source.filter(shouldBackfillMasterPrice)
      if (mastersToBackfill.length === 0) {
        return
      }

      let updatedItems = source

      for (const entry of mastersToBackfill) {
        try {
          const detail = await getFeaturedDetail("master", entry.id)
          const { priceLabel, price } = deriveMasterPriceFromDetail(detail)

          if (!priceLabel || !price || price <= 0) {
            continue
          }

          // For masters, always use profile image (image_url) from detail
          const resolvedImage = resolveFeaturedImage(detail)
          const normalizedImage = resolvedImage
            ? getOptimizedImageUrl(resolvedImage, 'original') || PLACEHOLDER_IMAGE
            : (entry.image && entry.image.trim().length > 0 ? entry.image : PLACEHOLDER_IMAGE)

          const enriched: RecentlyViewedItem = {
            ...entry,
            image: normalizedImage,
            priceLabel,
            price,
            pricePerDay: undefined,
          }

          updatedItems = upsertRecentlyViewedItem(enriched)
        } catch (error) {
          logger.warn("Failed to backfill master price for recently viewed item", { itemId: entry.id, error })
        }
      }

      setRecentlyViewedItems(updatedItems)
    },
    [],
  )

  useEffect(() => {
    const stored = syncRecentlyViewedFromStorage()
    void backfillMasterPrices(stored)
  }, [syncRecentlyViewedFromStorage, backfillMasterPrices])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handler = () => {
      const stored = syncRecentlyViewedFromStorage()
      void backfillMasterPrices(stored)
    }
    window.addEventListener(RECENTLY_VIEWED_EVENT, handler)
    return () => window.removeEventListener(RECENTLY_VIEWED_EVENT, handler)
  }, [syncRecentlyViewedFromStorage, backfillMasterPrices])

  useEffect(() => {
    setHoveredCategory(null)
    setHoveredNavType(null)
  }, [selectedNavType])

  const persistRecentSearches = useCallback((entries: string[]) => {
    setRecentSearches(entries)
    if (typeof window !== "undefined") {
      localStorage.setItem("allesinda-recent-searches", JSON.stringify(entries))
    }
  }, [])

  const addRecentlyViewedHighlight = useCallback(
    async (item: HighlightItem) => {
      if (!item?.href || !item.itemType) return

      const normalizedImage = item.image ? getOptimizedImageUrl(item.image, 'card') : undefined

      let priceLabel = item.priceLabel?.trim()
      let price: number | undefined = item.itemType === "rental" ? undefined : parsePriceLabel(priceLabel)
      let pricePerDay: number | undefined = item.itemType === "rental" ? parsePriceLabel(priceLabel) : undefined
      let subtitle = item.subtitle
      let image = normalizedImage && normalizedImage.length > 0 ? normalizedImage : undefined

      if (item.itemType === "master") {
        // Always fetch detail for masters to ensure we get the profile image
        try {
          const detail = await getFeaturedDetail("master", item.id)
          
          // Update price if missing
          if (!price || price <= 0 || !priceLabel) {
            const derived = deriveMasterPriceFromDetail(detail)
            if (derived.priceLabel) {
              priceLabel = derived.priceLabel
            }
            if (derived.price && derived.price > 0) {
              price = derived.price
            }
          }

          const detailLocation =
            detail.subtitle ??
            ([(detail as any).city_name].filter((value) => value && value.trim().length > 0).join(", ") || undefined)
          if (!subtitle && detailLocation) {
            subtitle = detailLocation
          }

          // For masters, always use profile image (image_url) from detail
          const resolvedImage = resolveFeaturedImage(detail)
          if (resolvedImage) {
            const normalized = getOptimizedImageUrl(resolvedImage, 'original')
            if (normalized && normalized.trim().length > 0) {
              image = normalized
            }
          }
        } catch (error) {
          logger.warn("Failed to resolve master details for recently viewed item", { itemId: item.id, error })
        }
      } else if (item.itemType === "product") {
        if (!price && priceLabel) {
          price = parsePriceLabel(priceLabel)
        }
        if (!priceLabel && typeof price === "number" && price > 0) {
          priceLabel = formatPrice(price, "EUR")
        }
      } else if (item.itemType === "rental") {
        if (!pricePerDay && priceLabel) {
          pricePerDay = parsePriceLabel(priceLabel)
        }
        if (!priceLabel && typeof pricePerDay === "number" && pricePerDay > 0) {
          priceLabel = `${formatPrice(pricePerDay, "EUR")}/day`
        }
      }

      const stored: RecentlyViewedItem = {
        id: item.id,
        title: item.title,
        subtitle,
        image,
        rating: item.rating,
        priceLabel,
        href: item.href,
        itemType: item.itemType,
        soldCount: item.soldCount,
        price,
        pricePerDay,
      }
      const next = upsertRecentlyViewedItem(stored)
      setRecentlyViewedItems(next)
    },
    [],
  )

  const handleClearRecentlyViewed = useCallback(() => {
    clearRecentlyViewedItems()
    setRecentlyViewedItems([])
  }, [])

  const handleTrendingSelect = (item: HighlightItem) => {
    if (!item?.href) return
    void addRecentlyViewedHighlight(item)
    router.push(item.href)
    setIsMobileMenuOpen(false)
  }

  const handleRecentlyViewedSelect = (item: RecentlyViewedDisplayItem) => {
    if (!item?.href) return
    const lookupItem = recentlyViewedHighlightLookup.get(item.href) ?? mapDisplayToHighlight(item)
    void addRecentlyViewedHighlight(lookupItem)
    router.push(item.href)
    setIsMobileMenuOpen(false)
  }

  const handleRemoveRecentlyViewedItem = useCallback(
    (item: RecentlyViewedDisplayItem) => {
      if (!item?.href) return
      const next = removeRecentlyViewedItem(item.href)
      setRecentlyViewedItems(next)
    },
    [],
  )

  const handleExploreTrending = useCallback(() => {
    router.push(buildCategoryUrl(selectedNav))
    setIsMobileMenuOpen(false)
  }, [selectedNav, router])

  useEffect(() => {
    if (!isSearchPanelOpen) return
    const handle = window.requestAnimationFrame(() => {
      searchPanelInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(handle)
  }, [isSearchPanelOpen])

  const buildCategoryUrl = (nav: NavItem, slug?: string | null, baseParams?: URLSearchParams | null) => {
    const params = baseParams ? new URLSearchParams(baseParams.toString()) : new URLSearchParams()

    // Debug: Log what we're building
    if (process.env.NODE_ENV === 'development' && baseParams?.has('city_id')) {
      console.log('[Header] buildCategoryUrl - baseParams has city_id:', {
        baseParamsString: baseParams.toString(),
        cityIdValue: baseParams.get('city_id'),
        navType: nav.type,
      })
    }

    params.set("types", nav.type)

    if (slug) {
      params.set("category", slug)
    } else {
      params.delete("category")
    }

    params.delete("min_price")
    params.delete("max_price")
    params.delete("verified_only")
    params.delete("latitude")
    params.delete("longitude")
    params.delete("radius_km")
    params.delete("page")
    // Preserve page_size if it exists in baseParams, otherwise set default
    if (!params.has("page_size")) {
      params.set("page_size", "12")
    }
    params.delete("sort_by")
    params.delete("sort_order")

    params.set("page", "1")

    const query = params.toString()
    
    const finalUrl = query ? `${nav.href}?${query}` : nav.href
    
    // Debug: Log final URL if city_id was in baseParams
    if (process.env.NODE_ENV === 'development' && baseParams?.has('city_id')) {
      console.log('[Header] buildCategoryUrl - Final URL:', {
        finalUrl,
        hasCityIdInFinal: params.has('city_id'),
        cityIdValue: params.get('city_id'),
        allParams: params.toString(),
      })
    }
    
    return finalUrl
  }

  // Search function - ONLY called when Search button is clicked (via handleSearchSubmit)
  // NOT called on typing, NOT called on city change, NO debounce
  const executeSearch = useCallback(
    (
      nav: NavItem,
      overrideValue?: string,
      options?: { replace?: boolean; baseParams?: URLSearchParams | ReadonlyURLSearchParams | null },
    ) => {
      const valueToUse = overrideValue ?? searchValue
      setSearchValue(valueToUse)

      const trimmed = valueToUse.trim()
      const params = options?.baseParams
        ? new URLSearchParams(options.baseParams.toString())
        : new URLSearchParams()

      params.set("types", nav.type)
      if (typeof searchCityId === "number") {
        params.set("city_id", String(searchCityId))
      } else {
        params.delete("city_id")
      }

      if (trimmed) {
        params.set("q", trimmed)
      } else {
        params.delete("q")
      }

      // Debug: Log search execution
      if (process.env.NODE_ENV === 'development') {
        console.log('[Header] executeSearch called:', {
          searchValue: trimmed,
          searchCityId,
          navType: nav.type,
          finalParams: params.toString(),
        })
      }

      const targetUrl = buildCategoryUrl(nav, undefined, params)

      if (options?.replace) {
        router.replace(targetUrl)
      } else {
        router.push(targetUrl)
      }

      if (trimmed) {
        const nextEntries = [trimmed, ...recentSearches.filter((term) => term.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8)
        persistRecentSearches(nextEntries)
      }

      setIsMobileMenuOpen(false)
      setIsSearchPanelOpen(false)
    },
    [searchValue, recentSearches, router, persistRecentSearches, searchCityId],
  )

  // Search handler - ONLY called on Search button click (form submit)
  // This is the ONLY way search is triggered - no debounce, no auto-search
  // Accepts optional searchValue and cityId to use current values instead of stale closures
  const handleSearchSubmit = useCallback(
    (overrideValue?: string, overrideCityId?: number | undefined) => {
      // Use overrideCityId if provided, otherwise use current searchCityId state
      const cityIdToUse = overrideCityId !== undefined ? overrideCityId : searchCityId
      
      // Debug: Log what we received
      if (process.env.NODE_ENV === 'development') {
        console.log('[Header] handleSearchSubmit called:', {
          overrideValue,
          overrideCityId,
          searchCityId,
          cityIdToUse,
          selectedNavType: selectedNav.type,
        })
      }
      
      // Create params with the correct cityId
      const params = new URLSearchParams()
      params.set("types", selectedNav.type)
      if (typeof cityIdToUse === "number") {
        params.set("city_id", String(cityIdToUse))
      }
      
      const trimmed = (overrideValue ?? searchValue).trim()
      if (trimmed) {
        params.set("q", trimmed)
      }
      
      // Debug: Log params before buildCategoryUrl
      if (process.env.NODE_ENV === 'development') {
        console.log('[Header] handleSearchSubmit - params before buildCategoryUrl:', {
          params: params.toString(),
          hasCityId: params.has('city_id'),
          cityIdValue: params.get('city_id'),
          cityIdToUse,
        })
      }
      
      const targetUrl = buildCategoryUrl(selectedNav, undefined, params)
      
      // Debug: Log final URL
      if (process.env.NODE_ENV === 'development') {
        console.log('[Header] handleSearchSubmit - Final URL:', targetUrl)
      }
      
      router.push(targetUrl)
      
      if (trimmed) {
        const nextEntries = [trimmed, ...recentSearches.filter((term) => term.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8)
        persistRecentSearches(nextEntries)
      }
      
      setIsMobileMenuOpen(false)
      setIsSearchPanelOpen(false)
    },
    [searchValue, searchCityId, recentSearches, router, persistRecentSearches, selectedNav],
  )

  const handleSearchSubmitAndClose = useCallback(
    (overrideValue?: string, overrideCityId?: number | undefined) => {
      // Use overrideCityId if provided, otherwise use current searchCityId state
      const cityIdToUse = overrideCityId !== undefined ? overrideCityId : searchCityId
      
      // Create params with the correct cityId
      const params = new URLSearchParams()
      params.set("types", selectedNav.type)
      if (typeof cityIdToUse === "number") {
        params.set("city_id", String(cityIdToUse))
      }
      
      const trimmed = (overrideValue ?? searchValue).trim()
      if (trimmed) {
        params.set("q", trimmed)
      }
      
      const targetUrl = buildCategoryUrl(selectedNav, undefined, params)
      router.push(targetUrl)
      
      if (trimmed) {
        const nextEntries = [trimmed, ...recentSearches.filter((term) => term.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8)
        persistRecentSearches(nextEntries)
      }
      
      setIsMobileMenuOpen(false)
      setIsSearchPanelOpen(false)
    },
    [searchValue, searchCityId, recentSearches, router, persistRecentSearches, selectedNav],
  )

  const handleClearRecent = () => {
    persistRecentSearches([])
  }

  const getDefaultCategorySlug = (category: CategoryTree) => {
    if (category.children && category.children.length > 0) {
      return category.children[0].slug
    }
    return category.slug
  }

  const handleCategoryNavigate = (nav: NavItem, category: CategoryTree, slug?: string) => {
    const targetSlug = slug ?? getDefaultCategorySlug(category)
    router.push(buildCategoryUrl(nav, targetSlug, featuredSearchParams))
    closeDesktopMegaMenu()
    setIsMobileMenuOpen(false)
  }

  const handleMobileMenuChange = useCallback(
    (next: boolean) => {
      setIsMobileMenuOpen(next)
      setMobileNavView("root")
      setMobileSelectedNav(null)
      setMobileSelectedCategory(null)
    },
    []
  )
  const mobileNavButtonClass =
    "flex w-full items-center justify-between rounded-md px-3 py-3 text-base font-semibold text-neutral-900 transition hover:bg-neutral-100"
  const mobileListItemBaseClass =
    "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100"
  const mobileListItemClass = `${mobileListItemBaseClass} justify-between`
  const mobileListItemWithIconClass = `${mobileListItemBaseClass} gap-3`
  const accountNavigationLinks: Array<{ label: string; href: string; icon: LucideIcon }> = [
    { label: "Profil", href: "/profile", icon: User },
    { label: "Favoriten", href: "/favorites", icon: Heart },
    { label: "Benachrichtigungen", href: "/notifications", icon: Bell },
    { label: "Buchungen", href: "/bookings", icon: CalendarCheck },
    { label: "Nachrichten", href: "/messages", icon: MessageSquare },
  ]
  const accountNavigationRows: Array<
    | { kind: "cart"; icon: LucideIcon; label: string }
    | { kind: "link"; icon: LucideIcon; label: string; href: string; badge?: string }
    | { kind: "role" }
    | { kind: "auth" }
    | { kind: "break" }
  > = user ? [
    { kind: "cart", icon: ShoppingCart, label: "Warenkorb" },
    ...accountNavigationLinks.map((link) => ({
      kind: "link" as const,
      icon: link.icon,
      label: link.label,
      href: link.href,
    })),
    { kind: "role" },
    { kind: "break" },
    { kind: "auth" },
  ] : [
    { kind: "auth" },
  ]
  const roleSpecificLinks: Record<string, { label: string; href: string; icon: LucideIcon }> = {
    master: { label: "Mein Dashboard", href: "/dashboard/master", icon: Award },
    seller: { label: "Mein Dashboard", href: "/dashboard/seller", icon: Store },
    admin: { label: "Admin-Panel", href: "/admin", icon: Shield },
  }
  const mobileRoleLink = user?.role ? roleSpecificLinks[user.role] : undefined
  const mobileRoleIcon = mobileRoleLink?.icon
  const RoleIcon = mobileRoleIcon
  const mobileHighlightTiles = [
    {
      key: "featured-items",
      image: "/featured.webp",
      title: "Empfohlene Artikel",
      href: "/?sort=featured",
    },
    {
      key: "trending-items",
      image: "/trending.webp",
      title: "Beliebte Artikel",
      href: "/?sort=trending_desc",
    },
  ]
  const mobileAriaTitle = "Hauptnavigation"
  const mobileAriaDescription = "Verwenden Sie dieses Menü, um Kategorien und Kontolinks zu durchsuchen."

  const trendingForSelected = trendingByType[selectedNavType] ?? { status: "idle", items: [] }

  const updateDesktopCategoryScrollState = useCallback(() => {
    const container = desktopCategoryScrollRef.current
    if (!container) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }

    const { scrollLeft, scrollWidth, clientWidth } = container
    setCanScrollLeft(scrollLeft > 1)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  const updateMobileCategoryScrollState = useCallback(() => {
    const container = mobileCategoryScrollRef.current
    if (!container) {
      setCanScrollLeftMobile(false)
      setCanScrollRightMobile(false)
      return
    }

    const { scrollLeft, scrollWidth, clientWidth } = container
    setCanScrollLeftMobile(scrollLeft > 1)
    setCanScrollRightMobile(scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  useEffect(() => {
    const container = desktopCategoryScrollRef.current
    if (!container) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }

    updateDesktopCategoryScrollState()
    container.addEventListener("scroll", updateDesktopCategoryScrollState)
    window.addEventListener("resize", updateDesktopCategoryScrollState)

    return () => {
      container.removeEventListener("scroll", updateDesktopCategoryScrollState)
      window.removeEventListener("resize", updateDesktopCategoryScrollState)
    }
  }, [updateDesktopCategoryScrollState, selectedCategories])

  useEffect(() => {
    const container = mobileCategoryScrollRef.current
    if (!container) {
      setCanScrollLeftMobile(false)
      setCanScrollRightMobile(false)
      return
    }

    updateMobileCategoryScrollState()
    container.addEventListener("scroll", updateMobileCategoryScrollState)
    window.addEventListener("resize", updateMobileCategoryScrollState)

    return () => {
      container.removeEventListener("scroll", updateMobileCategoryScrollState)
      window.removeEventListener("resize", updateMobileCategoryScrollState)
    }
  }, [updateMobileCategoryScrollState, selectedCategories])

  useEffect(() => {
    const handle = window.requestAnimationFrame(updateDesktopCategoryScrollState)
    return () => window.cancelAnimationFrame(handle)
  }, [selectedCategories.length, categoriesLoading, updateDesktopCategoryScrollState])

  useEffect(() => {
    const handle = window.requestAnimationFrame(updateMobileCategoryScrollState)
    return () => window.cancelAnimationFrame(handle)
  }, [selectedCategories.length, categoriesLoading, updateMobileCategoryScrollState])

  const scrollDesktopCategories = (direction: "left" | "right") => {
    const container = desktopCategoryScrollRef.current
    if (!container) return

    const offset = direction === "left" ? -280 : 280
    container.scrollBy({ left: offset, behavior: "smooth" })
  }

  const scrollMobileCategories = (direction: "left" | "right") => {
    const container = mobileCategoryScrollRef.current
    if (!container) return

    const offset = direction === "left" ? -240 : 240
    container.scrollBy({ left: offset, behavior: "smooth" })
  }

  function buildHighlightKey(nav: NavItem, category: CategoryTree) {
    return `${nav.type}:${category.slug ?? category.id}`
  }

  const mapProductToHighlight = (product: Product): HighlightItem => {
    const image =
      getOptimizedImageUrl(product.image_url ?? product.media?.[0]?.url ?? "", 'card') || "/placeholder.jpg"

    const location = product.city_name ?? undefined

    return {
      id: product.id,
      title: product.title ?? "Product",
      subtitle: product.brand ?? product.seller_name ?? location ?? undefined,
      image,
      rating: product.rating,
      priceLabel:
        typeof product.price === "number" ? `€${product.price.toFixed(2)}` : undefined,
      href: `/detailed/product/${product.id}`,
      itemType: "product",
    }
  }

  const mapRentalToHighlight = (rental: Rental): HighlightItem => {
    const image =
      getOptimizedImageUrl(rental.image_url ?? rental.media?.[0]?.url ?? "", 'card') || "/placeholder.jpg"

    const location = rental.city_name ?? undefined
    const isLowStock = typeof rental.stock === "number" && rental.stock > 0 && rental.stock <= 3
    const isOutOfStock = typeof rental.stock === "number" && rental.stock <= 0
    const stockLabel = isOutOfStock
      ? "Out of stock"
      : isLowStock
        ? `${rental.stock} left`
        : undefined
    const subtitleParts = [location, stockLabel].filter((part): part is string => Boolean(part))

    return {
      id: rental.id,
      title: rental.title ?? "Rental",
      subtitle: subtitleParts.length ? subtitleParts.join(" • ") : undefined,
      image,
      rating: undefined,
      priceLabel:
        typeof rental.price_per_day === "number"
          ? `€${rental.price_per_day.toFixed(2)}/day`
          : undefined,
      href: `/detailed/rental/${rental.id}`,
      itemType: "rental",
    }
  }

  const mapMasterToHighlight = (profile: Profile): HighlightItem => {
    const image = "/placeholder.jpg"
    const location = profile.city_name ?? undefined

    const rawPriceLabel =
      typeof (profile as unknown as { price_label?: string }).price_label === "string"
        ? (profile as unknown as { price_label?: string }).price_label?.trim()
        : undefined
    const profilePriceFrom =
      typeof (profile as unknown as { price_from?: number }).price_from === "number"
        ? (profile as unknown as { price_from?: number }).price_from
        : undefined

    const derivedPriceLabel =
      rawPriceLabel && rawPriceLabel.length > 0
        ? rawPriceLabel
        : typeof profilePriceFrom === "number" && Number.isFinite(profilePriceFrom) && profilePriceFrom > 0
          ? formatPrice(profilePriceFrom, "EUR")
          : undefined

    return {
      id: profile.id,
      title: profile.user_name ?? "Master",
      subtitle: location ?? undefined,
      image,
      rating: profile.rating,
      priceLabel: derivedPriceLabel,
      href: `/detailed/master/${profile.id}`,
      itemType: "master",
    }
  }

  const firstMediaUrl = (media?: Media[]): string | undefined => {
    if (!media || media.length === 0) return undefined
    const sorted = [...media].sort((a, b) => {
      const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER
      const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) return orderA - orderB
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      if (createdA !== createdB) return createdB - createdA
      return a.id - b.id
    })
    const withThumbnail = sorted.find(
      (entry) => entry.thumbnail_url && entry.thumbnail_url.trim().length > 0,
    )
    if (withThumbnail?.thumbnail_url) {
      return withThumbnail.thumbnail_url
    }
    const withUrl = sorted.find((entry) => entry.url && entry.url.trim().length > 0)
    return withUrl?.url
  }

  const resolveFeaturedImage = (detail: FeaturedDetail): string | undefined => {
    // For masters, prioritize profile image (image_url) first
    if (detail.type === "master" && detail.image_url && detail.image_url.trim().length > 0) {
      return detail.image_url
    }
    const primaryMedia = detail.media && detail.media.length ? detail.media : detail.portfolio
    const mediaImage = firstMediaUrl(primaryMedia)
    if (mediaImage && mediaImage.trim().length > 0) return mediaImage
    if (detail.image_url && detail.image_url.trim().length > 0) return detail.image_url
    return undefined
  }

const mapFeaturedItemToHighlight = (item: FeaturedItem): HighlightItem => {
  const normalizedImage = getOptimizedImageUrl(item.image_url ?? "", 'card')
  const fallbackImage = normalizedImage && normalizedImage.trim().length > 0 ? normalizedImage : PLACEHOLDER_IMAGE
  const subtitle =
    item.subtitle && item.subtitle.trim().length > 0
      ? item.subtitle
      : [item.city_name as any].filter((value) => value && (value as string).trim().length > 0).join(", ") || undefined

  let priceLabel: string | undefined
  if (item.type === "master" && typeof item.price === "number" && Number.isFinite(item.price) && item.price > 0) {
    priceLabel = formatPrice(item.price, "EUR")
  } else if (item.type === "product" && typeof item.price === "number") {
    priceLabel = formatPrice(item.price, "EUR")
  } else if (item.type === "rental") {
    const price = typeof item.price_per_day === "number" ? item.price_per_day : item.price
    if (typeof price === "number" && Number.isFinite(price) && price > 0) {
      priceLabel = `${formatPrice(price, "EUR")}${typeof item.price_per_day === "number" ? "/day" : ""}`
    }
  }

  return {
    id: item.id,
    title: item.title,
    subtitle,
    image: fallbackImage,
    priceLabel,
    rating: item.rating ?? undefined,
    href: `/detailed/${item.type}/${item.id}`,
    itemType: item.type,
    soldCount: undefined,
  }
}

  const mapFeaturedDetailToHighlight = (detail: FeaturedDetail): HighlightItem => {
    const image =
      getOptimizedImageUrl(resolveFeaturedImage(detail) ?? "", 'card') ||
      "/placeholder.jpg"

    const location =
      detail.subtitle ?? ([(detail as any).city_name].filter((value) => value && value.trim().length > 0).join(", ") || undefined)

    const lowestServicePrice =
      detail.type === "master"
        ? detail.services?.reduce<number | undefined>((lowest, service) => {
            const price = typeof service.price_from === "number" ? service.price_from : undefined
            if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
              return lowest
            }
            if (typeof lowest !== "number" || price < lowest) {
              return price
            }
            return lowest
          }, undefined)
        : undefined

    const extraPriceLabel =
      detail.extra && typeof (detail.extra as { price_label?: unknown }).price_label === "string"
        ? ((detail.extra as { price_label?: string }).price_label ?? "").trim()
        : undefined

    let priceLabel: string | undefined
    if (detail.type === "product" && typeof detail.price === "number") {
      priceLabel = `€${detail.price.toFixed(2)}`
    } else if (detail.type === "rental" && typeof detail.price_per_day === "number") {
      priceLabel = `€${detail.price_per_day.toFixed(2)}/day`
    } else if (detail.type === "master") {
      if (extraPriceLabel && extraPriceLabel.length > 0) {
        priceLabel = extraPriceLabel
      } else if (typeof lowestServicePrice === "number") {
        priceLabel = formatPrice(lowestServicePrice, "EUR")
      } else if (typeof detail.price === "number" && Number.isFinite(detail.price) && detail.price > 0) {
        priceLabel = formatPrice(detail.price, "EUR")
      }
    }

    return {
      id: detail.id,
      title: detail.title,
      subtitle: location,
      image,
      rating: detail.rating ?? undefined,
      priceLabel,
      href: `/detailed/${detail.type}/${detail.id}`,
      itemType: detail.type,
    }
  }

  const ensureTrendingItems = useCallback(
    async (type: CategoryType) => {
      const current = trendingByType[type]
      if (current && (current.status === "loading" || current.status === "ready")) {
        return
      }

      setTrendingByType((prev) => ({
        ...prev,
        [type]: {
          status: "loading",
          items: [],
        },
      }))

      try {
        const limit = 10
        let itemsSource: FeaturedItem[] = []

        try {
          const curated = await getCuratedFeaturedItems({
            types: [type],
            page: 1,
            page_size: limit,
          })
          if (curated?.items?.length) {
            itemsSource = curated.items as FeaturedItem[]
          }
        } catch (curatedError) {
          logger.warn("Failed to load curated featured items:", curatedError)
        }

        if (itemsSource.length === 0) {
          const response = await getFeaturedItems({
            types: [type],
            sort_by: "rating",
            sort_order: "desc",
            page: 1,
            page_size: limit,
          })
          itemsSource = response.items ?? []
        }

        const highlightItems = await Promise.all(
          itemsSource.map(async (item) => {
            if (item.type === "master") {
              return mapFeaturedItemToHighlight(item)
            }
            try {
              const detail = await getFeaturedDetail(type, item.id)
              return mapFeaturedDetailToHighlight(detail)
            } catch (error) {
              logger.warn(`Failed to load featured detail for ${type} ${item.id}`, error)
              return null
            }
          }),
        )

        setTrendingByType((prev) => ({
          ...prev,
          [type]: {
            status: "ready",
            items: highlightItems.filter((item): item is HighlightItem => Boolean(item)),
          },
        }))
      } catch (error) {
        logger.error("Failed to load featured items:", error)
        setTrendingByType((prev) => ({
          ...prev,
          [type]: {
            status: "error",
            items: [],
          },
        }))
      }
    },
    [trendingByType],
  )

  useEffect(() => {
    ensureTrendingItems(selectedNavType)
  }, [selectedNavType, ensureTrendingItems])

  const ensureCategoryHighlights = useCallback(
    async (nav: NavItem, category: CategoryTree) => {
      if (!category.slug) return
      const key = buildHighlightKey(nav, category)
      const existing = categoryHighlights[key]
      if (existing && (existing.status === "loading" || existing.status === "ready")) {
        return
      }

      setCategoryHighlights((prev) => ({
        ...prev,
        [key]: {
          status: "loading",
          items: [],
        },
      }))

      try {
        let items: HighlightItem[] = []

        // Convert category slug to ID for API call (backend accepts numeric string in category param)
        const categoryId = category.id?.toString()
        const response = await getFeaturedItems({
          types: [nav.type],
          category: categoryId, // Backend accepts numeric string in category param
          sort_by: "rating",
          sort_order: "desc",
          page_size: 2,
        })
        items = response.items.map(mapFeaturedItemToHighlight).slice(0, 2)

        setCategoryHighlights((prev) => ({
          ...prev,
          [key]: {
            status: "ready",
            items,
          },
        }))
      } catch (error) {
        if (error instanceof ApiClientError && error.statusCode === 404) {
          setCategoryHighlights((prev) => ({
            ...prev,
            [key]: {
              status: "ready",
              items: [],
            },
          }))
        } else if (error instanceof ApiClientError && error.statusCode === 422) {
          logger.warn("Skipping highlights for category due to validation error:", {
            category: category.slug,
            type: nav.type,
          })
          setCategoryHighlights((prev) => ({
            ...prev,
            [key]: {
              status: "ready",
              items: [],
            },
          }))
        } else {
          logger.error("Failed to load top rated highlights:", error)
          setCategoryHighlights((prev) => ({
            ...prev,
            [key]: {
              status: "error",
              items: [],
            },
          }))
        }
      }
    },
    [categoryHighlights]
  )

  useEffect(() => {
    if (!hoveredCategory) {
      setActiveHighlightCategory(null)
      return
    }
    const descendants = hoveredCategory.children ?? []
    if (descendants.length === 0) {
      setActiveHighlightCategory(null)
      return
    }
    setActiveHighlightCategory((prev) => {
      if (prev && descendants.some((child) => child.id === prev.id)) {
        return prev
      }
      return descendants.find((child) => child.slug) ?? descendants[0]
    })
  }, [hoveredCategory])

  useEffect(() => {
    if (!activeHighlightCategory || !activeHighlightCategory.slug) return
    const nav =
      NAV_ITEMS.find((item) => item.type === (hoveredNavType ?? selectedNav.type)) ?? selectedNav
    ensureCategoryHighlights(nav, activeHighlightCategory)
  }, [activeHighlightCategory, hoveredNavType, ensureCategoryHighlights, selectedNav])

  useEffect(() => {
    if (mobileNavView === "subcategories" && mobileSelectedNav && mobileSelectedCategory) {
      ensureCategoryHighlights(mobileSelectedNav, mobileSelectedCategory)
    }
  }, [mobileNavView, mobileSelectedNav, mobileSelectedCategory, ensureCategoryHighlights])

  useEffect(() => {
    if (!isDesktopMegaMenuOpen) {
      setMegaMenuHeight(0)
      return
    }

    const node = megaMenuContainerRef.current
    if (!node) return

    const updateSize = () => {
      const rect = node.getBoundingClientRect()
      setMegaMenuHeight(rect.height)
    }

    updateSize()

    const resizeObserver = new ResizeObserver(() => {
      updateSize()
    })

    resizeObserver.observe(node)

    return () => {
      resizeObserver.disconnect()
    }
  }, [isDesktopMegaMenuOpen, hoveredCategory, activeHighlightCategory])

  useEffect(() => {
    if (isDesktopSearchSuggestionsOpen) {
      closeDesktopMegaMenu()
    }
  }, [isDesktopSearchSuggestionsOpen, closeDesktopMegaMenu])

  const renderMegaMenu = () => {
    if (!hoveredCategory || hoveredNavType === null) return null
    if (!hoveredCategory.children || hoveredCategory.children.length === 0) return null

    const nav = NAV_ITEMS.find((item) => item.type === hoveredNavType) ?? selectedNav
    const childCategories = hoveredCategory.children ?? []
    const topCategories = childCategories.filter((child) => child.slug)
    const popularSubcategories = childCategories.flatMap((child) =>
      (child.children ?? []).filter((grand) => grand.slug)
    )
    const combinedSubcategories = [...topCategories, ...popularSubcategories]
    const DISPLAY_SUBCATEGORY_LIMIT = 15
    const displaySubcategories = combinedSubcategories.slice(0, DISPLAY_SUBCATEGORY_LIMIT)
    const remainingSubcategoryCount = combinedSubcategories.length - displaySubcategories.length
    const effectiveHighlightCategory = activeHighlightCategory ?? combinedSubcategories[0] ?? null
    const highlightKey =
      effectiveHighlightCategory != null ? buildHighlightKey(nav, effectiveHighlightCategory) : null
    const highlightState = highlightKey ? categoryHighlights[highlightKey] : undefined
    const highlightItems = highlightState?.items ?? []
    const highlightStatus = highlightState?.status ?? "idle"

    return (
        <div className="hidden lg:block absolute inset-x-0 top-full z-[60] bg-white">
        <div
          ref={megaMenuContainerRef}
          className="container mx-auto px-sides"
          onMouseLeave={closeDesktopMegaMenu}
        >
          <div className="bg-white border-t border-neutral-900/30">
            <div className="px-4 py-3">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_240px_240px]">
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6">
                  {displaySubcategories.map((category) => {
                    const rawImageUrl = (category.image_url && category.image_url.trim()) || (hoveredCategory.image_url && hoveredCategory.image_url.trim()) || null
                    let imageSrc = rawImageUrl ? getOptimizedImageUrl(rawImageUrl, 'thumbnail') : PLACEHOLDER_IMAGE
                    const isLocalPath = imageSrc.startsWith("/") && !imageSrc.startsWith("//")
                    
                    const isActive = activeHighlightCategory?.id === category.id
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleCategoryNavigate(nav, hoveredCategory, category.slug)}
                        onMouseEnter={() => {
                          setActiveHighlightCategory(category)
                          setHoveredNavType(nav.type)
                        }}
                        onFocus={() => {
                          setActiveHighlightCategory(category)
                          setHoveredNavType(nav.type)
                        }}
                        className={cn(
                          "group flex flex-col items-center gap-2 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer",
                        )}
                      >
                        <span
                          className={cn(
                            "relative h-20 w-20 flex-shrink-0 rounded-full border-1 bg-white transition-all duration-200 flex items-center justify-center p-0.5",
                            isActive
                              ? "border-primary scale-105"
                              : "border-border/60 group-hover:border-primary group-hover:scale-105",
                          )}
                        >
                          <span className="relative h-full w-full overflow-hidden rounded-full">
                            <Image
                              key={`${category.id}-${category.updated_at || category.image_url}`}
                              src={imageSrc}
                              alt={category.name}
                              fill
                              sizes="80px"
                              unoptimized={isLocalPath}
                              className="object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          </span>
                        </span>
                        <p
                          className={cn(
                            "text-sm font-medium transition-colors duration-200",
                            isActive ? "text-primary" : "text-neutral-800 group-hover:text-primary",
                          )}
                        >
                          {category.name}
                        </p>
                      </button>
                    )
                  })}
                  {remainingSubcategoryCount > 0 && (
                    <div className="col-span-full flex w-full">
                      <button
                        type="button"
                        onClick={() => handleCategoryNavigate(nav, hoveredCategory)}
                        className="group flex w-full items-center justify-between gap-3 border-t border-dashed border-primary/60 pt-4 text-sm font-semibold uppercase tracking-wide text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <span>View {remainingSubcategoryCount} more subcategor{remainingSubcategoryCount === 1 ? "y" : "ies"}</span>
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {(() => {
                  const tiles = [
                    {
                      key: "featured-items",
                      image: "/featured.webp",
                      title: "Featured Items",
                      href: "/?sort=featured",
                    },
                    {
                      key: "trending-items",
                      image: "/trending.webp",
                      title: "Trending Items",
                      href: "/?sort=trending_desc",
                    },
                  ]

                  const renderHighlightCard = (tile: typeof tiles[0], position: number) => {
                    const imageSrc = getOptimizedImageUrl(tile.image, 'card') || "/placeholder.jpg"
                    const isLocalPath = imageSrc.startsWith("/") && !imageSrc.startsWith("//")
                    const cardClasses = cn(
                      "group relative block w-full overflow-hidden rounded-none border border-neutral-200 bg-white transition-transform duration-300 hover:-translate-y-1 hover:border-primary/70 p-0.5",
                      position === 0 ? "" : "mt-0"
                    )

                    const content = (
                      <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
                        <Image
                          src={imageSrc}
                          alt={tile.title}
                          fill
                          unoptimized={isLocalPath}
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          sizes="(max-width: 1024px) 100vw, 300px"
                        />
                      </div>
                    )

                    return (
                      <Link key={tile.key} href={tile.href} className={cardClasses}>
                        {content}
                      </Link>
                    )
                  }

                  return tiles.map((tile, index) => (
                    <div key={tile.key} className="space-y-3 border-l border-neutral-200 pl-6">
                      {renderHighlightCard(tile, index)}
                    </div>
                  ))
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <header ref={headerRef} className="sticky top-0 z-50 bg-white border-b border-gray-300">
      {isDesktopMegaMenuOpen && headerHeight > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 hidden lg:block z-[45] bg-black/55 transition-opacity duration-200 pointer-events-none"
          style={{ top: `${headerHeight + megaMenuHeight}px` }}
          role="presentation"
          aria-hidden="true"
        />
      )}
      {isDesktopSearchSuggestionsOpen && (
        <div
          className="fixed inset-0 hidden lg:block z-[55] bg-black/65"
          role="presentation"
          aria-hidden="true"
        />
      )}
      {isSearchPanelOpen && (
        <div
          className="fixed inset-0 z-[65] bg-black/70"
          role="presentation"
          aria-hidden="true"
          onClick={() => setIsSearchPanelOpen(false)}
        />
      )}
      <div className="bg-white text-black">
        <div className="container mx-auto px-sides h-16 flex items-center gap-2 sm:gap-3">
          <Sheet open={isMobileMenuOpen} onOpenChange={handleMobileMenuChange}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden h-9 w-9 sm:h-10 sm:w-10 rounded-sm text-black/70 hover:text-black hover:bg-black/5 shrink-0"
                aria-label="Menü öffnen"
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] sm:w-[360px] p-0">
              <div className="flex h-full flex-col bg-white">
                <SheetTitle className="sr-only">{mobileAriaTitle}</SheetTitle>
                <SheetDescription className="sr-only">{mobileAriaDescription}</SheetDescription>
                <div className="flex items-center gap-3 border-b border-neutral-200 px-6 py-5">
                  <div className="relative h-9 w-[140px] -ml-1">
                    <Image src="/logo_dark.webp" alt="Allesinda" fill sizes="140px" className="object-contain object-left" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                  {mobileNavView === "root" && (
                    <div className="space-y-6">
                      <nav className="space-y-3">
                        {NAV_ITEMS.map((item) => (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => {
                              // Close sheet immediately
                              setIsMobileMenuOpen(false)
                              setSelectedNavType(item.type)
                              // Navigate immediately without waiting for sheet close animation
                              router.push(`/?types=${item.type}`, { scroll: false })
                            }}
                            className={mobileNavButtonClass}
                          >
                            <span>{item.label}</span>
                            <ChevronRight className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                          </button>
                        ))}
                      </nav>

                    <div className="space-y-4 border-t border-black/20 pt-4">
                      {loading ? (
                        <div className="space-y-3">
                          <div className="h-4 w-2/3 rounded bg-neutral-200 animate-pulse" />
                          <div className="h-10 w-full rounded bg-neutral-200 animate-pulse" />
                        </div>
                      ) : (
                        <nav className="space-y-2">
                          {accountNavigationRows.map((row, index) => {
                            const { kind } = row
                              if (kind === "break") {
                                return (
                                  <div
                                    key={`divider-${index}`}
                                    className="my-2 border-t border-neutral-200"
                                  />
                                )
                              }

                              if (kind === "cart") {
                                return (
                                  <AllesindaCartModal
                                    key="mobile-cart"
                                    renderTrigger={({ onClick, totalItems }) => (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          // Open cart without closing mobile menu - cart will overlay it
                                          onClick()
                                        }}
                                        className={mobileListItemWithIconClass}
                                      >
                                        <row.icon className="h-4 w-4 text-neutral-600" />
                                        <span className="flex-1 text-left">{row.label}</span>
                                        {totalItems > 0 && (
                                          <Badge
                                            variant="secondary"
                                            className="ml-auto h-5 min-w-[1.25rem] px-2 text-[11px] font-semibold leading-none"
                                          >
                                            {totalItems > 9 ? "9+" : totalItems}
                                          </Badge>
                                        )}
                                      </button>
                                    )}
                                  />
                                )
                              }

                              if (kind === "auth" && !user) {
                                return (
                                  <SheetClose asChild key="mobile-sign-in">
                                      <Link href="/login" className={mobileListItemWithIconClass}>
                                      <LogIn className="h-4 w-4 text-neutral-600" />
                                      <span className="flex-1 text-left">Anmelden</span>
                                    </Link>
                                  </SheetClose>
                                )
                              }

                              if (kind === "role" && mobileRoleLink && RoleIcon) {
                                return (
                                  <SheetClose asChild key="mobile-role-link">
                                    <Link href={mobileRoleLink.href} className={mobileListItemWithIconClass}>
                                      <RoleIcon className="h-4 w-4 text-neutral-600" />
                                      <span className="flex-1 text-left">{mobileRoleLink.label}</span>
                                    </Link>
                                  </SheetClose>
                                )
                              }

                              if (kind === "role" || kind === "auth") {
                                return null
                              }

                              return (
                                <SheetClose asChild key={row.href}>
                                  <Link href={row.href ?? "#"} className={mobileListItemWithIconClass}>
                                    <row.icon className="h-4 w-4 text-neutral-600" />
                                    <span className="flex-1 text-left">{row.label}</span>
                                    {row.badge && (
                                      <Badge variant="secondary" className="ml-auto h-5 px-2 text-[11px] font-semibold">
                                        {row.badge}
                                      </Badge>
                                    )}
                                  </Link>
                                </SheetClose>
                              )
                            }
                          )}
                        </nav>
                      )}
                    </div>
                    </div>
                  )}

                </div>
                {user && (
                  <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-5">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Angemeldet als
                        </p>
                        <p className="text-sm font-medium text-neutral-900 truncate">{user.email}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-md border-neutral-300 font-semibold"
                        onClick={() => {
                          logout()
                          handleMobileMenuChange(false)
                        }}
                      >
                        <LogOut className="h-4 w-4 mr-2" aria-hidden="true" /> Abmelden
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center shrink-0 -ml-1 min-w-0">
            <div className="relative h-8 w-[100px] xs:h-9 xs:w-[120px] sm:h-10 sm:w-[140px]">
              <Image
                src="/logo_dark.webp"
                alt="Allesinda Logo"
                fill
                className="object-contain object-left"
                priority
                sizes="(max-width: 640px) 120px, 140px"
              />
            </div>
          </Link>

          <nav
            className="hidden lg:flex items-center gap-1.5 ml-4"
            role="tablist"
            aria-label="Empfohlene Navigation"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = selectedNavType === item.type
              return (
                <Link
                  key={item.type}
                  href={`/?types=${item.type}`}
                  onClick={(event) => {
                    if (
                      event.defaultPrevented ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey ||
                      event.button !== 0
                    ) {
                      return
                    }

                    event.preventDefault()

                    setSelectedNavType(item.type)
                    router.push(`/?types=${item.type}`)
                  }}
                  className={cn(
                    "flex h-10 items-center rounded-sm px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-black/70 hover:bg-primary/10 hover:text-primary"
                  )}
                  style={{ cursor: "pointer" }}
                  role="tab"
                  aria-selected={isActive}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="hidden lg:flex flex-1 max-w-2xl ml-4">
            <HeaderSearchBar
              variant="desktop"
              value={searchValue}
              onValueChange={setSearchValue}
              cityId={searchCityId}
              onCityChange={setSearchCityId}
              onSubmit={handleSearchSubmit}
              recentSearches={recentSearches}
              onRecentSelect={handleSearchSubmit}
              onClearRecent={handleClearRecent}
              trendingItems={trendingForSelected.items}
              trendingStatus={trendingForSelected.status}
              onTrendingSelect={handleTrendingSelect}
              recentlyViewed={recentlyViewedDisplayItems}
              onRecentlyViewedSelect={handleRecentlyViewedSelect}
              onRecentlyViewedRemove={handleRemoveRecentlyViewedItem}
              onClearRecentlyViewed={handleClearRecentlyViewed}
              onExploreTrending={handleExploreTrending}
              onOpenChange={setIsDesktopSearchSuggestionsOpen}
            />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-sm text-black transition-all duration-200 hover:text-black hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none lg:hidden shrink-0"
              aria-label="Suchpanel öffnen"
              onClick={() => setIsSearchPanelOpen(true)}
            >
              <SearchIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>

            {user && (
              <Link
                href="/favorites"
                className="hidden sm:flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-sm text-black transition-all duration-200 hover:text-black hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none lg:hidden shrink-0"
                aria-label="Favoriten"
              >
                <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
            )}

            {user && (
              <div className="flex items-center gap-1 sm:gap-2 lg:hidden">
                <AllesindaCartModal
                  triggerClassName="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-sm text-black transition-all duration-200 hover:text-black hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none shrink-0"
                  iconClassName="text-current h-4 w-4 sm:h-5 sm:w-5"
                />
              </div>
            )}

            <div className="flex items-center gap-1 sm:gap-2 lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-sm text-black transition-all duration-200 hover:text-black hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none shrink-0"
                    aria-label="Kontomenü"
                  >
                    <User className="text-current h-[20px] w-[20px] sm:h-5 sm:w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <nav className="min-w-[220px] py-2">
                    {user ? (
                      <>
                        <div className="px-3 py-2 border-b border-border/60">
                          <p className="text-sm font-semibold truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <DropdownMenuItem asChild>
                          <Link href="/profile" className="flex items-center gap-3 text-sm">
                            <User className="h-4 w-4 text-neutral-500" />
                            <span>Profil</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/favorites" className="flex items-center gap-3 text-sm">
                            <Heart className="h-4 w-4 text-neutral-500" />
                            <span>Favoriten</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/notifications" className="flex items-center gap-3 text-sm">
                            <Bell className="h-4 w-4 text-neutral-500" />
                            <span>Benachrichtigungen</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/bookings" className="flex items-center gap-3 text-sm">
                            <CalendarCheck className="h-4 w-4 text-neutral-500" />
                            <span>Buchungen</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/messages" className="flex items-center gap-3 text-sm">
                            <MessageSquare className="h-4 w-4 text-neutral-500" />
                            <span>Nachrichten</span>
                          </Link>
                        </DropdownMenuItem>
                        {user.role === "master" && (
                          <DropdownMenuItem asChild>
                            <Link href="/dashboard/master" className="flex items-center gap-3 text-sm">
                              <Award className="h-4 w-4 text-neutral-500" />
                              <span>Mein Dashboard</span>
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {user.role === "seller" && (
                          <DropdownMenuItem asChild>
                            <Link href="/dashboard/seller" className="flex items-center gap-3 text-sm">
                              <Store className="h-4 w-4 text-neutral-500" />
                              <span>Mein Dashboard</span>
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {user.role === "admin" && (
                          <DropdownMenuItem asChild>
                            <Link href="/admin" className="flex items-center gap-3 text-sm">
                              <Shield className="h-4 w-4 text-neutral-500" />
                              <span>Admin-Panel</span>
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => logout()}
                          className="text-base focus:text-white flex items-center gap-3"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Abmelden</span>
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem asChild>
                        <Link href="/login" className="flex items-center gap-3 text-sm">
                          <LogIn className="h-4 w-4 text-neutral-500" />
                          <span>Anmelden</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </nav>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {user && (
              <div className="hidden items-center gap-2 lg:flex">
                <AllesindaCartModal
                  triggerClassName="flex h-10 w-10 items-center justify-center rounded-sm text-black transition-all duration-200 hover:text-black hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none"
                  iconClassName="text-current"
                />
                <NotificationDropdown />
                <Link
                  href="/messages"
                  className="flex h-10 w-10 items-center justify-center rounded-sm text-black transition-all duration-200 hover:text-black hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none"
                  aria-label="Nachrichten"
                >
                  <MessageSquare className="h-5 w-5" />
                </Link>
              </div>
            )}

            {loading ? (
              <div className="hidden h-10 w-10 rounded-sm bg-black/10 animate-pulse lg:block" />
            ) : (
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="hidden h-10 w-10 items-center justify-center rounded-sm text-black transition-all duration-200 hover:text-black hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none lg:flex"
                      aria-label="Kontomenü"
                    >
                      <User className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <nav className="min-w-[220px] py-2">
                    {user ? (
                      <>
                        <div className="px-3 py-2 border-b border-border/60">
                          <p className="text-sm font-semibold truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <DropdownMenuItem asChild>
                          <Link href="/profile" className="flex items-center gap-3 text-sm">
                            <User className="h-4 w-4 text-neutral-500" />
                            <span>Profil</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/favorites" className="flex items-center gap-3 text-sm">
                            <Heart className="h-4 w-4 text-neutral-500" />
                            <span>Favoriten</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/notifications" className="flex items-center gap-3 text-sm">
                            <Bell className="h-4 w-4 text-neutral-500" />
                            <span>Benachrichtigungen</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/bookings" className="flex items-center gap-3 text-sm">
                            <CalendarCheck className="h-4 w-4 text-neutral-500" />
                            <span>Buchungen</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/messages" className="flex items-center gap-3 text-sm">
                            <MessageSquare className="h-4 w-4 text-neutral-500" />
                            <span>Nachrichten</span>
                          </Link>
                        </DropdownMenuItem>
                        {user.role === "master" && (
                          <DropdownMenuItem asChild>
                            <Link href="/dashboard/master" className="flex items-center gap-3 text-sm">
                              <Award className="h-4 w-4 text-neutral-500" />
                              <span>Mein Dashboard</span>
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {user.role === "seller" && (
                          <DropdownMenuItem asChild>
                            <Link href="/dashboard/seller" className="flex items-center gap-3 text-sm">
                              <Store className="h-4 w-4 text-neutral-500" />
                              <span>Mein Dashboard</span>
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {user.role === "admin" && (
                          <DropdownMenuItem asChild>
                            <Link href="/admin" className="flex items-center gap-3 text-sm">
                              <Shield className="h-4 w-4 text-neutral-500" />
                              <span>Admin-Panel</span>
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => logout()}
                          className="text-base focus:text-white flex items-center gap-3"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Abmelden</span>
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem asChild>
                        <Link href="/login" className="flex items-center gap-3 text-sm">
                          <LogIn className="h-4 w-4 text-neutral-500" />
                          <span>Anmelden</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    </nav>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

          <Sheet
            open={isSearchPanelOpen}
            onOpenChange={(next) => {
              setIsSearchPanelOpen(next)
              if (next) {
                requestAnimationFrame(() => {
                  searchPanelInputRef.current?.focus()
                })
              }
            }}
          >
            <SheetContent
              side="right"
              showClose={false}
              className="z-[70] w-full max-w-sm sm:w-[420px] md:w-[440px] px-0"
              overlayClassName="pointer-events-none z-[60] bg-transparent"
            >
              <div className="flex h-full flex-col bg-white">
                <div className="relative border-b border-border/60 px-6 py-4 flex items-center justify-between">
                  <div>
                    <SheetTitle className="text-base font-semibold text-neutral-900">Suchen</SheetTitle>
                    <SheetDescription className="sr-only">
                      Geben Sie eine Abfrage ein und wählen Sie Meister, Produkt oder Verleih aus, um Ihre Ergebnisse zu verfeinern.
                    </SheetDescription>
                  </div>
                  <SheetClose className="flex h-8 w-8 items-center justify-center rounded-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                    <span className="flex w-full justify-end pr-1">
                      <X className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="sr-only">Suchpanel schließen</span>
                  </SheetClose>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  <div className="flex items-center gap-1 rounded-sm border border-border/60 bg-muted/40 p-1">
                    {NAV_ITEMS.map((item) => {
                      const isActive = selectedNavType === item.type
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => {
                            setSelectedNavType(item.type)
                            requestAnimationFrame(() => {
                              searchPanelInputRef.current?.focus()
                            })
                          }}
                          className={cn(
                            "flex-1 rounded-sm px-3 py-1.5 text-center text-xs font-semibold transition-all duration-200",
                            isActive ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary hover:bg-white/50"
                          )}
                        >
                          {item.label}
                        </button>
                      )
                    })}
                  </div>

                  <HeaderSearchBar
                    variant="desktop"
                    value={searchValue}
                    onValueChange={setSearchValue}
                    cityId={searchCityId}
                    onCityChange={setSearchCityId}
                    showInlineCity={false}
                    onSubmit={handleSearchSubmitAndClose}
                    placeholder={`Suchen ${selectedNav.label.toLowerCase()}`}
                    onInputRef={(node) => {
                      searchPanelInputRef.current = node
                    }}
                    recentSearches={recentSearches}
                    onRecentSelect={handleSearchSubmitAndClose}
                    onClearRecent={handleClearRecent}
                    trendingItems={trendingForSelected.items}
                    trendingStatus={trendingForSelected.status}
                    onTrendingSelect={(item) => {
                      handleTrendingSelect(item)
                      setIsSearchPanelOpen(false)
                    }}
                    recentlyViewed={recentlyViewedDisplayItems}
                    onRecentlyViewedSelect={(item) => {
                      handleRecentlyViewedSelect(item)
                      setIsSearchPanelOpen(false)
                    }}
                    onRecentlyViewedRemove={(item) => {
                      handleRemoveRecentlyViewedItem(item)
                      setIsSearchPanelOpen(false)
                    }}
                    onClearRecentlyViewed={handleClearRecentlyViewed}
                    onExploreTrending={() => {
                      handleExploreTrending()
                      setIsSearchPanelOpen(false)
                    }}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

    </header>
  )
}
