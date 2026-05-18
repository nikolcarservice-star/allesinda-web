"use client"

import { useState, useEffect } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { addFavorite, removeFavorite, checkFavorite } from "@/lib/api/favorites"
import { toast } from "sonner"
import { useAuth } from "@/lib/context/auth-context"
import { useRouter } from "next/navigation"
import type { FavoriteType } from "@/lib/api/types"

interface FavoriteButtonProps {
  favoriteType: FavoriteType
  favoriteId: number
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "default" | "ghost" | "outline"
  /** Icon-only (default) or text label for header actions */
  display?: "icon" | "label"
}

export function FavoriteButton({
  favoriteType,
  favoriteId,
  className,
  size = "md",
  variant = "ghost",
  display = "icon",
}: FavoriteButtonProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [isFavorited, setIsFavorited] = useState(false)
  const [favoriteItemId, setFavoriteItemId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    loadFavoriteStatus()
  }, [favoriteType, favoriteId])

  const loadFavoriteStatus = async () => {
    try {
      setLoading(true)
      const result = await checkFavorite(favoriteType, favoriteId)
      setIsFavorited(result.is_favorited)
      setFavoriteItemId(result.favorite_id)
    } catch (error: any) {
      // If not authenticated, just set to false
      if (error?.statusCode === 401) {
        setIsFavorited(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (toggling || loading) return

    // Check if user is logged in
    if (!user) {
      toast.error("Bitte melden Sie sich zuerst an, um Favoriten hinzuzufügen", {
        action: {
          label: "Anmelden",
          onClick: () => router.push("/login"),
        },
      })
      return
    }

    try {
      setToggling(true)

      if (isFavorited && favoriteItemId) {
        await removeFavorite(favoriteItemId)
        setIsFavorited(false)
        setFavoriteItemId(null)
        toast.success("Aus Favoriten entfernt")
      } else {
        const favorite = await addFavorite({
          favorite_type: favoriteType,
          favorite_id: favoriteId,
        })
        setIsFavorited(true)
        setFavoriteItemId(favorite.id)
        toast.success("Zu Favoriten hinzugefügt")
      }
    } catch (error: any) {
      if (error?.statusCode === 401) {
        toast.error("Bitte melden Sie sich an, um Favoriten hinzuzufügen", {
          action: {
            label: "Anmelden",
            onClick: () => router.push("/login"),
          },
        })
      } else {
        toast.error(error?.message || "Favorit konnte nicht aktualisiert werden")
      }
    } finally {
      setToggling(false)
    }
  }

  const sizeClasses = {
    sm: "!h-6 !w-6 !p-0 !min-h-6 !min-w-6",
    md: "!h-9 !w-9 !p-0 !min-h-9 !min-w-9",
    lg: "!h-11 !w-11 !p-0 !min-h-11 !min-w-11",
  }

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  const labelText = isFavorited ? "Gespeichert" : "Speichern"
  const ariaLabel = isFavorited ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"

  if (display === "label") {
    return (
      <Button
        variant={variant}
        size="sm"
        className={cn(
          "h-9 shrink-0 px-3 text-sm font-semibold text-foreground hover:text-foreground",
          isFavorited && "text-rose-600 hover:text-rose-700",
          toggling && "opacity-50 cursor-not-allowed",
          className,
        )}
        onClick={handleToggle}
        disabled={loading || toggling}
        aria-label={ariaLabel}
        aria-pressed={isFavorited}
      >
        {labelText}
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      className={cn(
        sizeClasses[size],
        "group/fav relative overflow-hidden rounded-full border transition-all duration-200 hover:-translate-y-0.5",
        isFavorited
          ? "border-rose-200/60 bg-rose-50/95 text-rose-600 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/80 dark:text-rose-400 dark:hover:bg-rose-900/90"
          : "border-white/40 bg-white/90 text-foreground/70 hover:bg-white hover:text-foreground dark:border-white/20 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20 dark:hover:text-white",
        "supports-[backdrop-filter]:backdrop-blur-sm shadow-sm hover:shadow-md",
        toggling && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={handleToggle}
      disabled={loading || toggling}
      aria-label={ariaLabel}
    >
      <Heart
        className={cn(
          iconSizes[size],
          "relative transition-all duration-200 group-hover/fav:scale-105",
          isFavorited
            ? "fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400"
            : "fill-none stroke-[1.75] text-foreground/65 group-hover/fav:text-rose-500 group-hover/fav:stroke-rose-500 dark:text-white/70 dark:group-hover/fav:text-rose-400 dark:group-hover/fav:stroke-rose-400"
        )}
      />
    </Button>
  )
}

