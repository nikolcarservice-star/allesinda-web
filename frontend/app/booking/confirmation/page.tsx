import Link from "next/link"
import { CheckCircle2, Calendar, Clock, MapPin, User, Download, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

export default function BookingConfirmationPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground">
            Ihre Buchung wurde erfolgreich bestätigt. Wir haben eine Bestätigungs-E-Mail an john@example.com gesendet
          </p>
        </div>

        {/* Booking Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Booking Details</CardTitle>
                <CardDescription>Confirmation #ALI-2025-001234</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Receipt
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Service Info */}
            <div className="flex gap-4">
              <img
                src="/professional-plumber-portrait.png"
                alt="Service"
                className="w-24 h-24 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Professional Plumbing Service</h3>
                <p className="text-muted-foreground">with John Smith</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-sm font-medium">4.9</span>
                  <span className="text-yellow-500">★</span>
                  <span className="text-xs text-muted-foreground">(127 reviews)</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Booking Information */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Date</p>
                  <p className="text-sm text-muted-foreground">February 15, 2025</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Time</p>
                  <p className="text-sm text-muted-foreground">10:00 AM - 12:00 PM</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-sm text-muted-foreground">123 Main St, San Francisco, CA 94102</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Contact</p>
                  <p className="text-sm text-muted-foreground">John Doe</p>
                  <p className="text-sm text-muted-foreground">+49 30 9834 2765</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment Summary */}
            <div className="space-y-2">
              <h3 className="font-semibold mb-3">Zahlungsübersicht</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Grundpreis</span>
                <span>€75.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Servicegebühr</span>
                <span>€7.50</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Steuer</span>
                <span>€6.00</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Gesamt bezahlt</span>
                <span>€88.50</span>
              </div>
              <p className="text-xs text-muted-foreground">Bezahlt mit Visa, endet auf 1234</p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Button variant="outline" size="lg" asChild>
            <Link href="/messages">
              <MessageSquare className="h-4 w-4 mr-2" />
              Anbieter kontaktieren
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/bookings">Alle Buchungen anzeigen</Link>
          </Button>
        </div>

        {/* What's Next */}
        <Card>
          <CardHeader>
            <CardTitle>Was kommt als Nächstes?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                1
              </div>
              <div>
                <p className="font-medium">Bestätigungs-E-Mail gesendet</p>
                <p className="text-sm text-muted-foreground">Überprüfen Sie Ihre E-Mail für Buchungsdetails und Quittung</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                2
              </div>
              <div>
                <p className="font-medium">Anbieter wird Sie kontaktieren</p>
                <p className="text-sm text-muted-foreground">
                  Der Anbieter wird sich vor dem Termin bei Ihnen melden, um Details zu bestätigen
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                3
              </div>
              <div>
                <p className="font-medium">Servicetermin</p>
                <p className="text-sm text-muted-foreground">
                  Ihr Anbieter wird zur geplanten Zeit am 15. Februar 2025 eintreffen
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                4
              </div>
              <div>
                <p className="font-medium">Bewertung hinterlassen</p>
                <p className="text-sm text-muted-foreground">Teilen Sie nach dem Service Ihre Erfahrung, um anderen zu helfen</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-8">
          <Button asChild size="lg">
            <Link href="/">Zurück zur Startseite</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
