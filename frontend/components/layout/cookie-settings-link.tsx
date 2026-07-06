"use client"

import { COOKIE_SETTINGS_EVENT } from "@/components/layout/cookie-consent"

type CookieSettingsLinkProps = {
  className?: string
}

export function CookieSettingsLink({ className }: CookieSettingsLinkProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))
      }}
    >
      Cookie-Einstellungen
    </button>
  )
}
