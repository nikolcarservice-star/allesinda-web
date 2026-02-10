"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CalendarIcon, Clock } from "lucide-react"

interface BookingCardProps {
  master: {
    name: string
    priceFrom: number
  }
}

export function BookingCard({ master }: BookingCardProps) {
  const [date, setDate] = useState<Date | undefined>(new Date())

  return (
    <Card className="sticky top-20 border-border/50 shadow-sm hover:shadow-md transition-all duration-200">
      <CardHeader>
        <CardTitle>Service buchen</CardTitle>
        <p className="text-sm text-muted-foreground">Ab €{master.priceFrom}/Stunde</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-2 block">Datum auswählen</Label>
          <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
        </div>

        <div>
          <Label htmlFor="time" className="mb-2 block">
            Bevorzugte Uhrzeit
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="gap-2 bg-transparent pl-3 pr-5">
              <Clock className="h-4 w-4" />
              Morgen
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent pl-3 pr-5">
              <Clock className="h-4 w-4" />
              Nachmittag
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="message" className="mb-2 block">
            Beschreiben Sie Ihr Projekt
          </Label>
          <Textarea id="message" placeholder="Erzählen Sie uns von Ihren Projektanforderungen..." rows={4} />
        </div>

        <Button className="w-full pl-4 pr-6" size="lg">
          <CalendarIcon className="h-4 w-4 mr-2" />
          Buchung anfragen
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Sie werden noch nicht belastet. Der Meister wird Ihre Anfrage zuerst prüfen.
        </p>
      </CardContent>
    </Card>
  )
}
