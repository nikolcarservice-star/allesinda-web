"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, XCircle, Loader2, AlertCircle, Image as ImageIcon, Video, Search, Filter, X, Trash2, Eye, Maximize2 } from "lucide-react"
import { getModerationMedia, approveMedia, rejectMedia, deleteMediaAdmin } from "@/lib/api/admin"
import { toast } from "sonner"
import Image from "next/image"
import { getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale/de"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface MediaItem {
  id: number;
  owner_id: number;
  owner_name: string;
  owner_role: string;
  url: string;
  thumbnail_url?: string;
  type: string;
  title?: string;
  category?: string;
  is_before_after?: boolean;
  before_url?: string;
  after_url?: string;
  status: string;
  created_at: string;
}

export function MediaModeration() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending")
  const [typeFilter, setTypeFilter] = useState<"photo" | "video" | "all">("all")
  const [roleFilter, setRoleFilter] = useState<"master" | "seller" | "client" | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "approve" | "reject" | "delete" | null;
    mediaId: number | null;
  }>({ open: false, action: null, mediaId: null })
  const [viewDialog, setViewDialog] = useState<{
    open: boolean;
    media: MediaItem | null;
  }>({ open: false, media: null })

  useEffect(() => {
    loadMedia()
  }, [page, statusFilter, typeFilter, roleFilter, categoryFilter])

  useEffect(() => {
    // Extract unique categories from media
    const uniqueCategories = [...new Set(media.map(item => item.category).filter(Boolean))] as string[]
    setCategories(uniqueCategories)
  }, [media])

  const loadMedia = async () => {
    try {
      setLoading(true)
      const params: {
        status?: "pending" | "approved" | "rejected";
        media_type?: "photo" | "video";
        category?: string;
        owner_role?: "master" | "seller" | "client";
        page?: number;
        page_size?: number;
      } = {
        page,
        page_size: 20,
      }
      
      if (statusFilter !== "all") {
        params.status = statusFilter
      }
      if (typeFilter !== "all") {
        params.media_type = typeFilter
      }
      if (roleFilter !== "all") {
        params.owner_role = roleFilter
      }
      if (categoryFilter && categoryFilter !== "all") {
        params.category = categoryFilter
      }
      
      const response = await getModerationMedia(params)
      setMedia(response.items || [])
      setTotalPages(response.total_pages || 1)
    } catch (error: any) {
      console.error("Failed to load media:", error)
      toast.error("Fehler beim Laden der Medien")
      setMedia([])
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (mediaId: number) => {
    try {
      setProcessing(mediaId)
      await approveMedia(mediaId)
      toast.success("Media approved successfully")
      loadMedia()
      setConfirmDialog({ open: false, action: null, mediaId: null })
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Genehmigen des Mediums")
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (mediaId: number) => {
    try {
      setProcessing(mediaId)
      await rejectMedia(mediaId)
      toast.success("Media rejected successfully")
      loadMedia()
      setConfirmDialog({ open: false, action: null, mediaId: null })
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Ablehnen des Mediums")
    } finally {
      setProcessing(null)
    }
  }

  const handleDelete = async (mediaId: number) => {
    try {
      setProcessing(mediaId)
      await deleteMediaAdmin(mediaId)
      toast.success("Media deleted successfully")
      loadMedia()
      setConfirmDialog({ open: false, action: null, mediaId: null })
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Löschen des Mediums")
    } finally {
      setProcessing(null)
    }
  }

  const openConfirmDialog = (action: "approve" | "reject" | "delete", mediaId: number) => {
    setConfirmDialog({ open: true, action, mediaId })
  }

  // Client-side filtering for search query (backend doesn't support search)
  const filteredMedia = media.filter((item) => {
    if (!searchQuery || !searchQuery.trim()) return true
    const query = searchQuery.toLowerCase().trim()
    return (
      item.title?.toLowerCase().includes(query) ||
      item.owner_name.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query) ||
      item.id.toString().includes(query)
    )
  })

  const clearFilters = () => {
    setStatusFilter("pending")
    setTypeFilter("all")
    setRoleFilter("all")
    setCategoryFilter("all")
    setSearchQuery("")
    setPage(1)
  }

  const hasActiveFilters = useMemo(() => {
    return (
      statusFilter !== "pending" ||
      typeFilter !== "all" ||
      roleFilter !== "all" ||
      categoryFilter !== "all" ||
      searchQuery.trim() !== ""
    )
  }, [statusFilter, typeFilter, roleFilter, categoryFilter, searchQuery])

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base sm:text-lg font-semibold">Medien-Moderation</CardTitle>
            <p className="text-xs text-muted-foreground">
              Medien von Meistern, Verkäufern und Kunden überprüfen und genehmigen/ablehnen
            </p>
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
                  {/* Owner Role and Type in one row */}
                  <div className="flex flex-row gap-2">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs text-muted-foreground font-medium">Eigentümer-Rolle</label>
                      <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as typeof roleFilter); setPage(1) }}>
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Eigentümer-Rolle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                        <SelectItem value="master">Meister</SelectItem>
                        <SelectItem value="seller">Verkäufer</SelectItem>
                          <SelectItem value="client">Kunden</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs text-muted-foreground font-medium">Typ</label>
                      <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as typeof typeFilter); setPage(1) }}>
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Typ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="photo">Fotos</SelectItem>
                          <SelectItem value="video">Videos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Category */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Kategorie</label>
                    <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1) }}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Kategorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Status */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1) }}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle</SelectItem>
                        <SelectItem value="pending">Ausstehend</SelectItem>
                        <SelectItem value="approved">Genehmigt</SelectItem>
                        <SelectItem value="rejected">Abgelehnt</SelectItem>
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
                        placeholder="Suchen..."
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
            <label className="text-xs text-muted-foreground font-medium">Eigentümer-Rolle</label>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as typeof roleFilter); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Eigentümer-Rolle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                        <SelectItem value="master">Meister</SelectItem>
                        <SelectItem value="seller">Verkäufer</SelectItem>
                <SelectItem value="client">Kunden</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Typ</label>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as typeof typeFilter); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="photo">Fotos</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Kategorie</label>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Status</label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="approved">Genehmigt</SelectItem>
                <SelectItem value="rejected">Abgelehnt</SelectItem>
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
                placeholder="Suchen..."
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
            <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-primary" />
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="text-center py-8 sm:py-10 space-y-2 px-3 sm:px-4">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted/50 mb-2">
              <ImageIcon className="h-6 w-6 sm:h-7 sm:w-7 text-muted-foreground" />
            </div>
            <p className="text-sm sm:text-base font-semibold text-foreground">Keine Medien gefunden</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {hasActiveFilters ? "Versuchen Sie, Ihre Filter anzupassen" : "Alle Medien wurden moderiert"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-2 px-3">
              {filteredMedia.map((item) => (
                <Card key={item.id} className="border border-border/40 p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col shrink-0">
                      <div 
                        className="relative w-20 h-20 rounded-sm overflow-hidden border bg-muted cursor-pointer hover:opacity-80 transition-opacity group"
                        onClick={() => setViewDialog({ open: true, media: item })}
                        title="Klicken Sie, um Vollbild anzuzeigen"
                      >
                        {item.is_before_after && item.before_url && item.after_url ? (
                          <div className="grid grid-cols-2 gap-0.5 h-full">
                            <div className="relative">
                              <Image
                                src={getOptimizedImageUrl(item.before_url, 'thumbnail') || "/placeholder.svg"}
                                alt="Vorher"
                                fill
                                className="object-cover"
                                sizes="40px"
                                unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.before_url, 'thumbnail'))}
                              />
                            </div>
                            <div className="relative">
                              <Image
                                src={getOptimizedImageUrl(item.after_url, 'thumbnail') || "/placeholder.svg"}
                                alt="Nachher"
                                fill
                                className="object-cover"
                                sizes="40px"
                                unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.after_url, 'thumbnail'))}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            {item.type === "video" ? (
                              <>
                                <Image
                                  src={getOptimizedImageUrl(item.thumbnail_url || item.url, 'thumbnail') || "/placeholder.svg"}
                                  alt="Video-Vorschaubild"
                                  fill
                                  className="object-cover"
                                  sizes="80px"
                                  unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.thumbnail_url || item.url, 'thumbnail'))}
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <Video className="h-4 w-4 text-white" />
                                </div>
                              </>
                            ) : (
                              <Image
                                src={getOptimizedImageUrl(item.url, 'thumbnail') || "/placeholder.svg"}
                                alt="Media"
                                fill
                                className="object-cover"
                                sizes="80px"
                                unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.url, 'thumbnail'))}
                              />
                            )}
                            <Badge className="absolute top-1 left-1 text-[9px] px-1.5 py-0.5 font-medium shadow-sm" variant={item.type === "video" ? "default" : "secondary"}>
                              {item.type === "video" ? <Video className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
                            </Badge>
                          </>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Maximize2 className="h-4 w-4 text-white drop-shadow-lg" />
                        </div>
                      </div>
                      {/* Status and Type badges at bottom of image - vertically aligned */}
                      <div className="flex flex-col gap-0.5 mt-1 w-20">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0.5 capitalize font-medium w-full justify-center ${
                            item.status === "approved"
                              ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : item.status === "rejected"
                              ? "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                          }`}
                        >
                          {item.status === "approved" ? "Genehmigt" : 
                           item.status === "rejected" ? "Abgelehnt" : 
                           "Ausstehend"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 capitalize font-medium w-full justify-center">
                          {item.type === "video" ? "Video" : "Foto"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Category at top on mobile - full width */}
                      {item.category && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium w-full block">
                          {item.category}
                        </Badge>
                      )}
                      <div className="space-y-1">
                        <p className="font-medium text-sm truncate">{item.title || `Medien #${item.id}`}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: de })}
                        </p>
                        {item.is_before_after && (
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-medium whitespace-nowrap">Vorher/Nachher</Badge>
                        )}
                      </div>
                      {item.owner_name && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">von</span>
                          <span className="text-[10px] font-medium truncate">{item.owner_name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0.5 capitalize font-medium ${
                              item.owner_role === "master"
                                ? "border-blue-500/50 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : item.owner_role === "seller"
                                ? "border-purple-500/50 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                : item.owner_role === "client"
                                ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                            }`}
                          >
                            {item.owner_role === "master" ? "Meister" : 
                             item.owner_role === "seller" ? "Verkäufer" : 
                             item.owner_role === "client" ? "Kunde" : 
                             item.owner_role === "admin" ? "Admin" : 
                             item.owner_role}
                          </Badge>
                        </div>
                      )}
                      <div className="flex items-center gap-1 pt-1">
                        <Button
                          onClick={() => setViewDialog({ open: true, media: item })}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="Details anzeigen"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {item.status !== "approved" && (
                          <Button
                            onClick={() => openConfirmDialog("approve", item.id)}
                            disabled={processing === item.id}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Genehmigen"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        {item.status !== "rejected" && (
                          <Button
                            onClick={() => openConfirmDialog("reject", item.id)}
                            disabled={processing === item.id}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            title="Ablehnen"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          onClick={() => openConfirmDialog("delete", item.id)}
                          disabled={processing === item.id}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                    <TableHead className="text-xs sm:text-sm h-9 w-24">Vorschau</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 min-w-[220px]">Medien-Info</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 hidden md:table-cell min-w-[140px]">Eigentümer</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 hidden lg:table-cell min-w-[120px]">Kategorie</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 w-28">Status</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm h-9 w-36">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMedia.map((item) => (
                    <TableRow key={item.id} className="h-auto">
                      <TableCell className="py-2">
                        <div 
                          className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-sm overflow-hidden border border-border/40 bg-muted cursor-pointer hover:opacity-80 transition-opacity group shrink-0"
                          onClick={() => setViewDialog({ open: true, media: item })}
                          title="Klicken Sie, um Vollbild anzuzeigen"
                        >
                          {item.is_before_after && item.before_url && item.after_url ? (
                            <div className="grid grid-cols-2 gap-0.5 h-full">
                              <div className="relative">
                                <Image
                                  src={getOptimizedImageUrl(item.before_url, 'thumbnail') || "/placeholder.svg"}
                                  alt="Vorher"
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                  unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.before_url, 'thumbnail'))}
                                />
                              </div>
                              <div className="relative">
                                <Image
                                  src={getOptimizedImageUrl(item.after_url, 'thumbnail') || "/placeholder.svg"}
                                  alt="Nachher"
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                  unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.after_url, 'thumbnail'))}
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              {item.type === "video" ? (
                                <>
                                  <Image
                                    src={getOptimizedImageUrl(item.thumbnail_url || item.url, 'thumbnail') || "/placeholder.svg"}
                                    alt="Video-Vorschaubild"
                                    fill
                                    className="object-cover"
                                    sizes="80px"
                                    unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.thumbnail_url || item.url, 'thumbnail'))}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <Video className="h-4 w-4 text-white" />
                                  </div>
                                </>
                              ) : (
                                <Image
                                  src={getOptimizedImageUrl(item.url, 'thumbnail') || "/placeholder.svg"}
                                  alt="Media"
                                  fill
                                  className="object-cover"
                                  sizes="80px"
                                  unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.url, 'thumbnail'))}
                                />
                              )}
                              <Badge className="absolute top-1 left-1 text-[9px] px-1.5 py-0.5 font-medium shadow-sm" variant={item.type === "video" ? "default" : "secondary"}>
                                {item.type === "video" ? <Video className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
                              </Badge>
                            </>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Maximize2 className="h-4 w-4 text-white drop-shadow-lg" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="space-y-1.5 min-w-0">
                          <div>
                            <p className="text-xs sm:text-sm font-medium line-clamp-1 truncate">{item.title || `Medien #${item.id}`}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
                              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: de })}
                            </p>
                          </div>
                          {item.is_before_after && (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-medium whitespace-nowrap">Vorher/Nachher</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden md:table-cell">
                        <div className="space-y-1.5 min-w-0">
                          <p className="text-xs sm:text-sm font-medium truncate">{item.owner_name}</p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 capitalize font-medium ${
                              item.owner_role === "master"
                                ? "border-blue-500/50 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : item.owner_role === "seller"
                                ? "border-purple-500/50 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                : item.owner_role === "client"
                                ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                            }`}
                          >
                            {item.owner_role === "master" ? "Meister" : 
                             item.owner_role === "seller" ? "Verkäufer" : 
                             item.owner_role === "client" ? "Kunde" : 
                             item.owner_role === "admin" ? "Admin" : 
                             item.owner_role}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden lg:table-cell">
                        {item.category ? (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium whitespace-nowrap truncate block max-w-[150px]">{item.category}</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 capitalize font-medium ${
                            item.status === "approved"
                              ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : item.status === "rejected"
                              ? "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                          }`}
                        >
                          {item.status === "approved" ? "Genehmigt" : 
                           item.status === "rejected" ? "Abgelehnt" : 
                           "Ausstehend"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1 shrink-0">
                          <Button
                            onClick={() => setViewDialog({ open: true, media: item })}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Details anzeigen"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {item.status !== "approved" && (
                            <Button
                              onClick={() => openConfirmDialog("approve", item.id)}
                              disabled={processing === item.id}
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Genehmigen"
                            >
                              {processing === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          {item.status !== "rejected" && (
                            <Button
                              onClick={() => openConfirmDialog("reject", item.id)}
                              disabled={processing === item.id}
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              title="Ablehnen"
                            >
                              {processing === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          <Button
                            onClick={() => openConfirmDialog("delete", item.id)}
                            disabled={processing === item.id}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Löschen"
                          >
                            {processing === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 mt-3 sm:mt-4 pt-3 border-t px-3 sm:px-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
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
                  disabled={page === totalPages || loading}
                  className="h-8 text-xs"
                >
                  Weiter
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
      
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, action: null, mediaId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "approve" ? "Medium genehmigen" : 
               confirmDialog.action === "reject" ? "Medium ablehnen" : 
               "Medium löschen"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "approve"
                ? "Sind Sie sicher, dass Sie dieses Medium genehmigen möchten? Es wird für Benutzer sichtbar sein."
                : confirmDialog.action === "reject"
                ? "Sind Sie sicher, dass Sie dieses Medium ablehnen möchten? Es wird für Benutzer verborgen sein."
                : "Sind Sie sicher, dass Sie dieses Medium löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.action === "approve" && confirmDialog.mediaId) {
                  handleApprove(confirmDialog.mediaId)
                } else if (confirmDialog.action === "reject" && confirmDialog.mediaId) {
                  handleReject(confirmDialog.mediaId)
                } else if (confirmDialog.action === "delete" && confirmDialog.mediaId) {
                  handleDelete(confirmDialog.mediaId)
                }
              }}
              className={confirmDialog.action === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {confirmDialog.action === "approve" ? "Genehmigen" : 
               confirmDialog.action === "reject" ? "Ablehnen" : 
               "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Media Dialog */}
      <Dialog open={viewDialog.open} onOpenChange={(open) => setViewDialog({ open, media: null })}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {viewDialog.media && (
            <>
              <DialogHeader className="text-left">
                <DialogTitle>{viewDialog.media.title || `Medien #${viewDialog.media.id}`}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Media Display */}
                <div className="relative w-full rounded-sm overflow-hidden border bg-muted">
                  {viewDialog.media.is_before_after && viewDialog.media.before_url && viewDialog.media.after_url ? (
                    <div className="grid grid-cols-2 gap-2 p-2">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-center">Vorher</p>
                        <div className="relative aspect-video rounded-sm overflow-hidden">
                          <Image
                            src={getOptimizedImageUrl(viewDialog.media.before_url, 'full')}
                            alt="Vorher"
                            fill
                            className="object-cover"
                            unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(viewDialog.media.before_url, 'full'))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-center">Nachher</p>
                        <div className="relative aspect-video rounded-sm overflow-hidden">
                          <Image
                            src={getOptimizedImageUrl(viewDialog.media.after_url, 'full')}
                            alt="Nachher"
                            fill
                            className="object-cover"
                            unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(viewDialog.media.after_url, 'full'))}
                          />
                        </div>
                      </div>
                    </div>
                  ) : viewDialog.media.type === "video" ? (
                    <div className="relative aspect-video bg-black rounded-sm overflow-hidden">
                      <video
                        src={getOptimizedImageUrl(viewDialog.media.url, 'original')}
                        controls
                        className="w-full h-full object-cover rounded-sm"
                        poster={getOptimizedImageUrl(viewDialog.media.thumbnail_url, 'full')}
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  ) : (
                    <div className="relative w-full aspect-video rounded-sm overflow-hidden">
                      <Image
                        src={getOptimizedImageUrl(viewDialog.media.url, 'full')}
                        alt={viewDialog.media.title || "Media"}
                        fill
                        className="object-cover rounded-sm"
                        sizes="100vw"
                        unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(viewDialog.media.url, 'full'))}
                      />
                    </div>
                  )}
                </div>

                {/* Media Details */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="space-y-1.5">
                    <p className="font-medium text-muted-foreground">Status</p>
                    <Badge
                      variant={
                        viewDialog.media.status === "approved" ? "default" :
                        viewDialog.media.status === "rejected" ? "destructive" : "secondary"
                      }
                      className={`text-xs px-2.5 py-1 capitalize font-medium ${
                        viewDialog.media.status === "approved" 
                          ? "bg-green-500 hover:bg-green-600" 
                          : ""
                      }`}
                    >
                      {viewDialog.media.status === "approved" ? "Genehmigt" : 
                       viewDialog.media.status === "rejected" ? "Abgelehnt" : 
                       "Ausstehend"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-medium text-muted-foreground">Typ</p>
                    <Badge variant="outline" className="text-xs px-2.5 py-1 capitalize font-medium">
                      {viewDialog.media.type === "video" ? "Video" : "Foto"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-medium text-muted-foreground">Eigentümer</p>
                    <p className="text-sm">{viewDialog.media.owner_name}</p>
                  </div>
                  {viewDialog.media.category && (
                    <div className="col-span-2 mt-4">
                      <p className="font-medium text-muted-foreground mb-1.5">Kategorie</p>
                      <Badge variant="outline" className="text-xs px-3 py-1.5 font-medium break-words w-full justify-center block text-center">
                        {viewDialog.media.category}
                      </Badge>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <p className="font-medium text-muted-foreground">Rolle</p>
                    <Badge
                      variant="outline"
                      className={`text-xs px-2.5 py-1 capitalize font-medium ${
                        viewDialog.media.owner_role === "master"
                          ? "border-blue-500/50 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          : viewDialog.media.owner_role === "seller"
                          ? "border-purple-500/50 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                          : viewDialog.media.owner_role === "client"
                          ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                      }`}
                    >
                      {viewDialog.media.owner_role === "master" ? "Meister" :
                       viewDialog.media.owner_role === "seller" ? "Verkäufer" :
                       viewDialog.media.owner_role === "client" ? "Kunde" :
                       viewDialog.media.owner_role}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-medium text-muted-foreground">Erstellt</p>
                    <p className="text-sm">{formatDistanceToNow(new Date(viewDialog.media.created_at), { addSuffix: true, locale: de })}</p>
                  </div>
                  {viewDialog.media.is_before_after && (
                    <div className="space-y-1.5">
                      <p className="font-medium text-muted-foreground">Typ</p>
                      <Badge variant="secondary" className="text-xs px-2.5 py-1 font-medium">Vorher/Nachher</Badge>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-2 pt-4 border-t">
                  {viewDialog.media.status !== "approved" && (
                    <Button
                      onClick={() => {
                        setViewDialog({ open: false, media: null })
                        openConfirmDialog("approve", viewDialog.media!.id)
                      }}
                      variant="default"
                      size="sm"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Genehmigen
                    </Button>
                  )}
                  {viewDialog.media.status !== "rejected" && (
                    <Button
                      onClick={() => {
                        setViewDialog({ open: false, media: null })
                        openConfirmDialog("reject", viewDialog.media!.id)
                      }}
                      variant="destructive"
                      size="sm"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Ablehnen
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setViewDialog({ open: false, media: null })
                      openConfirmDialog("delete", viewDialog.media!.id)
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Löschen
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
