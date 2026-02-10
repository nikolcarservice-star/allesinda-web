"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Eye, CheckCircle2, XCircle, Loader2, Calendar, MapPin, FileText, CreditCard, User, Store, AlertCircle, Mail, Phone, Package, Clock, X } from "lucide-react"
import { getAllOrders, updateOrderStatus, getOrderAdmin } from "@/lib/api/admin"
import type { Order, OrderStatus } from "@/lib/api/types"
import { toast } from "sonner"
import { format } from "date-fns"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface BookingDisplay {
  id: string
  customer: string
  master: string
  service: string
  date: string
  time: string
  status: "confirmed" | "pending" | "completed" | "canceled"
  amount: number
  order: Order
}

function transformOrderToBooking(order: Order): BookingDisplay {
  // Get customer and master names
  const customer = order.buyer?.name || `Customer ${order.buyer_id}`
  const master = order.seller?.name || `Master ${order.seller_id}`

  // Get service/product/rental title
  let service = "Unbekannte Dienstleistung"
  if (order.order_type === "service" && order.service) {
    service = order.service.title || "Service"
  } else if (order.order_type === "product" && order.product) {
    service = order.product.title || "Product"
  } else if (order.order_type === "rental" && order.rental) {
    service = order.rental.title || "Rental"
  }

  // Format date and time
    let date = "Nicht geplant"
  let time = ""
  try {
    if (order.scheduled_date) {
      const scheduled = new Date(order.scheduled_date)
      if (!isNaN(scheduled.getTime())) {
        date = scheduled.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })
        time = scheduled.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      }
    } else if (order.created_at) {
      const created = new Date(order.created_at)
      if (!isNaN(created.getTime())) {
        date = created.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })
        time = created.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      }
    }
  } catch (error) {
    console.error("Error parsing date:", error)
      date = "Ungültiges Datum"
    time = ""
  }

  // Map status
  let status: "confirmed" | "pending" | "completed" | "canceled" = "pending"
  if (order.status === "completed") {
    status = "completed"
  } else if (order.status === "canceled") {
    status = "canceled"
  } else if (order.status === "paid") {
    status = "confirmed"
  } else {
    status = "pending" // created
  }

  return {
    id: String(order.id),
    customer,
    master,
    service,
    date,
    time,
    status,
    amount: order.amount,
    order,
  }
}

