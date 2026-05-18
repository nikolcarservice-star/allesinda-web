"use client"

import Link from "next/link"
import Image from "next/image"
import { FavoriteButton } from "@/components/ui/favorite-button"
import { cn } from "@/lib/utils"

interface MasterDetailHeaderBarProps {
  profileId: number
  className?: string
}

export function MasterDetailHeaderBar({ profileId, className }: MasterDetailHeaderBarProps) {
  return (
    <div className={cn("container mx-auto flex h-16 items-center justify-between gap-3 px-sides", className)}>
      <Link href="/" className="flex min-w-0 shrink-0 items-center" aria-label="Allesinda Startseite">
        <div className="relative h-8 w-[100px] sm:h-10 sm:w-[140px]">
          <Image
            src="/logo_dark.webp"
            alt="Allesinda Logo"
            fill
            className="object-contain object-left"
            priority
            sizes="(max-width: 640px) 120px, 140px"
          />
        </div>
      </Link>
      <FavoriteButton
        favoriteType="profile"
        favoriteId={profileId}
        display="label"
        variant="ghost"
      />
    </div>
  )
}
