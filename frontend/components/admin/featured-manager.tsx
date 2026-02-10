"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Loader2, RefreshCw, Trash2, Search, Edit, Eye, Star, Check, X, AlertCircle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { AdminPreviewSidebar } from "@/components/admin/admin-preview-sidebar"
import {
  deleteFeaturedSelection,
  getFeaturedSelections,
  updateFeaturedSelection,
  upsertFeaturedSelection,
  previewMaster,
  previewProduct,
  previewRental,
} from "@/lib/api/admin"
import { searchMasters, searchProducts, searchRentals } from "@/lib/api/search"
import { getCategoriesByType } from "@/lib/api/categories"
import type { CategoryType, FeaturedItem, FeaturedSelection, Profile, Product, Rental, Category } from "@/lib/api/types"
import { getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"

const TYPE_LABEL: Record<CategoryType, string> = {
  master: "Master",
  product: "Product",
  rental: "Rental",
}

function getItemLocation(item?: FeaturedItem | null) {
  if (!item) return "—"
  return item.city_name && item.city_name.trim().length > 0 ? item.city_name : "—"
}

function getItemLocationFromAny(item: Profile | Product | Rental): string {
  const cityName = (item as any).city_name as string | undefined
  return cityName && cityName.trim().length > 0 ? cityName : "—"
}

export function FeaturedManager() {
  const [selections, setSelections] = useState<FeaturedSelection[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<CategoryType>("master")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all")
  const [featuredFilter, setFeaturedFilter] = useState<"all" | "featured" | "normal">("all")
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Category[]>([])
  const [items, setItems] = useState<{
    masters: Profile[];
    products: Product[];
    rentals: Rental[];
  }>({ masters: [], products: [], rentals: [] })
  const [loadingItems, setLoadingItems] = useState(false)
  const [editingPriority, setEditingPriority] = useState<{ itemId: number; priority: number; originalPriority: number } | null>(null)
  const [viewSheet, setViewSheet] = useState<{
    open: boolean;
    itemId: number | null;
    itemType: CategoryType | null;
    loading: boolean;
    data: any | null;
  }>({ open: false, itemId: null, itemType: null, loading: false, data: null })

  const loadSelections = async () => {
    try {
      setRefreshing(true)
      // Backend limits page_size to max 100
      const response = await getFeaturedSelections({ page: 1, page_size: 100 })
      setSelections(response.items ?? [])
    } catch (error: any) {
      console.error("Failed to load featured selections:", error)
      // Only show error toast for non-404/401/500 errors
      const errorStatus = error?.statusCode || error?.status
      if (errorStatus && errorStatus !== 404 && errorStatus !== 401 && errorStatus !== 500) {
      toast.error(error?.message || "Failed to load featured selections")
      }
      setSelections([])
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  const loadCategories = async (type: CategoryType) => {
    try {
      const cats = await getCategoriesByType(type, { activeOnly: true, rootOnly: true })
      setCategories(cats)
      setSubcategories([])
      setCategoryFilter("all")
      setSubcategoryFilter("all")
    } catch (error: any) {
      console.error("Failed to load categories:", error)
      setCategories([])
    }
  }

  const loadSubcategories = async (categoryId: number) => {
    try {
      const subs = await getCategoriesByType(typeFilter, { activeOnly: true, parentId: categoryId })
      setSubcategories(subs)
      setSubcategoryFilter("all")
    } catch (error: any) {
      console.error("Failed to load subcategories:", error)
      setSubcategories([])
    }
  }

  const loadItems = async () => {
    try {
      setLoadingItems(true)
      setLoading(true)
      const searchParams: any = { page: 1, page_size: 100 }
      
      // Convert category slugs to IDs for API call
      if (subcategoryFilter !== "all" && subcategoryFilter) {
        const foundSubcategory = subcategories.find(sub => sub.slug === subcategoryFilter)
        if (foundSubcategory) {
          searchParams.category_id = foundSubcategory.id
        } else {
          // Fallback: try parsing as ID (numeric string)
          const parsedId = parseInt(subcategoryFilter)
          if (!isNaN(parsedId)) {
            searchParams.category_id = parsedId
          }
        }
      } else if (categoryFilter !== "all" && categoryFilter) {
        const foundCategory = categories.find(cat => cat.slug === categoryFilter)
        if (foundCategory) {
          searchParams.category_id = foundCategory.id
        } else {
          // Fallback: try parsing as ID (numeric string)
          const parsedId = parseInt(categoryFilter)
          if (!isNaN(parsedId)) {
            searchParams.category_id = parsedId
          }
        }
      }
      
      if (searchQuery.trim()) {
        searchParams.q = searchQuery.trim()
      }

      const [mastersRes, productsRes, rentalsRes] = await Promise.all([
        typeFilter === "master" ? searchMasters(searchParams) : Promise.resolve({ items: [], total: 0, page: 1, page_size: 100, total_pages: 0 }),
        typeFilter === "product" ? searchProducts(searchParams) : Promise.resolve({ items: [], total: 0, page: 1, page_size: 100, total_pages: 0 }),
        typeFilter === "rental" ? searchRentals(searchParams) : Promise.resolve({ items: [], total: 0, page: 1, page_size: 100, total_pages: 0 }),
      ])
      
      setItems({
        masters: mastersRes.items || [],
        products: productsRes.items || [],
        rentals: rentalsRes.items || [],
      })
    } catch (error: any) {
      console.error("Failed to load items:", error)
      toast.error("Failed to load items")
    } finally {
      setLoadingItems(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSelections()
  }, [])

  useEffect(() => {
    if (typeFilter) {
      loadCategories(typeFilter)
    }
  }, [typeFilter])

  useEffect(() => {
    if (categoryFilter !== "all" && categoryFilter) {
      loadSubcategories(Number.parseInt(categoryFilter, 10))
    } else {
      setSubcategories([])
      setSubcategoryFilter("all")
    }
  }, [categoryFilter, typeFilter])

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, categoryFilter, subcategoryFilter, searchQuery])

  const handleToggleFeatured = async (itemId: number, isFeatured: boolean) => {
    try {
      if (isFeatured) {
        // Remove from featured
        const selection = selections.find(s => s.item_type === typeFilter && s.item_id === itemId)
        if (selection) {
          await deleteFeaturedSelection(selection.id)
          setSelections(prev => prev.filter(s => s.id !== selection.id))
          toast.success("Removed from featured")
        }
      } else {
        // Add to featured
      await upsertFeaturedSelection({
          item_type: typeFilter,
        item_id: itemId,
          priority: 0,
          is_active: true,
        })
        await loadSelections()
        toast.success("Added to featured")
      }
    } catch (error: any) {
      console.error("Failed to update featured status:", error)
      toast.error(error?.message || "Failed to update featured status")
    }
  }

  const handlePriorityChange = async (itemId: number, priority: number) => {
    try {
      const selection = selections.find(s => s.item_type === typeFilter && s.item_id === itemId)
      if (selection) {
      await updateFeaturedSelection(selection.id, { priority })
      setSelections((prev) =>
        prev
          .map((item) => (item.id === selection.id ? { ...item, priority } : item))
      )
        setEditingPriority(null)
      toast.success("Priority updated")
      }
    } catch (error: any) {
      console.error("Failed to update priority:", error)
      toast.error(error?.message || "Failed to update priority")
    }
  }

  const handlePrioritySave = (itemId: number) => {
    if (editingPriority && editingPriority.itemId === itemId) {
      handlePriorityChange(itemId, editingPriority.priority)
    }
  }

  const handlePriorityCancel = (itemId: number) => {
    if (editingPriority && editingPriority.itemId === itemId) {
      const selection = selections.find(s => s.item_type === typeFilter && s.item_id === itemId)
      if (selection) {
        setSelections((prev) =>
          prev.map((s) =>
            s.id === selection.id ? { ...s, priority: editingPriority.originalPriority } : s
          )
        )
      }
      setEditingPriority(null)
    }
  }

  const getCurrentItems = () => {
    if (typeFilter === "master") return items.masters
    if (typeFilter === "product") return items.products
    return items.rentals
  }

  const isItemFeatured = (itemId: number): boolean => {
    return selections.some(s => s.item_type === typeFilter && s.item_id === itemId && s.is_active)
  }

  const getItemFeaturedSelection = (itemId: number): FeaturedSelection | undefined => {
    return selections.find(s => s.item_type === typeFilter && s.item_id === itemId && s.is_active)
  }

  const handleViewDetails = async (itemId: number) => {
    setViewSheet({ open: true, itemId, itemType: typeFilter, loading: true, data: null })
    try {
      let previewData
      if (typeFilter === "master") {
        previewData = await previewMaster(itemId)
      } else if (typeFilter === "product") {
        previewData = await previewProduct(itemId)
      } else {
        previewData = await previewRental(itemId)
      }
      setViewSheet({ open: true, itemId, itemType: typeFilter, loading: false, data: previewData })
    } catch (error: any) {
      console.error("Failed to load preview:", error)
      toast.error(error.message || "Failed to load preview")
      setViewSheet({ open: false, itemId: null, itemType: null, loading: false, data: null })
    }
  }

  const clearFilters = () => {
    setTypeFilter("master")
    setCategoryFilter("all")
    setSubcategoryFilter("all")
    setFeaturedFilter("all")
    setSearchQuery("")
  }

  const hasActiveFilters = useMemo(() => {
    return (
      typeFilter !== "master" ||
      categoryFilter !== "all" ||
      subcategoryFilter !== "all" ||
      featuredFilter !== "all" ||
      searchQuery.trim() !== ""
    )
  }, [typeFilter, categoryFilter, subcategoryFilter, featuredFilter, searchQuery])

  const filteredItems = useMemo(() => {
    const currentItems = getCurrentItems()
    let filtered: Profile[] | Product[] | Rental[]
    
    // Filter by featured status
    if (featuredFilter === "featured") {
      filtered = currentItems.filter(item => isItemFeatured(item.id)) as typeof currentItems
    } else if (featuredFilter === "normal") {
      filtered = currentItems.filter(item => !isItemFeatured(item.id)) as typeof currentItems
    } else {
      filtered = currentItems
    }
    
    return filtered
  }, [items, typeFilter, featuredFilter, selections])

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
          <CardTitle className="text-base sm:text-lg font-semibold">Empfohlene Artikel</CardTitle>
            <p className="text-xs text-muted-foreground">Empfohlene Artikel für Startseite und Empfohlenseiten kuratieren und verwalten</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => { loadSelections(); loadItems(); }}
            disabled={refreshing || loadingItems}
            aria-label="Aktualisieren"
          >
            {refreshing || loadingItems ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
        
        {/* Filters */}
        {/* Mobile: Accordion */}
        <div className="block lg:hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="filters" className="border border-border/40 rounded-sm">
              <AccordionTrigger className="py-2 px-2 hover:no-underline">
                <h4 className="text-xs font-medium">Filter</h4>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-3 px-2">
                <div className="space-y-3">
                  {/* Item Type and Featured in one row */}
                  <div className="flex flex-row gap-2">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs text-muted-foreground font-medium">Artikeltyp</label>
                      <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as CategoryType)}>
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Artikeltyp" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="master">Meister</SelectItem>
                          <SelectItem value="product">Produkt</SelectItem>
                          <SelectItem value="rental">Verleih</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs text-muted-foreground font-medium">Empfohlen</label>
                      <Select value={featuredFilter} onValueChange={(v) => setFeaturedFilter(v as typeof featuredFilter)}>
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Empfohlen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="featured">Empfohlen</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Category */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Kategorie</label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={categories.length === 0}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Kategorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.slug}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Subcategory */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Unterkategorie</label>
                    <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter} disabled={subcategories.length === 0 || categoryFilter === "all"}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Unterkategorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle</SelectItem>
                        {subcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.slug}>
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Search */}
                  <div className="relative flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Suchen</label>
                    <div className="relative">
                      <div className="flex items-center justify-center w-7 h-7 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                        <Search className="h-3.5 w-3.5" />
                      </div>
                      <Input
                        type="text"
                        placeholder="Artikel suchen..."
                        className="pl-11 h-8 text-xs rounded-sm border border-border/40 focus:border-primary shadow-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && loadItems()}
                      />
                    </div>
                  </div>
                  
                  {/* Clear Button */}
                  {hasActiveFilters && (
                    <div className="flex flex-col gap-1.5 justify-end items-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-8 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Zurücksetzen
                      </Button>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        
        {/* Desktop: All filters in one row */}
        <div className="hidden lg:flex flex-row gap-2 items-end">
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Empfohlen</label>
            <Select value={featuredFilter} onValueChange={(v) => setFeaturedFilter(v as typeof featuredFilter)}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Empfohlen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="featured">Empfohlen</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Artikeltyp</label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as CategoryType)}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Artikeltyp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="master">Meister</SelectItem>
                <SelectItem value="product">Produkt</SelectItem>
                <SelectItem value="rental">Verleih</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Kategorie</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={categories.length === 0}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Unterkategorie</label>
            <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter} disabled={subcategories.length === 0 || categoryFilter === "all"}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Unterkategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {subcategories.map((sub) => (
                  <SelectItem key={sub.id} value={sub.slug}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Suchen</label>
            <div className="relative">
              <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <Input
                type="text"
                placeholder="Artikel suchen..."
                className="pl-11 sm:pl-12 h-8 sm:h-9 text-xs sm:text-sm rounded-sm border border-border/40 focus:border-primary shadow-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadItems()}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex flex-col gap-1.5 justify-end items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 sm:h-9 text-xs sm:text-sm"
              >
                <X className="h-3 w-3 mr-1" />
                Zurücksetzen
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-3 sm:pt-0 sm:pb-4">
        {loading || loadingItems ? (
          <div className="flex items-center justify-center py-8 sm:py-10 px-3 sm:px-4">
            <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 sm:py-10 text-muted-foreground px-3 sm:px-4">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className="text-xs sm:text-sm">Keine Artikel gefunden</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-2 px-3">
              {filteredItems.map((item) => {
                const isFeatured = isItemFeatured(item.id)
                const selection = getItemFeaturedSelection(item.id)
                const itemTitle = typeFilter === "master" ? (item as Profile).user_name || "Master" : (item as Product | Rental).title
                const itemImage = item.image_url
                const itemLocation = getItemLocationFromAny(item)
                
                return (
                  <Card key={item.id} className="border border-border/40 p-2">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        {itemImage ? (
                          <div className="relative h-12 w-12 rounded-none overflow-hidden shrink-0 bg-muted/30">
                            <Image
                              src={getOptimizedImageUrl(itemImage, 'card')}
                              unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(itemImage, 'card'))}
                              alt={itemTitle}
                              fill
                              sizes="48px"
                              className="object-cover"
            />
          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-none bg-muted/20 flex items-center justify-center text-xs text-muted-foreground shrink-0">
                            —
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-xs leading-tight">{itemTitle}</h4>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{itemLocation}</p>
                          <div className="flex items-center justify-between gap-1.5 mt-1">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0.5 font-medium ${
                                isFeatured
                                  ? "border-yellow-500/50 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                                  : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                              }`}
                            >
                              {isFeatured ? (
                                <>
                                  <Star className="h-2.5 w-2.5 mr-0.5 inline fill-current" />
                                  Empfohlen
                                </>
                              ) : (
                                "Normal"
                              )}
                            </Badge>
                            {isFeatured && selection && (
                              <span className="text-[9px] text-muted-foreground ml-auto">Priorität: {selection.priority}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                        {isFeatured && selection ? (
                          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              step={1}
                        value={selection.priority}
                              onFocus={(event) => {
                                const currentSelection = selections.find((s) => s.id === selection.id)
                                if (currentSelection && (!editingPriority || editingPriority.itemId !== item.id)) {
                                  setEditingPriority({
                                    itemId: item.id,
                                    priority: currentSelection.priority,
                                    originalPriority: currentSelection.priority
                                  })
                                }
                              }}
                        onChange={(event) => {
                          const nextValue = Number.parseInt(event.target.value, 10)
                          if (!Number.isNaN(nextValue) && nextValue >= 0) {
                            setSelections((prev) =>
                                    prev.map((s) =>
                                      s.id === selection.id ? { ...s, priority: nextValue } : s
                                    )
                                  )
                                  if (editingPriority && editingPriority.itemId === item.id) {
                                    setEditingPriority({
                                      ...editingPriority,
                                      priority: nextValue
                                    })
                                  }
                                }
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  handlePrioritySave(item.id)
                                } else if (event.key === "Escape") {
                                  event.preventDefault()
                                  handlePriorityCancel(item.id)
                                }
                              }}
                              className="h-7 w-16 text-xs text-center"
                            />
                            {editingPriority && editingPriority.itemId === item.id && (
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handlePrioritySave(item.id)}
                                  title="Speichern"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handlePriorityCancel(item.id)}
                                  title="Abbrechen"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
          </div>
                            )}
            </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Nicht empfohlen</span>
                        )}
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleViewDetails(item.id)}
                            title="Details anzeigen"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 shrink-0 ${isFeatured ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50" : "text-muted-foreground hover:text-primary"}`}
                            onClick={() => handleToggleFeatured(item.id, isFeatured)}
                            title={isFeatured ? "Von Empfohlen entfernen" : "Zu Empfohlen hinzufügen"}
                          >
                            <Star className={`h-3.5 w-3.5 ${isFeatured ? "fill-current" : ""}`} />
            </Button>
          </div>
          </div>
          </div>
                  </Card>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block px-3 sm:px-4">
          <div className="overflow-hidden rounded-sm border border-border/40">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                      <TableHead className="text-xs sm:text-sm h-9 w-16">Bild</TableHead>
                      <TableHead className="text-xs sm:text-sm h-9 min-w-[150px]">Artikel</TableHead>
                      <TableHead className="text-xs sm:text-sm h-9 w-24 text-center">Priorität</TableHead>
                      <TableHead className="text-xs sm:text-sm h-9 w-28 text-center">Empfohlen</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm h-9 w-32">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                    {filteredItems.map((item) => {
                      const isFeatured = isItemFeatured(item.id)
                      const selection = getItemFeaturedSelection(item.id)
                      const itemTitle = typeFilter === "master" ? (item as Profile).user_name || "Master" : (item as Product | Rental).title
                      const itemImage = item.image_url
                      const itemLocation = getItemLocationFromAny(item)
                      
                      return (
                        <TableRow key={item.id} className="h-auto">
                          <TableCell className="py-2">
                            {itemImage ? (
                              <div className="relative h-8 w-8 rounded-none overflow-hidden shrink-0 bg-muted/30">
                            <Image
                                  src={getOptimizedImageUrl(itemImage, 'card')}
                              unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(itemImage, 'card'))}
                                  alt={itemTitle}
                              fill
                                  sizes="32px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                              <div className="h-8 w-8 rounded-none bg-muted/20 flex items-center justify-center text-xs text-muted-foreground shrink-0">
                            —
                          </div>
                        )}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="min-w-0">
                              <p className="font-medium text-xs sm:text-sm truncate">{itemTitle}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">{itemLocation}</p>
                      </div>
                    </TableCell>
                          <TableCell className="py-2">
                            {isFeatured && selection ? (
                              <div className="flex items-center gap-1 justify-center">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={selection.priority}
                                  onFocus={(event) => {
                                    const currentSelection = selections.find((s) => s.id === selection.id)
                                    if (currentSelection && (!editingPriority || editingPriority.itemId !== item.id)) {
                                      setEditingPriority({
                                        itemId: item.id,
                                        priority: currentSelection.priority,
                                        originalPriority: currentSelection.priority
                                      })
                                    }
                                  }}
                        onChange={(event) => {
                          const nextValue = Number.parseInt(event.target.value, 10)
                          if (!Number.isNaN(nextValue) && nextValue >= 0) {
                            setSelections((prev) =>
                                        prev.map((s) =>
                                          s.id === selection.id ? { ...s, priority: nextValue } : s
                                        )
                                      )
                                      if (editingPriority && editingPriority.itemId === item.id) {
                                        setEditingPriority({
                                          ...editingPriority,
                                          priority: nextValue
                                        })
                                      }
                                    }
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault()
                                      handlePrioritySave(item.id)
                                    } else if (event.key === "Escape") {
                                      event.preventDefault()
                                      handlePriorityCancel(item.id)
                                    }
                                  }}
                                  className="h-9 w-20 text-sm text-center"
                                />
                                {editingPriority && editingPriority.itemId === item.id && (
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={() => handlePrioritySave(item.id)}
                                      title="Priorität speichern"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handlePriorityCancel(item.id)}
                                      title="Abbrechen"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                      </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                    </TableCell>
                          <TableCell className="py-2 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 font-medium whitespace-nowrap ${
                                isFeatured
                                  ? "border-yellow-500/50 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                                  : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                              }`}
                            >
                              {isFeatured ? (
                                <>
                                  <Star className="h-3 w-3 mr-1 inline fill-current" />
                                  Empfohlen
                                </>
                              ) : (
                                "Normal"
                              )}
                            </Badge>
                    </TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex items-center justify-end gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => handleViewDetails(item.id)}
                                title="Details anzeigen"
                              >
                                <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                                className={`h-7 w-7 shrink-0 ${isFeatured ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50" : "text-muted-foreground hover:text-primary"}`}
                                onClick={() => handleToggleFeatured(item.id, isFeatured)}
                                title={isFeatured ? "Von Empfohlen entfernen" : "Zu Empfohlen hinzufügen"}
                              >
                                <Star className={`h-3.5 w-3.5 ${isFeatured ? "fill-current" : ""}`} />
                      </Button>
                            </div>
                    </TableCell>
                  </TableRow>
                      )
                    })}
              </TableBody>
            </Table>
          </div>
            </div>
          </>
        )}
      </CardContent>

      {/* View Details Sidebar */}
      <AdminPreviewSidebar
        open={viewSheet.open}
        onOpenChange={(open) => {
          if (!open) {
            setViewSheet({ open: false, itemId: null, itemType: null, loading: false, data: null })
          }
        }}
        type={viewSheet.itemType}
        loading={viewSheet.loading}
        data={viewSheet.data}
      />
    </Card>
  )
}
