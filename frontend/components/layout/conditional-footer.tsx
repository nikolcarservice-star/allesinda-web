"use client"

import { usePathname } from "next/navigation"
import { Footer } from "./footer"

/**
 * Renders Footer on all routes except the messages page,
 * so the chat page can feel like a full-screen native app on mobile.
 */
export function ConditionalFooter() {
  const pathname = usePathname()
  if (pathname?.startsWith("/messages")) {
    return null
  }
  return <Footer />
}
