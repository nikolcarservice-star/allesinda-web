"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, Sparkles, ShieldCheck, Timer } from "lucide-react"
import { getHomeContent, getWorkGallery, getCategoryTreeByType } from "@/lib/api"
import type { CategoryType, HomeContent, CategoryTree } from "@/lib/api"
import { useAuth } from "@/lib/context/auth-context"
import { Button } from "@/components/ui/button"
import { RecentlyViewedStrip, type RecentlyViewedDisplayItem } from "@/components/shared/recently-viewed-strip"
import { FeaturedPageContent } from "@/components/home/featured-page-content"
import { HorizontalGalleryCarousel } from "@/components/shared/horizontal-gallery-carousel"
import { CategorySection } from "@/components/home/category-section"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  clearRecentlyViewedItems,
  readRecentlyViewedItems,
  removeRecentlyViewedItem,
  RECENTLY_VIEWED_EVENT,
  RECENTLY_VIEWED_FILTER_EVENT,
  getRecentlyViewedFilter,
  setRecentlyViewedFilter,
  parsePriceLabel,
  type RecentlyViewedItem,
} from "@/lib/utils/recently-viewed"
import { cn, formatPrice } from "@/lib/utils"

type HomePageContentProps = {
  initialContent: HomeContent
}

const HERO_QUICK_LINKS: Array<{ label: string; value: CategoryType }> = [
  { label: "Meister", value: "master" },
  { label: "Produkt", value: "product" },
  { label: "Mieten", value: "rental" },
]

const VALID_TYPES: readonly CategoryType[] = ["master", "product", "rental"]

function mapRecentlyViewedItemToDisplay(item: RecentlyViewedItem): RecentlyViewedDisplayItem {
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
    category_id: item.category_id ?? undefined,
    category: item.category, // Keep for backward compatibility
    totalReviews: item.totalReviews,
  }
}

