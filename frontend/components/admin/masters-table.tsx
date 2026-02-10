"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Search, CheckCircle2, XCircle, Loader2, AlertCircle, X } from "lucide-react"
import { getModerationProfiles, verifyProfile, rejectProfile } from "@/lib/api/admin"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale/de"
import { getOptimizedImageUrl } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Profile {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_role: string;
  image_url?: string;
  city_name?: string | null;
  verified: boolean;
  rating: number;
  total_reviews: number;
  created_at: string;
}

export function MastersTable() {
  const [searchQuery, setSearchQuery] = useState("")
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all")
  const [roleFilter, setRoleFilter] = useState<"all" | "master" | "seller">("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "verify" | "reject" | null;
    profileId: number | null;
    profileName: string;
  }>({ open: false, action: null, profileId: null, profileName: "" })

  const loadProfiles = async () => {
    try {
      setLoading(true)
      const params: { verified_only?: boolean; unverified_only?: boolean; role?: "master" | "seller"; page?: number; page_size?: number } = {}
      if (filter === "verified") params.verified_only = true
      if (filter === "unverified") params.unverified_only = true
      if (roleFilter !== "all") params.role = roleFilter
      params.page = page
      params.page_size = 20
      
      const response = await getModerationProfiles(params)
      setProfiles(response.items || [])
      setTotalPages(response.total_pages || 1)
    } catch (error: any) {
      console.error("Failed to load profiles:", error)
      toast.error("Profile konnten nicht geladen werden")
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfiles()
  }, [page, filter, roleFilter])

  const handleVerify = async (profileId: number) => {
    try {
      await verifyProfile(profileId)
      toast.success("Profil erfolgreich verifiziert")
      loadProfiles()
      setConfirmDialog({ open: false, action: null, profileId: null, profileName: "" })
    } catch (error: any) {
      toast.error(error.message || "Profil konnte nicht verifiziert werden")
    }
  }

  const handleReject = async (profileId: number) => {
    try {
      await rejectProfile(profileId)
      toast.success("Profil-Verifizierung entfernt")
      loadProfiles()
      setConfirmDialog({ open: false, action: null, profileId: null, profileName: "" })
    } catch (error: any) {
      toast.error(error.message || "Profil konnte nicht abgelehnt werden")
    }
  }

  const openConfirmDialog = (action: "verify" | "reject", profileId: number, profileName: string) => {
    setConfirmDialog({ open: true, action, profileId, profileName })
  }

  const clearFilters = () => {
    setFilter("all")
    setRoleFilter("all")
    setSearchQuery("")
    setPage(1)
  }

  const hasActiveFilters = useMemo(() => {
    return (
      filter !== "all" ||
      roleFilter !== "all" ||
      searchQuery.trim() !== ""
    )
  }, [filter, roleFilter, searchQuery])

  const filteredProfiles = profiles.filter(
    (profile) =>
      profile.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.city_name && profile.city_name.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base sm:text-lg font-semibold">Profil-Moderation</CardTitle>
            <p className="text-xs text-muted-foreground">Meister- und Verkäuferprofile verifizieren und verwalten</p>
          </div>
        </div>
        {/* Filters */}
        {/* Mobile: Accordion */}
        <div className="block lg:hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="filters" className="border border-border/40 rounded-sm">
              <AccordionTrigger className="py-2 px-2 hover:no-underline">
                <h4 className="text-xs font-medium">Filter</h4>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-3 px-2">
                <div className="space-y-3">
                  {/* Status and Role in one row */}
                  <div className="flex flex-row gap-2">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs text-muted-foreground font-medium">Status</label>
                      <Select value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(1) }}>
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="verified">Verifiziert</SelectItem>
                          <SelectItem value="unverified">Unverifiziert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs text-muted-foreground font-medium">Rolle</label>
                      <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as typeof roleFilter); setPage(1) }}>
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Rolle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="master">Meister</SelectItem>
                          <SelectItem value="seller">Verkäufer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Search */}
                  <div className="relative flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Suchen</label>
                    <div className="relative">
                      <div className="flex items-center justify-center w-7 h-7 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                        <Search className="h-3.5 w-3.5" />
                      </div>
                      <Input
                        type="text"
                        placeholder="Meister suchen..."
                        className="pl-11 h-8 text-xs rounded-sm border border-border/40 focus:border-primary shadow-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {/* Clear Button */}
                  {hasActiveFilters && (
                    <div className="flex flex-col gap-1.5 justify-end items-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-8 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Zurücksetzen
                      </Button>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        
        {/* Desktop: All filters in one row */}
        <div className="hidden lg:flex flex-row gap-2 items-end">
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Status</label>
            <Select value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="verified">Verifiziert</SelectItem>
                <SelectItem value="unverified">Unverifiziert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Rolle</label>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as typeof roleFilter); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Rolle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="master">Meister</SelectItem>
                <SelectItem value="seller">Verkäufer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Suchen</label>
            <div className="relative">
              <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <Input
                type="text"
                placeholder="Meister suchen..."
                className="pl-11 sm:pl-12 h-8 sm:h-9 text-xs sm:text-sm rounded-sm border border-border/40 focus:border-primary shadow-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex flex-col gap-1.5 justify-end items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 sm:h-9 text-xs sm:text-sm"
              >
                <X className="h-3 w-3 mr-1" />
                Zurücksetzen
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-3 sm:pt-0 sm:pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 sm:py-10 px-3 sm:px-4">
            <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="text-center py-8 sm:py-10 text-muted-foreground px-3 sm:px-4">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className="text-xs sm:text-sm">Keine Profile gefunden</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-2 px-3">
              {filteredProfiles.map((profile) => (
                <Card key={profile.id} className="border border-border/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Avatar className="h-9 w-9 shrink-0 rounded-full">
                        <AvatarFallback className="text-xs rounded-full">{profile.user_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="font-medium text-sm truncate">{profile.user_name}</p>
                          {profile.verified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{profile.user_email}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 capitalize font-medium ${
                              profile.user_role === "master"
                                ? "border-blue-500/50 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : profile.user_role === "seller"
                                ? "border-purple-500/50 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                : profile.user_role === "client"
                                ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                            }`}
                          >
                            {profile.user_role === "master" ? "Meister" : 
                             profile.user_role === "seller" ? "Verkäufer" : 
                             profile.user_role === "client" ? "Kunde" : 
                             profile.user_role === "admin" ? "Admin" : 
                             profile.user_role}
                          </Badge>
                          <Badge
                            variant={profile.verified ? "default" : "secondary"}
                            className={`text-[10px] px-1.5 py-0 ${profile.verified ? "bg-green-600" : ""}`}
                          >
                            {profile.verified ? "Verifiziert" : "Unverifiziert"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {profile.rating.toFixed(1)}⭐ • {profile.total_reviews}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!profile.verified ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => openConfirmDialog("verify", profile.id, profile.user_name)}
                          title="Verifizieren"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={() => openConfirmDialog("reject", profile.id, profile.user_name)}
                          title="Verifizierung entfernen"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto px-3 sm:px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm h-9">Meister</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell h-9">Kontakt</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden lg:table-cell h-9">Standort</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9">Status</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden xl:table-cell h-9">Bewertung</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden xl:table-cell h-9">Bewertungen</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden 2xl:table-cell h-9">Beigetreten</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm h-9">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile) => (
                    <TableRow key={profile.id} className="h-14">
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 rounded-full">
                            <AvatarFallback className="text-xs rounded-full">{profile.user_name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm">{profile.user_name}</p>
                              {profile.verified && (
                                <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0.5 capitalize font-medium ${
                                  profile.user_role === "master"
                                    ? "border-blue-500/50 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                    : profile.user_role === "seller"
                                    ? "border-purple-500/50 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                    : profile.user_role === "client"
                                    ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                    : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                                }`}
                              >
                                {profile.user_role === "master" ? "Meister" : 
                             profile.user_role === "seller" ? "Verkäufer" : 
                             profile.user_role === "client" ? "Kunde" : 
                             profile.user_role === "admin" ? "Admin" : 
                             profile.user_role}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden md:table-cell">
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{profile.user_email}</p>
                      </TableCell>
                      <TableCell className="py-2 hidden lg:table-cell">
                        <span className="text-xs">{profile.city_name || "N/A"}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant={profile.verified ? "default" : "secondary"}
                          className={`text-[10px] ${profile.verified ? "bg-green-600" : ""}`}
                        >
                          {profile.verified ? "Verifiziert" : "Unverifiziert"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 hidden xl:table-cell">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium">{profile.rating.toFixed(1)}</span>
                          <span className="text-[10px] text-muted-foreground">/ 5.0</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden xl:table-cell text-xs">{profile.total_reviews}</TableCell>
                      <TableCell className="py-2 hidden 2xl:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true, locale: de })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <div className="flex items-center justify-end gap-1">
                          {!profile.verified ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => openConfirmDialog("verify", profile.id, profile.user_name)}
                              title="Verifizieren"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => openConfirmDialog("reject", profile.id, profile.user_name)}
                              title="Verifizierung entfernen"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 sm:mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 text-xs"
            >
              Zurück
            </Button>
            <span className="text-xs sm:text-sm text-muted-foreground">
              Seite {page} von {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 text-xs"
            >
              Weiter
            </Button>
          </div>
        )}
      </CardContent>
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, action: null, profileId: null, profileName: "" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "verify" ? "Profil verifizieren" : "Verifizierung entfernen"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "verify"
                ? `Sind Sie sicher, dass Sie das Profil von ${confirmDialog.profileName} verifizieren möchten? Es wird als verifizierter Meister angezeigt.`
                : `Sind Sie sicher, dass Sie die Verifizierung von ${confirmDialog.profileName}'s Profil entfernen möchten?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.action === "verify" && confirmDialog.profileId) {
                  handleVerify(confirmDialog.profileId)
                } else if (confirmDialog.action === "reject" && confirmDialog.profileId) {
                  handleReject(confirmDialog.profileId)
                }
              }}
            >
              {confirmDialog.action === "verify" ? "Verifizieren" : "Verifizierung entfernen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
