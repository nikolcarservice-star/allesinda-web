"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { FavoriteButton } from "@/components/ui/favorite-button"
import { Button } from "@/components/ui/button"
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
        <div className="relative h-8 w-[100px] sm:h-9 sm:w-[120px]">
          <Image
            src="/logo_dark.webp"
            alt="Allesinda Logo"
            fill
            className="object-contain object-center"
            priority
            sizes="120px"
          />
        </div>
      </Link>

      <div className="flex justify-self-end">
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
