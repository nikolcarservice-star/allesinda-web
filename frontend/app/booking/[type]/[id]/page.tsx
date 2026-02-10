"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { Calendar, Clock, MapPin, CreditCard, Shield, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getMaster } from "@/lib/api/masters"
import { getProduct } from "@/lib/api/products"
import { getRental } from "@/lib/api/rentals"
import { getUser } from "@/lib/api/users"
import { createOrder } from "@/lib/api/orders"
import { createCheckoutSession } from "@/lib/api/payments"
import type { ProfileDetailed, Product, Rental, OrderType, User } from "@/lib/api/types"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { logger } from "@/lib/logger"

type BookingType = "master" | "product" | "rental"

interface BookingData {
  type: "service" | "product" | "rental"
  title: string
  provider: string
  image: string
  rating: number
  reviews: number
  basePrice: number
  priceUnit?: string
  description: string
  stock?: number
  available?: boolean
}

export default function BookingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const type = (params?.type as BookingType) || "product"
  const id = params?.id as string
  const quantityParam = searchParams?.get("quantity")
  const quantity = quantityParam ? Math.max(1, parseInt(quantityParam, 10)) : 1
  const [bookingData, setBookingData] = useState<BookingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [sellerId, setSellerId] = useState<number | null>(null)
  const [seller, setSeller] = useState<User | null>(null)
  const [serviceId, setServiceId] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string>("card")

  useEffect(() => {
    if (id) {
      loadBookingData()
    }
  }, [type, id])

  const loadBookingData = async () => {
    try {
      setLoading(true)
      const itemId = parseInt(id)

      if (type === "master") {
        // For master booking, we get the master profile
        const master = await getMaster(itemId)
        
        // Get service_id from URL params or use first service as fallback
        const urlParams = new URLSearchParams(window.location.search)
        const serviceIdParam = urlParams.get('service_id')
        const selectedServiceId = serviceIdParam ? parseInt(serviceIdParam) : null
        
        // Find the selected service or use first service
        const selectedService = selectedServiceId 
          ? master.services?.find(s => s.id === selectedServiceId)
          : (master.services && master.services.length > 0 ? master.services[0] : null)
        
        setSellerId(master.user?.id || null)
        setServiceId(selectedService?.id || null)
        setBookingData({
          type: "service",
          title: selectedService?.title || "Professioneller Service",
          provider: master.user?.name || "Professionell",
          image: "/placeholder.svg",
          rating: master.rating,
          reviews: master.total_reviews,
          basePrice: selectedService?.price_from || 0,
          description: selectedService?.description || master.about || "Professioneller Service",
        })
      } else if (type === "product") {
        const product = await getProduct(itemId)
        setSellerId(product.seller_id)
        // Check if seller info is already included in the response
        let sellerName = `Seller ID: ${product.seller_id}`
        if (product.seller) {
          setSeller(product.seller)
          sellerName = product.seller.name
        } else if (product.seller_name) {
          sellerName = product.seller_name
          setSeller({ id: product.seller_id, name: product.seller_name } as User)
        } else {
          // Try to fetch seller information (if backend endpoint exists)
          try {
            const sellerData = await getUser(product.seller_id)
            setSeller(sellerData)
            sellerName = sellerData.name
          } catch (error: any) {
            // Silently fail - backend doesn't have user endpoint yet
            logger.log("User endpoint not available, seller name will not be displayed")
          }
        }
        setBookingData({
          type: "product",
          title: product.title,
          provider: sellerName,
          image: product.image_url || "/placeholder.svg",
          rating: product.rating,
          reviews: product.total_reviews,
          basePrice: product.price,
          description: product.description || "Produkt",
        })
      } else if (type === "rental") {
        const rental = await getRental(itemId)
        setSellerId(rental.seller_id)
        // Check if owner info is already included in the response
        let ownerName = `Owner ID: ${rental.seller_id}`
        if (rental.seller) {
          setSeller(rental.seller)
          ownerName = rental.seller.name
        } else if (rental.owner_name) {
          ownerName = rental.owner_name
          setSeller({ id: rental.seller_id, name: rental.owner_name } as User)
        } else {
          // Try to fetch owner information (if backend endpoint exists)
          try {
            const ownerData = await getUser(rental.seller_id)
            setSeller(ownerData)
            ownerName = ownerData.name
          } catch (error: any) {
            // Silently fail - backend doesn't have user endpoint yet
            logger.log("User endpoint not available, owner name will not be displayed")
          }
        }
        setBookingData({
          type: "rental",
          title: rental.title,
          provider: ownerName,
          image: rental.image_url || "/placeholder.svg",
          rating: 4.5, // Rentals don't have rating in the API
          reviews: 0,
          basePrice: rental.price_per_day,
          priceUnit: "pro Tag",
          description: rental.description || "Geräteverleih",
          stock: rental.stock,
          available: rental.available,
        })
      }
    } catch (error: any) {
      console.error("Failed to load booking data:", error)
      toast.error("Fehler beim Laden der Buchungsinformationen")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!bookingData || !sellerId) {
      toast.error("Fehlende Buchungsinformationen")
      return
    }

    if (
      bookingData.type === "rental" &&
      ((bookingData.stock ?? 0) <= 0 || bookingData.available === false)
    ) {
      toast.error("Diese Verleih ist derzeit nicht verfügbar.")
      return
    }

    setProcessing(true)

    try {
      // Get form values
      const locationInput = document.getElementById("location") as HTMLInputElement
      const notesInput = document.getElementById("notes") as HTMLTextAreaElement
      const dateInput = document.getElementById("date") as HTMLInputElement
      const timeInput = document.getElementById("time") as HTMLInputElement

      const location = locationInput?.value || ""
      const notes = notesInput?.value || ""
      
      // Combine date and time for scheduled_date
      let scheduledDate: string | undefined
      if (dateInput?.value && timeInput?.value) {
        scheduledDate = `${dateInput.value}T${timeInput.value}:00`
      }

      // Calculate total amount (base price + commission) * quantity
      const baseAmount = bookingData.basePrice * quantity
      const commission = baseAmount * 0.1 // 10% commission
      const totalAmount = baseAmount + commission

      // Map booking type to order type
      const orderType: OrderType = bookingData.type === "service" ? "service" : bookingData.type === "product" ? "product" : "rental"

      // Create order
      const order = await createOrder({
        seller_id: sellerId,
        service_id: type === "master" && serviceId ? serviceId : undefined,
        product_id: type === "product" ? parseInt(id) : undefined,
        rental_id: type === "rental" ? parseInt(id) : undefined,
        amount: baseAmount, // Backend will calculate commission
        order_type: orderType,
        scheduled_date: scheduledDate,
        location: location || undefined,
        notes: notes || undefined,
      })

      // If payment method is card, redirect to Stripe checkout
      if (paymentMethod === "card") {
        const checkoutSession = await createCheckoutSession({
          order_id: order.id,
        })

        // Redirect to Stripe checkout
        if (checkoutSession.url) {
          window.location.href = checkoutSession.url
          return
        } else {
          toast.error("Fehler beim Erstellen der Checkout-Sitzung")
        }
      } else {
        // Cash payment - redirect to confirmation
        toast.success("Buchung erfolgreich erstellt! Die Zahlung wird bei Lieferung/Ankunft abgewickelt.")
        router.push(`/booking/confirmation?order_id=${order.id}`)
      }
    } catch (error: any) {
      console.error("Failed to create booking:", error)
      const errorMessage = error?.response?.data?.detail || error?.message || "Fehler beim Erstellen der Buchung. Bitte versuchen Sie es erneut."
      toast.error(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!bookingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Buchung nicht gefunden</h2>
          <p className="text-muted-foreground">Die Buchung, die Sie suchen, existiert nicht.</p>
        </div>
      </div>
    )
  }

  const isRentalOutOfStock =
    bookingData.type === "rental" &&
    ((bookingData.stock ?? 0) <= 0 || bookingData.available === false)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-sides py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
            {bookingData.type === "product" ? "Kauf abschließen" : "Buchung abschließen"}
          </h1>
          <p className="text-muted-foreground">
            Überprüfen Sie die Details und bestätigen Sie Ihre {bookingData.type === "product" ? "Bestellung" : "Reservierung"}
          </p>
        </div>

        <form onSubmit={handleConfirmBooking}>
        {isRentalOutOfStock && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Verleih nicht verfügbar</AlertTitle>
            <AlertDescription>
              Diese Verleih hat derzeit keinen verfügbaren Bestand. Sie können die Details unten einsehen, aber die Buchung ist deaktiviert,
              bis der Eigentümer den Bestand auffüllt.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Booking Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Booking Details */}
            {bookingData.type !== "product" && (
              <Card>
                <CardHeader>
                  <CardTitle>Buchungsdetails</CardTitle>
                  <CardDescription>Wählen Sie Ihr bevorzugtes Datum und Ihre bevorzugte Uhrzeit</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Datum</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="date" type="date" className="pl-10" defaultValue="2025-02-15" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Uhrzeit</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="time" type="time" className="pl-10" defaultValue="10:00" />
                      </div>
                    </div>
                  </div>

                  {bookingData.type === "rental" && (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1 rounded-md border border-dashed border-amber-400 bg-amber-50/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                          Verfügbare Einheiten
                        </span>
                        <span className="text-sm font-semibold text-amber-900">
                          {Math.max(0, bookingData.stock ?? 0)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duration">Mietdauer</Label>
                        <RadioGroup defaultValue="1">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="1" id="1day" />
                            <Label htmlFor="1day" className="font-normal cursor-pointer">
                              1 Tag - €{bookingData.basePrice.toFixed(2)}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="3" id="3days" />
                            <Label htmlFor="3days" className="font-normal cursor-pointer">
                              3 Tage - €{(bookingData.basePrice * 3 * 0.9).toFixed(2)} (10% sparen)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="7" id="7days" />
                            <Label htmlFor="7days" className="font-normal cursor-pointer">
                              7 Tage - €{(bookingData.basePrice * 7 * 0.8).toFixed(2)} (20% sparen)
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="location">Ort</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="location" placeholder="Geben Sie Ihre Adresse ein" className="pl-10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Zusätzliche Hinweise</Label>
                    <Textarea id="notes" placeholder="Spezielle Anforderungen oder Details..." rows={4} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Location field for products */}
            {bookingData.type === "product" && (
              <Card>
                <CardHeader>
                  <CardTitle>Versandinformationen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="shipping-address">Versandadresse</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="shipping-address" placeholder="Geben Sie Ihre Versandadresse ein" className="pl-10" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Kontaktinformationen</CardTitle>
                <CardDescription>Wie können wir Sie erreichen?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Vorname</Label>
                    <Input id="firstName" placeholder="Max" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input id="lastName" placeholder="Mustermann" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input id="email" type="email" placeholder="max@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefonnummer</Label>
                  <Input id="phone" type="tel" placeholder="+49 30 9834 2765" />
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle>Zahlungsmethode</CardTitle>
                <CardDescription>Wählen Sie Ihre bevorzugte Zahlungsmethode</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center space-x-2 p-4 border border-border/50 rounded-lg cursor-pointer hover:bg-accent hover:border-border/80 transition-all duration-200">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-2 font-normal cursor-pointer flex-1">
                      <CreditCard className="h-4 w-4" />
                      Kredit- oder Debitkarte (Stripe)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border border-border/50 rounded-lg cursor-pointer hover:bg-accent hover:border-border/80 transition-all duration-200">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="font-normal cursor-pointer flex-1">
                      Bezahlung bei {bookingData.type === "product" ? "Lieferung" : "Ankunft"} (Bar)
                    </Label>
                  </div>
                </RadioGroup>

                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Kartennummer</Label>
                    <Input id="cardNumber" placeholder="1234 5678 9012 3456" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Ablaufdatum</Label>
                      <Input id="expiry" placeholder="MM/JJ" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVV</Label>
                      <Input id="cvv" placeholder="123" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Bestellübersicht</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <img
                    src={bookingData.image || "/placeholder.svg"}
                    alt={bookingData.title}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm line-clamp-2">{bookingData.title}</h3>
                    <p className="text-sm text-muted-foreground">{bookingData.provider}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-sm font-medium">{bookingData.rating.toFixed(1)}</span>
                      <span className="text-yellow-500">★</span>
                      <span className="text-xs text-muted-foreground">({bookingData.reviews})</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {quantity > 1 && (
                  <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Menge</span>
                    <span className="font-semibold text-foreground">{quantity}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Grundpreis{bookingData.priceUnit ? ` (${bookingData.priceUnit})` : ""}
                      {quantity > 1 ? ` × ${quantity}` : ""}
                    </span>
                    <span className="font-medium">€{(bookingData.basePrice * quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Servicegebühr</span>
                    <span className="font-medium">€{(bookingData.basePrice * quantity * 0.1).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Steuer</span>
                    <span className="font-medium">€{(bookingData.basePrice * quantity * 0.08).toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Gesamt</span>
                  <span>€{(bookingData.basePrice * quantity * 1.18).toFixed(2)}</span>
                </div>

                {bookingData.type === "rental" && (
                  <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Verbleibende Einheiten</span>
                    <span className="font-semibold text-foreground">
                      {Math.max(0, bookingData.stock ?? 0)}
                    </span>
                  </div>
                )}

                {isRentalOutOfStock && (
                  <Alert variant="destructive">
                    <AlertTitle>Derzeit nicht verfügbar</AlertTitle>
                    <AlertDescription>
                      Diese Verleih hat keinen verbleibenden Bestand. Bitte schauen Sie später noch einmal vorbei oder kontaktieren Sie den Eigentümer für geschätzte Verfügbarkeit.
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  className="w-full" 
                  size="lg" 
                  type="submit"
                  disabled={processing || !sellerId || isRentalOutOfStock}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Wird verarbeitet...
                    </>
                  ) : isRentalOutOfStock ? (
                    "Nicht verfügbar"
                  ) : (
                    `${bookingData.type === "product" ? "Kauf" : "Buchung"} bestätigen`
                  )}
                </Button>

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>
                    Ihre Zahlungsinformationen sind sicher und verschlüsselt.{" "}
                    {bookingData.type !== "product" && "Sie können bis zu 24 Stunden vor Ihrer Buchung kostenlos stornieren."}
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Sofortige Bestätigung</span>
                  </div>
                  {bookingData.type !== "product" && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Kostenlose Stornierung</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Sichere Zahlung</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </form>
      </div>
    </div>
  )
}
