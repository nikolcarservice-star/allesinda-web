"use client"

import { usePathname } from "next/navigation"
import { Footer } from "./footer"
import { useAuth } from "@/lib/context/auth-context"

/**
 * Renders site footer on desktop (lg+). Hidden on mobile — bottom nav is used instead.
 * Skipped on messages, home, and master cabinet routes.
 */
export function ConditionalFooter() {
  const pathname = usePathname()
  const { user } = useAuth()
  const isMasterCabinet = pathname === "/profile" && user?.role === "master"

  if (pathname?.startsWith("/messages") || pathname === "/") {
    return null
  }
  if (isMasterCabinet) {
    return (
      <div className="hidden lg:block">
        <Footer />
      </div>
    )
  }
  return <Footer />
}
