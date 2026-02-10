"use client"

import { Button } from "@/components/ui/button"
import { Share2 } from "lucide-react"
import { useState } from "react"

interface ShareProfileButtonProps {
  title: string
  description?: string | null
  className?: string
}

export function ShareProfileButton({ title, description, className }: ShareProfileButtonProps) {
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
    <Button
      size="lg"
      variant="outline"
      className={className}
      onClick={handleShare}
    >
      {copied ? "Copied!" : "Share Profile"}
      {!copied && <Share2 className="ml-2 h-4 w-4" />}
    </Button>
  )
}

