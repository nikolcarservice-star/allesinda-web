"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  readConsent,
  saveConsent,
  updateAnalyticsConsent,
} from "@/lib/analytics/consent"

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!readConsent()) {
      setIsVisible(true)
    }
  }, [])

  const handleConsent = (analytics: boolean) => {
    saveConsent(analytics)
    updateAnalyticsConsent(analytics)
    setIsVisible(false)
  }

  if (!isVisible) {
    return null
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-[70] max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-border bg-background/95 px-sides py-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:bottom-0">
      <div className="container mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Cookie-Einstellungen</p>
          <p>
            Diese Website verwendet Cookies. Technisch notwendige Cookies sind immer aktiv. Analyse-Cookies
            (Google Analytics) werden nur mit Ihrer Zustimmung gesetzt. Weitere Informationen finden Sie in
            unserer{" "}
            <Link className="font-medium text-primary underline-offset-2 hover:underline" href="/privacy">
              Datenschutzerklärung
            </Link>
            .
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => handleConsent(false)}>
            Nur notwendige Cookies
          </Button>
          <Button type="button" onClick={() => handleConsent(true)}>
            Alle Cookies akzeptieren
          </Button>
        </div>
      </div>
    </div>
  )
}
