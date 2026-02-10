"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Loader2, Search, SlidersHorizontal, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { getWorkGallery } from "@/lib/api/gallery"
import { getCategoriesByType } from "@/lib/api/categories"
import type { Media, Category } from "@/lib/api/types"
import { GalleryCard } from "@/components/gallery/gallery-card"
import { VideoPlayer } from "@/components/shared/video-player"
import { logger } from "@/lib/logger"

export default function GalleryPage() {
  const [gallery, setGallery] = useState<(Media & { master_name?: string; master_profile_id?: number; master_verified?: boolean; master_image_url?: string | null })[]>([])
  const [parentCategories, setParentCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Category[]>([])
  const [allSubcategories, setAllSubcategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState<"all" | "before-after" | "work-video">("all")
  const [parentCategory, setParentCategory] = useState<string>("all")
  const [subcategory, setSubcategory] = useState<string>("all") // Can be "all" or category ID as string
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedVideo, setSelectedVideo] = useState<Media | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const mediaQuery = window.matchMedia("(min-width: 768px)")
    const applyMatches = (matches: boolean) => {
      setIsDesktop(matches)
      setFiltersOpen(false)
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

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filter, parentCategory, subcategory])

  // Filter subcategories based on selected parent category
  useEffect(() => {
    if (parentCategory === "all") {
      setSubcategories(allSubcategories)
    } else {
      const filtered = allSubcategories.filter(
        (cat) => cat.parent_id && cat.parent_id === parseInt(parentCategory)
      )
      setSubcategories(filtered)
      // Reset subcategory selection if current selection is not in filtered list
      // Note: subcategory is also reset in onValueChange handler, this is a safety check
      setSubcategory((current) => {
        if (current !== "all" && !filtered.find((cat) => cat.id.toString() === current)) {
          return "all"
        }
        return current
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentCategory, allSubcategories])

  useEffect(() => {
    loadGallery()
  }, [page, filter, parentCategory, subcategory])

  const loadCategories = async () => {
    try {
      setCategoriesLoading(true)
      // Gallery uses master categories
      const data = await getCategoriesByType("master", { activeOnly: true, rootOnly: false })
      const parents = data.filter((category) => !category.parent_id)
      const subs = data.filter((category) => category.parent_id)
      setParentCategories(parents)
      setAllSubcategories(subs)
      setSubcategories(subs)
    } catch (error: any) {
      logger.error("Failed to load categories:", error)
      setParentCategories([])
      setAllSubcategories([])
      setSubcategories([])
    } finally {
      setCategoriesLoading(false)
    }
  }

  const loadGallery = async () => {
    try {
      setLoading(true)
      const categoryId = subcategory !== "all" ? parseInt(subcategory) : undefined
      const response = await getWorkGallery({
        page,
        page_size: 24,
        // All media is now automatically approved
        show_before_after_only: filter === "before-after",
        videos_only: filter === "work-video",
        category_id: categoryId,
      })
      setGallery(response.items || [])
      setTotalPages(response.total_pages || 1)
    } catch (error: any) {
      logger.error("Failed to load gallery:", error)
      setGallery([])
    } finally {
      setLoading(false)
    }
  }

  const getItemHref = (item: Media & { master_profile_id?: number }) => {
    if (item.master_profile_id) {
      return `/detailed/master/${item.master_profile_id}`
    }
    return "#"
  }

  const handleVideoClick = (item: Media) => {
    setSelectedVideo(item)
  }

  const handleResetFilters = () => {
    setFilter("all")
    setParentCategory("all")
    setSubcategory("all")
    setSearchQuery("")
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Header */}
      <div className="relative bg-white overflow-hidden">
        <div className="container mx-auto px-sides py-10 sm:py-12 md:py-16 relative z-10">
          <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Arbeitsgalerie
                </span>
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground/90 max-w-2xl mx-auto">
                Sehen Sie echte Ergebnisse von unseren vertrauenswürdigen Meistern
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters - Full width */}
      <div className="container mx-auto px-sides pb-6">
        <div className="w-full space-y-4">
          {isDesktop ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="flex-1">
                <CollapsibleContent>
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:flex-nowrap">
                    {/* Category Filter */}
                    <div className="flex min-w-[180px] flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">Category</span>
                      <Select 
                        value={parentCategory} 
                        onValueChange={(value) => {
                          setParentCategory(value)
                          setSubcategory("all")
                        }} 
                        disabled={categoriesLoading}
                      >
                        <SelectTrigger className="h-10 w-full rounded-sm border border-border/60 bg-white text-sm focus:ring-0 focus:ring-offset-0 transition-colors hover:border-primary hover:bg-white hover:text-foreground focus-visible:border-border/60 focus-visible:ring-0 focus-visible:ring-offset-0">
                          <SelectValue placeholder={categoriesLoading ? "Lädt..." : "Alle"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-sm border border-border/60">
                          <SelectItem value="all">Alle</SelectItem>
                          {parentCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Subcategory Filter */}
                    <div className="flex min-w-[180px] flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">Unterkategorie</span>
                      <Select 
                        value={subcategory} 
                        onValueChange={setSubcategory} 
                        disabled={categoriesLoading || parentCategory === "all"}
                      >
                        <SelectTrigger className="h-10 w-full rounded-sm border border-border/60 bg-white text-sm focus:ring-0 focus:ring-offset-0 transition-colors hover:border-primary hover:bg-white hover:text-foreground focus-visible:border-border/60 focus-visible:ring-0 focus-visible:ring-offset-0">
                          <SelectValue placeholder={categoriesLoading ? "Lädt..." : parentCategory === "all" ? "Zuerst Kategorie auswählen" : "Alle"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-sm border border-border/60">
                          <SelectItem value="all">Alle</SelectItem>
                          {subcategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Type Filter */}
                    <div className="flex min-w-[180px] flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">Type</span>
                      <Select 
                        value={filter} 
                        onValueChange={(v) => setFilter(v as typeof filter)}
                      >
                        <SelectTrigger className="h-10 w-full rounded-sm border border-border/60 bg-white text-sm focus:ring-0 focus:ring-offset-0 transition-colors hover:border-primary hover:bg-white hover:text-foreground focus-visible:border-border/60 focus-visible:ring-0 focus-visible:ring-offset-0">
                          <SelectValue placeholder="Alle" />
                        </SelectTrigger>
                        <SelectContent className="rounded-sm border border-border/60">
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="before-after">Vorher/Nachher</SelectItem>
                          <SelectItem value="work-video">Arbeitsvideo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Search */}
                    <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">Suchen</span>
                      <div className="relative">
                        <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                          <Search className="h-3.5 w-3.5" />
                        </div>
                        <Input
                          type="text"
                          placeholder="Suchen..."
                          className="pl-11 h-10 rounded-sm border border-border/60 bg-white text-sm focus:ring-0 focus:ring-offset-0 transition-colors hover:border-primary focus-visible:border-border/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Action buttons - right aligned */}
              <div className="flex items-center gap-2 min-h-[58px] md:items-end md:shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 inline-flex items-center gap-2 rounded-sm border border-border/60 bg-white px-4 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  aria-expanded={filtersOpen}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {filtersOpen ? "Filter ausblenden" : "Filter anzeigen"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 inline-flex items-center gap-2 rounded-sm border border-border/60 bg-white px-4 text-sm font-medium transition-all hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive focus-visible:border-destructive/50 focus-visible:ring-2 focus-visible:ring-destructive/20"
                  onClick={handleResetFilters}
                >
                  <RotateCcw className="h-4 w-4" />
                  Filter zurücksetzen
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                <SheetContent side="bottom" className="w-full p-0 flex flex-col rounded-t-sm">
                  <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60">
                    <SheetTitle className="text-lg font-semibold">Filter</SheetTitle>
                    <SheetDescription className="text-sm text-muted-foreground mt-1">
                      Galerieergebnisse verfeinern
                    </SheetDescription>
                  </SheetHeader>
                  <div className="px-6 py-4 space-y-6 overflow-y-auto flex-1">
                    <div className="flex flex-col gap-6">
                      {/* Category Filter */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-foreground">Kategorie</label>
                        <Select 
                          value={parentCategory} 
                          onValueChange={(value) => {
                            setParentCategory(value)
                            setSubcategory("all")
                          }} 
                          disabled={categoriesLoading}
                        >
                          <SelectTrigger className="h-10 w-full rounded-sm border border-border/60 bg-white text-sm">
                            <SelectValue placeholder={categoriesLoading ? "Lädt..." : "Alle"} />
                          </SelectTrigger>
                          <SelectContent className="rounded-sm border border-border/60">
                            <SelectItem value="all">Alle</SelectItem>
                            {parentCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id.toString()}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Subcategory Filter */}
                      <div className="flex flex-col gap-2 border-t border-border/40 pt-6">
                        <label className="text-sm font-semibold text-foreground">Unterkategorie</label>
                        <Select 
                          value={subcategory} 
                          onValueChange={setSubcategory} 
                          disabled={categoriesLoading || parentCategory === "all"}
                        >
                          <SelectTrigger className="h-10 w-full rounded-sm border border-border/60 bg-white text-sm">
                            <SelectValue placeholder={categoriesLoading ? "Lädt..." : parentCategory === "all" ? "Zuerst Kategorie auswählen" : "Alle"} />
                          </SelectTrigger>
                          <SelectContent className="rounded-sm border border-border/60">
                            <SelectItem value="all">Alle</SelectItem>
                            {subcategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id.toString()}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Type Filter */}
                      <div className="flex flex-col gap-2 border-t border-border/40 pt-6">
                        <label className="text-sm font-semibold text-foreground">Typ</label>
                        <Select 
                          value={filter} 
                          onValueChange={(v) => setFilter(v as typeof filter)}
                        >
                          <SelectTrigger className="h-10 w-full rounded-sm border border-border/60 bg-white text-sm">
                            <SelectValue placeholder="Alle" />
                          </SelectTrigger>
                          <SelectContent className="rounded-sm border border-border/60">
                            <SelectItem value="all">Alle</SelectItem>
                            <SelectItem value="before-after">Vorher/Nachher</SelectItem>
                            <SelectItem value="work-video">Arbeitsvideo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Search */}
                      <div className="flex flex-col gap-2 border-t border-border/40 pt-6">
                        <label className="text-sm font-semibold text-foreground">Suchen</label>
                        <div className="relative">
                          <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                            <Search className="h-3.5 w-3.5" />
                          </div>
                          <Input
                            type="text"
                            placeholder="Suchen..."
                            className="pl-11 h-10 rounded-sm border border-border/60 bg-white text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-border/60 bg-muted/30 px-6 py-4 mt-auto">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 h-10"
                        onClick={handleResetFilters}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Zurücksetzen
                      </Button>
                      <Button
                        className="flex-1 h-10"
                        onClick={() => setFiltersOpen(false)}
                      >
                        Filter anwenden
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Mobile: Always visible action buttons */}
              <div className="flex items-center gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 inline-flex items-center gap-2 rounded-sm border border-border/60 bg-white px-4 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  aria-expanded={filtersOpen}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {filtersOpen ? "Filter ausblenden" : "Filter anzeigen"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 inline-flex items-center gap-2 rounded-sm border border-border/60 bg-white px-4 text-sm font-medium transition-all hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive focus-visible:border-destructive/50 focus-visible:ring-2 focus-visible:ring-destructive/20"
                  onClick={handleResetFilters}
                >
                  <RotateCcw className="h-4 w-4" />
                  Filter zurücksetzen
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gallery Content */}
      <div className="container mx-auto px-sides py-8 sm:py-10 md:py-12">

        {/* Gallery Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-10 sm:py-12">
            <Loader2 className="h-7 w-7 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
          </div>
        ) : gallery.length === 0 ? (
          <div className="text-center py-10 sm:py-12 text-muted-foreground">
            <p className="text-sm sm:text-base">Keine Arbeitsgalerie-Artikel gefunden</p>
            <p className="text-xs sm:text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {gallery
                .filter((item) => {
                  if (!searchQuery) return true
                  const query = searchQuery.toLowerCase()
                  return (
                    item.title?.toLowerCase().includes(query) ||
                    item.master_name?.toLowerCase().includes(query) ||
                    item.category?.toLowerCase().includes(query)
                  )
                })
                .map((item) => (
                  <GalleryCard
                    key={item.id}
                    item={item}
                    href={getItemHref(item)}
                    onVideoClick={item.media_type === "video" ? handleVideoClick : undefined}
                  />
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          if (page > 1 && !loading) {
                            setPage((prev) => Math.max(1, prev - 1))
                          }
                        }}
                        aria-disabled={page === 1 || loading}
                        className={cn({ 'pointer-events-none opacity-50': page === 1 || loading })}
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
                              if (pageNumber !== page && !loading) {
                                setPage(pageNumber)
                              }
                            }}
                            className={cn({ 'pointer-events-none opacity-50': loading })}
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
                          if (page < totalPages && !loading) {
                            setPage((prev) => Math.min(totalPages, prev + 1))
                          }
                        }}
                        aria-disabled={page >= totalPages || loading}
                        className={cn({ 'pointer-events-none opacity-50': page >= totalPages || loading })}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayer
          videoUrl={selectedVideo.url || ""}
          thumbnailUrl={selectedVideo.thumbnail_url || undefined}
          title={selectedVideo.title || undefined}
          isOpen={true}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  )
}

