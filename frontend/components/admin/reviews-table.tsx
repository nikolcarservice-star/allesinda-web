"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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
import { Search, Trash2, Loader2, AlertCircle, Star, User, X } from "lucide-react"
import { getAllReviews, deleteReview } from "@/lib/api/admin"
import { getCategoriesByType } from "@/lib/api/categories"
import type { CategoryType, Category } from "@/lib/api/types"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale/de"

interface Review {
  id: number;
  order_id: number;
  rating: number;
  text?: string;
  created_at: string;
  buyer_id?: number;
  buyer_name?: string;
  seller_id?: number;
  seller_name?: string;
  order_type?: string;
  order_amount?: number;
  category?: string;
  subcategory?: string;
}

export function ReviewsTable() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [ratingFilter, setRatingFilter] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all")
  const [orderTypeFilter, setOrderTypeFilter] = useState<"all" | "service" | "product" | "rental">("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all")
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Category[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; review: Review | null }>({
    open: false,
    review: null,
  })

  useEffect(() => {
    loadReviews()
  }, [page, ratingFilter, orderTypeFilter])

  useEffect(() => {
    if (orderTypeFilter !== "all") {
      loadCategories(orderTypeFilter as CategoryType)
    } else {
      setCategories([])
      setSubcategories([])
      setCategoryFilter("all")
      setSubcategoryFilter("all")
    }
  }, [orderTypeFilter])

  const loadCategories = async (type: CategoryType) => {
    try {
      // Don't pass rootOnly since it defaults to true in the backend
      const cats = await getCategoriesByType(type, { activeOnly: true })
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
    if (orderTypeFilter === "all") return
    try {
      // Pass parentId to get subcategories (rootOnly is ignored when parentId is provided)
      const subs = await getCategoriesByType(orderTypeFilter as CategoryType, { activeOnly: true, parentId: categoryId })
      setSubcategories(subs)
      setSubcategoryFilter("all")
    } catch (error: any) {
      console.error("Failed to load subcategories:", error)
      setSubcategories([])
    }
  }

  useEffect(() => {
    if (categoryFilter !== "all" && categories.length > 0) {
      const selectedCategory = categories.find((cat) => cat.slug === categoryFilter)
      if (selectedCategory) {
        loadSubcategories(selectedCategory.id)
      } else {
        setSubcategories([])
        setSubcategoryFilter("all")
      }
    } else {
      setSubcategories([])
      setSubcategoryFilter("all")
    }
  }, [categoryFilter, categories])

  const loadReviews = async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        page_size: 20,
      }
      if (ratingFilter !== "all") {
        params.min_rating = parseInt(ratingFilter)
        params.max_rating = parseInt(ratingFilter)
      }
      
      const response = await getAllReviews(params)
      setReviews(response.items || [])
      setTotalPages(response.total_pages || 1)
    } catch (error: any) {
      console.error("Failed to load reviews:", error)
      toast.error("Bewertungen konnten nicht geladen werden")
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.review) return

    try {
      await deleteReview(deleteDialog.review.id)
      toast.success("Bewertung erfolgreich gelöscht")
      setDeleteDialog({ open: false, review: null })
      loadReviews()
    } catch (error: any) {
      toast.error(error.message || "Bewertung konnte nicht gelöscht werden")
    }
  }

  const clearFilters = () => {
    setRatingFilter("all")
    setOrderTypeFilter("all")
    setCategoryFilter("all")
    setSubcategoryFilter("all")
    setSearchQuery("")
    setPage(1)
  }

  const hasActiveFilters = useMemo(() => {
    return (
      ratingFilter !== "all" ||
      orderTypeFilter !== "all" ||
      categoryFilter !== "all" ||
      subcategoryFilter !== "all" ||
      searchQuery.trim() !== ""
    )
  }, [ratingFilter, orderTypeFilter, categoryFilter, subcategoryFilter, searchQuery])

  const filteredReviews = useMemo(() => {
    let filtered = reviews
    
    // Filter by order type
    if (orderTypeFilter !== "all") {
      filtered = filtered.filter((r) => r.order_type === orderTypeFilter)
    }
    
    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter((r) => r.category === categoryFilter)
    }
    
    // Filter by subcategory
    if (subcategoryFilter !== "all") {
      filtered = filtered.filter((r) => r.subcategory === subcategoryFilter)
    }
    
    // Filter by search query
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((review) => 
        (review.buyer_name && review.buyer_name.toLowerCase().includes(query)) ||
        (review.seller_name && review.seller_name.toLowerCase().includes(query)) ||
        (review.text && review.text.toLowerCase().includes(query))
      )
    }
    
    return filtered
  }, [reviews, orderTypeFilter, categoryFilter, subcategoryFilter, searchQuery])

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-600"
    if (rating >= 3) return "text-yellow-600"
    return "text-red-600"
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${
              star <= rating ? `fill-current ${getRatingColor(rating)}` : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <Card className="border border-border/40 shadow-sm">
        <CardHeader className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base sm:text-lg font-semibold">Bewertungsverwaltung</CardTitle>
              <p className="text-xs text-muted-foreground">Kundenbewertungen und -Bewertungen und verwalten</p>
            </div>
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
                    {/* Rating and Type in one row */}
                    <div className="flex flex-row gap-2">
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs text-muted-foreground font-medium">Bewertung</label>
                        <Select value={ratingFilter} onValueChange={(v) => { setRatingFilter(v as typeof ratingFilter); setPage(1) }}>
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue placeholder="Bewertung" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle</SelectItem>
                            <SelectItem value="5">5 Sterne</SelectItem>
                            <SelectItem value="4">4 Sterne</SelectItem>
                            <SelectItem value="3">3 Sterne</SelectItem>
                            <SelectItem value="2">2 Sterne</SelectItem>
                            <SelectItem value="1">1 Stern</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs text-muted-foreground font-medium">Typ</label>
                        <Select value={orderTypeFilter} onValueChange={(v) => { setOrderTypeFilter(v as typeof orderTypeFilter); setPage(1) }}>
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue placeholder="Typ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle</SelectItem>
                            <SelectItem value="service">Dienstleistung</SelectItem>
                            <SelectItem value="product">Produkt</SelectItem>
                            <SelectItem value="rental">Verleih</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Category */}
                    {orderTypeFilter !== "all" && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-muted-foreground font-medium">Kategorie</label>
                        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1) }} disabled={categories.length === 0}>
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
                    )}
                    
                    {/* Subcategory */}
                    {orderTypeFilter !== "all" && categoryFilter !== "all" && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-muted-foreground font-medium">Unterkategorie</label>
                        <Select value={subcategoryFilter} onValueChange={(v) => { setSubcategoryFilter(v); setPage(1) }} disabled={subcategories.length === 0}>
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
                    )}
                    
                    {/* Search */}
                    <div className="relative flex flex-col gap-1.5">
                      <label className="text-xs text-muted-foreground font-medium">Suchen</label>
                      <div className="relative">
                        <div className="flex items-center justify-center w-7 h-7 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                          <Search className="h-3.5 w-3.5" />
                        </div>
                        <Input
                          type="text"
                          placeholder="Bewertungen suchen..."
                          className="pl-11 h-8 text-xs rounded-sm border border-border/40 focus:border-primary shadow-none"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
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
              <label className="text-xs text-muted-foreground font-medium">Bewertung</label>
              <Select value={ratingFilter} onValueChange={(v) => { setRatingFilter(v as typeof ratingFilter); setPage(1) }}>
                <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Bewertung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="5">5 Sterne</SelectItem>
                  <SelectItem value="4">4 Sterne</SelectItem>
                  <SelectItem value="3">3 Sterne</SelectItem>
                  <SelectItem value="2">2 Sterne</SelectItem>
                  <SelectItem value="1">1 Stern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
              <label className="text-xs text-muted-foreground font-medium">Typ</label>
              <Select value={orderTypeFilter} onValueChange={(v) => { setOrderTypeFilter(v as typeof orderTypeFilter); setPage(1) }}>
                <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="service">Dienstleistung</SelectItem>
                  <SelectItem value="product">Produkt</SelectItem>
                  <SelectItem value="rental">Verleih</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {orderTypeFilter !== "all" && (
              <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
                <label className="text-xs text-muted-foreground font-medium">Kategorie</label>
                <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1) }} disabled={categories.length === 0}>
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
            )}
            {orderTypeFilter !== "all" && categoryFilter !== "all" && (
              <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
                <label className="text-xs text-muted-foreground font-medium">Unterkategorie</label>
                <Select value={subcategoryFilter} onValueChange={(v) => { setSubcategoryFilter(v); setPage(1) }} disabled={subcategories.length === 0}>
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
            )}
            <div className="relative flex-1 flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Suchen</label>
            <div className="relative">
              <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <Input
                type="text"
                placeholder="Bewertungen suchen..."
                className="pl-11 sm:pl-12 h-8 sm:h-9 text-xs sm:text-sm rounded-sm border border-border/40 focus:border-primary shadow-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
          {loading ? (
            <div className="flex items-center justify-center py-8 sm:py-10 px-3 sm:px-4">
              <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="text-center py-8 sm:py-10 text-muted-foreground px-3 sm:px-4">
              <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
              <p className="text-xs sm:text-sm">Keine Bewertungen gefunden</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block sm:hidden space-y-2 px-3">
                {filteredReviews.map((review) => (
                  <Card key={review.id} className="border border-border/40 p-2">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <Avatar className="h-12 w-12 shrink-0 rounded-full">
                          <AvatarFallback className="text-xs rounded-full">
                            {review.buyer_name?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <h4 className="font-medium text-xs leading-tight truncate">{review.buyer_name || "Unbekannt"}</h4>
                            {renderStars(review.rating)}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            Bewertung für {review.seller_name || "Verkäufer"}
                          </p>
                          {review.text && (
                            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">{review.text}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0.5 font-medium whitespace-nowrap ${
                                review.order_type === "service"
                                  ? "border-indigo-500/50 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                  : review.order_type === "product"
                                  ? "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                                  : review.order_type === "rental"
                                  ? "border-teal-500/50 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                                  : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                              }`}
                            >
                              {review.order_type === "service" ? "Dienstleistung" : 
                               review.order_type === "product" ? "Produkt" : 
                               review.order_type === "rental" ? "Verleih" : 
                               review.order_type || "N/A"}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground">Bestellung #{review.order_id}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteDialog({ open: true, review })}
                          title="Bewertung löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block px-3 sm:px-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs sm:text-sm h-9 min-w-[150px]">Bewerter</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell h-9 min-w-[120px]">Verkäufer</TableHead>
                      <TableHead className="text-xs sm:text-sm h-9 w-24">Bewertung</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden lg:table-cell h-9 min-w-[200px]">Bewertung</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell h-9 w-24">Bestellung</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden xl:table-cell h-9 w-32">Datum</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm h-9 w-20">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReviews.map((review) => (
                      <TableRow key={review.id} className="h-auto">
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar className="h-8 w-8 rounded-full shrink-0">
                              <AvatarFallback className="text-xs rounded-full">
                                {review.buyer_name?.[0] || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-xs sm:text-sm truncate">{review.buyer_name || "Unbekannt"}</p>
                              {review.order_amount && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  Bestellung: €{review.order_amount.toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 hidden md:table-cell">
                          <div className="flex items-center gap-2 min-w-0">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs truncate">{review.seller_name || "Unbekannt"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-col gap-1">
                            {renderStars(review.rating)}
                            <span className={`text-xs font-medium whitespace-nowrap ${getRatingColor(review.rating)}`}>
                              {review.rating}/5
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 hidden lg:table-cell">
                          {review.text ? (
                            <p className="text-xs text-muted-foreground line-clamp-2 min-w-0">{review.text}</p>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Kein Kommentar</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 font-medium whitespace-nowrap w-fit ${
                                review.order_type === "service"
                                  ? "border-indigo-500/50 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                  : review.order_type === "product"
                                  ? "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                                  : review.order_type === "rental"
                                  ? "border-teal-500/50 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                                  : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                              }`}
                            >
                              {review.order_type === "service" ? "Dienstleistung" : 
                               review.order_type === "product" ? "Produkt" : 
                               review.order_type === "rental" ? "Verleih" : 
                               review.order_type || "N/A"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              #{review.order_id}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: de })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteDialog({ open: true, review })}
                              title="Bewertung löschen"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 sm:mt-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 text-xs"
              >
                Zurück
              </Button>
              <span className="text-xs sm:text-sm text-muted-foreground">
                Seite {page} von {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 text-xs"
              >
                Weiter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, review: null })}
      >
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">Bewertung löschen</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              Sind Sie sicher, dass Sie diese Bewertung löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden. Die Bewertung des Verkäufers wird neu berechnet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-3">
            <AlertDialogCancel className="h-9 sm:h-10 text-sm sm:text-base">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-9 sm:h-10 text-sm sm:text-base bg-destructive hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

