"use client"

import { Toaster } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"

/** Toasts above the mobile bottom nav + safe area; default offset on desktop. */
export function AppToaster() {
  const isMobile = useIsMobile()

  return (
    <Toaster
      closeButton
      position="bottom-right"
      offset={
        isMobile
          ? "calc(4.5rem + env(safe-area-inset-bottom, 0px))"
          : "1rem"
      }
    />
  )
}
