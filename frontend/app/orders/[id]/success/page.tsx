"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getOrder } from "@/lib/api/orders"
import type { Order } from "@/lib/api/types"
import { toast } from "sonner"

export default function PaymentSuccessPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params?.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      loadOrder()
    }
  }, [orderId])

  const loadOrder = async () => {
    try {
      setLoading(true)
      const orderData = await getOrder(parseInt(orderId))
      setOrder(orderData)
      
      // If order is not paid, show warning
      if (orderData.status !== "paid") {
        toast.warning("Payment is being processed. Please wait a moment.")
      } else {
        toast.success("Zahlung erfolgreich! Ihre Bestellung wurde bestätigt.")
      }
    } catch (error: any) {
      console.error("Failed to load order:", error)
      setError(error?.message || "Fehler beim Laden der Bestelldetails")
      toast.error("Fehler beim Laden der Bestelldetails")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Bestelldetails werden geladen...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Bestellung nicht gefunden</h1>
          <p className="text-muted-foreground">{error || "Die Bestellung, die Sie suchen, existiert nicht."}</p>
          <Button asChild>
            <Link href="/">Zurück zur Startseite</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Zahlung erfolgreich!</h1>
          <p className="text-muted-foreground">
            Ihre Bestellung wurde bestätigt und die Zahlung wurde abgewickelt.
          </p>
        </div>

        {/* Order Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Bestelldetails</CardTitle>
                <CardDescription>Bestellung #{order.id}</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/orders/${order.id}`}>View Order</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Order Type</p>
                <p className="font-semibold capitalize">{order.order_type}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                <p className="font-semibold capitalize">{order.status}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Betrag</p>
                <p className="font-semibold">€{order.amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Provision</p>
                <p className="font-semibold">€{order.commission.toFixed(2)}</p>
              </div>
            </div>

            {order.scheduled_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Geplantes Datum</p>
                <p className="font-semibold">{new Date(order.scheduled_date).toLocaleString()}</p>
              </div>
            )}

            {order.location && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Ort</p>
                <p className="font-semibold">{order.location}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Button variant="outline" size="lg" asChild>
            <Link href="/bookings">Alle Bestellungen anzeigen</Link>
          </Button>
          <Button size="lg" asChild>
            <Link href="/">Zurück zur Startseite</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

