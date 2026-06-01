"use client"

import { useAuth } from "@/lib/context/auth-context"
import { usePathname } from "next/navigation"

/**
 * On mobile, master cabinet hides the global header — cancel root layout top padding.
 * Desktop keeps the normal header offset.
 */
export function ProfileLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const isMasterCabinet = pathname === "/profile" && user?.role === "master"

  if (!isMasterCabinet) {
    return <>{children}</>
  }

  return <div className="-mt-14 pt-0 sm:-mt-[72px] lg:mt-0 lg:pt-0">{children}</div>
}
