"use client"

import Image from "next/image"
import { cn, getMediaAbsoluteUrl } from "@/lib/utils"

interface BeforeAfterCardProps {
  beforeUrl: string
  afterUrl: string
  className?: string
  priority?: boolean
  onClick?: () => void
}

export function BeforeAfterCard({
  beforeUrl,
  afterUrl,
  className,
  priority = false,
  onClick,
}: BeforeAfterCardProps) {
  return (
    <div
      className={cn("relative aspect-square bg-muted", className)}
      onClick={onClick}
    >
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        <div className="relative bg-muted">
          <Image
            src={getMediaAbsoluteUrl(beforeUrl) || beforeUrl || "/placeholder.svg"}
            alt="Vorher"
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            quality={90}
            {...(priority ? { priority: true } : { loading: "lazy" })}
          />
          <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 md:bottom-4 md:left-4 bg-black/80 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium backdrop-blur-md border border-white/20 shadow-xl z-10">
            Vorher
          </div>
        </div>
        <div className="relative bg-muted">
          <Image
            src={getMediaAbsoluteUrl(afterUrl) || afterUrl || "/placeholder.svg"}
            alt="Nachher"
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            quality={90}
            {...(priority ? { priority: true } : { loading: "lazy" })}
          />
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 md:bottom-4 md:right-4 bg-primary/90 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium backdrop-blur-md border border-white/20 shadow-xl z-10">
            Nachher
          </div>
        </div>
      </div>
    </div>
  )
}

