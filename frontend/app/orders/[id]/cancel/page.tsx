"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { XCircle, ArrowLeft, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PaymentCancelPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params?.id as string

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4 mx-auto">
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-500" />
            </div>
            <CardTitle className="text-2xl">Zahlung abgebrochen</CardTitle>
            <CardDescription>
              Ihre Zahlung wurde abgebrochen. Es wurden keine Gebühren erhoben.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Der Zahlungsvorgang wurde abgebrochen. Ihre Bestellung ist noch ausstehend und kann später abgeschlossen werden.
              </p>
              {orderId && (
                <p className="text-sm text-muted-foreground">
                  Bestell-ID: #{orderId}
                </p>
              )}
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="font-semibold">Was möchten Sie tun?</h3>
              
              <div className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    // Try to go back to booking page
                    router.back()
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Erneut versuchen
                </Button>

                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  asChild
                >
                  <Link href={`/booking/${orderId}`}>
                    <CreditCard className="h-4 w-4" />
                    Zahlung abschließen
                  </Link>
                </Button>

                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  asChild
                >
                  <Link href="/bookings">
                    Meine Bestellungen anzeigen
                  </Link>
                </Button>

                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  asChild
                >
                  <Link href="/">
                    Zurück zur Startseite
                  </Link>
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Benötigen Sie Hilfe? Kontaktieren Sie unser Support-Team für Unterstützung.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

