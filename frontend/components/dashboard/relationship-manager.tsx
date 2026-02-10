"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import {
  createRelationship,
  deleteRelationship,
  getFeaturedDetail,
  listRelationships,
  searchItemsForLinking,
  type SearchItemResult,
} from "@/lib/api"
import type {
  CategoryType,
  FeaturedDetail,
  ItemRelationship,
} from "@/lib/api"
import { getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, Link2, Plus, Trash2, Search, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface RelationshipManagerProps {
  sourceType: CategoryType
  sourceId: number
  sourceLabel?: string
}

type RelationshipDisplay = {
  relationship: ItemRelationship
  counterpartType: CategoryType
  counterpartId: number
  detail?: FeaturedDetail | null
}

const TYPE_OPTIONS: { value: CategoryType; label: string }[] = [
  { value: "master", label: "Meister" },
  { value: "product", label: "Produkt" },
  { value: "rental", label: "Mieten" },
]

export function RelationshipManager({ sourceType, sourceId, sourceLabel }: RelationshipManagerProps) {
  const [items, setItems] = useState<RelationshipDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [targetType, setTargetType] = useState<CategoryType>("product")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchItemResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SearchItemResult | null>(null)
  const [preview, setPreview] = useState<FeaturedDetail | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640
    }
    return false
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const refreshRelationships = useCallback(async () => {
    if (!sourceId || sourceId <= 0) {
      setLoading(false)
      setItems([])
      return
    }
    
    setLoading(true)
    try {
      const relations = await listRelationships(sourceType, sourceId)
      const displays: RelationshipDisplay[] = await Promise.all(
        relations.map(async (rel) => {
          const isSource = rel.source_type === sourceType && rel.source_id === sourceId
          const counterpartType = (isSource ? rel.target_type : rel.source_type) as CategoryType
          const counterpartId = isSource ? rel.target_id : rel.source_id
          let detail: FeaturedDetail | null = null
          try {
            detail = await getFeaturedDetail(counterpartType, counterpartId)
          } catch (error) {
            console.error("Failed to fetch relationship detail", error)
          }
          return {
            relationship: rel,
            counterpartType,
            counterpartId,
            detail,
          }
        })
      )
      setItems(displays)
    } catch (error: any) {
      console.error("Failed to load relationships", error)
      // Don't show error toast if it's a 404 (no relationships found) or 422 (invalid source)
      if (error?.statusCode !== 404 && error?.statusCode !== 422) {
        toast.error("Verknüpfte Artikel konnten nicht abgerufen werden")
      }
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [sourceId, sourceType])

  useEffect(() => {
    refreshRelationships()
  }, [refreshRelationships])

  const handleSearch = async () => {
    const query = searchQuery.trim()
    if (query.length < 2) {
      toast.error("Bitte geben Sie mindestens 2 Zeichen ein, um zu suchen")
      return
    }

    setSearching(true)
    setSearchResults([])
    setSelectedItem(null)
    setPreview(null)
    
    try {
      const results = await searchItemsForLinking(targetType, query, 20)
      // Filter out the source item itself
      const filtered = results.filter(item => {
        if (targetType === sourceType && item.id === sourceId) {
          return false
        }
        return true
      })
      setSearchResults(filtered)
      setSearchOpen(true)
      
      if (filtered.length === 0) {
        toast.info("Keine Artikel gefunden. Versuchen Sie einen anderen Suchbegriff.")
      }
    } catch (error: any) {
      console.error("Failed to search items", error)
      // Don't show error toast for 401 (authentication) errors - let auth context handle it
      if (error?.statusCode !== 401) {
        toast.error(error?.message || "Suche nach Artikeln fehlgeschlagen. Bitte versuchen Sie es erneut.")
      }
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleSelectItem = async (item: SearchItemResult) => {
    setSelectedItem(item)
    setSearchQuery(item.title)
    setSearchOpen(false)
    
    // Load preview
    setPreview(null)
    setPreviewLoading(true)
    try {
      const detail = await getFeaturedDetail(item.type, item.id)
      setPreview(detail)
    } catch (error) {
      console.error("Failed to preview item", error)
      toast.error("Artikeldetails konnten nicht geladen werden")
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!selectedItem) {
      toast.error("Bitte wählen Sie einen Artikel zum Verknüpfen aus")
      return
    }
    
    if (selectedItem.id === sourceId && targetType === sourceType) {
      toast.error("Ein Artikel kann nicht mit sich selbst verknüpft werden")
      return
    }

    try {
      setSaving(true)
      await createRelationship({
        source_type: sourceType,
        source_id: sourceId,
        target_type: selectedItem.type,
        target_id: selectedItem.id,
      })
      toast.success("Artikel erfolgreich verknüpft")
      setDialogOpen(false)
      setSearchQuery("")
      setSelectedItem(null)
      setPreview(null)
      await refreshRelationships()
    } catch (error: any) {
      console.error("Failed to create relationship", error)
      toast.error(error?.message || "Beziehung konnte nicht erstellt werden")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (relationshipId: number) => {
    try {
      setDeletingId(relationshipId)
      await deleteRelationship(relationshipId)
      toast.success("Verknüpfung entfernt")
      await refreshRelationships()
    } catch (error: any) {
      console.error("Failed to remove relationship", error)
      toast.error(error?.message || "Verknüpfung konnte nicht entfernt werden")
    } finally {
      setDeletingId(null)
    }
  }

  const sourceBadgeLabel = useMemo(() => {
    const option = TYPE_OPTIONS.find((opt) => opt.value === sourceType)
    return option?.label ?? sourceType
  }, [sourceType])

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setSearchQuery("")
      setSelectedItem(null)
      setPreview(null)
      setPreviewLoading(false)
      setSearchResults([])
      setSearchOpen(false)
    }
  }

  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5 md:p-6">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg md:text-xl font-bold">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-primary/10 text-primary shrink-0 flex items-center justify-center">
              <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <span className="truncate">Verknüpfte Artikel</span>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground/90">
            Verwalten Sie quertypische Verknüpfungen für diesen {sourceBadgeLabel.toLowerCase()}
          </CardDescription>
          <div className="text-[10px] sm:text-xs text-muted-foreground">
            <span className="font-medium">Quelle:</span> {sourceLabel ?? `${sourceBadgeLabel} #${sourceId}`}
          </div>
        </div>
        {isMobile ? (
          <Sheet open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <SheetTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm font-medium shadow-sm hover:shadow transition-all">
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                Artikel verknüpfen
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-0">
              <SheetHeader className="pb-3 border-b px-4 pt-4 pr-12">
                <SheetTitle className="text-base font-semibold">Einen Featured-Artikel verknüpfen</SheetTitle>
                <SheetDescription className="text-xs">
                  Suchen Sie nach einem Artikel nach Namen, um eine Beziehung zu erstellen.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 py-4">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="target-type-mobile" className="text-xs font-medium">Artikeltyp <span className="text-destructive">*</span></Label>
                    <Select value={targetType} onValueChange={(value: CategoryType) => {
                      setTargetType(value)
                      setSelectedItem(null)
                      setPreview(null)
                      setSearchQuery("")
                      setSearchResults([])
                    }}>
                      <SelectTrigger id="target-type-mobile" className="h-9 text-xs">
                        <SelectValue placeholder="Typ auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="search-item-mobile" className="text-xs font-medium">Artikel suchen</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          id="search-item-mobile"
                          placeholder={`${TYPE_OPTIONS.find(o => o.value === targetType)?.label} suchen...`}
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value)
                            setSelectedItem(null)
                            setPreview(null)
                            setSearchResults([])
                            setSearchOpen(false)
                          }}
                          onKeyPress={handleSearchKeyPress}
                          className="pl-8 h-9 text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleSearch}
                        disabled={searching || searchQuery.trim().length < 2}
                        className="h-9 px-3 shrink-0 text-xs"
                      >
                        {searching ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Search className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    {searchQuery.length > 0 && searchQuery.length < 2 && (
                      <p className="text-[10px] text-muted-foreground">
                        Geben Sie mindestens 2 Zeichen ein, um zu suchen
                      </p>
                    )}
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Suchergebnisse</Label>
                      <ScrollArea className="h-[200px] rounded-md border border-border/40 p-2">
                    <div className="space-y-1">
                      {searchResults.map((item) => (
                        <div
                          key={`${item.type}-${item.id}`}
                          onClick={() => handleSelectItem(item)}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-md border border-border/40 cursor-pointer transition-colors hover:bg-muted/50",
                            selectedItem?.id === item.id && "bg-muted border-primary"
                          )}
                        >
                          {item.image_url && (
                            <div className="relative h-10 w-10 overflow-hidden rounded-md border border-border/40 shrink-0">
                              <Image
                                src={getOptimizedImageUrl(item.image_url, 'thumbnail') || "/placeholder.svg"}
                                alt={item.title}
                                fill
                                className="object-cover"
                                sizes="40px"
                                unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.image_url, 'thumbnail'))}
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-xs truncate">{item.title}</p>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0">
                                {item.type}
                              </Badge>
                            </div>
                            {item.subtitle && (
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{item.subtitle}</p>
                            )}
                          </div>
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0 text-primary",
                              selectedItem?.id === item.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </div>
                      ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {previewLoading ? (
                  <div className="space-y-2 rounded-md border border-border/40 p-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ) : preview ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 p-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-md border border-border/40 shrink-0">
                      <Image
                        src={getOptimizedImageUrl(preview.image_url, 'thumbnail') || "/placeholder.svg"}
                        alt={preview.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                        unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(preview.image_url, 'thumbnail'))}
                      />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0">
                          {preview.type}
                        </Badge>
                        {preview.category && (
                          <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">
                            {preview.category.replace(/-/g, " ")}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-xs leading-tight line-clamp-2">{preview.title}</p>
                      {preview.subtitle && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{preview.subtitle}</p>
                      )}
                    </div>
                  </div>
                ) : selectedItem ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 p-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-md border border-border/40 shrink-0">
                      {selectedItem.image_url ? (
                        <Image
                          src={getOptimizedImageUrl(selectedItem.image_url, 'thumbnail') || "/placeholder.svg"}
                          alt={selectedItem.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                          unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(selectedItem.image_url, 'thumbnail'))}
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Link2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0">
                          {selectedItem.type}
                        </Badge>
                      </div>
                      <p className="font-medium text-xs leading-tight line-clamp-2">{selectedItem.title}</p>
                      {selectedItem.subtitle && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{selectedItem.subtitle}</p>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogOpenChange(false)}
                    className="flex-1 h-9 text-xs"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreate}
                    disabled={!selectedItem || saving}
                    className="flex-1 h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                        Wird verknüpft...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-3.5 w-3.5 mr-2" />
                        Verknüpfen
                      </>
                    )}
                  </Button>
                </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm font-medium shadow-sm hover:shadow transition-all">
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                Artikel verknüpfen
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Einen Featured-Artikel verknüpfen</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Suchen Sie nach einem Artikel nach Namen, um eine Beziehung zu erstellen.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="target-type" className="text-xs sm:text-sm font-semibold">Artikeltyp</Label>
                  <Select value={targetType} onValueChange={(value: CategoryType) => {
                    setTargetType(value)
                    setSelectedItem(null)
                    setPreview(null)
                    setSearchQuery("")
                    setSearchResults([])
                  }}>
                    <SelectTrigger id="target-type" className="h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Typ auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-item" className="text-xs sm:text-sm font-semibold">Artikel suchen</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search-item"
                        placeholder={`${TYPE_OPTIONS.find(o => o.value === targetType)?.label} nach Namen suchen...`}
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setSelectedItem(null)
                          setPreview(null)
                          setSearchResults([])
                          setSearchOpen(false)
                        }}
                        onKeyPress={handleSearchKeyPress}
                        className="pl-8 h-9 text-xs sm:text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleSearch}
                      disabled={searching || searchQuery.trim().length < 2}
                      className="h-9 px-4 shrink-0"
                    >
                      {searching ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Wird gesucht...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Suchen
                        </>
                      )}
                    </Button>
                  </div>
                  {searchQuery.length > 0 && searchQuery.length < 2 && (
                    <p className="text-[10px] text-muted-foreground">
                      Geben Sie mindestens 2 Zeichen ein, um zu suchen
                    </p>
                  )}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-semibold">Suchergebnisse</Label>
                    <ScrollArea className="h-[200px] rounded-md border border-border/40 p-2">
                      <div className="space-y-1">
                        {searchResults.map((item) => (
                          <div
                            key={`${item.type}-${item.id}`}
                            onClick={() => handleSelectItem(item)}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-md border border-border/40 cursor-pointer transition-colors hover:bg-muted/50",
                              selectedItem?.id === item.id && "bg-muted border-primary"
                            )}
                          >
                            {item.image_url && (
                              <div className="relative h-10 w-10 overflow-hidden rounded-md border border-border/40 shrink-0">
                                <Image
                                  src={getOptimizedImageUrl(item.image_url, 'thumbnail') || "/placeholder.svg"}
                                  alt={item.title}
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                  unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.image_url, 'thumbnail'))}
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-xs truncate">{item.title}</p>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0">
                                  {item.type}
                                </Badge>
                              </div>
                              {item.subtitle && (
                                <p className="text-[10px] text-muted-foreground line-clamp-1">{item.subtitle}</p>
                              )}
                            </div>
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0 text-primary",
                                selectedItem?.id === item.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {previewLoading ? (
                  <div className="space-y-2 rounded-md border border-border/40 p-3 sm:p-4">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ) : preview ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                    <div className="relative h-12 w-12 sm:h-14 sm:w-14 overflow-hidden rounded-md border border-border/40 shrink-0">
                      <Image
                        src={getOptimizedImageUrl(preview.image_url, 'thumbnail') || "/placeholder.svg"}
                        alt={preview.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                        unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(preview.image_url, 'thumbnail'))}
                      />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0">
                          {preview.type}
                        </Badge>
                        {preview.category && (
                          <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">
                            {preview.category.replace(/-/g, " ")}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-xs sm:text-sm leading-tight line-clamp-2">{preview.title}</p>
                      {preview.subtitle && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{preview.subtitle}</p>
                      )}
                    </div>
                  </div>
                ) : selectedItem ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 p-3 sm:p-4">
                    <div className="relative h-12 w-12 sm:h-14 sm:w-14 overflow-hidden rounded-md border border-border/40 shrink-0">
                      {selectedItem.image_url ? (
                        <Image
                          src={getOptimizedImageUrl(selectedItem.image_url, 'thumbnail') || "/placeholder.svg"}
                          alt={selectedItem.title}
                          fill
                          className="object-cover"
                          sizes="56px"
                          unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(selectedItem.image_url, 'thumbnail'))}
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Link2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0">
                          {selectedItem.type}
                        </Badge>
                      </div>
                      <p className="font-medium text-xs sm:text-sm leading-tight line-clamp-2">{selectedItem.title}</p>
                      {selectedItem.subtitle && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{selectedItem.subtitle}</p>
                      )}
                    </div>
                  </div>
                ) : null}

                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={!selectedItem || saving}
                  className="w-full h-9 text-xs sm:text-sm font-medium"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                      Artikel verknüpfen
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-8 sm:py-10">
            <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/40 p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted/50 mb-2">
              <Link2 className="h-6 w-6 sm:h-7 sm:w-7 text-muted-foreground" />
            </div>
            <p className="text-sm sm:text-base font-semibold text-foreground">Keine verknüpften Artikel</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Klicken Sie auf \"Artikel verknüpfen\", um Beziehungen hinzuzufügen</p>
          </div>
        ) : (
          <div className="space-y-2">
            <ScrollArea className="max-h-[400px] pr-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm w-[100px] sm:w-[120px]">Typ</TableHead>
                    <TableHead className="text-xs sm:text-sm">Artikel</TableHead>
                    <TableHead className="text-xs sm:text-sm w-[70px] sm:w-[80px] hidden sm:table-cell">ID</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm w-[70px] sm:w-[80px]">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(({ relationship, counterpartType, counterpartId, detail }) => (
                    <TableRow key={relationship.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-[10px] sm:text-xs px-1.5 py-0">
                          {counterpartType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          {detail?.image_url && (
                            <div className="relative h-8 w-8 sm:h-10 sm:w-10 overflow-hidden rounded-md border border-border/40 shrink-0">
                              <Image
                                src={getOptimizedImageUrl(detail.image_url, 'thumbnail') || "/placeholder.svg"}
                                alt={detail.title || "Item"}
                                fill
                                className="object-cover"
                                sizes="40px"
                                unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(detail.image_url, 'thumbnail'))}
                              />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-medium text-xs sm:text-sm truncate">
                              {detail?.title ?? `Verknüpftes ${counterpartType}`}
                            </span>
                            {detail?.subtitle && (
                              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                {detail.subtitle}
                              </span>
                            )}
                            {!detail?.subtitle && (
                              <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                                ID {counterpartId}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm font-mono hidden sm:table-cell">
                        {counterpartId}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(relationship.id)}
                          disabled={deletingId === relationship.id}
                          className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-destructive/10 hover:text-destructive"
                        >
                          {deletingId === relationship.id ? (
                            <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
