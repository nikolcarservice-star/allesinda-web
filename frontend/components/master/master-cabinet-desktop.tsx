"use client"

import type { ChangeEvent, KeyboardEvent, RefObject } from "react"
import Image from "next/image"
import {
  Camera,
  Flag,
  ImageIcon,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Star,
  Trash2,
  User as UserIcon,
  Video,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CityCombobox } from "@/components/shared/city-combobox"
import { AccountSessionSection } from "@/components/profile/account-session-section"
import { BeforeAfterUploadSection } from "@/components/master/before-after-upload-section"
import { cn, shouldUseUnoptimized } from "@/lib/utils"
import type { Category, Media, Profile, ProfileInput, Review } from "@/lib/api/types"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale/de"

export type CabinetTabId = "profile" | "photo" | "video" | "reviews"

const DESKTOP_TABS: { id: CabinetTabId; label: string }[] = [
  { id: "profile", label: "Profil" },
  { id: "photo", label: "Foto" },
  { id: "video", label: "Video" },
  { id: "reviews", label: "Bewertungen" },
]

export type MasterCabinetDesktopProps = {
  activeTab: CabinetTabId
  onTabChange: (tab: CabinetTabId) => void
  saving: boolean
  onSave: () => void
  profile: Profile | null
  profileImageUrl: string | null
  displayName: string
  profilePhotoInputRef: RefObject<HTMLInputElement | null>
  profileImageUploading: boolean
  onProfilePhotoChange: (event: ChangeEvent<HTMLInputElement>) => void
  firstName: string
  onFirstNameChange: (value: string) => void
  lastName: string
  onLastNameChange: (value: string) => void
  phone: string
  onPhoneChange: (value: string) => void
  profession: string
  onProfessionChange: (value: string) => void
  priceFrom: string
  onPriceFromChange: (value: string) => void
  profileForm: ProfileInput
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileInput>>
  masterCategories: Category[]
  serviceTagInput: string
  onServiceTagInputChange: (value: string) => void
  onServiceTagKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  serviceTags: string[]
  suggestedTags: string[]
  onAddServiceTag: (value: string) => void
  onRemoveServiceTag: (tag: string) => void
  aboutLimit: number
  masterPhotos: Media[]
  masterBeforeAfter: Media[]
  masterPhotoInputRef: RefObject<HTMLInputElement | null>
  masterPhotosUploading: boolean
  beforeAfterUploading: boolean
  canAddMasterPhotos: boolean
  canAddBeforeAfter: boolean
  onMasterPhotoInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onDeleteMasterPhoto: (photoId: number) => void
  onViewMasterPhoto: (photo: Media) => void
  onBeforeAfterUpload: (beforeFile: File, afterFile: File, title?: string) => Promise<void>
  onDeleteBeforeAfter: (mediaId: number) => void
  onViewBeforeAfter: (item: Media) => void
  deletingMasterPhotoId: number | null
  deletingBeforeAfterId: number | null
  photoLimit: number
  beforeAfterLimit: number
  masterVideos: Media[]
  masterVideoInputRef: RefObject<HTMLInputElement | null>
  masterVideosUploading: boolean
  canAddMasterVideos: boolean
  onMasterVideoInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onDeleteMasterVideo: (videoId: number) => void
  onViewMasterVideo: (video: Media) => void
  deletingMasterVideoId: number | null
  videoLimit: number
  getVideoTitle: (video: Media) => string
  masterReviews: Review[]
  activeReplyReviewId: number | null
  setActiveReplyReviewId: (id: number | null) => void
  activeReportReviewId: number | null
  setActiveReportReviewId: (id: number | null) => void
  replyDrafts: Record<number, string>
  setReplyDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>
  savingReviewId: number | null
  reportingReviewId: number | null
  onReplyToReview: (reviewId: number) => void
  onReportReview: (reviewId: number, reason: string) => void
  reviewReportReasons: readonly string[]
  getReviewReportStatusLabel: (status?: string | null) => string | null
  getOptimizedPhotoUrl: (url: string) => string
}

