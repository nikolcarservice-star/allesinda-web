"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Search, Eye, Loader2, AlertCircle, CheckCircle2, XCircle, X } from "lucide-react"
import { getAllProducts, approveProduct, rejectProduct, previewProduct } from "@/lib/api/admin"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import Image from "next/image"
import { getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"
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
import { AdminPreviewSidebar } from "@/components/admin/admin-preview-sidebar"

interface Product {
  id: number;
  seller_id: number;
  seller_name?: string;
  title: string;
  description?: string;
  price: number;
  stock: number;
  city_id?: number | null;
  city_name?: string | null;
  image_url?: string;
  brand?: string;
  category?: string;
  rating: number;
  total_reviews: number;
  approved: boolean;
  created_at: string;
  updated_at?: string;
}

export function ProductsTable() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "out_of_stock">("all")
  // Approval filter removed - all products are automatically approved
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "approve" | "reject" | null;
    productId: number | null;
    productTitle: string;
  }>({ open: false, action: null, productId: null, productTitle: "" })
  const [viewSheet, setViewSheet] = useState<{
    open: boolean;
    itemId: number | null;
    itemType: "master" | "product" | "rental" | null;
    loading: boolean;
    data: any | null;
  }>({ open: false, itemId: null, itemType: null, loading: false, data: null })

  useEffect(() => {
    loadProducts()
  }, [page, categoryFilter, stockFilter, searchQuery])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        page_size: 20,
        include_out_of_stock: true,
      }
      if (searchQuery && searchQuery.trim()) {
        params.q = searchQuery.trim()
      }
      if (categoryFilter !== "all") {
        // Convert category slug to ID (backend accepts numeric string in category param)
        // Note: categoryFilter is currently not used in UI, but kept for API compatibility
        const parsedId = parseInt(categoryFilter)
        if (!isNaN(parsedId)) {
          params.category = categoryFilter // Already numeric string
        } else {
          // If it's a slug, we'd need to look it up, but since there's no UI for this filter,
          // we'll just pass it as-is (backend will handle slug lookup)
        params.category = categoryFilter
        }
      }
      if (stockFilter === "in_stock") {
        params.min_stock = 1
        params.include_out_of_stock = false
      } else if (stockFilter === "out_of_stock") {
        params.min_stock = 0
        params.include_out_of_stock = true
      }
      
      const response = await getAllProducts(params)
      let filtered = response.items || []
      
      // All products are automatically approved, no filtering needed
      setProducts(filtered)
      setTotalPages(response.total_pages || 1)
    } catch (error: any) {
      console.error("Failed to load products:", error)
      toast.error("Failed to load products")
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (productId: number) => {
    try {
      await approveProduct(productId)
      toast.success("Product approved successfully")
      loadProducts()
      setConfirmDialog({ open: false, action: null, productId: null, productTitle: "" })
    } catch (error: any) {
      toast.error(error.message || "Failed to approve product")
    }
  }

  const handleReject = async (productId: number) => {
    try {
      await rejectProduct(productId)
      toast.success("Product rejected successfully")
      loadProducts()
      setConfirmDialog({ open: false, action: null, productId: null, productTitle: "" })
    } catch (error: any) {
      toast.error(error.message || "Failed to reject product")
    }
  }

  const openConfirmDialog = (action: "approve" | "reject", productId: number, productTitle: string) => {
    setConfirmDialog({ open: true, action, productId, productTitle })
  }

  const handleViewDetails = async (productId: number) => {
    setViewSheet({ open: true, itemId: productId, itemType: "product", loading: true, data: null })
    try {
      const data = await previewProduct(productId)
      setViewSheet({ open: true, itemId: productId, itemType: "product", loading: false, data })
    } catch (error: any) {
      console.error("Failed to load preview:", error)
      toast.error("Failed to load details")
      setViewSheet({ open: false, itemId: null, itemType: null, loading: false, data: null })
    }
  }

  const handleSearch = () => {
    setPage(1)
    loadProducts()
  }

  const clearFilters = () => {
    setStockFilter("all")
    // Approval filter removed
    setCategoryFilter("all")
    setSearchQuery("")
    setPage(1)
  }

  const hasActiveFilters = useMemo(() => {
    return (
      stockFilter !== "all" ||
      categoryFilter !== "all" ||
      searchQuery.trim() !== ""
    )
  }, [stockFilter, categoryFilter, searchQuery])

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle className="text-base sm:text-lg font-semibold">Produktverwaltung</CardTitle>
            <p className="text-xs text-muted-foreground">Alle Produkt im Marktplatz verwalten</p>
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
                  {/* Stock and Approval in one row */}
                  <div className="flex flex-row gap-2">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs text-muted-foreground font-medium">Bestand</label>
                      <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v as typeof stockFilter); setPage(1) }}>
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Bestand" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="in_stock">Auf Lager</SelectItem>
                          <SelectItem value="out_of_stock">Nicht vorrätig</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Approval filter removed - all products are automatically approved */}
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
                        placeholder="Produkt suchen..."
                        className="pl-11 h-8 text-xs rounded-sm border border-border/40 focus:border-primary shadow-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
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
            <label className="text-xs text-muted-foreground font-medium">Bestand</label>
            <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v as typeof stockFilter); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Bestand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="in_stock">Auf Lager</SelectItem>
                <SelectItem value="out_of_stock">Nicht vorrätig</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Approval filter removed - all products are automatically approved */}
          <div className="relative flex-1 flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Suchen</label>
            <div className="relative">
              <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <Input
                type="text"
                placeholder="Produkt suchen..."
                className="pl-11 sm:pl-12 h-8 sm:h-9 text-xs sm:text-sm rounded-sm border border-border/40 focus:border-primary shadow-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
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
        ) : products.length === 0 ? (
          <div className="text-center py-8 sm:py-10 text-muted-foreground px-3 sm:px-4">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className="text-xs sm:text-sm">Keine Produkt gefunden</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-2 px-3">
              {products.map((product) => (
                <Card key={product.id} className="border border-border/40 p-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      {product.image_url && (
                        <div className="relative h-12 w-12 rounded-none overflow-hidden shrink-0">
                          <Image
                            src={getOptimizedImageUrl(product.image_url, 'thumbnail') || "/placeholder.svg"}
                            unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(product.image_url, 'thumbnail'))}
                            alt={product.title}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-xs leading-tight">{product.title}</h4>
                        {product.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{product.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0.5 font-medium ${
                              product.approved
                                ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                            }`}
                          >
                            {product.approved ? "Genehmigt" : "Ausstehend"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0.5 font-medium ${
                              product.stock > 0
                                ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {product.stock > 0 ? "Auf Lager" : "Ausverkauft"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                      <span className="text-[10px] font-semibold text-foreground">€{product.price.toFixed(2)}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleViewDetails(product.id)}
                          title="Details anzeigen"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {!product.approved ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => openConfirmDialog("approve", product.id, product.title)}
                            title="Genehmigen"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            onClick={() => openConfirmDialog("reject", product.id, product.title)}
                            title="Ablehnen"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
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
                    <TableHead className="text-xs sm:text-sm h-9 min-w-[150px]">Produkt</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell h-9 min-w-[100px]">Kategorie</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 w-20">Preis</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 w-16">Bestand</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden lg:table-cell h-9 min-w-[100px]">Verkäufer</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 w-28">Status</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden xl:table-cell h-9 w-20">Bewertung</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm h-9 w-28">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} className="h-auto">
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {product.image_url && (
                            <div className="relative h-8 w-8 rounded-none overflow-hidden shrink-0">
                              <Image
                                src={getOptimizedImageUrl(product.image_url, 'thumbnail') || "/placeholder.svg"}
                            unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(product.image_url, 'thumbnail'))}
                                alt={product.title}
                                fill
                                className="object-cover"
                                sizes="32px"
                              />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs sm:text-sm truncate">{product.title}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground md:hidden truncate">{product.category || "N/A"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden md:table-cell">
                        <span className="text-xs truncate block">{product.category || "N/A"}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-xs sm:text-sm whitespace-nowrap">€{product.price.toFixed(2)}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className={`text-xs sm:text-sm whitespace-nowrap ${product.stock === 0 ? "text-destructive font-medium" : ""}`}>{product.stock}</span>
                      </TableCell>
                      <TableCell className="py-2 hidden lg:table-cell">
                        <span className="text-xs truncate block min-w-0">{product.seller_name || `Seller ${product.seller_id}`}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 font-medium whitespace-nowrap ${
                              product.approved 
                                ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                            }`}
                          >
                            {product.approved ? "Genehmigt" : "Ausstehend"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 font-medium whitespace-nowrap ${
                              product.stock > 0
                                ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {product.stock > 0 ? "Auf Lager" : "Ausverkauft"}
                          </Badge>
                        </div>
                      </TableCell>
                    <TableCell className="py-2 hidden xl:table-cell text-xs">
                      {product.rating > 0 ? `${product.rating.toFixed(1)} ⭐ (${product.total_reviews})` : "Keine Bewertungen"}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleViewDetails(product.id)}
                          title="Details anzeigen"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {!product.approved ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => openConfirmDialog("approve", product.id, product.title)}
                            title="Genehmigen"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            onClick={() => openConfirmDialog("reject", product.id, product.title)}
                            title="Ablehnen"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 sm:mt-4 gap-2 px-3 sm:px-4">
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
          </>
        )}
      </CardContent>
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, action: null, productId: null, productTitle: "" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "approve" ? "Produkt genehmigen" : "Produkt ablehnen"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "approve"
                ? `Sind Sie sicher, dass Sie "${confirmDialog.productTitle}" genehmigen möchten? Dieses Produkt wird für Benutzer sichtbar sein.`
                : `Sind Sie sicher, dass Sie "${confirmDialog.productTitle}" ablehnen möchten? Dieses Produkt wird für Benutzer verborgen sein.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.action === "approve" && confirmDialog.productId) {
                  handleApprove(confirmDialog.productId)
                } else if (confirmDialog.action === "reject" && confirmDialog.productId) {
                  handleReject(confirmDialog.productId)
                }
              }}
            >
              {confirmDialog.action === "approve" ? "Genehmigen" : "Ablehnen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Details Sidebar */}
      <AdminPreviewSidebar
        open={viewSheet.open}
        onOpenChange={(open: boolean) => {
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
