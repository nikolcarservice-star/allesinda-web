"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Loader2 } from "lucide-react"
import { getWorkGallery, getProfileGallery } from "@/lib/api/gallery"
import { searchMasters } from "@/lib/api/search"
import type { Media } from "@/lib/api/types"
import { GalleryCard } from "@/components/gallery/gallery-card"

interface WorkGalleryProps {
  searchQuery?: string
}

export function WorkGallery({ searchQuery = "" }: WorkGalleryProps) {
  const [gallery, setGallery] = useState<(Media & { master_name?: string; master_profile_id?: number; master_verified?: boolean; master_image_url?: string | null })[]>([])
  const [loading, setLoading] = useState(true)

  const loadGalleryForSearch = useCallback(async (query: string) => {
    try {
      // Get top 5 masters from search
      const mastersResponse = await searchMasters({ q: query, page: 1, page_size: 5 })
      const masters = mastersResponse.items || []
      
      if (masters.length === 0) {
        setGallery([])
        return
      }

      // For each master, get their gallery items
      const galleryPromises = masters.map(async (master) => {
        const profileId = master.id
        if (!profileId) return []

        try {
          // Get all gallery items for this master
          const galleryResponse = await getProfileGallery(profileId, {
            page: 1,
            page_size: 24, // Get more items to have options
            // All media is now automatically approved
          })
          
          const items = galleryResponse.items || []
          
          // Separate before-after and normal items
          const beforeAfterItems = items.filter(item => item.is_before_after === true && item.before_url && item.after_url)
          const normalItems = items.filter(item => item.is_before_after !== true)
          
          // Try to get 1 before-after + 1 normal, or 2 normal if no before-after
          const selectedItems: (Media & { master_name?: string; master_profile_id?: number; master_verified?: boolean; master_image_url?: string | null })[] = []
          
          if (beforeAfterItems.length > 0) {
            // Add 1 before-after item
            const beforeAfterItem = beforeAfterItems[0]
            selectedItems.push({
              ...beforeAfterItem,
              master_name: master.user_name || `Master ${profileId}`,
              master_profile_id: profileId,
              master_verified: master.verified || false,
              master_image_url: master.image_url || null,
            })
          }
          
          // Add 1 normal item (or 2 if no before-after)
          const normalCount = beforeAfterItems.length > 0 ? 1 : 2
          const normalToAdd = normalItems.slice(0, normalCount)
          
          normalToAdd.forEach(item => {
            selectedItems.push({
              ...item,
              master_name: master.user_name || `Master ${profileId}`,
              master_profile_id: profileId,
              master_verified: master.verified || false,
              master_image_url: master.image_url || null,
            })
          })
          
          return selectedItems
        } catch (error) {
          // Gracefully handle errors for individual masters
          if (process.env.NODE_ENV !== "production") {
            console.error(`Failed to load gallery for master ${profileId}:`, error)
          }
          return []
        }
      })
      
      const allGalleryItems = await Promise.all(galleryPromises)
      // Flatten and limit to 10 items max (5 masters × 2 items each)
      const flattened = allGalleryItems.flat().slice(0, 10)
      setGallery(flattened)
    } catch (error) {
      // Gracefully handle API errors - show empty state instead of breaking
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to load gallery for search:", error)
      }
      setGallery([])
    }
  }, [])

  const loadGallery = useCallback(async () => {
    try {
      setLoading(true)

      if (searchQuery.trim()) {
        await loadGalleryForSearch(searchQuery.trim())
      } else {
        const response = await getWorkGallery({
          page: 1,
          page_size: 12,
          // All media is now automatically approved
          show_before_after_only: false,
        })
        setGallery((response.items || []).slice(0, 10))
      }
    } catch (error: any) {
      // Gracefully handle API errors - show empty state instead of breaking
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to load gallery:", error)
      }
      setGallery([])
    } finally {
      setLoading(false)
    }
  }, [searchQuery, loadGalleryForSearch])

  useEffect(() => {
    loadGallery()
  }, [loadGallery])

  const getItemHref = (item: Media & { master_profile_id?: number }) => {
    if (item.master_profile_id) {
      return `/detailed/master/${item.master_profile_id}`
    }
    return "#"
  }

  return (
    <section className="bg-white py-12 sm:py-16 md:py-20">
      <div className="container mx-auto space-y-12 px-sides sm:space-y-16 md:space-y-20">
        {/* Header Section */}
        <div className="space-y-2">
          <div className="flex flex-row items-center justify-between gap-4">
            <h2 className="flex-1 min-w-0 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
              Arbeitsgalerie
            </h2>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="shrink-0 flex-shrink-0 group/btn border-border/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-200 font-medium"
            >
              <Link href="/gallery" className="flex items-center gap-1.5">
                <span>Alle anzeigen</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground sm:text-base">
            {searchQuery ? `Zeigt Arbeiten von Meistern zu: "${searchQuery}"` : "Sehen Sie echte Ergebnisse von unseren vertrauenswürdigen Meistern"}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 sm:py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground sm:h-8 sm:w-8" />
          </div>
        ) : gallery.length === 0 ? (
          <div className="rounded-none border border-dashed border-muted/40 bg-muted/10 py-10 text-center text-muted-foreground sm:py-12">
            <p>Noch keine Arbeitsgalerie-Artikel</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            {gallery.map((item, index) => (
              <GalleryCard key={item.id} item={item} href={getItemHref(item)} priority={index === 0} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
