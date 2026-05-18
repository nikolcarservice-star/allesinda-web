"use client"

import { Button } from "@/components/ui/button"
import { Share2 } from "lucide-react"
import { useState } from "react"

interface ShareProfileButtonProps {
  title: string
  description?: string | null
  className?: string
  label?: string
  copiedLabel?: string
  variant?: "default" | "ghost" | "outline"
  size?: "default" | "sm" | "lg" | "icon"
}

export function ShareProfileButton({
  title,
  description,
  className,
  label = "Profil teilen",
  copiedLabel = "Kopiert!",
  variant = "outline",
  size = "lg",
}: ShareProfileButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = window.location.href

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: description ?? undefined,
          url,
        })
      } else {
        // Fallback to copy to clipboard
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (error) {
      // User cancelled or error occurred, try clipboard fallback
      if (!navigator.share) {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  return (
    <Button size={size} variant={variant} className={className} onClick={handleShare}>
      {!copied && <Share2 className="mr-2 h-4 w-4" />}
      {copied ? copiedLabel : label}
    </Button>
  )
}

