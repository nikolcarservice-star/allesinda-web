"use client"

import { useState, useCallback, useRef, useEffect, Fragment } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn, getOptimizedImageUrl, toMediaRelativePath } from "@/lib/utils"
import type { CategoryTree, CategoryType } from "@/lib/api"
import { SubcategorySection } from "@/components/home/subcategory-section"

const PLACEHOLDER_IMAGE = "/placeholder.jpg"

interface CategorySectionProps {
  categories: CategoryTree[]
  selectedCategory: CategoryTree | null
  onCategoryClick: (category: CategoryTree) => void
  isTransitioning: boolean
  onScrollToSubcategories?: () => void
  selectedNavType?: CategoryType
  isSubcategoryTransitioning?: boolean
  subcategorySectionRef?: React.RefObject<HTMLDivElement | null>
  isCatalogView?: boolean
  allCategories?: CategoryTree[]
  onCatalogCategoryClick?: (category: CategoryTree) => void
  onCloseSubcategory?: () => void
  isSubcategorySectionVisible?: boolean
  isMobile?: boolean
}

export function CategorySection({
  categories,
  selectedCategory,
  onCategoryClick,
  isTransitioning,
  onScrollToSubcategories,
  selectedNavType,
  isSubcategoryTransitioning = false,
  subcategorySectionRef,
  isCatalogView = false,
  allCategories = [],
  onCatalogCategoryClick,
  onCloseSubcategory,
  isMobile = false,
}: CategorySectionProps) {
  const [imageErrors, setImageErrors] = useState<Record<string | number, boolean>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Calculate items per row on large screens
  const [itemsPerRow, setItemsPerRow] = useState(5) // Default for lg screens

  // Reset image errors when categories change to allow retry
  useEffect(() => {
    setImageErrors({})
  }, [categories])

  const handleImageError = useCallback((categoryId: string | number) => {
    setImageErrors((prev) => ({ ...prev, [categoryId]: true }))
  }, [])

  const updateScrollState = useCallback(() => {
    const node = scrollContainerRef.current
    if (!node) return
    
    const { scrollLeft, scrollWidth, clientWidth } = node
    const threshold = 4
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)
    
    setCanScrollLeft(scrollLeft > threshold)
    setCanScrollRight(maxScrollLeft > threshold && (maxScrollLeft - scrollLeft) > threshold)
  }, [])

  useEffect(() => {
    const node = scrollContainerRef.current
    if (!node) return

    updateScrollState()

    const handleScroll = () => {
      updateScrollState()
      
      // On small screens, hide subcategory panel while scrolling
      if (itemsPerRow === 0) {
        setIsScrolling(true)
        
        // Clear existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
        
        // Show panel again after scrolling stops (300ms delay)
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false)
        }, 300)
      }
    }

    const handleResize = () => {
      updateScrollState()
    }

    // Use native passive event listeners for better performance
    node.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleResize, { passive: true })

    // Also observe for content changes
    const observer = new ResizeObserver(() => {
      updateScrollState()
    })
    observer.observe(node)

    return () => {
      node.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleResize)
      observer.disconnect()
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [updateScrollState, categories.length, itemsPerRow])


  const scrollLeft = useCallback(() => {
    const node = scrollContainerRef.current
    if (!node) return
    
    const scrollAmount = node.clientWidth * 0.8
    node.scrollBy({ left: -scrollAmount, behavior: "smooth" })
  }, [])

  const scrollRight = useCallback(() => {
    const node = scrollContainerRef.current
    if (!node) return
    
    const scrollAmount = node.clientWidth * 0.8
    node.scrollBy({ left: scrollAmount, behavior: "smooth" })
  }, [])
  
  useEffect(() => {
    const calculateItemsPerRow = () => {
      if (typeof window === 'undefined') return
      const width = window.innerWidth
      if (width >= 1536) setItemsPerRow(8) // 2xl
      else if (width >= 1280) setItemsPerRow(6) // xl
      else if (width >= 1024) setItemsPerRow(5) // lg
      else setItemsPerRow(0) // Not large screen
    }
    
    calculateItemsPerRow()
    window.addEventListener('resize', calculateItemsPerRow)
    return () => window.removeEventListener('resize', calculateItemsPerRow)
  }, [])

  // Calculate selected category's row (for large screens)
  const selectedCategoryIndex = selectedCategory 
    ? categories.findIndex(cat => cat.id === selectedCategory.id)
    : -1
  const selectedCategoryRow = selectedCategoryIndex >= 0 && itemsPerRow > 0
    ? Math.floor(selectedCategoryIndex / itemsPerRow)
    : -1

  // Check if we should insert subcategory section after this category
  // For catalog view: after catalog category
  // For regular categories: after selected category's row
  const shouldInsertSubcategories = selectedCategory && selectedCategory.children && selectedCategory.children.length > 0 && selectedNavType

  // Early return if no categories
  if (!categories || categories.length === 0) {
    return null
  }

  return (
    <div className="w-full flex flex-col items-center py-2 sm:py-3 md:py-4 lg:py-0">
      <div className="w-full relative">
        <div 
          ref={scrollContainerRef}
          className={cn(
            "flex gap-1 sm:gap-2 w-full",
            // On small/medium screens: horizontal scrolling carousel
            "flex-nowrap overflow-x-auto overflow-y-visible",
            "scrollbar-hide snap-x snap-mandatory",
            "px-2 sm:px-3 md:px-4",
            // Add minimal vertical padding for compact layout
            "py-2 sm:py-3 md:py-4",
            // On large screens: original grid layout (no scrolling)
            "lg:flex-wrap lg:justify-center lg:overflow-visible lg:snap-none lg:px-0 lg:py-0 lg:gap-2"
          )}
        style={{ 
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          // Touch styles for mobile - CSS will handle large screens via overflow-visible
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y pinch-zoom",
          overscrollBehaviorY: "auto",
          overscrollBehaviorX: "contain",
          maxWidth: "1920px",
          width: "100%"
        }}
        role="region"
        aria-label="Kategorie-Karussell"
      >
        {categories.map((category, index) => {
          if (!category?.id) {
            return null
          }

          const hasImageError = imageErrors[category.id]
          const rawImageUrl = category.image_url && category.image_url.trim() ? category.image_url : null
          // On mobile: use relative /media/ path so images load via rewrite (no CORS). On desktop: use optimized URL as before.
          const relativeMediaPath = rawImageUrl ? toMediaRelativePath(rawImageUrl) : ""
          const useRelativeBackendPath = isMobile && relativeMediaPath.length > 0 && relativeMediaPath.startsWith("/")
          const imageSrc = hasImageError || !rawImageUrl
            ? PLACEHOLDER_IMAGE
            : useRelativeBackendPath
              ? relativeMediaPath
              : getOptimizedImageUrl(rawImageUrl, "thumbnail")
          const isLocalPath = imageSrc.startsWith("/") && !imageSrc.startsWith("//") && !imageSrc.startsWith("http")
          const isSelected = selectedCategory?.id === category.id
          const categoryName = category.name || "Unnamed Category"
          
          // Check if we should insert subcategory section after this category
          const currentRow = itemsPerRow > 0 ? Math.floor(index / itemsPerRow) : -1
          const isLastInSelectedRow = itemsPerRow > 0 && 
            selectedCategoryRow >= 0 && 
            currentRow === selectedCategoryRow && 
            (index === categories.length - 1 || Math.floor((index + 1) / itemsPerRow) > selectedCategoryRow)
          const isCatalogCategory = category.id === -1
          // On large screens, insert after the last item in selected category's row
          // On small screens, we'll render it outside the flex container
          const shouldInsertAfterThis = isCatalogCategory || 
            (isLastInSelectedRow && !isCatalogView && itemsPerRow > 0)

          return (
            <Fragment key={category.id}>
              <div
                data-category-item
                data-category-id={category.id}
                className={cn(
                  // On mobile/small/medium: show 5 categories at once (task 15)
                  "flex-shrink-0 snap-center",
                  "w-[calc((100%-1rem)/5)] sm:w-[calc((100%-2rem)/5)] md:w-[calc((100%-2rem)/5)]",
                  // On large screens: original grid layout (flex-wrap handles wrapping)
                  // For n items per row with gap g: calc((100% - (n-1) × g) / n)
                  // lg: 5 items, gap 0.5rem (4 gaps) = calc((100% - 2rem) / 5)
                  // xl: 6 items, gap 0.5rem (5 gaps) = calc((100% - 2.5rem) / 6)
                  // 2xl: 8 items, gap 0.5rem (7 gaps) = calc((100% - 3.5rem) / 8)
                  "lg:snap-none lg:w-[calc((100%-2rem)/5)] xl:w-[calc((100%-2.5rem)/6)] 2xl:w-[calc((100%-3.5rem)/8)]"
                )}
              >
                <button
                  type="button"
                  onClick={() => onCategoryClick(category)}
                  className={cn(
                    "group flex flex-col items-center gap-2 text-center transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
                    "w-full"
                  )}
                >
                    <span
                      className={cn(
                        "relative h-24 w-24 sm:h-20 sm:w-20 flex-shrink-0 rounded-sm border-1 bg-white transition-all duration-200",
                      "flex items-center justify-center p-0.5",
                      "shadow-sm",
                      isSelected
                        ? "border-primary shadow-md"
                        : "border-border/60 group-hover:border-primary/60 group-hover:shadow-md",
                    )}
                  >
                    <span className="relative h-full w-full min-h-[1px] min-w-[1px] overflow-hidden rounded-sm bg-gradient-to-br from-muted/20 to-muted/5">
                      <Image
                        key={`${category.id}-${category.updated_at || category.image_url || 'fallback'}`}
                        src={imageSrc}
                        alt={categoryName}
                        fill
                        sizes="(max-width: 640px) 96px, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 80px"
                        unoptimized={isLocalPath || hasImageError || useRelativeBackendPath}
                        className="object-cover transition-opacity duration-200"
                        onError={() => handleImageError(category.id)}
                        loading="lazy"
                        quality={85}
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/8 rounded-sm ring-2 ring-primary/20" />
                      )}
                    </span>
                  </span>
                  <div className="space-y-1.5 mt-0.5 w-full">
                    <p
                      className={cn(
                        "text-xs sm:text-xs md:text-sm font-semibold transition-colors duration-200 line-clamp-2 leading-tight",
                        "max-w-[70%] mx-auto relative",
                        isSelected 
                          ? "text-primary" 
                          : "text-foreground/90 group-hover:text-primary"
                      )}
                    >
                      {categoryName}
                      {!isSelected && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
                      )}
                    </p>
                    {isSelected && (
                      <div className="h-1 w-10 sm:w-12 mx-auto bg-primary rounded-sm" />
                    )}
                  </div>
                </button>
              </div>
              
              {/* Insert subcategory section after catalog category or selected category's row (large screens only) */}
              {shouldInsertAfterThis && shouldInsertSubcategories && itemsPerRow > 0 && (
                <div 
                  ref={subcategorySectionRef}
                  key={`subcategories-${selectedCategory.id}`}
                  className="w-full basis-full flex-[1_0_100%] min-w-full mt-2 lg:mt-3"
                >
                  <SubcategorySection
                    selectedCategory={selectedCategory}
                    selectedNavType={selectedNavType}
                    isTransitioning={isSubcategoryTransitioning}
                    selectedCategoryIndex={selectedCategoryIndex}
                    totalCategories={categories.length}
                    isCatalogView={isCatalogView}
                    allCategories={isCatalogView ? allCategories : undefined}
                    onCategoryClick={isCatalogView ? onCatalogCategoryClick : undefined}
                    onClose={onCloseSubcategory}
                  />
                </div>
              )}
            </Fragment>
          )
        })}
        </div>

        {/* Arrow buttons on small/medium screens (hidden on large screens where all categories are visible) */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={scrollLeft}
            className={cn(
              "group absolute left-2 md:left-3 top-1/2 -translate-y-1/2 z-20",
              "flex lg:hidden h-10 w-10 md:h-9 md:w-9 items-center justify-center rounded-full",
              "bg-white/98 backdrop-blur-sm border border-border/60",
              "shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/15",
              "text-foreground/80 hover:text-primary hover:border-primary/60",
              "hover:bg-white hover:scale-105",
              "transition-all duration-300 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
              "active:scale-95 active:shadow-md",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
            aria-label="Nach links scrollen"
          >
            <ChevronLeft className="h-5 w-5 md:h-4 md:w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={scrollRight}
            className={cn(
              "group absolute right-2 md:right-3 top-1/2 -translate-y-1/2 z-20",
              "flex lg:hidden h-10 w-10 md:h-9 md:w-9 items-center justify-center rounded-full",
              "bg-white/98 backdrop-blur-sm border border-border/60",
              "shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/15",
              "text-foreground/80 hover:text-primary hover:border-primary/60",
              "hover:bg-white hover:scale-105",
              "transition-all duration-300 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
              "active:scale-95 active:shadow-md",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
            aria-label="Nach rechts scrollen"
          >
            <ChevronRight className="h-5 w-5 md:h-4 md:w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
      
      {/* Subcategory section for small screens - outside scrolling container */}
      {itemsPerRow === 0 && shouldInsertSubcategories && selectedCategory && !isCatalogView && !isScrolling && (
        <div 
          ref={subcategorySectionRef}
          key={`subcategories-small-${selectedCategory.id}`}
          className="w-full mt-2 sm:mt-3"
        >
          <SubcategorySection
            selectedCategory={selectedCategory}
            selectedNavType={selectedNavType}
            isTransitioning={isSubcategoryTransitioning}
            onClose={onCloseSubcategory}
            selectedCategoryIndex={selectedCategoryIndex}
            totalCategories={categories.length}
            isCatalogView={isCatalogView}
            allCategories={isCatalogView ? allCategories : undefined}
            onCategoryClick={isCatalogView ? onCatalogCategoryClick : undefined}
          />
        </div>
      )}
    </div>
  )
}