export function BookingsTable() {
  const [bookings, setBookings] = useState<BookingDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all")
  const [orderTypeFilter, setOrderTypeFilter] = useState<"all" | "service" | "product" | "rental">("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    bookingId: number | null;
    currentStatus: OrderStatus | null;
  }>({ open: false, bookingId: null, currentStatus: null })
  const [detailsSheet, setDetailsSheet] = useState<{
    open: boolean;
    booking: BookingDisplay | null;
    orderDetails: Order | null;
    loading: boolean;
  }>({ open: false, booking: null, orderDetails: null, loading: false })

  useEffect(() => {
    loadBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, orderTypeFilter, searchQuery])

  const loadBookings = async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        page_size: 20,
      }
      if (statusFilter !== "all") {
        params.status = statusFilter
      }
      if (orderTypeFilter !== "all") {
        params.order_type = orderTypeFilter
      }
      if (searchQuery && searchQuery.trim()) {
        params.q = searchQuery.trim()
      }
      
      const response = await getAllOrders(params)
      const transformed = response.items.map(transformOrderToBooking)
      setBookings(transformed)
      setTotalPages(response.total_pages || 1)
    } catch (error: any) {
      console.error("Failed to load bookings:", error)
      toast.error("Failed to load bookings")
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (orderId: number, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus)
      toast.success(`Order status updated to ${newStatus}`)
      setStatusDialog({ open: false, bookingId: null, currentStatus: null })
      loadBookings()
    } catch (error: any) {
      toast.error(error.message || "Failed to update order status")
    }
  }

  const handleViewDetails = async (booking: BookingDisplay) => {
    setDetailsSheet({ open: true, booking, orderDetails: null, loading: true })
    try {
      const orderDetails = await getOrderAdmin(booking.order.id)
      setDetailsSheet({ open: true, booking, orderDetails, loading: false })
    } catch (error: any) {
      console.error("Failed to load order details:", error)
      toast.error(error.message || "Failed to load order details")
      setDetailsSheet({ open: false, booking: null, orderDetails: null, loading: false })
    }
  }

  const handleSearch = () => {
    setPage(1)
    loadBookings()
  }

  const clearFilters = () => {
    setStatusFilter("all")
    setOrderTypeFilter("all")
    setSearchQuery("")
    setPage(1)
  }

  const hasActiveFilters = useMemo(() => {
    return (
      statusFilter !== "all" ||
      orderTypeFilter !== "all" ||
      searchQuery.trim() !== ""
    )
  }, [statusFilter, orderTypeFilter, searchQuery])

  if (loading) {
    return (
      <Card className="border border-border/40 shadow-sm">
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="flex items-center justify-center py-8 sm:py-10">
            <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base sm:text-lg font-semibold">Buchungsverwaltung</CardTitle>
            <p className="text-xs text-muted-foreground">Alle Buchungen, Bestellungen und Transaktionen verwalten</p>
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
                  {/* Status and Type in one row */}
                  <div className="flex flex-row gap-2">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs text-muted-foreground font-medium">Status</label>
                      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1) }}>
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="created">Erstellt</SelectItem>
                          <SelectItem value="paid">Bezahlt</SelectItem>
                          <SelectItem value="completed">Abgeschlossen</SelectItem>
                          <SelectItem value="canceled">Storniert</SelectItem>
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
                          <SelectItem value="rental">Mieten</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                        placeholder="Buchungen suchen..."
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
            <label className="text-xs text-muted-foreground font-medium">Status</label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="created">Erstellt</SelectItem>
                <SelectItem value="paid">Bezahlt</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
                <SelectItem value="canceled">Storniert</SelectItem>
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
                <SelectItem value="rental">Mieten</SelectItem>
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
                placeholder="Buchungen suchen..."
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
        {bookings.length === 0 ? (
          <div className="text-center py-8 sm:py-10 text-muted-foreground px-3 sm:px-4">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className="text-xs sm:text-sm">Keine Buchungen gefunden</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-2 px-3">
              {bookings.map((booking) => (
                <Card key={booking.id} className="border border-border/40 p-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <Avatar className="h-12 w-12 shrink-0 rounded-full">
                        <AvatarImage src="/placeholder.svg" className="rounded-full" />
                        <AvatarFallback className="text-xs rounded-full">{booking.customer[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-xs leading-tight">{booking.customer}</h4>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{booking.master}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0.5 font-medium ${
                              booking.status === "confirmed"
                                ? "border-blue-500/50 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : booking.status === "completed"
                                  ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                  : booking.status === "canceled"
                                    ? "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                                    : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                            }`}
                          >
                            {booking.status}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground truncate">{booking.service}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                      <span className="text-[10px] font-semibold text-foreground">€{booking.amount.toFixed(2)}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleViewDetails(booking)}
                          title="Details anzeigen"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {booking.status === "pending" && booking.order.status === "created" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleStatusUpdate(booking.order.id, "paid")}
                            title="Als bezahlt markieren"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {booking.status === "confirmed" && booking.order.status === "paid" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleStatusUpdate(booking.order.id, "completed")}
                            title="Als abgeschlossen markieren"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {booking.status !== "canceled" && booking.status !== "completed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setStatusDialog({ open: true, bookingId: booking.order.id, currentStatus: booking.order.status })}
                            title="Bestellung stornieren"
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
                    <TableHead className="text-xs sm:text-sm h-9 min-w-[120px]">Kunde</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell h-9 min-w-[100px]">Meister</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden lg:table-cell h-9 min-w-[120px]">Dienstleistung</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 min-w-[100px]">Datum & Uhrzeit</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 w-20">Betrag</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 w-24">Status</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm h-9 w-28">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow key={booking.id} className="h-auto">
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7 rounded-full shrink-0">
                            <AvatarImage src="/placeholder.svg" className="rounded-full" />
                            <AvatarFallback className="text-xs rounded-full">{booking.customer[0]}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-xs sm:text-sm truncate min-w-0">{booking.customer}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Avatar className="h-6 w-6 rounded-full shrink-0">
                            <AvatarImage src="/placeholder.svg" className="rounded-full" />
                            <AvatarFallback className="text-[10px] rounded-full">{booking.master[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs truncate min-w-0">{booking.master}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden lg:table-cell">
                        <span className="text-xs truncate block max-w-[150px]">{booking.service}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="text-xs sm:text-sm min-w-0">
                          <p className="truncate">{booking.date}</p>
                          <p className="text-muted-foreground text-[10px] sm:text-xs truncate">{booking.time}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 font-medium text-xs sm:text-sm whitespace-nowrap">€{booking.amount.toFixed(2)}</TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="default"
                          className={`text-[10px] px-2 py-0.5 font-medium whitespace-nowrap ${
                            booking.status === "confirmed"
                              ? "bg-blue-500 hover:bg-blue-600"
                              : booking.status === "completed"
                                ? "bg-green-500 hover:bg-green-600"
                                : booking.status === "canceled"
                                  ? "bg-red-500 hover:bg-red-600"
                                  : "bg-orange-500 hover:bg-orange-600"
                          }`}
                        >
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <div className="flex items-center justify-end gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleViewDetails(booking)}
                            title="Buchungsdetails anzeigen"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {booking.status === "pending" && booking.order.status === "created" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleStatusUpdate(booking.order.id, "paid")}
                              title="Als bezahlt markieren"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {booking.status === "confirmed" && booking.order.status === "paid" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleStatusUpdate(booking.order.id, "completed")}
                              title="Als abgeschlossen markieren"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {booking.status !== "canceled" && booking.status !== "completed" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setStatusDialog({ open: true, bookingId: booking.order.id, currentStatus: booking.order.status })}
                              title="Bestellung stornieren"
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
      <AlertDialog open={statusDialog.open} onOpenChange={(open) => !open && setStatusDialog({ open: false, bookingId: null, currentStatus: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestellung stornieren</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diese Bestellung stornieren möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusDialog.bookingId) {
                  handleStatusUpdate(statusDialog.bookingId, "canceled")
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Bestellung stornieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Booking Details Sheet */}
      <Sheet open={detailsSheet.open} onOpenChange={(open) => setDetailsSheet({ open, booking: null, orderDetails: null, loading: false })}>
        <SheetContent side="right" className="w-full sm:w-[500px] overflow-y-auto p-0">
          <SheetHeader className="pb-3 border-b px-4 pt-4 pr-12">
            <SheetTitle className="text-base font-semibold">Booking Details</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-4 overflow-y-auto">
            {detailsSheet.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : detailsSheet.orderDetails ? (
              <div className="space-y-4">
                {/* Order Status */}
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={`text-xs sm:text-sm px-2 py-0.5 font-medium ${
                      detailsSheet.orderDetails.status === "completed"
                        ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : detailsSheet.orderDetails.status === "canceled"
                          ? "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                          : detailsSheet.orderDetails.status === "paid"
                            ? "border-blue-500/50 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                    }`}
                  >
                    {detailsSheet.orderDetails.status.toUpperCase()}
                  </Badge>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Order #{detailsSheet.orderDetails.id}
                  </span>
                </div>

                {/* Customer & Seller Info */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2 p-3 border border-border/40 rounded-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-xs sm:text-sm">Customer</h4>
                    </div>
                    {detailsSheet.orderDetails.buyer ? (
                      <>
                        <p className="font-medium text-xs sm:text-sm">{detailsSheet.orderDetails.buyer.name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {detailsSheet.orderDetails.buyer.email}
                        </p>
                        {detailsSheet.orderDetails.buyer.phone && (
                          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {detailsSheet.orderDetails.buyer.phone}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm text-muted-foreground">Customer ID: {detailsSheet.orderDetails.buyer_id}</p>
                    )}
                  </div>

                  <div className="space-y-2 p-3 border border-border/40 rounded-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-xs sm:text-sm">
                        {detailsSheet.orderDetails.order_type === "service" ? "Master" : "Seller"}
                      </h4>
                    </div>
                    {detailsSheet.orderDetails.seller ? (
                      <>
                        <p className="font-medium text-xs sm:text-sm">{detailsSheet.orderDetails.seller.name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {detailsSheet.orderDetails.seller.email}
                        </p>
                        {detailsSheet.orderDetails.seller.phone && (
                          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {detailsSheet.orderDetails.seller.phone}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm text-muted-foreground">Seller ID: {detailsSheet.orderDetails.seller_id}</p>
                    )}
                  </div>
                </div>

                {/* Order Item */}
                <div className="p-3 border border-border/40 rounded-sm">
                  <h4 className="font-semibold text-xs sm:text-sm mb-2 flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                    Order Item
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-medium">Type:</span>
                    <Badge
                      variant="outline"
                      className={`text-xs sm:text-sm px-2 py-0.5 capitalize font-medium ${
                        detailsSheet.orderDetails.order_type === "service"
                          ? "border-indigo-500/50 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : detailsSheet.orderDetails.order_type === "product"
                          ? "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                          : detailsSheet.orderDetails.order_type === "rental"
                          ? "border-teal-500/50 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                          : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                      }`}
                    >
                      {detailsSheet.orderDetails.order_type === "service" ? "Service" : 
                       detailsSheet.orderDetails.order_type === "product" ? "Produkt" : 
                       detailsSheet.orderDetails.order_type === "rental" ? "Mieten" : 
                       detailsSheet.orderDetails.order_type}
                    </Badge>
                  </div>
                  {detailsSheet.orderDetails.service && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-medium">Service:</span>
                        <span className="text-xs sm:text-sm">{detailsSheet.orderDetails.service.title}</span>
                      </div>
                      {detailsSheet.orderDetails.service.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          {detailsSheet.orderDetails.service.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-medium">Preis ab:</span>
                        <span className="text-xs sm:text-sm">€{detailsSheet.orderDetails.service.price_from.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {detailsSheet.orderDetails.product && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-medium">Product:</span>
                        <span className="text-xs sm:text-sm">{detailsSheet.orderDetails.product.title}</span>
                      </div>
                      {detailsSheet.orderDetails.product.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          {detailsSheet.orderDetails.product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-medium">Price:</span>
                        <span className="text-xs sm:text-sm">€{detailsSheet.orderDetails.product.price.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {detailsSheet.orderDetails.rental && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-medium">Rental:</span>
                        <span className="text-xs sm:text-sm">{detailsSheet.orderDetails.rental.title}</span>
                      </div>
                      {detailsSheet.orderDetails.rental.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          {detailsSheet.orderDetails.rental.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-medium">Price per Day:</span>
                        <span className="text-xs sm:text-sm">€{detailsSheet.orderDetails.rental.price_per_day.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  </div>
                </div>

                {/* Financial Information */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 sm:p-3 border border-border/40 rounded-sm">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Amount</p>
                    <p className="text-sm sm:text-base font-semibold">€{detailsSheet.orderDetails.amount.toFixed(2)}</p>
                  </div>
                  <div className="p-2 sm:p-3 border border-border/40 rounded-sm">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Commission</p>
                    <p className="text-sm sm:text-base font-semibold">€{detailsSheet.orderDetails.commission.toFixed(2)}</p>
                  </div>
                  <div className="p-2 sm:p-3 border border-border/40 rounded-sm">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Net Amount</p>
                    <p className="text-sm sm:text-base font-semibold">
                      €{(detailsSheet.orderDetails.amount - detailsSheet.orderDetails.commission).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Schedule & Location */}
                {(detailsSheet.orderDetails.scheduled_date || detailsSheet.orderDetails.location) && (
                  <div className="grid grid-cols-1 gap-3">
                    {detailsSheet.orderDetails.scheduled_date && (
                      <div className="p-3 border border-border/40 rounded-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                          <h4 className="font-semibold text-xs sm:text-sm">Scheduled Date & Time</h4>
                        </div>
                        <p className="text-xs sm:text-sm">
                          {format(new Date(detailsSheet.orderDetails.scheduled_date), "PPP 'at' p")}
                        </p>
                      </div>
                    )}
                    {detailsSheet.orderDetails.location && (
                      <div className="p-3 border border-border/40 rounded-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                          <h4 className="font-semibold text-xs sm:text-sm">Location</h4>
                        </div>
                        <p className="text-xs sm:text-sm">{detailsSheet.orderDetails.location}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Information */}
                {detailsSheet.orderDetails.payment_intent_id && (
                  <div className="p-3 border border-border/40 rounded-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-xs sm:text-sm">Payment</h4>
                    </div>
                    <p className="text-xs sm:text-sm font-mono text-muted-foreground">
                      {detailsSheet.orderDetails.payment_intent_id}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {detailsSheet.orderDetails.notes && (
                  <div className="p-3 border border-border/40 rounded-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-xs sm:text-sm">Notes</h4>
                    </div>
                    <p className="text-xs sm:text-sm whitespace-pre-wrap">{detailsSheet.orderDetails.notes}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="border border-border/40 rounded-sm overflow-hidden">
                  <div className="p-3 border-b border-border/40 bg-muted/40">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-xs sm:text-sm">Timestamps</h4>
                    </div>
                  </div>
                  <div className="divide-y divide-border/40">
                    <div className="p-3 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-medium text-muted-foreground">Created</span>
                      <span className="text-xs sm:text-sm">{format(new Date(detailsSheet.orderDetails.created_at), "PPp")}</span>
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-medium text-muted-foreground">Updated</span>
                      <span className="text-xs sm:text-sm">{format(new Date(detailsSheet.orderDetails.updated_at), "PPp")}</span>
                    </div>
                    {detailsSheet.orderDetails.completed_at && (
                      <div className="p-3 flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-medium text-muted-foreground">Completed</span>
                        <span className="text-xs sm:text-sm">{format(new Date(detailsSheet.orderDetails.completed_at), "PPp")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm">Failed to load order details</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  )
}
