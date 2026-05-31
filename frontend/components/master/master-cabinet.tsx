"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, User, X, Plus, Trash2, Video, Star, Flag } from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { getMasterCabinet, updateMasterCabinet, uploadProfileImage } from "@/lib/api/masters"
import { ApiClientError } from "@/lib/api/client"
import { getCategoriesByType } from "@/lib/api/categories"
import { getMyMedia, uploadMedia, deleteMedia } from "@/lib/api/media"
import { getSellerReviews, replyToReview, reportReview } from "@/lib/api/reviews"
import { getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"
import { CityCombobox } from "@/components/shared/city-combobox"
import type { Category, Media, Profile, ProfileInput, Review, User } from "@/lib/api/types"
import { toast } from "sonner"
import { ProtectedRoute } from "@/components/auth/protected-route"

const ABOUT_LIMIT = 500
const MASTER_PHOTO_LIMIT = 20
const MASTER_VIDEO_LIMIT = 5
const REVIEW_REPORT_REASONS = ["Falsche Angaben", "Beleidigung", "Spam"] as const

const SERVICE_TAG_SUGGESTIONS: Array<{ match: string[]; tags: string[] }> = [
  {
    match: ["bau", "renovierung", "handwerker", "schreinerei", "fliesen", "malerei"],
    tags: ["Trockenbau", "Fliesen legen", "Malerarbeiten", "Renovierung", "Möbelmontage"],
  },
  {
    match: ["elektrik"],
    tags: ["Lampen montieren", "Steckdosen", "Sicherungskasten", "Smart Home", "E-Check"],
  },
  {
    match: ["sanitär", "heizung", "hlk"],
    tags: ["Rohrreparatur", "Armaturen", "Heizungswartung", "Warmwasser", "Notdienst"],
  },
  {
    match: ["kfz", "fahrzeug", "auto"],
    tags: ["Inspektion", "Bremsen", "Reifenwechsel", "Batterie", "Diagnose"],
  },
  {
    match: ["reinigung"],
    tags: ["Grundreinigung", "Fenster", "Büro", "Auszug", "Teppich"],
  },
  {
    match: ["schneider", "näherei", "textil"],
    tags: ["Änderungen", "Reparaturen", "Maßanfertigung", "Reißverschluss", "Vorhänge"],
  },
]

function parseServiceTags(value?: string | null) {
  const seen = new Set<string>()
  return (value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase()
      if (!tag || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function stringifyServiceTags(tags: string[]) {
  return tags.join(", ")
}

function getSuggestedTags(categoryName?: string) {
  const normalized = (categoryName || "").toLowerCase()
  return SERVICE_TAG_SUGGESTIONS.find((group) => group.match.some((token) => normalized.includes(token)))?.tags || [
    "Beratung",
    "Montage",
    "Reparatur",
    "Wartung",
    "Notdienst",
  ]
}

function splitName(fullName: string) {
  const trimmed = fullName.trim()
  const spaceIndex = trimmed.indexOf(" ")
  if (spaceIndex === -1) return { firstName: trimmed, lastName: "" }
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() }
}

function joinName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ")
}

function getReviewReportStatusLabel(status?: string | null) {
  if (status === "in_review") return "In Prüfung"
  if (status === "removed") return "Entfernt"
  if (status === "rejected") return "Abgelehnt"
  return null
}

function getVideoTitle(video: Media) {
  if (video.title?.trim()) return video.title.trim()
  const path = video.url.split("?")[0]
  return decodeURIComponent(path.split("/").pop() || `Video ${video.id}`)
}

function SpeichernButton({
  saving,
  onClick,
  className,
}: {
  saving: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={saving}
      className={className}
    >
      {saving ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Wird gespeichert...
        </>
      ) : (
        "Speichern"
      )}
    </Button>
  )
}

export function MasterCabinet() {
  const { user, refreshUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileImageUploading, setProfileImageUploading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [masterPhotos, setMasterPhotos] = useState<Media[]>([])
  const [masterVideos, setMasterVideos] = useState<Media[]>([])
  const [masterPhotosUploading, setMasterPhotosUploading] = useState(false)
  const [masterVideosUploading, setMasterVideosUploading] = useState(false)
  const [deletingMasterPhotoId, setDeletingMasterPhotoId] = useState<number | null>(null)
  const [deletingMasterVideoId, setDeletingMasterVideoId] = useState<number | null>(null)
  const [masterReviews, setMasterReviews] = useState<Review[]>([])
  const [activeReplyReviewId, setActiveReplyReviewId] = useState<number | null>(null)
  const [activeReportReviewId, setActiveReportReviewId] = useState<number | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [savingReviewId, setSavingReviewId] = useState<number | null>(null)
  const [reportingReviewId, setReportingReviewId] = useState<number | null>(null)
  const [masterCategories, setMasterCategories] = useState<Category[]>([])
  const [serviceTagInput, setServiceTagInput] = useState("")
  const profilePhotoInputRef = useRef<HTMLInputElement>(null)
  const masterPhotoInputRef = useRef<HTMLInputElement>(null)
  const masterVideoInputRef = useRef<HTMLInputElement>(null)
  const loadRequestId = useRef(0)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [profession, setProfession] = useState("")
  const [priceFrom, setPriceFrom] = useState("")
  const [profileForm, setProfileForm] = useState<ProfileInput>({
    about: "",
    category_id: undefined,
    keywords: "",
    city_id: undefined,
    profession: "",
  })

  const applyAccountAndProfile = useCallback((accountUser: User, profileData: Profile, displayPrice?: number | null) => {
    setProfile(profileData)
    setProfileForm({
      about: (profileData.about || "").slice(0, ABOUT_LIMIT),
      category_id: profileData.category_id ?? undefined,
      keywords: profileData.keywords || "",
      city_id: profileData.city_id ?? undefined,
      profession: profileData.profession || "",
    })
    setProfession(profileData.profession || "")
    const { firstName: fn, lastName: ln } = splitName(accountUser.name || "")
    setFirstName(fn)
    setLastName(ln)
    setPhone(accountUser.phone || "")
    if (typeof displayPrice === "number" && displayPrice > 0) {
      setPriceFrom(String(displayPrice))
    } else {
      setPriceFrom("")
    }
  }, [])

  const loadData = useCallback(async () => {
    const requestId = ++loadRequestId.current
    setLoading(true)
    try {
      const [cabinetData, categories, mediaData] = await Promise.all([
        getMasterCabinet(),
        getCategoriesByType("master", { activeOnly: true, rootOnly: true }),
        getMyMedia({ page: 1, page_size: 100 }),
      ])

      if (requestId !== loadRequestId.current) return

      applyAccountAndProfile(cabinetData.user, cabinetData.profile, cabinetData.price_from)
      setMasterCategories(categories)
      setMasterPhotos(
        (mediaData.items || []).filter(
          (item) => item.media_type === "photo" && item.profile_id === cabinetData.profile.id,
        ),
      )
      setMasterVideos(
        (mediaData.items || []).filter(
          (item) => item.media_type === "video" && item.profile_id === cabinetData.profile.id,
        ),
      )

      const reviewsData = await getSellerReviews(cabinetData.profile.user_id, { page: 1, page_size: 20 }).catch(() => ({
        items: [] as Review[],
      }))
      if (requestId !== loadRequestId.current) return
      setMasterReviews(reviewsData.items || [])
    } catch (err: unknown) {
      if (requestId !== loadRequestId.current) return
      const message = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Profil konnte nicht geladen werden"
      toast.error(message)
    } finally {
      if (requestId === loadRequestId.current) {
        setLoading(false)
      }
    }
  }, [applyAccountAndProfile])

  useEffect(() => {
    if (user?.role === "master" && user.id) {
      loadData()
    }
  }, [user?.id, user?.role, loadData])

  const serviceTags = parseServiceTags(profileForm.keywords)
  const selectedCategoryName = masterCategories.find((category) => category.id === profileForm.category_id)?.name
  const suggestedTags = getSuggestedTags(selectedCategoryName).filter(
    (tag) => !serviceTags.some((existingTag) => existingTag.toLowerCase() === tag.toLowerCase()),
  )
  const canAddMasterPhotos = masterPhotos.length < MASTER_PHOTO_LIMIT
  const canAddMasterVideos = masterVideos.length < MASTER_VIDEO_LIMIT

  const addServiceTag = (value: string) => {
    const tag = value.replace(/,/g, " ").trim()
    if (!tag) return
    const exists = serviceTags.some((existingTag) => existingTag.toLowerCase() === tag.toLowerCase())
    if (exists) {
      setServiceTagInput("")
      return
    }
    setProfileForm((prev) => ({
      ...prev,
      keywords: stringifyServiceTags([...serviceTags, tag]),
    }))
    setServiceTagInput("")
  }

  const removeServiceTag = (tagToRemove: string) => {
    setProfileForm((prev) => ({
      ...prev,
      keywords: stringifyServiceTags(serviceTags.filter((tag) => tag !== tagToRemove)),
    }))
  }

  const handleServiceTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" && event.key !== ",") return
    event.preventDefault()
    addServiceTag(serviceTagInput)
  }

  const handleSave = async () => {
    const fullName = joinName(firstName, lastName)
    if (!fullName.trim()) {
      toast.error("Bitte geben Sie Vor- und Nachname ein")
      return
    }

    loadRequestId.current += 1
    setSaving(true)
    try {
      const parsedPrice = priceFrom.trim() === "" ? null : Number.parseFloat(priceFrom.replace(",", "."))
      if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
        toast.error("Bitte geben Sie einen gültigen Preis ein")
        setSaving(false)
        return
      }

      const payload = {
        name: fullName,
        phone: phone.trim() || null,
        about: (profileForm.about || "").slice(0, ABOUT_LIMIT),
        category_id: profileForm.category_id,
        keywords: stringifyServiceTags(serviceTags),
        city_id: profileForm.city_id,
        profession: profession.trim() || null,
        price_from: parsedPrice,
      }

      const result = await updateMasterCabinet(payload)
      applyAccountAndProfile(result.user, result.profile, result.price_from)
      await refreshUser()
      toast.success("Gespeichert")
    } catch (err: unknown) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Speichern fehlgeschlagen"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleProfilePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (event.target) event.target.value = ""
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Nur Bilddateien sind erlaubt")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Datei ist größer als 10MB")
      return
    }

    try {
      setProfileImageUploading(true)
      const updated = await uploadProfileImage(file)
      setProfile(updated)
      toast.success("Profilfoto aktualisiert")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Foto konnte nicht hochgeladen werden"
      toast.error(message)
    } finally {
      setProfileImageUploading(false)
    }
  }

  const handleMasterPhotoInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    if (event.target) event.target.value = ""
    if (!selectedFiles.length || !profile?.id) return

    const remainingSlots = MASTER_PHOTO_LIMIT - masterPhotos.length
    if (remainingSlots <= 0) {
      toast.error(`Maximal ${MASTER_PHOTO_LIMIT} Fotos erlaubt`)
      return
    }

    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"))
    const filesToUpload = imageFiles.slice(0, remainingSlots)
    if (!filesToUpload.length) return

    try {
      setMasterPhotosUploading(true)
      const uploadedPhotos: Media[] = []
      for (const file of filesToUpload) {
        if (file.size > 10 * 1024 * 1024) continue
        const uploaded = await uploadMedia(file, {
          media_type: "photo",
          profile_id: profile.id,
          category_id: profileForm.category_id,
        })
        uploadedPhotos.push(uploaded)
      }
      if (uploadedPhotos.length > 0) {
        setMasterPhotos((prev) => [...prev, ...uploadedPhotos].slice(0, MASTER_PHOTO_LIMIT))
        toast.success(`${uploadedPhotos.length} Foto${uploadedPhotos.length === 1 ? "" : "s"} hochgeladen`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Foto konnte nicht hochgeladen werden"
      toast.error(message)
    } finally {
      setMasterPhotosUploading(false)
    }
  }

  const handleDeleteMasterPhoto = async (photoId: number) => {
    try {
      setDeletingMasterPhotoId(photoId)
      await deleteMedia(photoId)
      setMasterPhotos((prev) => prev.filter((photo) => photo.id !== photoId))
      toast.success("Foto gelöscht")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Foto konnte nicht gelöscht werden"
      toast.error(message)
    } finally {
      setDeletingMasterPhotoId(null)
    }
  }

  const handleMasterVideoInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    if (event.target) event.target.value = ""
    if (!selectedFiles.length || !profile?.id) return

    const remainingSlots = MASTER_VIDEO_LIMIT - masterVideos.length
    if (remainingSlots <= 0) {
      toast.error(`Maximal ${MASTER_VIDEO_LIMIT} Videos erlaubt`)
      return
    }

    const videoFiles = selectedFiles.filter((file) => file.type.startsWith("video/"))
    const filesToUpload = videoFiles.slice(0, remainingSlots)
    if (!filesToUpload.length) return

    try {
      setMasterVideosUploading(true)
      const uploadedVideos: Media[] = []
      for (const file of filesToUpload) {
        if (file.size > 50 * 1024 * 1024) continue
        const uploaded = await uploadMedia(file, {
          media_type: "video",
          profile_id: profile.id,
          category_id: profileForm.category_id,
          title: file.name,
        })
        uploadedVideos.push(uploaded)
      }
      if (uploadedVideos.length > 0) {
        setMasterVideos((prev) => [...prev, ...uploadedVideos].slice(0, MASTER_VIDEO_LIMIT))
        toast.success(`${uploadedVideos.length} Video${uploadedVideos.length === 1 ? "" : "s"} hochgeladen`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Video konnte nicht hochgeladen werden"
      toast.error(message)
    } finally {
      setMasterVideosUploading(false)
    }
  }

  const handleDeleteMasterVideo = async (videoId: number) => {
    try {
      setDeletingMasterVideoId(videoId)
      await deleteMedia(videoId)
      setMasterVideos((prev) => prev.filter((video) => video.id !== videoId))
      toast.success("Video gelöscht")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Video konnte nicht gelöscht werden"
      toast.error(message)
    } finally {
      setDeletingMasterVideoId(null)
    }
  }

  const handleReplyToReview = async (reviewId: number) => {
    const response = (replyDrafts[reviewId] || "").trim()
    if (!response) {
      toast.error("Antwort darf nicht leer sein")
      return
    }
    try {
      setSavingReviewId(reviewId)
      const updated = await replyToReview(reviewId, response)
      setMasterReviews((prev) => prev.map((review) => (review.id === reviewId ? updated : review)))
      setActiveReplyReviewId(null)
      toast.success("Antwort gespeichert")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Antwort konnte nicht gespeichert werden"
      toast.error(message)
    } finally {
      setSavingReviewId(null)
    }
  }

  const handleReportReview = async (reviewId: number, reason: (typeof REVIEW_REPORT_REASONS)[number]) => {
    try {
      setReportingReviewId(reviewId)
      const updated = await reportReview(reviewId, reason)
      setMasterReviews((prev) => prev.map((review) => (review.id === reviewId ? updated : review)))
      setActiveReportReviewId(null)
      toast.success("Bewertung gemeldet")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bewertung konnte nicht gemeldet werden"
      toast.error(message)
    } finally {
      setReportingReviewId(null)
    }
  }

  const profileImageUrl = profile?.image_url
    ? getOptimizedImageUrl(profile.image_url, "thumbnail")
    : null

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
        {/* Шапка: логотип + Speichern */}
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link href="/" className="flex shrink-0 items-center">
            <Image src="/logo_dark.webp" alt="Allesinda" width={120} height={32} className="h-7 w-auto" priority />
          </Link>
          <SpeichernButton
            saving={saving}
            onClick={handleSave}
            className="h-9 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
          />
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="mx-auto max-w-lg space-y-8 px-4 py-6">
            {/* Блок 1 — Фото профиля */}
            <section className="flex flex-col items-center gap-4">
              <div className="relative h-36 w-36 overflow-hidden rounded-full border-4 border-neutral-100 bg-neutral-100 shadow-md">
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
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="h-16 w-16 text-neutral-300" />
                  </div>
                )}
              </div>
              <Input
                ref={profilePhotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleProfilePhotoChange}
                disabled={profileImageUploading}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => profilePhotoInputRef.current?.click()}
                disabled={profileImageUploading}
                className="rounded-full px-6"
              >
                {profileImageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Foto ändern"}
              </Button>
            </section>

            {/* Блок 2 — Основные данные */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Grunddaten</h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="vorname">Vorname</Label>
                    <Input
                      id="vorname"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Max"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nachname">Nachname</Label>
                    <Input
                      id="nachname"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Mustermann"
                      className="h-11"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telefon">Telefonnummer</Label>
                  <Input
                    id="telefon"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+49 170 1234567"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Stadt</Label>
                  <CityCombobox
                    variant="form"
                    size="md"
                    className="h-11 w-full"
                    value={profileForm.city_id ?? undefined}
                    onChange={(id) => setProfileForm((prev) => ({ ...prev, city_id: id }))}
                    placeholder="Stadt wählen"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="beruf">Beruf</Label>
                  <Input
                    id="beruf"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="z.B. Elektriker, Schneider"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="preis">Preis ab (€)</Label>
                  <Input
                    id="preis"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                    placeholder="z.B. 45.00"
                    className="h-11"
                  />
                  <p className="text-xs text-neutral-400">Wird als „Ab … €“ auf Ihrem Profil angezeigt</p>
                </div>
              </div>
            </section>

            {/* Блок 3 — Kategorie + теги */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Kategorie</h2>
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
                <SelectTrigger className="h-11">
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

              <div className="space-y-2">
                <Label htmlFor="service_tags">Service-Tags</Label>
                <div className="flex gap-2">
                  <Input
                    id="service_tags"
                    value={serviceTagInput}
                    onChange={(e) => setServiceTagInput(e.target.value)}
                    onKeyDown={handleServiceTagKeyDown}
                    placeholder="z.B. Lampen montieren"
                    className="h-11"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addServiceTag(serviceTagInput)}
                    disabled={!serviceTagInput.trim()}
                    className="h-11 shrink-0 px-4"
                  >
                    +
                  </Button>
                </div>
                {serviceTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {serviceTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1.5 rounded-full px-3 py-1.5">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeServiceTag(tag)}
                          className="rounded-full hover:text-foreground"
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
                    {suggestedTags.slice(0, 5).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addServiceTag(tag)}
                        className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 hover:border-emerald-400 hover:text-emerald-700"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Блок 4 — Über mich */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Über mich</h2>
              <Textarea
                value={profileForm.about || ""}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    about: e.target.value.slice(0, ABOUT_LIMIT),
                  }))
                }
                placeholder="Erzählen Sie von Ihrer Erfahrung und Ihren Spezialgebieten..."
                rows={7}
                maxLength={ABOUT_LIMIT}
                className="min-h-[160px] resize-none"
              />
              <p className="text-right text-xs text-neutral-400">
                {(profileForm.about || "").length}/{ABOUT_LIMIT}
              </p>
            </section>

            {/* Блок 5 — Meine Fotos */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Meine Fotos</h2>
              <Input
                ref={masterPhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handleMasterPhotoInputChange}
                disabled={masterPhotosUploading || !canAddMasterPhotos}
                className="hidden"
              />
              <div className="grid grid-cols-3 gap-2">
                {masterPhotos.map((photo) => {
                  const photoUrl = getOptimizedImageUrl(photo.thumbnail_url || photo.url, "thumbnail")
                  const isDeleting = deletingMasterPhotoId === photo.id
                  return (
                    <div key={photo.id} className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
                      <img src={photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      <button
                        type="button"
                        onClick={() => handleDeleteMasterPhoto(photo.id)}
                        disabled={isDeleting || masterPhotosUploading}
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                        aria-label="Foto löschen"
                      >
                        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-4 w-4" />}
                      </button>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => masterPhotoInputRef.current?.click()}
                  disabled={masterPhotosUploading || !canAddMasterPhotos}
                  className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 text-xs font-medium text-neutral-500 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-40"
                >
                  {masterPhotosUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="mb-1 h-5 w-5" />}
                  Foto
                </button>
              </div>
              <p className="text-xs text-neutral-400">{masterPhotos.length}/{MASTER_PHOTO_LIMIT} Fotos</p>
            </section>

            {/* Блок 6 — Meine Videos */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Meine Videos</h2>
              <Input
                ref={masterVideoInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={handleMasterVideoInputChange}
                disabled={masterVideosUploading || !canAddMasterVideos}
                className="hidden"
              />
              {masterVideos.length > 0 && (
                <div className="space-y-2">
                  {masterVideos.map((video) => {
                    const isDeleting = deletingMasterVideoId === video.id
                    return (
                      <div
                        key={video.id}
                        className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                      >
                        <Video className="h-5 w-5 shrink-0 text-neutral-400" />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{getVideoTitle(video)}</p>
                        <button
                          type="button"
                          onClick={() => handleDeleteMasterVideo(video.id)}
                          disabled={isDeleting || masterVideosUploading}
                          className="shrink-0 text-red-500 hover:text-red-700"
                          aria-label="Video löschen"
                        >
                          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => masterVideoInputRef.current?.click()}
                disabled={masterVideosUploading || !canAddMasterVideos}
                className="h-11 w-full border-dashed"
              >
                {masterVideosUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Video hochladen
              </Button>
              <p className="text-xs text-neutral-400">{masterVideos.length}/{MASTER_VIDEO_LIMIT} Videos</p>
            </section>

            {/* Блок 7 — Bewertungen */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Bewertungen</h2>
              {masterReviews.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-200 py-8 text-center text-sm text-neutral-400">
                  Noch keine Bewertungen
                </p>
              ) : (
                <div className="space-y-3">
                  {masterReviews.map((review) => {
                    const statusLabel = getReviewReportStatusLabel(review.report_status)
                    const isReplyOpen = activeReplyReviewId === review.id
                    const isReportOpen = activeReportReviewId === review.id
                    return (
                      <div key={review.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={index}
                                className={
                                  index < review.rating
                                    ? "h-4 w-4 fill-amber-400 text-amber-400"
                                    : "h-4 w-4 text-neutral-200"
                                }
                              />
                            ))}
                          </div>
                          {statusLabel && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {statusLabel}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-neutral-700">
                          {review.report_status === "removed" ? "Diese Bewertung wurde entfernt." : review.text || "Ohne Text"}
                        </p>
                        {review.master_response && (
                          <div className="rounded-lg bg-white p-3 text-sm">
                            <p className="mb-1 text-xs font-semibold text-neutral-400">Ihre Antwort</p>
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
                            className="h-8 rounded-full text-xs"
                          >
                            Antworten
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveReportReviewId(isReportOpen ? null : review.id)}
                            className="h-8 rounded-full text-xs"
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
                              className="resize-none text-sm"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={savingReviewId === review.id}
                              onClick={() => handleReplyToReview(review.id)}
                              className="w-full"
                            >
                              {savingReviewId === review.id && <Loader2 className="h-4 w-4 animate-spin" />}
                              Antwort speichern
                            </Button>
                          </div>
                        )}
                        {isReportOpen && (
                          <div className="space-y-2 rounded-lg bg-white p-3">
                            <p className="text-xs font-semibold text-neutral-500">Grund auswählen</p>
                            {REVIEW_REPORT_REASONS.map((reason) => (
                              <Button
                                key={reason}
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={reportingReviewId === review.id}
                                onClick={() => handleReportReview(review.id, reason)}
                                className="w-full justify-start text-xs"
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
            </section>

            {/* Нижняя кнопка Speichern */}
            <SpeichernButton
              saving={saving}
              onClick={handleSave}
              className="h-14 w-full rounded-2xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700"
            />
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
