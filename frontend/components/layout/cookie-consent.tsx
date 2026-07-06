"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const GA_MEASUREMENT_ID = "G-69NP5395Z3"
const CONSENT_STORAGE_KEY = "allesinda_consent"
export const COOKIE_SETTINGS_EVENT = "allesinda:open-cookie-settings"

type Consent = {
  necessary: true
  analytics: boolean
  timestamp: string
}

type GtagCommand = [command: string, ...args: unknown[]]

declare global {
  interface Window {
    dataLayer: GtagCommand[]
    gtag?: (...args: GtagCommand) => void
  }
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    ((...args: GtagCommand) => {
      window.dataLayer.push(args)
    })
}

function updateAnalyticsConsent(granted: boolean) {
  ensureGtag()
  window.gtag?.("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: "denied",
  })
}

function setDefaultConsent() {
  ensureGtag()
  window.gtag?.("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    wait_for_update: 500,
  })
}

function readConsent(): Consent | null {
  try {
    const rawConsent = localStorage.getItem(CONSENT_STORAGE_KEY)

    if (!rawConsent) {
      return null
    }

    const parsed = JSON.parse(rawConsent) as Partial<Consent>

    if (parsed.necessary !== true || typeof parsed.analytics !== "boolean") {
      return null
    }

    return {
      necessary: true,
      analytics: parsed.analytics,
      timestamp: typeof parsed.timestamp === "string" ? parsed.timestamp : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function saveConsent(analytics: boolean) {
  const consent: Consent = {
    necessary: true,
    analytics,
    timestamp: new Date().toISOString(),
  }

  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent))
}

function loadGoogleAnalytics() {
  if (document.getElementById("ga-script")) {
    return
  }

  ensureGtag()

  const script = document.createElement("script")
  script.id = "ga-script"
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  script.onload = () => {
    window.gtag?.("js", new Date())
    window.gtag?.("config", GA_MEASUREMENT_ID, { anonymize_ip: true })
  }

  document.head.appendChild(script)
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setDefaultConsent()

    const consent = readConsent()

    if (!consent) {
      setIsVisible(true)
      return
    }

    updateAnalyticsConsent(consent.analytics)

    if (consent.analytics) {
      loadGoogleAnalytics()
    }
  }, [])

  useEffect(() => {
    const openSettings = () => {
      setIsVisible(true)
    }

    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings)

    return () => {
      window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings)
    }
  }, [])

  const handleConsent = (analytics: boolean) => {
    saveConsent(analytics)
    updateAnalyticsConsent(analytics)

    if (analytics) {
      loadGoogleAnalytics()
    }

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
            (Google Analytics {GA_MEASUREMENT_ID}) werden nur mit Ihrer Zustimmung gesetzt. Weitere Informationen
            finden Sie in unserer{" "}
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
