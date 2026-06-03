"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { resetMobileViewportZoom } from "@/lib/utils/reset-mobile-viewport"

/** После смены страницы (например /login → /) снимаем зум iOS. */
export function MobileViewportReset() {
  const pathname = usePathname()

  useEffect(() => {
    resetMobileViewportZoom()
  }, [pathname])

  return null
}
