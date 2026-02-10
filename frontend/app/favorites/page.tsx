"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Heart, Star, MapPin, Euro, Trash2, Loader2, Grid3x3, User, Package, Home } from "lucide-react"
import { getFavorites, removeFavorite } from "@/lib/api/favorites"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"
import type { Favorite } from "@/lib/api/types"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"

export default function FavoritesPage() {
  const router = useRouter()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "profile" | "product" | "rental">("all")

  useEffect(() => {
    loadFavorites()
  }, [activeTab])

  const loadFavorites = async () => {
    try {
      setLoading(true)
      const response = await getFavorites({
        page: 1,
        page_size: 100,
        favorite_type: activeTab === "all" ? undefined : activeTab,
      })
      setFavorites(response.items)
    } catch (error: any) {
      if (error?.statusCode === 401) {
        router.push("/login")
      } else {
        toast.error("Fehler beim Laden der Favoriten")
        console.error(error)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (favoriteId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      setRemoving(favoriteId)
      await removeFavorite(favoriteId)
      setFavorites(favorites.filter((f) => f.id !== favoriteId))
      toast.success("Aus Favoriten entfernt")
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Entfernen des Favoriten")
    } finally {
      setRemoving(null)
    }
  }

  const getItemLink = (favorite: Favorite) => {
    if (favorite.favorite_type === "profile") {
      return `/detailed/master/${favorite.favorite_id}`
    } else if (favorite.favorite_type === "product") {
      return `/detailed/product/${favorite.favorite_id}`
    } else if (favorite.favorite_type === "rental") {
      return `/detailed/rental/${favorite.favorite_id}`
    }
    return "#"
  }

  const getItemImage = (favorite: Favorite) => {
    if (favorite.favorite_type === "profile") {
      return "/professional-plumber-portrait.png"
    }
    return getOptimizedImageUrl(favorite.item?.image_url, 'card') || "/placeholder.svg"
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-sides py-8 sm:py-12">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-b from-background via-muted/10 to-background">
        <div className="container mx-auto px-sides py-8 sm:py-10 md:py-12">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Meine Favoriten
                </span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground/90">Verwalten Sie Ihre gespeicherten Meister, Produkt und Verleih</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-6 sm:space-y-8">
            <TabsList variant="modern" className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6 sm:mb-8">
              <TabsTrigger variant="modern" value="all" className="flex items-center justify-center gap-1.5">
                <Grid3x3 className="shrink-0" />
                <span>Alle</span>
              </TabsTrigger>
              <TabsTrigger variant="modern" value="profile" className="flex items-center justify-center gap-1.5">
                <User className="shrink-0" />
                <span>Meister</span>
              </TabsTrigger>
              <TabsTrigger variant="modern" value="product" className="flex items-center justify-center gap-1.5">
                <Package className="shrink-0" />
                <span>Produkt</span>
              </TabsTrigger>
              <TabsTrigger variant="modern" value="rental" className="flex items-center justify-center gap-1.5">
                <Home className="shrink-0" />
                <span>Mieten</span>
              </TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex items-center justify-center py-16 sm:py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : favorites.length === 0 ? (
              <div className="text-center py-16 sm:py-20 space-y-3 text-muted-foreground">
                <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg sm:text-xl font-semibold text-foreground">Noch keine Favoriten</p>
                <p className="text-sm sm:text-base text-muted-foreground">Beginnen Sie zu erkunden und speichern Sie Ihre Lieblingsartikel!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                {favorites.map((favorite) => (
                  <Link href={getItemLink(favorite)} key={favorite.id} className="group block">
                    <Card className="border border-border/50 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 hover:-translate-y-1 bg-gradient-to-br from-card to-card/95">
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center gap-4 sm:gap-5">
                          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted border border-border/30 shadow-sm">
                            <Image
                              src={getItemImage(favorite)}
                              alt={favorite.item?.title || favorite.item?.name || "Favoriten-Artikel"}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 80px, (max-width: 1024px) 96px, 96px"
                              unoptimized={shouldUseUnoptimized(getItemImage(favorite))}
                            />
                          </div>
                          <div className="flex-1 space-y-1.5 min-w-0">
                            <h3 className="font-bold text-base sm:text-lg truncate group-hover:text-primary transition-colors">
                              {favorite.item?.title || favorite.item?.name || "Ohne Titel"}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground/90 capitalize">{favorite.favorite_type}</p>
                            {favorite.favorite_type === "profile" && favorite.item?.rating !== undefined && (
                              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground/90">
                                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                <span>{favorite.item.rating.toFixed(1)} {favorite.item.total_reviews !== undefined ? `(${favorite.item.total_reviews})` : ''}</span>
                              </div>
                            )}
                            {(favorite.favorite_type === "product" || favorite.favorite_type === "rental") && favorite.item?.price !== undefined && (
                              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground/90">
                                <Euro className="h-3.5 w-3.5 text-primary" />
                                <span>{favorite.item.price.toFixed(2)} {favorite.favorite_type === "rental" ? "/ day" : ""}</span>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-lg text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleRemove(favorite.id, e)}
                            disabled={removing === favorite.id}
                          >
                            {removing === favorite.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  )
}

