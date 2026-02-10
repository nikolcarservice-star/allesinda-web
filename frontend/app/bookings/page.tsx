"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from "react"
import { Calendar, Clock, MapPin, MoreVertical, MessageSquare, CheckCircle2, XCircle, CalendarClock, CheckCircle, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getMyOrders, cancelOrder } from "@/lib/api/orders"
import type { Order } from "@/lib/api/types"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface BookingDisplay {
  id: number
  type: "service" | "rental" | "product"
  title: string
  provider: string
  image: string
  date: string
  time: string
  location: string
  status: "upcoming" | "completed" | "cancelled"
  price: number
  order: Order
}

function transformOrderToBooking(order: Order): BookingDisplay {
  // Get title and image based on order type
  let title = "Unbekannte Buchung"
  let image = "/placeholder.svg"
  let provider = order.seller?.name || "Unbekannter Anbieter"

  if (order.order_type === "service" && order.service) {
    title = order.service.title || "Dienstleistungsbuchung"
    image = "/placeholder.svg"
  } else if (order.order_type === "product" && order.product) {
    title = order.product.title || "Produktbestellung"
    image = order.product.image_url || "/placeholder.svg"
  } else if (order.order_type === "rental" && order.rental) {
    title = order.rental.title || "Verleihbuchung"
    image = order.rental.image_url || "/placeholder.svg"
  }

  // Format date and time
  let date = "Nicht geplant"
  let time = ""
  try {
    if (order.scheduled_date) {
      const scheduled = new Date(order.scheduled_date)
      if (!isNaN(scheduled.getTime())) {
        date = scheduled.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        time = scheduled.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      }
    } else if (order.created_at) {
      const created = new Date(order.created_at)
      if (!isNaN(created.getTime())) {
        date = created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        time = created.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      }
    }
  } catch (error) {
    console.error("Error parsing date:", error)
    date = "Ungültiges Datum"
    time = ""
  }

  // Map status
  let status: "upcoming" | "completed" | "cancelled" = "upcoming"
  if (order.status === "completed") {
    status = "completed"
  } else if (order.status === "canceled") {
    status = "cancelled"
  } else {
    status = "upcoming" // created or paid
  }

  return {
    id: order.id,
    type: order.order_type,
    title,
    provider,
    image,
    date,
    time,
    location: order.location || "Nicht angegeben",
    status,
    price: order.amount,
    order,
  }
}