export function MasterCabinetDesktop(props: MasterCabinetDesktopProps) {
  const {
    activeTab,
    onTabChange,
    saving,
    onSave,
    profile,
    profileImageUrl,
    displayName,
    profilePhotoInputRef,
    profileImageUploading,
    onProfilePhotoChange,
    firstName,
    onFirstNameChange,
    lastName,
    onLastNameChange,
    phone,
    onPhoneChange,
    profession,
    onProfessionChange,
    priceFrom,
    onPriceFromChange,
    profileForm,
    setProfileForm,
    masterCategories,
    serviceTagInput,
    onServiceTagInputChange,
    onServiceTagKeyDown,
    serviceTags,
    suggestedTags,
    onAddServiceTag,
    onRemoveServiceTag,
    aboutLimit,
    masterPhotos,
    masterBeforeAfter,
    masterPhotoInputRef,
    masterPhotosUploading,
    beforeAfterUploading,
    canAddMasterPhotos,
    canAddBeforeAfter,
    onMasterPhotoInputChange,
    onDeleteMasterPhoto,
    onViewMasterPhoto,
    onBeforeAfterUpload,
    onDeleteBeforeAfter,
    onViewBeforeAfter,
    deletingMasterPhotoId,
    deletingBeforeAfterId,
    photoLimit,
    beforeAfterLimit,
    masterVideos,
    masterVideoInputRef,
    masterVideosUploading,
    canAddMasterVideos,
    onMasterVideoInputChange,
    onDeleteMasterVideo,
    onViewMasterVideo,
    deletingMasterVideoId,
    videoLimit,
    getVideoTitle,
    masterReviews,
    activeReplyReviewId,
    setActiveReplyReviewId,
    activeReportReviewId,
    setActiveReportReviewId,
    replyDrafts,
    setReplyDrafts,
    savingReviewId,
    reportingReviewId,
    onReplyToReview,
    onReportReview,
    reviewReportReasons,
    getReviewReportStatusLabel,
    getOptimizedPhotoUrl,
  } = props

  return (
    <div className="hidden min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-background to-muted/20 lg:block">
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mein Profil</h1>
            <p className="text-sm text-muted-foreground">
              Verwalten Sie Ihr öffentliches Meisterprofil, Medien und Bewertungen
            </p>
          </div>
          {activeTab === "profile" && (
            <Button type="button" onClick={onSave} disabled={saving} className="shrink-0 shadow-md">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Änderungen speichern
                </>
              )}
            </Button>
          )}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => onTabChange(value as CabinetTabId)}
          className="w-full space-y-6"
        >
          <TabsList variant="modern" className="grid h-auto w-full max-w-2xl grid-cols-4">
            {DESKTOP_TABS.map((tab) => (
              <TabsTrigger key={tab.id} variant="modern" value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="profile" className="mt-0 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="border border-border/50 shadow-md bg-gradient-to-br from-card via-card to-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Camera className="h-5 w-5 text-primary" />
                    </div>
                    Profilbild
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative h-36 w-36 overflow-hidden rounded-full border-4 border-background shadow-xl ring-4 ring-primary/10">
                      {profileImageUrl ? (
                        <Image
                          src={profileImageUrl}
                          alt="Profilfoto"
                          fill
                          className="object-cover"
                          unoptimized={shouldUseUnoptimized(profileImageUrl)}
                          sizes="144px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <UserIcon className="h-16 w-16 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    {displayName ? (
                      <p className="text-center text-lg font-semibold">{displayName}</p>
                    ) : null}
                    <Input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={onProfilePhotoChange}
                      disabled={profileImageUploading}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => profilePhotoInputRef.current?.click()}
                      disabled={profileImageUploading}
                    >
                      {profileImageUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Foto ändern"
                      )}
                    </Button>
                  </div>
                  {profile && (
                    <div className="grid grid-cols-2 gap-2 border-t pt-4 text-center text-sm">
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="text-xs text-muted-foreground">Bewertung</p>
                        <p className="font-bold">{(profile.rating ?? 0).toFixed(1)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="text-xs text-muted-foreground">Bewertungen</p>
                        <p className="font-bold">{profile.total_reviews ?? 0}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/50 shadow-sm md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </div>
                    Grunddaten
                  </CardTitle>
                  <CardDescription>Name, Kontakt und Standort für Ihr Profil</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="desktop-vorname">Vorname</Label>
                      <Input
                        id="desktop-vorname"
                        value={firstName}
                        onChange={(e) => onFirstNameChange(e.target.value)}
                        placeholder="Max"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="desktop-nachname">Nachname</Label>
                      <Input
                        id="desktop-nachname"
                        value={lastName}
                        onChange={(e) => onLastNameChange(e.target.value)}
                        placeholder="Mustermann"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="desktop-telefon">Telefonnummer</Label>
                      <Input
                        id="desktop-telefon"
                        type="tel"
                        value={phone}
                        onChange={(e) => onPhoneChange(e.target.value)}
                        placeholder="+49 170 1234567"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stadt</Label>
                      <CityCombobox
                        variant="form"
                        size="md"
                        className="h-10 w-full"
                        value={profileForm.city_id ?? undefined}
                        onChange={(id) => setProfileForm((prev) => ({ ...prev, city_id: id }))}
                        placeholder="Stadt wählen"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="desktop-beruf">Beruf</Label>
                      <Input
                        id="desktop-beruf"
                        value={profession}
                        onChange={(e) => onProfessionChange(e.target.value)}
                        placeholder="z.B. Elektriker"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="desktop-preis">Preis ab (€)</Label>
                      <Input
                        id="desktop-preis"
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceFrom}
                        onChange={(e) => onPriceFromChange(e.target.value)}
                        placeholder="z.B. 45.00"
                        className="h-10 max-w-xs"
                      />
                      <p className="text-xs text-muted-foreground">Wird als „Ab … €“ auf Ihrem Profil angezeigt</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Kategorie & Service-Tags</CardTitle>
                <CardDescription>Hilft Kunden, Sie in der Suche zu finden</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-w-md space-y-2">
                  <Label>Kategorie</Label>
                  <Select
                    value={profileForm.category_id ? String(profileForm.category_id) : ""}
                    onValueChange={(value) => {
                      const parsed = Number(value)
                      setProfileForm((prev) => ({
                        ...prev,
                        category_id: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                      }))
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Kategorie auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterCategories.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desktop-tags">Service-Tags</Label>
                  <div className="flex max-w-xl gap-2">
                    <Input
                      id="desktop-tags"
                      value={serviceTagInput}
                      onChange={(e) => onServiceTagInputChange(e.target.value)}
                      onKeyDown={onServiceTagKeyDown}
                      placeholder="z.B. Lampen montieren"
                      className="h-10 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 px-4"
                      onClick={() => onAddServiceTag(serviceTagInput)}
                      disabled={!serviceTagInput.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {serviceTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {serviceTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1.5 px-3 py-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => onRemoveServiceTag(tag)}
                            aria-label={`${tag} entfernen`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {suggestedTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {suggestedTags.slice(0, 8).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => onAddServiceTag(tag)}
                          className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Über mich</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  value={profileForm.about || ""}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      about: e.target.value.slice(0, aboutLimit),
                    }))
                  }
                  placeholder="Erzählen Sie von Ihrer Erfahrung..."
                  rows={8}
                  maxLength={aboutLimit}
                  className="min-h-[180px] resize-none"
                />
                <p className="text-right text-xs text-muted-foreground tabular-nums">
                  {(profileForm.about || "").length}/{aboutLimit}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Konto</CardTitle>
              </CardHeader>
              <CardContent>
                <AccountSessionSection />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="photo" className="mt-0 space-y-4">
            <Card className="border border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  Meine Fotos
                </CardTitle>
                <CardDescription>
                  {masterPhotos.length}/{photoLimit} Fotos hochgeladen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  ref={masterPhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onMasterPhotoInputChange}
                  disabled={masterPhotosUploading || !canAddMasterPhotos}
                  className="hidden"
                />
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {masterPhotos.map((photo) => {
                    const photoUrl = getOptimizedPhotoUrl(photo.thumbnail_url || photo.url)
                    const isDeleting = deletingMasterPhotoId === photo.id
                    return (
                      <div
                        key={photo.id}
                        className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
                      >
                        <button
                          type="button"
                          onClick={() => onViewMasterPhoto(photo)}
                          className="absolute inset-0 h-full w-full cursor-pointer"
                          aria-label="Foto anzeigen"
                        >
                          <img src={photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteMasterPhoto(photo.id)
                          }}
                          disabled={isDeleting || masterPhotosUploading}
                          className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
                          aria-label="Foto löschen"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => masterPhotoInputRef.current?.click()}
                    disabled={masterPhotosUploading || !canAddMasterPhotos}
                    className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                  >
                    {masterPhotosUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <Plus className="mb-1 h-6 w-6" />
                        Foto
                      </>
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <BeforeAfterUploadSection
                  items={masterBeforeAfter}
                  uploading={beforeAfterUploading}
                  canAdd={canAddBeforeAfter}
                  limit={beforeAfterLimit}
                  deletingId={deletingBeforeAfterId}
                  onUpload={onBeforeAfterUpload}
                  onDelete={onDeleteBeforeAfter}
                  onView={onViewBeforeAfter}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="video" className="mt-0">
            <Card className="border border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Video className="h-5 w-5 text-primary" />
                  Meine Videos
                </CardTitle>
                <CardDescription>
                  {masterVideos.length}/{videoLimit} Videos hochgeladen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  ref={masterVideoInputRef}
                  type="file"
                  accept="video/*,.mp4,.mov,.webm,.mkv,.m4v,.3gp"
                  multiple
                  onChange={onMasterVideoInputChange}
                  disabled={masterVideosUploading || !canAddMasterVideos}
                  className="hidden"
                />
                {masterVideos.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {masterVideos.map((video) => {
                      const isDeleting = deletingMasterVideoId === video.id
                      return (
                        <div
                          key={video.id}
                          className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3"
                        >
                          <button
                            type="button"
                            onClick={() => onViewMasterVideo(video)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            aria-label="Video ansehen"
                          >
                            <Video className="h-5 w-5 shrink-0 text-muted-foreground" />
                            <p className="min-w-0 flex-1 truncate text-sm font-medium">{getVideoTitle(video)}</p>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteMasterVideo(video.id)}
                            disabled={isDeleting || masterVideosUploading}
                            className="shrink-0 text-destructive hover:text-destructive"
                            aria-label="Video löschen"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Noch keine Videos</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => masterVideoInputRef.current?.click()}
                  disabled={masterVideosUploading || !canAddMasterVideos}
                >
                  {masterVideosUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Video hochladen
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="mt-0">
            <Card className="border border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Bewertungen
                </CardTitle>
              </CardHeader>
              <CardContent>
                {masterReviews.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Noch keine Bewertungen</p>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {masterReviews.map((review) => {
                      const statusLabel = getReviewReportStatusLabel(review.report_status)
                      const isReplyOpen = activeReplyReviewId === review.id
                      const isReportOpen = activeReportReviewId === review.id
                      return (
                        <div
                          key={review.id}
                          className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{review.buyer_name || "Kunde"}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(review.created_at), {
                                  addSuffix: true,
                                  locale: de,
                                })}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex gap-0.5">
                                {Array.from({ length: 5 }).map((_, index) => (
                                  <Star
                                    key={index}
                                    className={cn(
                                      "h-4 w-4",
                                      index < review.rating
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-muted-foreground/30",
                                    )}
                                  />
                                ))}
                              </div>
                              {statusLabel && (
                                <Badge variant="outline" className="text-[10px]">
                                  {statusLabel}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {review.report_status === "removed"
                              ? "Diese Bewertung wurde entfernt."
                              : review.text || "Ohne Text"}
                          </p>
                          {review.master_response && (
                            <div className="rounded-md border bg-background p-3 text-sm">
                              <p className="mb-1 text-xs font-semibold text-muted-foreground">Ihre Antwort</p>
                              <p>{review.master_response}</p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setActiveReplyReviewId(isReplyOpen ? null : review.id)
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [review.id]: prev[review.id] ?? review.master_response ?? "",
                                }))
                              }}
                            >
                              Antworten
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveReportReviewId(isReportOpen ? null : review.id)}
                            >
                              <Flag className="h-3.5 w-3.5" />
                              Melden
                            </Button>
                          </div>
                          {isReplyOpen && (
                            <div className="space-y-2">
                              <Textarea
                                value={replyDrafts[review.id] || ""}
                                onChange={(e) =>
                                  setReplyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))
                                }
                                placeholder="Antwort schreiben..."
                                rows={3}
                                className="resize-none"
                              />
                              <Button
                                type="button"
                                size="sm"
                                disabled={savingReviewId === review.id}
                                onClick={() => onReplyToReview(review.id)}
                              >
                                {savingReviewId === review.id && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                Antwort speichern
                              </Button>
                            </div>
                          )}
                          {isReportOpen && (
                            <div className="space-y-2 rounded-md border bg-background p-3">
                              <p className="text-xs font-semibold text-muted-foreground">Grund auswählen</p>
                              {reviewReportReasons.map((reason) => (
                                <Button
                                  key={reason}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start"
                                  disabled={reportingReviewId === review.id}
                                  onClick={() => onReportReview(review.id, reason)}
                                >
                                  {reason}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
