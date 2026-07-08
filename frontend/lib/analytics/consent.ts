export const GA_MEASUREMENT_ID = "G-69NP5395Z3"
export const CONSENT_STORAGE_KEY = "allesinda_consent"

export type Consent = {
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

export function ensureGtag() {
  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    ((...args: GtagCommand) => {
      window.dataLayer.push(args)
    })
}

export function setDefaultConsent() {
  ensureGtag()
  window.gtag?.("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  })
}

export function updateAnalyticsConsent(granted: boolean) {
  ensureGtag()
  window.gtag?.("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })

  if (granted) {
    window.gtag?.("event", "page_view")
  }
}

export function readConsent(): Consent | null {
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

export function saveConsent(analytics: boolean) {
  const consent: Consent = {
    necessary: true,
    analytics,
    timestamp: new Date().toISOString(),
  }

  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent))
}

export function applyStoredConsent() {
  const consent = readConsent()
  if (!consent) {
    return
  }

  updateAnalyticsConsent(consent.analytics)
}

export function configureGoogleAnalytics() {
  ensureGtag()
  window.gtag?.("js", new Date())
  window.gtag?.("config", GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: false,
  })
  applyStoredConsent()
}
