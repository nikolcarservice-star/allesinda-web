"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CategoryTree, CategoryType } from "@/lib/api"
import { Button } from "@/components/ui/button"

interface SubcategorySectionProps {
  selectedCategory: CategoryTree
  selectedNavType: CategoryType
  isTransitioning: boolean
  selectedCategoryIndex?: number
  totalCategories?: number
  isCatalogView?: boolean
  allCategories?: CategoryTree[]
  onCategoryClick?: (category: CategoryTree) => void
  onClose?: () => void
}

export function SubcategorySection({
  selectedCategory,
  selectedNavType,
  isTransitioning,
  selectedCategoryIndex,
  totalCategories,
  isCatalogView = false,
  allCategories = [],
  onCategoryClick,
  onClose,
}: SubcategorySectionProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const [trianglePosition, setTrianglePosition] = useState<number | null>(null)
  
  // Get current selected subcategory from URL
  const currentCategoryParam = searchParams?.get("category")

  useEffect(() => {
    // Calculate triangle position based on selected category
    const calculatePosition = () => {
      if (selectedCategoryIndex === undefined || !totalCategories || !containerRef.current) {
        setTrianglePosition(null)
        return
      }

      // Find the selected category element in the DOM
      const categoryElements = document.querySelectorAll('[data-category-item]')
      const selectedElement = Array.from(categoryElements).find(
        (el) => el.getAttribute('data-category-id') === String(selectedCategory.id)
      ) as HTMLElement | undefined

      const subcategoryContainer = containerRef.current
      
      if (selectedElement && subcategoryContainer) {
        // Get positions relative to viewport
        const elementRect = selectedElement.getBoundingClientRect()
        const containerRect = subcategoryContainer.getBoundingClientRect()
        
        // Calculate the center X of the selected category
        const elementCenterX = elementRect.left + elementRect.width / 2
        
        // Calculate position relative to subcategory container's left edge
        const relativePosition = elementCenterX - containerRect.left
        
        // Only set if position is valid and within container bounds
        if (relativePosition >= 0 && relativePosition <= containerRect.width) {
          setTrianglePosition(relativePosition)
        } else {
          // If outside bounds, try to find category section and align centers
          const categorySection = selectedElement.closest('[role="region"][aria-label="Category carousel"]') as HTMLElement
          if (categorySection) {
            const categoryRect = categorySection.getBoundingClientRect()
            const categoryCenterX = categoryRect.left + categoryRect.width / 2
            const subcategoryCenterX = containerRect.left + containerRect.width / 2
            
            // Calculate offset from category center
            const offsetFromCategoryCenter = elementCenterX - categoryCenterX
            const alignedPosition = containerRect.width / 2 + offsetFromCategoryCenter
            
            if (alignedPosition >= 0 && alignedPosition <= containerRect.width) {
              setTrianglePosition(alignedPosition)
            } else {
              setTrianglePosition(containerRect.width / 2) // Center as fallback
            }
          } else {
            setTrianglePosition(containerRect.width / 2) // Center as fallback
          }
        }
      } else {
        // Fallback: center position
        if (subcategoryContainer && subcategoryContainer.offsetWidth > 0) {
          setTrianglePosition(subcategoryContainer.offsetWidth / 2)
        } else {
          // Even if container not ready, set a default to show triangle
          setTrianglePosition(null)
        }
      }
    }

    // Calculate with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      calculatePosition()
    }, 150)

    // Recalculate on resize and scroll
    window.addEventListener('resize', calculatePosition)
    window.addEventListener('scroll', calculatePosition, true)
    
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', calculatePosition)
      window.removeEventListener('scroll', calculatePosition, true)
    }
  }, [selectedCategoryIndex, totalCategories, selectedCategory.id])

  // For catalog view, use allCategories, otherwise check selectedCategory.children
  const displayCategories = isCatalogView && allCategories.length > 0 
    ? allCategories 
    : selectedCategory.children

  if (!displayCategories || displayCategories.length === 0) {
    return null
  }

  const handleSubcategoryClick = (subcategory: CategoryTree) => {
    const params = new URLSearchParams()
    params.set("types", selectedNavType)
    if (subcategory.slug) {
      params.set("category", subcategory.slug)
    }
    router.push(`/?${params.toString()}`)
  }

  // Calculate total count (if available from subcategories)
  // Note: count property may not exist in CategoryTree type, so we use optional chaining
  const totalCount = displayCategories?.reduce((sum, child) => {
    // If subcategories have count property, sum them up
    return sum + ((child as any).count || 0)
  }, 0) || ((selectedCategory as any).count || 0)

  return (
    <div
      ref={containerRef}
        className={cn(
          "relative transition-all duration-300 ease-in-out w-full",
          "bg-gray-100 rounded-none",
          "px-2 sm:px-2.5 md:px-3 lg:px-4",
          "py-1.5 sm:py-2 md:py-2.5",
          "pt-2.5 sm:pt-3 md:pt-3.5", // Extra top padding for triangle
          isTransitioning
            ? "opacity-0 translate-y-4"
            : "opacity-100 translate-y-0"
        )}
      key={`subcategories-${selectedCategory.id}`}
    >
      {/* Close button - positioned at top right */}
      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className={cn(
            "absolute top-1 right-1 sm:top-1.5 sm:right-1.5 md:top-2 md:right-2",
            "h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8",
            "p-0 rounded-full",
            "bg-white/80 hover:bg-white",
            "border border-border/40 hover:border-primary/60",
            "shadow-sm hover:shadow-md",
            "transition-all duration-200",
            "z-20",
            "flex items-center justify-center"
          )}
          aria-label="Close subcategory panel"
        >
          <X className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-muted-foreground hover:text-primary transition-colors" />
        </Button>
      )}
      
      {/* Triangle indicator pointing to selected category */}
      <div
        className="absolute -top-3 z-10 pointer-events-none"
        style={{
          left: trianglePosition !== null && trianglePosition > 0 ? `${trianglePosition}px` : '50%',
          transform: 'translateX(-50%)',
        }}
      >
        {/* Triangle pointing upward to selected category */}
        <div className="relative">
          {/* Main triangle matching panel background */}
          <div className="relative w-0 h-0 border-l-[12px] border-r-[12px] border-b-[12px] border-l-transparent border-r-transparent border-b-gray-100" />
        </div>
      </div>

      {/* Catalog view: Multi-column layout showing all categories with subcategories */}
      {isCatalogView ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5 md:gap-3">
          {displayCategories.map((category) => {
            const categoryCount = (category as any).count || 0
            const subcategories = category.children || []
            
            return (
              <div key={category.id} className="space-y-1.5 sm:space-y-2">
                {/* Category header - styled as a distinct card */}
                <button
                  type="button"
                  onClick={() => {
                    if (onCategoryClick) {
                      onCategoryClick(category)
                    }
                  }}
                  className="w-full px-2.5 py-2 rounded-md border border-primary/40 bg-primary/8 hover:bg-primary/12 hover:border-primary/60 transition-all duration-200 group"
                >
                  <h4 className="text-xs sm:text-sm font-bold text-primary text-center">
                    {category.name}
                    {categoryCount > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {categoryCount.toLocaleString()}
                      </span>
                    )}
                  </h4>
                </button>
                
                {/* Subcategories list - styled as cards like regular subcategories */}
                {subcategories.length > 0 && (
                  <div className="grid grid-cols-1 gap-1 sm:gap-1.5">
                    {subcategories.map((subcategory) => {
                      const subcategoryCount = (subcategory as any).count || 0
                      const isSubcategorySelected = currentCategoryParam === subcategory.slug
                      
                      return (
                        <button
                          key={subcategory.id}
                          type="button"
                          onClick={() => handleSubcategoryClick(subcategory)}
                          className={cn(
                            "text-center px-1.5 sm:px-2.5 py-1.5 sm:py-2",
                            "rounded-sm border transition-all duration-200",
                            "group relative",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1",
                            // Selected state - match category style
                            isSubcategorySelected
                              ? "border-primary shadow-md"
                              : "border-border/40 bg-white hover:border-primary/60 hover:shadow-md hover:bg-primary/5"
                          )}
                        >
                          <div className="flex flex-col gap-0.5 items-center w-full">
                            <span className={cn(
                              "text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap sm:whitespace-normal sm:line-clamp-2 relative",
                              isSubcategorySelected
                                ? "text-primary"
                                : "text-foreground/90 group-hover:text-primary"
                            )}>
                              {subcategory.name}
                              {!isSubcategorySelected && (
                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
                              )}
                            </span>
                            {isSubcategorySelected && (
                              <div className="h-1 w-8 sm:w-10 mx-auto bg-primary rounded-sm" />
                            )}
                            {subcategoryCount > 0 && (
                              <span className={cn(
                                "text-xs transition-colors font-medium",
                                isSubcategorySelected
                                  ? "text-primary/70"
                                  : "text-muted-foreground group-hover:text-primary/70"
                              )}>
                                {subcategoryCount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Regular subcategory carousel/grid */
        <div className={cn(
          "flex gap-1.5 sm:gap-2",
          // On small screens: horizontal scrolling carousel
          "flex-nowrap overflow-x-auto overflow-y-visible",
          "scrollbar-hide snap-x snap-mandatory",
          "px-1 sm:px-2",
          "py-1 sm:py-1.5",
          // On large screens: grid layout
          "sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          "sm:overflow-visible sm:snap-none sm:px-0 sm:py-0"
        )}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y pinch-zoom",
          overscrollBehaviorY: "auto",
          overscrollBehaviorX: "contain",
        }}
        >
          {displayCategories.map((subcategory) => {
            const subcategoryCount = (subcategory as any).count || 0
            const isSelected = currentCategoryParam === subcategory.slug
            
            return (
              <button
                key={subcategory.id}
                type="button"
                onClick={() => handleSubcategoryClick(subcategory)}
                className={cn(
                  "text-center px-1.5 sm:px-2.5 py-1.5 sm:py-2",
                  "rounded-sm border transition-all duration-200",
                  "group relative",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1",
                  // On small screens: carousel items with auto width
                  "flex-shrink-0 snap-center",
                  "min-w-fit whitespace-nowrap", // Auto width based on content, no wrapping
                  // On large screens: grid items
                  "sm:min-w-0 sm:w-full sm:whitespace-normal",
                  // Selected state - match category style
                  isSelected
                    ? "border-primary shadow-md"
                    : "border-border/40 bg-white hover:border-primary/60 hover:shadow-md hover:bg-primary/5"
                )}
              >
                <div className="flex flex-col gap-0.5 items-center w-full">
                  <span className={cn(
                    "text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap sm:whitespace-normal sm:line-clamp-2 relative",
                    isSelected
                      ? "text-primary"
                      : "text-foreground/90 group-hover:text-primary"
                  )}>
                    {subcategory.name}
                    {!isSelected && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
                    )}
                  </span>
                  {isSelected && (
                    <div className="h-1 w-8 sm:w-10 mx-auto bg-primary rounded-sm" />
                  )}
                  {subcategoryCount > 0 && (
                    <span className={cn(
                      "text-xs transition-colors font-medium",
                      isSelected
                        ? "text-primary/70"
                        : "text-muted-foreground group-hover:text-primary/70"
                    )}>
                      {subcategoryCount.toLocaleString()}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

