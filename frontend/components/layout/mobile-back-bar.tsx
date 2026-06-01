"use client"

import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getMobileBackFallback,
  navigateMobileBack,
  shouldShowMobileBackBar,
} from "@/lib/navigation/mobile-back"
import { cn } from "@/lib/utils"

type MobileBackBarProps = {
  className?: string
}

export function MobileBackBar({ className }: MobileBackBarProps) {
  const pathname = usePathname() ?? ""
  const router = useRouter()

  const visible = shouldShowMobileBackBar(pathname)
  const fallbackHref = useMemo(() => getMobileBackFallback(pathname), [pathname])

  if (!visible) return null

  return (
    <div
      className={cn(
        "sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-md lg:hidden",
        "pt-[max(0px,env(safe-area-inset-top,0px))]",
        className,
      )}
    >
      <div className="flex h-11 items-center px-4 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-fit px-1 text-sm font-medium text-foreground hover:bg-transparent"
          aria-label="Zurück"
          onClick={() => navigateMobileBack(router, fallbackHref)}
        >
          <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
          <span>Zurück</span>
        </Button>
      </div>
    </div>
  )
}
