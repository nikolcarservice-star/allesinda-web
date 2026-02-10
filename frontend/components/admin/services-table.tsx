"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Search, CheckCircle2, XCircle, Loader2, AlertCircle, Eye, X } from "lucide-react"
import { getOptimizedImageUrl } from "@/lib/utils"
import { getAllServices, approveService, rejectService, previewMaster } from "@/lib/api/admin"
import { toast } from "sonner"
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
import { AdminPreviewSidebar } from "@/components/admin/admin-preview-sidebar"

interface Service {
  id: number;
  profile_id: number;
  master_name?: string;
  master_id?: number;
  master_image_url?: string;
  title: string;
  description?: string;
  price_from: number;
  approved: boolean;
  created_at: string;
}

export function ServicesTable() {
  const [searchQuery, setSearchQuery] = useState("")
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  // Approval filter removed - all services are automatically approved
  const [filter, setFilter] = useState<"all">("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "approve" | "reject" | null;
    serviceId: number | null;
    serviceTitle: string;
  }>({ open: false, action: null, serviceId: null, serviceTitle: "" })
  const [viewSheet, setViewSheet] = useState<{
    open: boolean;
    itemId: number | null;
    itemType: "master" | "product" | "rental" | null;
    loading: boolean;
    data: any | null;
  }>({ open: false, itemId: null, itemType: null, loading: false, data: null })

  const loadServices = async () => {
    try {
      setLoading(true)
      const params: { page?: number; page_size?: number; q?: string } = {}
      // All services are automatically approved, no filtering needed
      if (searchQuery && searchQuery.trim()) {
        params.q = searchQuery.trim()
      }
      params.page = page
      params.page_size = 20
      
      const response = await getAllServices(params)
      setServices(response.items || [])
      setTotalPages(response.total_pages || 1)
    } catch (error: any) {
      console.error("Failed to load services:", error)
      toast.error("Failed to load services")
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServices()
  }, [page, filter])

  const handleApprove = async (serviceId: number) => {
    try {
      await approveService(serviceId)
      toast.success("Service approved successfully")
      loadServices()
      setConfirmDialog({ open: false, action: null, serviceId: null, serviceTitle: "" })
    } catch (error: any) {
      toast.error(error.message || "Failed to approve service")
    }
  }

  const handleReject = async (serviceId: number) => {
    try {
      await rejectService(serviceId)
      toast.success("Service rejected successfully")
      loadServices()
      setConfirmDialog({ open: false, action: null, serviceId: null, serviceTitle: "" })
    } catch (error: any) {
      toast.error(error.message || "Failed to reject service")
    }
  }

  const openConfirmDialog = (action: "approve" | "reject", serviceId: number, serviceTitle: string) => {
    setConfirmDialog({ open: true, action, serviceId, serviceTitle })
  }

  const handleViewDetails = async (profileId: number) => {
    setViewSheet({ open: true, itemId: profileId, itemType: "master", loading: true, data: null })
    try {
      const data = await previewMaster(profileId)
      setViewSheet({ open: true, itemId: profileId, itemType: "master", loading: false, data })
    } catch (error: any) {
      console.error("Failed to load preview:", error)
      toast.error("Failed to load details")
      setViewSheet({ open: false, itemId: null, itemType: null, loading: false, data: null })
    }
  }

  const clearFilters = () => {
    setFilter("all")
    setSearchQuery("")
    setPage(1)
  }

  const hasActiveFilters = useMemo(() => {
    return searchQuery.trim() !== ""
  }, [searchQuery])

  const filteredServices = services.filter(
    (service) =>
      service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.master_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base sm:text-lg font-semibold">Dienstleistungs-Moderation</CardTitle>
            <p className="text-xs text-muted-foreground">Service von Meistern genehmigen und verwalten</p>
          </div>
        </div>
        {/* Filters */}
        {/* Mobile: Accordion */}
        <div className="block lg:hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="filters" className="border border-border/40 rounded-sm">
              <AccordionTrigger className="py-2 px-2 hover:no-underline">
                <h4 className="text-xs font-medium">Filters</h4>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-3 px-2">
                <div className="space-y-3">
                  {/* Status filter removed - all services are automatically approved */}
                  
                  {/* Search */}
                  <div className="relative flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Suchen</label>
                    <div className="relative">
                      <div className="flex items-center justify-center w-7 h-7 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                        <Search className="h-3.5 w-3.5" />
                      </div>
                      <Input
                        type="text"
                        placeholder="Service suchen..."
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
          {/* Status filter removed - all services are automatically approved */}
          <div className="relative flex-1 flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Suchen</label>
            <div className="relative">
              <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <Input
                type="text"
                placeholder="Service suchen..."
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
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-8 sm:py-10 text-muted-foreground px-3 sm:px-4">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className="text-xs sm:text-sm">No services found</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-2 px-3">
              {filteredServices.map((service) => (
                <Card key={service.id} className="border border-border/40 p-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        {service.master_image_url && (
                          <Avatar className="h-12 w-12 rounded-full">
                            <AvatarImage src={getOptimizedImageUrl(service.master_image_url, 'thumbnail')} alt={service.master_name || "Master"} className="rounded-full" />
                            <AvatarFallback className="text-xs rounded-full">{service.master_name?.[0] || "M"}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm leading-tight mb-1">{service.title}</h4>
                        {service.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{service.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-2 gap-2">
                          {service.master_name && (
                            <span className="text-[10px] text-muted-foreground truncate min-w-0">
                              {service.master_name}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 font-medium whitespace-nowrap shrink-0 ${
                              service.approved 
                                ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                            }`}
                          >
                            {service.approved ? "Genehmigt" : "Ausstehend"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                      <span className="text-[10px] font-semibold text-foreground">ab €{service.price_from.toFixed(2)}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleViewDetails(service.profile_id)}
                          title="Details anzeigen"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!service.approved ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => openConfirmDialog("approve", service.id, service.title)}
                            title="Genehmigen"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            onClick={() => openConfirmDialog("reject", service.id, service.title)}
                            title="Ablehnen"
                          >
                            <XCircle className="h-4 w-4" />
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
                    <TableHead className="text-xs sm:text-sm h-9 min-w-[150px]">Dienstleistung</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell h-9 min-w-[120px]">Meister</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 w-24">Preis ab</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 w-28">Status</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden xl:table-cell h-9 w-32">Erstellt</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm h-9 w-28">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((service) => (
                    <TableRow key={service.id} className="h-auto">
                      <TableCell className="py-2">
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate">{service.title}</p>
                          {service.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 truncate">{service.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden md:table-cell">
                        <div className="flex items-center gap-2 min-w-0">
                          {service.master_image_url && (
                            <Avatar className="h-7 w-7 rounded-full shrink-0">
                              <AvatarImage src={getOptimizedImageUrl(service.master_image_url, 'thumbnail')} alt={service.master_name || "Master"} className="rounded-full" />
                              <AvatarFallback className="text-xs rounded-full">{service.master_name?.[0] || "M"}</AvatarFallback>
                            </Avatar>
                          )}
                          <p className="text-xs truncate min-w-0">{service.master_name || `Meister ${service.master_id || service.profile_id}`}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-xs sm:text-sm whitespace-nowrap">€{service.price_from.toFixed(2)}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 font-medium whitespace-nowrap ${
                            service.approved 
                              ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                          }`}
                        >
                          {service.approved ? "Genehmigt" : "Ausstehend"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 hidden xl:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(service.created_at), { addSuffix: true, locale: de })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleViewDetails(service.profile_id)}
                            title="Details anzeigen"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {!service.approved ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => openConfirmDialog("approve", service.id, service.title)}
                              title="Genehmigen"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => openConfirmDialog("reject", service.id, service.title)}
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
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, action: null, serviceId: null, serviceTitle: "" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "approve" ? "Dienstleistung genehmigen" : "Dienstleistung ablehnen"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "approve"
                ? `Sind Sie sicher, dass Sie "${confirmDialog.serviceTitle}" genehmigen möchten? Diese Dienstleistung wird für Benutzer sichtbar sein.`
                : `Sind Sie sicher, dass Sie "${confirmDialog.serviceTitle}" ablehnen möchten? Diese Dienstleistung wird für Benutzer ausgeblendet.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.action === "approve" && confirmDialog.serviceId) {
                  handleApprove(confirmDialog.serviceId)
                } else if (confirmDialog.action === "reject" && confirmDialog.serviceId) {
                  handleReject(confirmDialog.serviceId)
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

