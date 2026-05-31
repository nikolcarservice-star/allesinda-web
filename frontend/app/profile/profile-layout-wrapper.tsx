"use client"

import { useAuth } from "@/lib/context/auth-context"
import { usePathname } from "next/navigation"

/**
 * Offsets root layout header padding when the master cabinet renders its own header.
 */
export function ProfileLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const isMasterCabinet = pathname === "/profile" && user?.role === "master"

  if (!isMasterCabinet) {
    return <>{children}</>
  }

  return (
    <div className="-mt-14 sm:-mt-[72px] pt-0 lg:mt-0 lg:pt-0">
      {children}
    </div>
  )
}