export function HomePageContent({ initialContent }: HomePageContentProps) {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const [homeContent, setHomeContent] = useState<HomeContent>(initialContent)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshedUserId, setLastRefreshedUserId] = useState<number | null | undefined>(undefined)
  
  // Category/subcategory state
  // Initialize with default to avoid hydration mismatch - will sync from URL in useEffect
  const [selectedNavType, setSelectedNavType] = useState<CategoryType>("product")
  const [categoryTree, setCategoryTree] = useState<CategoryTree[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<CategoryTree | null>(null)
  const [isCatalogView, setIsCatalogView] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isSubcategoryTransitioning, setIsSubcategoryTransitioning] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const subcategorySectionRef = useRef<HTMLDivElement>(null)

  // Load categories when nav type changes
  useEffect(() => {
    if (!isMounted) return
    
    let cancelled = false
    const hasExistingCategories = categoryTree.length > 0
    
    async function loadCategories() {
      try {
        // Only fade out if we have existing categories (not on initial load)
        if (hasExistingCategories) {
          // On mobile, skip ALL transitions for instant swap
          if (isMobile) {
            // Load data immediately without any transition state
            const tree = await getCategoryTreeByType(selectedNavType)
            if (!cancelled) {
              // Add Catalog category at the beginning if enabled via environment variable
              const showCatalog = process.env.NEXT_PUBLIC_SHOW_CATALOG === 'true'
              const finalTree = showCatalog ? (() => {
                const catalogCategory: CategoryTree = {
                  id: -1, // Special ID for catalog
                  name: 'Katalog',
                  image_url: '/catalog.webp',
                  children: tree, // All categories as children for catalog view
                  slug: 'catalog',
                  type: selectedNavType,
                  sort_order: 0,
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
                return [catalogCategory, ...tree]
              })() : tree
              setCategoryTree(finalTree)
              setCategoriesLoading(false)
              setIsTransitioning(false)
            }
          } else {
            // Desktop: smooth fade-out/fade-in
            setIsTransitioning(true)
            // Wait for fade-out animation on desktop
            await new Promise(resolve => setTimeout(resolve, 200))
            if (cancelled) return
            
            // Load new categories
            const tree = await getCategoryTreeByType(selectedNavType)
            
            if (!cancelled) {
              // Add Catalog category at the beginning if enabled via environment variable
              const showCatalog = process.env.NEXT_PUBLIC_SHOW_CATALOG === 'true'
              const finalTree = showCatalog ? (() => {
                const catalogCategory: CategoryTree = {
                  id: -1, // Special ID for catalog
                  name: 'Katalog',
                  image_url: '/catalog.webp',
                  children: tree, // All categories as children for catalog view
                  slug: 'catalog',
                  type: selectedNavType,
                  sort_order: 0,
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
                return [catalogCategory, ...tree]
              })() : tree
              // Update categories
              setCategoryTree(finalTree)
              setCategoriesLoading(false)
              
              // Small delay on desktop for smoother transition
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  if (!cancelled) {
                    setIsTransitioning(false)
                  }
                })
              })
            }
          }
        } else {
          // Initial load
          setCategoriesLoading(true)
          const tree = await getCategoryTreeByType(selectedNavType)
          
          if (!cancelled) {
            // Add Catalog category at the beginning if enabled via environment variable
            const showCatalog = process.env.NEXT_PUBLIC_SHOW_CATALOG === 'true'
            const finalTree = showCatalog ? (() => {
              const catalogCategory: CategoryTree = {
                id: -1, // Special ID for catalog
                name: 'Catalog',
                image_url: '/catalog.webp',
                children: tree, // All categories as children for catalog view
                slug: 'catalog',
                type: selectedNavType,
                sort_order: 0,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
              return [catalogCategory, ...tree]
            })() : tree
            setCategoryTree(finalTree)
            setCategoriesLoading(false)
            setIsTransitioning(false)
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to load categories", error)
        }
        if (!cancelled) {
          setCategoryTree([])
          setCategoriesLoading(false)
          setIsTransitioning(false)
        }
      }
    }
    
    loadCategories()
    
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNavType, isMounted, isMobile]) // categoryTree.length intentionally excluded

  // Reset selected category when category tree changes (clear selection)
  useEffect(() => {
    setSelectedCategory(null)
  }, [categoryTree])

  // Reset subcategory transition state when category tree changes (nav type change)
  useEffect(() => {
    setIsSubcategoryTransitioning(false)
  }, [categoryTree])

  // Mark component as mounted to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Sync nav type from URL params - updates when header nav buttons change
  useEffect(() => {
    if (!isMounted) return
    // On mobile, skip URL sync if state was already updated (from button click)
    // This prevents double updates and delays
    const typeParam = searchParams?.get("types") ?? searchParams?.get("type")
    const nextType = typeParam && VALID_TYPES.includes(typeParam as CategoryType)
      ? (typeParam as CategoryType)
      : "product"
    // Only update if different to avoid unnecessary re-renders
    if (nextType !== selectedNavType) {
      setSelectedNavType(nextType)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isMounted]) // selectedNavType intentionally excluded to prevent loops

  // Sync selected category from URL params
  useEffect(() => {
    if (!isMounted || !categoryTree.length) return
    
    const categoryParam = searchParams?.get("category")
    
    if (categoryParam) {
      // Find category by slug in the category tree
      const findCategoryBySlug = (tree: CategoryTree[], slug: string): CategoryTree | null => {
        for (const node of tree) {
          if (node.slug === slug) {
            return node
          }
          if (node.children?.length) {
            const found = findCategoryBySlug(node.children, slug)
            if (found) return found
          }
        }
        return null
      }
      
      const foundCategory = findCategoryBySlug(categoryTree, categoryParam)
      
      // Only update if different to avoid unnecessary re-renders
      if (foundCategory && foundCategory.id !== selectedCategory?.id) {
        // Check if it's a parent category (has children) or subcategory
        if (foundCategory.children && foundCategory.children.length > 0) {
          // It's a parent category - select it
          setSelectedCategory(foundCategory)
        } else {
          // It's a subcategory - find and select its parent
          const findParent = (tree: CategoryTree[], childSlug: string): CategoryTree | null => {
            for (const node of tree) {
              if (node.children?.some(child => child.slug === childSlug)) {
                return node
              }
              if (node.children?.length) {
                const parent = findParent(node.children, childSlug)
                if (parent) return parent
              }
            }
            return null
          }
          const parentCategory = findParent(categoryTree, categoryParam)
          if (parentCategory) {
            setSelectedCategory(parentCategory)
          }
        }
      }
    } else {
      // No category in URL - clear selection
      // This happens when clicking type in breadcrumb or when category is removed
      if (selectedCategory && !isSubcategoryTransitioning) {
        setSelectedCategory(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, categoryTree, isMounted]) // selectedCategory intentionally excluded to prevent loops

  useEffect(() => {
    if (authLoading) return

    const currentUserId = user?.id ?? null
    if (lastRefreshedUserId === currentUserId) return

    let cancelled = false

    const fetchContent = async () => {
      setRefreshing(true)
      try {
        const data = await getHomeContent()
        if (!cancelled && data) {
          setHomeContent(data)
          setWorkGalleryItems((data.work_gallery ?? []).slice(0, 6))
        }
      } catch (error) {
        // Gracefully handle API errors - page should still work with initial content
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.error("Failed to refresh home content", error)
        }
        // Keep existing content, don't clear it on error
      } finally {
        if (!cancelled) {
          setRefreshing(false)
          setLastRefreshedUserId(currentUserId)
        }
      }
    }

    fetchContent()

    return () => {
      cancelled = true
    }
  }, [authLoading, user?.id, lastRefreshedUserId])

  const handleCategoryClick = (category: CategoryTree) => {
    // Check if this is the catalog category (special ID or name check)
    const isCatalog = category.id === -1 || category.name?.toLowerCase() === 'catalog' || category.name?.toLowerCase() === 'katalog'
    
    if (isCatalog) {
      // Toggle catalog view
      if (isCatalogView) {
        setIsSubcategoryTransitioning(true)
        setTimeout(() => {
          setIsCatalogView(false)
          setSelectedCategory(null)
          // Clear category from URL when closing catalog
          const params = new URLSearchParams()
          params.set("types", selectedNavType)
          router.push(`/?${params.toString()}`, { scroll: false })
          setTimeout(() => {
            setIsSubcategoryTransitioning(false)
          }, 50)
        }, 200)
      } else {
        setIsSubcategoryTransitioning(true)
        setTimeout(() => {
          setIsCatalogView(true)
          setSelectedCategory(category)
          setTimeout(() => {
            setIsSubcategoryTransitioning(false)
          }, 50)
        }, 200)
      }
    } else {
      // Regular category toggle
      setIsCatalogView(false)
      if (selectedCategory?.id === category.id) {
        // Deselect: hide subcategory panel and clear search
        setIsSubcategoryTransitioning(true)
        setTimeout(() => {
          setSelectedCategory(null)
          // Clear category from URL
          const params = new URLSearchParams()
          params.set("types", selectedNavType)
          router.push(`/?${params.toString()}`, { scroll: false })
          setTimeout(() => {
            setIsSubcategoryTransitioning(false)
          }, 50)
        }, 200)
      } else {
        // Select: show subcategory panel AND navigate to search results
        setIsSubcategoryTransitioning(true)
        setTimeout(() => {
          setSelectedCategory(category)
          // Navigate to search results with category filter
          const params = new URLSearchParams()
          params.set("types", selectedNavType)
          if (category.slug) {
            params.set("category", category.slug)
          }
          router.push(`/?${params.toString()}`, { scroll: false })
          setTimeout(() => {
            setIsSubcategoryTransitioning(false)
          }, 50)
        }, 200)
      }
    }
  }

  const handleCatalogCategoryClick = (category: CategoryTree) => {
    // When clicking a category in catalog view, select it and close catalog
    setIsSubcategoryTransitioning(true)
    setTimeout(() => {
      setIsCatalogView(false)
      setSelectedCategory(category)
      setTimeout(() => {
        setIsSubcategoryTransitioning(false)
      }, 50)
    }, 200)
  }

  const handleScrollToSubcategories = useCallback(() => {
    if (subcategorySectionRef.current) {
      subcategorySectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }, [])

  const handleCloseSubcategory = useCallback(() => {
    if (!selectedCategory) return
    
    // Close the subcategory section by deselecting the category
    setIsSubcategoryTransitioning(true)
    setTimeout(() => {
      setSelectedCategory(null)
      // Clear category from URL to close the panel
      const params = new URLSearchParams()
      params.set("types", selectedNavType)
      router.push(`/?${params.toString()}`, { scroll: false })
      setTimeout(() => {
        setIsSubcategoryTransitioning(false)
      }, 50)
    }, 200)
  }, [selectedCategory, selectedNavType, router])

  const handleNavTypeChange = (type: CategoryType) => {
    if (type === selectedNavType || isTransitioning) return
    // On mobile, update state immediately and skip URL sync delay
    if (isMobile) {
      setSelectedNavType(type)
      // Update URL in background without blocking
      router.push(`/?types=${type}`, { scroll: false })
    } else {
      // On desktop, let URL sync handle it for smoother transition
      router.push(`/?types=${type}`, { scroll: false })
    }
  }



  const [workGalleryItems, setWorkGalleryItems] = useState(() => (homeContent.work_gallery ?? []).slice(0, 6))
  const [recentlyViewedItems, setRecentlyViewedItems] = useState<RecentlyViewedItem[]>([])
  // Initialize with constant default to avoid hydration mismatch - will sync from storage in useEffect
  const [recentlyViewedFilter, setRecentlyViewedFilterState] = useState<CategoryType>("product")

  useEffect(() => {
    let cancelled = false

    const fetchExtendedGallery = async () => {
      try {
        const firstPage = await getWorkGallery({ 
          page: 1, 
          page_size: 6, 
          // All media is now automatically approved
          show_before_after_only: true,
          photos_only: true
        })
        if (cancelled || !firstPage) return
        if (!cancelled) {
          setWorkGalleryItems((firstPage.items ?? []).slice(0, 6))
        }
      } catch (error) {
        // Gracefully handle API errors - keep existing gallery items from initial content
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to load extended work gallery", error)
        }
        // Don't clear existing items, just keep what we have
      }
    }

    fetchExtendedGallery()

    return () => {
      cancelled = true
    }
  }, [lastRefreshedUserId])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const stored = readRecentlyViewedItems()
    if (stored.length) {
      setRecentlyViewedItems(stored)
    }
    const handler = () => {
      const items = readRecentlyViewedItems()
      setRecentlyViewedItems(items)
    }
    window.addEventListener(RECENTLY_VIEWED_EVENT, handler)
    return () => window.removeEventListener(RECENTLY_VIEWED_EVENT, handler)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !isMounted) {
      return
    }
    const storedFilter = getRecentlyViewedFilter()
    if (storedFilter) {
      setRecentlyViewedFilterState(storedFilter)
    }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: CategoryType }>).detail
      if (!detail?.type) return
      setRecentlyViewedFilterState((current) => (current === detail.type ? current : detail.type as CategoryType))
    }
    window.addEventListener(RECENTLY_VIEWED_FILTER_EVENT, handler)
    return () => window.removeEventListener(RECENTLY_VIEWED_FILTER_EVENT, handler)
  }, [isMounted])

  const isAuthenticated = Boolean(user)
  const dashboardCta = (() => {
    if (!user) return null
    switch (user.role) {
      case "master":
        return { href: "/dashboard/master", label: "Meister-Dashboard öffnen" }
      case "seller":
        return { href: "/dashboard/seller", label: "Verkäufer-Dashboard öffnen" }
      case "admin":
        return { href: "/admin", label: "Zum Admin-Panel" }
      default:
        return { href: "/profile", label: "Profil verwalten" }
    }
  })()

  const featuredTarget = `/?types=${recentlyViewedFilter}`
  const primaryCta = isAuthenticated
    ? { href: featuredTarget, label: "Empfohlene durchsuchen" }
    : { href: featuredTarget, label: "Empfohlene erkunden" }

  const secondaryCta = isAuthenticated ? dashboardCta ?? { href: "/profile", label: "Profil verwalten" } : null

  const tertiaryCta = isAuthenticated ? null : { href: "/login", label: "Anmelden" }

  const handleRemoveRecentlyViewed = useCallback((href: string) => {
    if (!href) return
    const next = removeRecentlyViewedItem(href)
    setRecentlyViewedItems(next)
  }, [])

  const handleClearRecentlyViewed = useCallback(() => {
    clearRecentlyViewedItems()
    setRecentlyViewedItems([])
  }, [])

  const handleRecentlyViewedFilterChange = useCallback((type: CategoryType) => {
    setRecentlyViewedFilterState((current) => {
      if (current === type) {
        return current
      }
      setRecentlyViewedFilter(type)
      return type
    })
  }, [])

  const filteredRecentlyViewedItems = useMemo(
    () => recentlyViewedItems.filter((item) => item.itemType === recentlyViewedFilter),
    [recentlyViewedItems, recentlyViewedFilter],
  )
  const hasStoredRecentlyViewed = recentlyViewedItems.length > 0
  const hasAnyRecentlyViewed = filteredRecentlyViewedItems.length > 0

  // Backend already returns profile image_url for masters in all FeaturedItemOut responses
  // The stored image in localStorage should already be the profile image (from view-tracker.tsx)
  // So we can trust the stored image for masters - it's already the profile image
  const recentlyViewedStripItems = useMemo<RecentlyViewedDisplayItem[]>(() => {
    return filteredRecentlyViewedItems.map((item) => mapRecentlyViewedItemToDisplay(item))
  }, [filteredRecentlyViewedItems])
  const activeFilterLabel = useMemo(
    () => HERO_QUICK_LINKS.find((link) => link.value === recentlyViewedFilter)?.label ?? "Artikel",
    [recentlyViewedFilter],
  )

  return (
    <div className="flex min-h-screen flex-col">
      {/* Category and Subcategory Section */}
      <section className="bg-gray-200 border-none pt-3 pb-3 sm:pt-3 sm:pb-3 md:pt-4 md:pb-4 lg:pt-6 lg:pb-6">
        <div className="container mx-auto px-sides">
          {/* Mobile Nav Type Selector - Only visible on small screens (Product hidden) */}
          <div className="mb-4 md:hidden">
            <nav
              className="flex items-center justify-center gap-0.5 p-1 bg-muted/40 rounded-lg border border-border/60 shadow-sm"
              role="tablist"
              aria-label="Featured navigation"
            >
              {HERO_QUICK_LINKS.filter((link) => link.value !== "product").map((link) => {
                const isActive = isMounted && selectedNavType === link.value
                return (
                  <button
                    key={link.value}
                    type="button"
                    onClick={() => handleNavTypeChange(link.value)}
                    disabled={isTransitioning}
                    className={cn(
                      "flex flex-1 items-center justify-center h-9 sm:h-10 rounded-md px-3 sm:px-4 text-sm sm:text-base font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                    role="tab"
                    aria-selected={isActive}
                  >
                    {link.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Categories Grid */}
          {categoriesLoading && categoryTree.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Kategorien werden geladen...</p>
              </div>
            </div>
          ) : categoryTree.length > 0 ? (
            <div 
              key={selectedNavType}
              className={cn(
                isMobile 
                  ? "" // No transition on mobile for instant swap
                  : "transition-all ease-in-out duration-300",
                !isMobile && isTransitioning 
                  ? "opacity-0 translate-y-2 pointer-events-none" 
                  : "opacity-100 translate-y-0"
              )}
            >
              <CategorySection
                categories={categoryTree}
                selectedCategory={selectedCategory}
                onCategoryClick={handleCategoryClick}
                isTransitioning={false}
                onScrollToSubcategories={handleScrollToSubcategories}
                selectedNavType={selectedNavType}
                isSubcategoryTransitioning={isSubcategoryTransitioning}
                subcategorySectionRef={subcategorySectionRef}
                isCatalogView={isCatalogView}
                allCategories={categoryTree.filter(cat => cat.id !== -1)}
                onCatalogCategoryClick={handleCatalogCategoryClick}
                onCloseSubcategory={handleCloseSubcategory}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 py-16 text-center">
              <p className="text-base text-muted-foreground">Noch keine Kategorien verfügbar.</p>
            </div>
          )}
        </div>
      </section>

      <FeaturedPageContent />

      <section className="bg-white py-3 sm:py-4 md:py-5">
        <div className="container mx-auto space-y-2 px-sides sm:space-y-6 md:space-y-6">
          <div className="space-y-2">
            <div className="flex flex-row items-center justify-between gap-4">
              <h2 className="flex-1 min-w-0 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                Arbeitsgalerie
              </h2>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="shrink-0 flex-shrink-0 group/btn border-border/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-200 font-medium"
              >
                <Link href="/gallery" className="flex items-center gap-1.5">
                  <span>Alle anzeigen</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                </Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground sm:text-base">
              Echte Ergebnisse von vertrauenswürdigen Meistern.
            </p>
          </div>

          {workGalleryItems.length ? (
            <HorizontalGalleryCarousel
              items={workGalleryItems
                .map((media) => {
                  const profileId = media.profile_id ?? media.master_profile_id
                  if (!profileId) return null
                  return {
                    ...media,
                    master_profile_id: profileId,
                    master_name: media.master_name ?? media.title ?? undefined,
                  }
                })
                .filter((item): item is NonNullable<typeof item> => item !== null)}
              ariaLabel="Arbeitsgalerie-Artikel"
              getItemHref={(item) => `/detailed/master/${item.master_profile_id ?? item.profile_id}`}
            />
          ) : (
            <div className="rounded-none border border-dashed border-muted/40 bg-muted/10 py-10 text-center text-muted-foreground sm:py-12">
              <p>Galerie-Inhalte kommen bald.</p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="container mx-auto flex flex-col gap-6 px-sides">
          <div className="flex flex-col gap-4">
            {/* Title row with Clear all button */}
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">Kürzliche Artikel</h2>
              <div className="flex items-center gap-3 shrink-0">
                {hasStoredRecentlyViewed && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearRecentlyViewed}
                    className="shrink-0 flex-shrink-0 border-border/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-200 font-medium"
                  >
                    Alle löschen
                  </Button>
                )}
                {refreshing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Synchronisierung
                  </div>
                )}
              </div>
            </div>
            
            {/* Description */}
            <p className="text-sm text-muted-foreground sm:text-base">
              Springen Sie zurück zu den Meistern, Produktn und Verleih, die Sie in der letzten Sitzung erkundet haben.
            </p>
            
            {/* Filter buttons - centered */}
            <div className="flex items-center justify-center gap-1 rounded-sm border border-border/60 bg-muted/40 p-1 max-w-fit mx-auto">
              {HERO_QUICK_LINKS.map((link) => {
                const isActive = isMounted && recentlyViewedFilter === link.value
                return (
                  <button
                    key={link.value}
                    type="button"
                    onClick={() => handleRecentlyViewedFilterChange(link.value)}
                    className={cn(
                      "flex-1 rounded-sm px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide transition-all duration-200 min-w-[80px]",
                      isActive
                        ? "bg-white text-primary shadow-sm"
                        : "text-muted-foreground hover:text-primary hover:bg-white/50",
                    )}
                    aria-pressed={isActive}
                  >
                    {link.label}
                  </button>
                )
              })}
            </div>
          </div>

          {recentlyViewedStripItems.length ? (
            <RecentlyViewedStrip
              mode="detailed"
              items={recentlyViewedStripItems}
              cardVariant="flat"
              cardClassName="rounded-none shadow-none hover:shadow-none"
              onRemove={
                hasStoredRecentlyViewed
                  ? (item) => {
                      handleRemoveRecentlyViewed(item.href)
                    }
                  : undefined
              }
              removeLabel="Kürzlich angesehenen Artikel entfernen"
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-muted-foreground/40 p-10 text-center text-muted-foreground space-y-2">
              {hasStoredRecentlyViewed ? (
                <p>
                  Noch keine kürzlich angesehenen {activeFilterLabel.toLowerCase()}. Weiter erkunden, um diese Liste zu füllen.
                </p>
              ) : user ? (
                <p>Beginnen Sie mit dem Durchsuchen, um Ihre personalisierte Liste zu erstellen.</p>
              ) : (
                <p>Artikel erkunden, um Ihre kürzliche Liste zu erstellen.</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}


