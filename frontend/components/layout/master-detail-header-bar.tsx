"use client"

import Link from "next/link"
import { BrandLogo } from "@/components/layout/brand-logo"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { FavoriteButton } from "@/components/ui/favorite-button"
import { Button } from "@/components/ui/button"
import { ProfileReportButton } from "@/components/detailed/profile-report-button"
import { cn } from "@/lib/utils"

interface MasterDetailHeaderBarProps {
  profileId: number
  className?: string
}

export function MasterDetailHeaderBar({ profileId, className }: MasterDetailHeaderBarProps) {
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== "undefined") {
      try {
        const ref = document.referrer
        if (ref && new URL(ref).origin === window.location.origin) {
          router.back()
          return
        }
      } catch {
        // ignore invalid referrer
      }
    }
    router.push("/?types=master")
  }

  return (
    <div
      className={cn(
        "container mx-auto grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 px-sides",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 w-fit justify-self-start px-1 text-sm font-medium text-foreground hover:bg-transparent"
        aria-label="Zurück"
        onClick={handleBack}
      >
        <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
        <span>Zurück</span>
      </Button>

      <Link href="/" className="flex items-center justify-center" aria-label="Allesinda Startseite">
        <BrandLogo className="h-8 w-[100px] sm:h-9 sm:w-[120px]" />
      </Link>

      <div className="flex items-center justify-self-end gap-1">
        <ProfileReportButton
          profileId={profileId}
          variant="ghost"
          size="sm"
          showLabel={false}
          className="h-9 w-9 px-0"
        />
        <FavoriteButton
          favoriteType="profile"
          favoriteId={profileId}
          display="label"
          variant="ghost"
        />
      </div>
    </div>
  )
}
