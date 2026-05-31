"use client"

import { usePathname } from "next/navigation"
import { Footer } from "./footer"
import { useAuth } from "@/lib/context/auth-context"

/**
 * Renders Footer on all routes except the messages page,
 * so the chat page can feel like a full-screen native app on mobile.
 */
export function ConditionalFooter() {
  const pathname = usePathname()
  const { user } = useAuth()
  const isMasterCabinet = pathname === "/profile" && user?.role === "master"

  if (pathname?.startsWith("/messages") || pathname === "/" || isMasterCabinet) {
    return null
  }
  return (
    <div className="pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      <Footer />
    </div>
  )
}