function BookingsPageContent() {
  const [bookings, setBookings] = useState<BookingDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadBookings() {
    try {
      setLoading(true)
      setError(null)
      const response = await getMyOrders({ page_size: 100 })
      const transformed = response.items.map(transformOrderToBooking)
      setBookings(transformed)
    } catch (err: any) {
      setError(err.message || "Fehler beim Laden der Buchungen")
      toast.error("Fehler beim Laden der Buchungen")
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelBooking(booking: BookingDisplay) {
    if (!confirm("Sind Sie sicher, dass Sie diese Buchung stornieren möchten?")) {
      return
    }

    try {
      await cancelOrder(booking.id)
      toast.success("Buchung erfolgreich storniert")
      loadBookings()
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Stornieren der Buchung")
    }
  }

  async function handleMessage(booking: BookingDisplay) {
    // Navigate to messages/conversation with seller
    router.push(`/messages?order=${booking.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-muted/10 to-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Buchungen werden geladen...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-muted/10 to-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="h-8 w-8 mx-auto text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={loadBookings}>Erneut versuchen</Button>
        </div>
      </div>
    )
  }

  const upcomingBookings = bookings.filter((b) => b.status === "upcoming")
  const completedBookings = bookings.filter((b) => b.status === "completed")
  const cancelledBookings = bookings.filter((b) => b.status === "cancelled")

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/10 to-background">
      <div className="container mx-auto px-sides py-6 sm:py-8 md:py-10 lg:py-12">
        {/* Header */}
        <div className="mb-4 sm:mb-5 md:mb-6 lg:mb-8">
          <div className="space-y-1 sm:space-y-1.5 md:space-y-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Meine Buchungen
              </span>
            </h1>
            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground/90">Verwalten Sie Ihre bevorstehenden und vergangenen Buchungen</p>
          </div>
        </div>

        <Tabs defaultValue="upcoming" className="space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8">
          <TabsList variant="modern" className="grid w-full grid-cols-3 mb-4 sm:mb-6 md:mb-8">
            <TabsTrigger variant="modern" value="upcoming" className="flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
              <CalendarClock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="hidden min-[360px]:inline">Bevorstehend</span>
              <span className="min-[360px]:hidden">Bev</span>
            </TabsTrigger>
            <TabsTrigger variant="modern" value="completed" className="flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="hidden min-[360px]:inline">Abgeschlossen</span>
              <span className="min-[360px]:hidden">Abg</span>
            </TabsTrigger>
            <TabsTrigger variant="modern" value="cancelled" className="flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="hidden min-[360px]:inline">Storniert</span>
              <span className="min-[360px]:hidden">Sto</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3 sm:space-y-4 md:space-y-5">
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8 sm:py-12 md:py-16 space-y-2 sm:space-y-3 text-muted-foreground">
                <CalendarClock className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-base sm:text-lg font-semibold text-foreground">Keine bevorstehenden Buchungen</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Sie haben noch keine bevorstehenden Buchungen</p>
              </div>
            ) : (
              upcomingBookings.map((booking) => (
                <Card key={booking.id} className="border border-border/50 shadow-sm hover:border-border/80 hover:shadow-md hover:shadow-black/5 transition-all duration-200">
                  <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
                    <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 md:gap-4 lg:gap-6">
                      <div className="relative w-full sm:w-24 md:w-28 lg:w-36 h-24 sm:h-24 md:h-28 lg:h-36 rounded-lg overflow-hidden shrink-0 bg-muted border border-border/40/30 shadow-sm">
                        <img src={booking.image || "/placeholder.svg"} alt={booking.title} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 space-y-2 sm:space-y-2.5 md:space-y-3 lg:space-y-4 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                            <h3 className="font-bold text-sm sm:text-base md:text-lg lg:text-xl truncate group-hover:text-primary transition-colors">{booking.title}</h3>
                            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground/90">mit {booking.provider}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0 rounded-md hover:bg-primary/10 hover:text-primary shadow-none hover:shadow-none transition-all h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9">
                                <MoreVertical className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-lg">
                              <DropdownMenuItem className="rounded-md text-xs sm:text-sm">Details anzeigen</DropdownMenuItem>
                              <DropdownMenuItem className="rounded-md text-xs sm:text-sm">Neu terminieren</DropdownMenuItem>
                              <DropdownMenuItem className="rounded-md text-xs sm:text-sm text-destructive" onClick={() => handleCancelBooking(booking)}>
                                Buchung stornieren
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 md:gap-3">
                          <div className="flex items-center gap-1.5 sm:gap-2 bg-background/50 backdrop-blur-sm p-2 sm:p-2.5 md:p-3 rounded-lg border border-border/40/30">
                            <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                              <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground/70">Datum</p>
                              <p className="text-[10px] sm:text-xs md:text-sm font-semibold truncate">{booking.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 bg-background/50 backdrop-blur-sm p-2 sm:p-2.5 md:p-3 rounded-lg border border-border/40/30">
                            <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                              <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground/70">Uhrzeit</p>
                              <p className="text-[10px] sm:text-xs md:text-sm font-semibold truncate">{booking.time}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 bg-background/50 backdrop-blur-sm p-2 sm:p-2.5 md:p-3 rounded-lg border border-border/40/30">
                            <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                              <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground/70">Standort</p>
                              <p className="text-[10px] sm:text-xs md:text-sm font-semibold truncate">{booking.location}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-2.5 md:gap-3 pt-2 sm:pt-2.5 md:pt-3 lg:pt-4 border-t border-border/30">
                          <div className="space-y-0.5">
                            <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-muted-foreground/90">Gesamtpreis</p>
                            <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">€{booking.price.toFixed(2)}</p>
                          </div>
                          <Button size="default" className="gap-1.5 rounded-md font-semibold shadow-none hover:shadow-none transition-all text-xs sm:text-sm h-8 sm:h-9 md:h-10 w-full sm:w-auto" onClick={() => handleMessage(booking)}>
                            <MessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                            <span>Nachricht</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3 sm:space-y-4 md:space-y-5">
            {completedBookings.length === 0 ? (
              <div className="text-center py-8 sm:py-12 md:py-16 space-y-2 sm:space-y-3 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-base sm:text-lg font-semibold text-foreground">Keine abgeschlossenen Buchungen</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Zeit, etwas zu erledigen!</p>
              </div>
            ) : (
              completedBookings.map((booking) => (
                <Card key={booking.id} className="border border-border/50 shadow-sm hover:border-border/80 hover:shadow-md hover:shadow-black/5 transition-all duration-200">
                  <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
                    <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 md:gap-4 lg:gap-6">
                      <div className="relative w-full sm:w-24 md:w-28 lg:w-36 h-24 sm:h-24 md:h-28 lg:h-36 rounded-lg overflow-hidden shrink-0 bg-muted border border-border/40/30 shadow-sm">
                        <img src={booking.image || "/placeholder.svg"} alt={booking.title} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 space-y-2 sm:space-y-2.5 md:space-y-3 lg:space-y-4 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                            <h3 className="font-bold text-sm sm:text-base md:text-lg lg:text-xl truncate group-hover:text-primary transition-colors">{booking.title}</h3>
                            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground/90">mit {booking.provider}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0 rounded-md hover:bg-primary/10 hover:text-primary shadow-none hover:shadow-none transition-all h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9">
                                <MoreVertical className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-lg">
                              <DropdownMenuItem className="rounded-md text-xs sm:text-sm">Details anzeigen</DropdownMenuItem>
                              <DropdownMenuItem className="rounded-md text-xs sm:text-sm">Beleg herunterladen</DropdownMenuItem>
                              <DropdownMenuItem className="rounded-md text-xs sm:text-sm">Erneut buchen</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 md:gap-3">
                          <div className="flex items-center gap-1.5 sm:gap-2 bg-background/50 backdrop-blur-sm p-2 sm:p-2.5 md:p-3 rounded-lg border border-border/40/30">
                            <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                              <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground/70">Datum</p>
                              <p className="text-[10px] sm:text-xs md:text-sm font-semibold truncate">{booking.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 bg-background/50 backdrop-blur-sm p-2 sm:p-2.5 md:p-3 rounded-lg border border-border/40/30">
                            <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                              <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground/70">Uhrzeit</p>
                              <p className="text-[10px] sm:text-xs md:text-sm font-semibold truncate">{booking.time}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 bg-background/50 backdrop-blur-sm p-2 sm:p-2.5 md:p-3 rounded-lg border border-border/40/30">
                            <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                              <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground/70">Standort</p>
                              <p className="text-[10px] sm:text-xs md:text-sm font-semibold truncate">{booking.location}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 sm:pt-2.5 md:pt-3 lg:pt-4 border-t border-border/30">
                          <div className="space-y-0.5">
                            <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-muted-foreground/90">Gesamtpreis</p>
                            <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">€{booking.price.toFixed(2)}</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 font-semibold bg-emerald-500/10 text-emerald-600 shadow-sm border-0">
                            Abgeschlossen
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-3 sm:space-y-4 md:space-y-5">
            {cancelledBookings.length === 0 ? (
              <div className="text-center py-8 sm:py-12 md:py-16 space-y-2 sm:space-y-3 text-muted-foreground">
                <XCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-base sm:text-lg font-semibold text-foreground">Keine stornierten Buchungen</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Alles gut hier!</p>
              </div>
            ) : (
              cancelledBookings.map((booking) => (
                <Card key={booking.id} className="border border-border/50 shadow-sm opacity-80">
                  <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                      <div className="relative w-full sm:w-28 md:w-36 h-32 sm:h-28 md:h-36 rounded-lg overflow-hidden shrink-0 bg-muted border border-border/40/30 shadow-sm grayscale opacity-70">
                        <img src={booking.image || "/placeholder.svg"} alt={booking.title} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1">
                            <h3 className="font-bold text-lg sm:text-xl truncate text-muted-foreground">{booking.title}</h3>
                            <p className="text-sm text-muted-foreground/70">with {booking.provider}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0 rounded-md hover:bg-primary/10 hover:text-primary shadow-none hover:shadow-none transition-all">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-lg">
                              <DropdownMenuItem className="rounded-lg">Details anzeigen</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                          <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm p-3 rounded-lg border border-border/40/30">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary/70 shrink-0">
                              <Calendar className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground/70">Date</p>
                              <p className="text-sm font-semibold truncate text-muted-foreground/90">{booking.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm p-3 rounded-lg border border-border/40/30">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary/70 shrink-0">
                              <Clock className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground/70">Time</p>
                              <p className="text-sm font-semibold truncate text-muted-foreground/90">{booking.time}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm p-3 rounded-lg border border-border/40/30">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary/70 shrink-0">
                              <MapPin className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground/70">Location</p>
                              <p className="text-sm font-semibold truncate text-muted-foreground/90">{booking.location}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-border/30">
                          <div className="space-y-0.5">
                            <p className="text-xs sm:text-sm text-muted-foreground/90">Total Price</p>
                            <p className="text-xl sm:text-2xl font-bold text-muted-foreground">€{booking.price.toFixed(2)}</p>
                          </div>
                          <Badge variant="destructive" className="text-xs sm:text-sm px-3 py-1.5 font-semibold bg-destructive/10 text-destructive shadow-sm border-0">
                            Storniert
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function BookingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <BookingsPageContent />
    </Suspense>
  )
}
