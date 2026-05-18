"use client"

import { usePathname } from "next/navigation"
import { Footer } from "./footer"

/**
 * Renders Footer on all routes except the messages page,
 * so the chat page can feel like a full-screen native app on mobile.
 */
const MASTER_DETAIL_PATH = /^\/detailed\/master\/[^/]+/

export function ConditionalFooter() {
  const pathname = usePathname() ?? ""
  if (pathname.startsWith("/messages") || pathname === "/") {
    return null
  }

  if (MASTER_DETAIL_PATH.test(pathname)) {
    return (
      <div className="hidden lg:block">
        <Footer />
      </div>
    )
  }
  return (
    <div className="pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      <Footer />
    </div>
  )
}
