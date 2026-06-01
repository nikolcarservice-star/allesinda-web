"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, User as UserIcon, X, Plus, Trash2, Video, Star, Flag } from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { getMasterCabinet, updateMasterCabinet, uploadProfileImage } from "@/lib/api/masters"
import { ApiClientError } from "@/lib/api/client"
import { getCategoriesByType } from "@/lib/api/categories"
import { getMyMedia, uploadMedia, deleteMedia } from "@/lib/api/media"
import { getSellerReviews, replyToReview, reportReview } from "@/lib/api/reviews"
import { cn, getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"
import { CityCombobox } from "@/components/shared/city-combobox"
import type { Category, Media, Profile, ProfileInput, Review, User } from "@/lib/api/types"
import { toast } from "sonner"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { AccountSessionSection } from "@/components/profile/account-session-section"
import { MasterCabinetDesktop } from "@/components/master/master-cabinet-desktop"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale/de"

const ABOUT_LIMIT = 500
const MASTER_PHOTO_LIMIT = 20
const MASTER_VIDEO_LIMIT = 5
const REVIEW_REPORT_REASONS = ["Falsche Angaben", "Beleidigung", "Spam"] as const

type CabinetTabId = "profile" | "photo" | "video" | "reviews"

const CABINET_TABS: { id: CabinetTabId; label: string }[] = [
  { id: "profile", label: "Profil" },
  { id: "photo", label: "Foto" },
  { id: "video", label: "Video" },
  { id: "reviews", label: "Bewertungen" },
]

const SERVICE_TAG_SUGGESTIONS: Array<{ match: string[]; tags: string[] }> = [
  {
    match: ["schneider", "näherei", "naeherei", "textil"],
    tags: ["Änderungen", "Reparaturen", "Maßanfertigung", "Reißverschluss", "Vorhänge"],
  },
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

function getFileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? ""
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"])
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "avi", "webm", "mkv", "m4v", "3gp"])

function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true
  return IMAGE_EXTENSIONS.has(getFileExtension(file.name))
}

function isVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true
  return VIDEO_EXTENSIONS.has(getFileExtension(file.name))
}

function getVideoTitle(video: Media) {
  if (video.title?.trim()) return video.title.trim()
  const path = video.url.split("?")[0]
  return decodeURIComponent(path.split("/").pop() || `Video ${video.id}`)
}

const FIELD_CLASS =
  "h-12 rounded-xl border-neutral-200 bg-neutral-50 text-base shadow-none transition-colors focus-visible:border-emerald-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/20 lg:h-10 lg:rounded-md lg:border-input lg:bg-background lg:text-sm lg:shadow-sm lg:focus-visible:border-ring lg:focus-visible:ring-ring/50"

const SECTION_CARD =
  "rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] lg:rounded-lg lg:border-border lg:p-6 lg:shadow-sm"

function CabinetSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-4", SECTION_CARD, className)}>
      <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">{title}</h2>
      {children}
    </section>
  )
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-sm font-medium text-neutral-700">
      {children}
    </Label>
  )
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
  const [activeTab, setActiveTab] = useState<CabinetTabId>("profile")
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

    const imageFiles = selectedFiles.filter(isImageFile)
    const filesToUpload = imageFiles.slice(0, remainingSlots)
    if (!imageFiles.length) {
      toast.error("Bitte wählen Sie eine Bilddatei (JPG, PNG, WebP …)")
      return
    }
    if (!filesToUpload.length) return

    try {
      setMasterPhotosUploading(true)
      const uploadedPhotos: Media[] = []
      let skippedLarge = 0
      for (const file of filesToUpload) {
        if (file.size > 10 * 1024 * 1024) {
          skippedLarge += 1
          continue
        }
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
      if (skippedLarge > 0) {
        toast.error("Einige Fotos sind größer als 10 MB")
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

    const videoFiles = selectedFiles.filter(isVideoFile)
    const filesToUpload = videoFiles.slice(0, remainingSlots)
    if (!videoFiles.length) {
      toast.error("Bitte wählen Sie eine Videodatei (MP4, MOV, WebM …)")
      return
    }
    if (!filesToUpload.length) return

    try {
      setMasterVideosUploading(true)
      const uploadedVideos: Media[] = []
      let skippedLarge = 0
      for (const file of filesToUpload) {
        if (file.size > 50 * 1024 * 1024) {
          skippedLarge += 1
          continue
        }
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
      } else if (skippedLarge > 0) {
        toast.error("Video ist größer als 50 MB")
      }
      if (skippedLarge > 0 && uploadedVideos.length > 0) {
        toast.error("Einige Videos sind größer als 50 MB und wurden übersprungen")
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

  const displayName = joinName(firstName, lastName)

  return (
    <ProtectedRoute>
      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center py-24 lg:min-h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          <MasterCabinetDesktop
            activeTab={activeTab}
            onTabChange={setActiveTab}
            saving={saving}
            onSave={handleSave}
            profile={profile}
            profileImageUrl={profileImageUrl}
            displayName={displayName}
            profilePhotoInputRef={profilePhotoInputRef}
            profileImageUploading={profileImageUploading}
            onProfilePhotoChange={handleProfilePhotoChange}
            firstName={firstName}
            onFirstNameChange={setFirstName}
            lastName={lastName}
            onLastNameChange={setLastName}
            phone={phone}
            onPhoneChange={setPhone}
            profession={profession}
            onProfessionChange={setProfession}
            priceFrom={priceFrom}
            onPriceFromChange={setPriceFrom}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            masterCategories={masterCategories}
            serviceTagInput={serviceTagInput}
            onServiceTagInputChange={setServiceTagInput}
            onServiceTagKeyDown={handleServiceTagKeyDown}
            serviceTags={serviceTags}
            suggestedTags={suggestedTags}
            onAddServiceTag={addServiceTag}
            onRemoveServiceTag={removeServiceTag}
            aboutLimit={ABOUT_LIMIT}
            masterPhotos={masterPhotos}
            masterPhotoInputRef={masterPhotoInputRef}
            masterPhotosUploading={masterPhotosUploading}
            canAddMasterPhotos={canAddMasterPhotos}
            onMasterPhotoInputChange={handleMasterPhotoInputChange}
            onDeleteMasterPhoto={handleDeleteMasterPhoto}
            deletingMasterPhotoId={deletingMasterPhotoId}
            photoLimit={MASTER_PHOTO_LIMIT}
            masterVideos={masterVideos}
            masterVideoInputRef={masterVideoInputRef}
            masterVideosUploading={masterVideosUploading}
            canAddMasterVideos={canAddMasterVideos}
            onMasterVideoInputChange={handleMasterVideoInputChange}
            onDeleteMasterVideo={handleDeleteMasterVideo}
            deletingMasterVideoId={deletingMasterVideoId}
            videoLimit={MASTER_VIDEO_LIMIT}
            getVideoTitle={getVideoTitle}
            masterReviews={masterReviews}
            activeReplyReviewId={activeReplyReviewId}
            setActiveReplyReviewId={setActiveReplyReviewId}
            activeReportReviewId={activeReportReviewId}
            setActiveReportReviewId={setActiveReportReviewId}
            replyDrafts={replyDrafts}
            setReplyDrafts={setReplyDrafts}
            savingReviewId={savingReviewId}
            reportingReviewId={reportingReviewId}
            onReplyToReview={handleReplyToReview}
            onReportReview={(reviewId, reason) =>
              handleReportReview(reviewId, reason as (typeof REVIEW_REPORT_REASONS)[number])
            }
            reviewReportReasons={REVIEW_REPORT_REASONS}
            getReviewReportStatusLabel={getReviewReportStatusLabel}
            getOptimizedPhotoUrl={(url) => getOptimizedImageUrl(url, "thumbnail")}
          />

          <div
            className={cn(
              "min-h-screen bg-neutral-100 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden",
              activeTab === "profile"
                ? "pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]"
                : "pb-[calc(5rem+env(safe-area-inset-bottom,0px))]",
            )}
          >
          <div className="mx-auto max-w-lg space-y-0 px-4 py-4">
            <p className="mb-4 px-1 text-xl font-bold tracking-tight text-neutral-900">Mein Profil</p>

            {/* Фото профиля + вкладки под ним */}
            <section className={cn("overflow-hidden", SECTION_CARD, "p-0")}>
              <div className="bg-gradient-to-b from-emerald-50/90 via-white to-white px-5 pb-5 pt-8 lg:flex lg:items-center lg:gap-8 lg:px-8 lg:py-8">
                <div className="flex flex-col items-center gap-4 lg:flex-1 lg:flex-row lg:items-center lg:justify-start lg:gap-6">
                  <div className="relative h-[7.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-full bg-white shadow-lg ring-4 ring-white lg:h-28 lg:w-28">
                    {profileImageUrl ? (
                      <Image
                        src={profileImageUrl}
                        alt="Profilfoto"
                        fill
                        className="object-cover"
                        unoptimized={shouldUseUnoptimized(profileImageUrl)}
                        sizes="120px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-neutral-100">
                        <UserIcon className="h-14 w-14 text-neutral-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col items-center gap-2 text-center lg:items-start lg:text-left">
                    {displayName ? (
                      <p className="max-w-full truncate text-lg font-semibold text-neutral-900 lg:text-xl">{displayName}</p>
                    ) : (
                      <p className="text-sm text-neutral-500">Profil vervollständigen</p>
                    )}
                    <Input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoChange}
                      disabled={profileImageUploading}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => profilePhotoInputRef.current?.click()}
                      disabled={profileImageUploading}
                      className="h-10 rounded-full border-emerald-200 bg-white px-6 text-sm font-medium text-emerald-800 shadow-sm hover:bg-emerald-50 lg:rounded-md"
                    >
                      {profileImageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Foto ändern"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-200 bg-white px-2 lg:px-4">
                <div
                  className="flex justify-between gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-2"
                  role="tablist"
                  aria-label="Profilbereiche"
                >
                  {CABINET_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "min-w-0 flex-1 shrink-0 border-b-2 pb-3 pt-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors sm:text-xs lg:pb-3.5 lg:pt-3 lg:text-sm",
                        activeTab === tab.id
                          ? "border-neutral-900 text-neutral-900"
                          : "border-transparent text-neutral-500 hover:text-neutral-700",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="min-h-[40vh] space-y-4 pt-4 lg:pt-0">
            {activeTab === "profile" && (
            <div className="space-y-4" role="tabpanel">
            {/* Grunddaten, Kategorie, Über mich */}
            <CabinetSection title="Grunddaten">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-4">
                <div className="col-span-1 space-y-2">
                  <FieldLabel htmlFor="vorname">Vorname</FieldLabel>
                  <Input
                    id="vorname"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Max"
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="col-span-1 space-y-2">
                  <FieldLabel htmlFor="nachname">Nachname</FieldLabel>
                  <Input
                    id="nachname"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Mustermann"
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <FieldLabel htmlFor="telefon">Telefonnummer</FieldLabel>
                  <Input
                    id="telefon"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+49 170 1234567"
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <FieldLabel>Stadt</FieldLabel>
                  <CityCombobox
                    variant="form"
                    size="md"
                    className={cn("h-12 w-full rounded-xl border-neutral-200 bg-neutral-50", FIELD_CLASS)}
                    value={profileForm.city_id ?? undefined}
                    onChange={(id) => setProfileForm((prev) => ({ ...prev, city_id: id }))}
                    placeholder="Stadt wählen"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <FieldLabel htmlFor="beruf">Beruf</FieldLabel>
                  <Input
                    id="beruf"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="z.B. Elektriker, Schneider"
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <FieldLabel htmlFor="preis">Preis ab (€)</FieldLabel>
                  <Input
                    id="preis"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                    placeholder="z.B. 45.00"
                    className={FIELD_CLASS}
                  />
                  <p className="text-xs leading-relaxed text-neutral-500">Wird als „Ab … €“ auf Ihrem Profil angezeigt</p>
                </div>
              </div>
            </CabinetSection>

            {/* Блок 3 — Kategorie + теги */}
            <CabinetSection title="Kategorie">
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
                <SelectTrigger className={FIELD_CLASS}>
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

              <div className="space-y-3 border-t border-neutral-100 pt-4">
                <FieldLabel htmlFor="service_tags">Service-Tags</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="service_tags"
                    value={serviceTagInput}
                    onChange={(e) => setServiceTagInput(e.target.value)}
                    onKeyDown={handleServiceTagKeyDown}
                    placeholder="z.B. Lampen montieren"
                    className={cn(FIELD_CLASS, "flex-1")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addServiceTag(serviceTagInput)}
                    disabled={!serviceTagInput.trim()}
                    className="h-12 w-12 shrink-0 rounded-xl border-neutral-200 bg-neutral-50 p-0 text-lg font-medium lg:h-10 lg:w-10 lg:rounded-md"
                  >
                    +
                  </Button>
                </div>
                {serviceTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {serviceTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-emerald-900"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeServiceTag(tag)}
                          className="rounded-full hover:text-emerald-950"
                          aria-label={`${tag} entfernen`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                {suggestedTags.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-neutral-500">Vorschläge</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedTags.slice(0, 5).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addServiceTag(tag)}
                          className="rounded-full border border-dashed border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600 active:scale-[0.98]"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CabinetSection>

            {/* Блок 4 — Über mich */}
            <CabinetSection title="Über mich" className="space-y-3">
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
                className="min-h-[160px] resize-none rounded-xl border-neutral-200 bg-neutral-50 text-base leading-relaxed focus-visible:border-emerald-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/20 lg:min-h-[200px] lg:rounded-md lg:border-input lg:bg-background lg:text-sm lg:focus-visible:border-ring lg:focus-visible:ring-ring/50"
              />
              <p className="text-right text-xs tabular-nums text-neutral-500">
                {(profileForm.about || "").length}/{ABOUT_LIMIT}
              </p>
            </CabinetSection>

            <AccountSessionSection />
            </div>
            )}

            {activeTab === "photo" && (
            <div role="tabpanel">
            <CabinetSection title="Meine Fotos" className="space-y-3">
              <Input
                ref={masterPhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleMasterPhotoInputChange}
                disabled={masterPhotosUploading || !canAddMasterPhotos}
                className="hidden"
              />
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-4 lg:gap-3 xl:grid-cols-5">
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
                  className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-200/80 bg-emerald-50/40 text-xs font-semibold text-emerald-700 active:scale-[0.98] disabled:opacity-40"
                >
                  {masterPhotosUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="mb-1 h-5 w-5" />}
                  Foto
                </button>
              </div>
              <p className="text-xs font-medium text-neutral-500">{masterPhotos.length}/{MASTER_PHOTO_LIMIT} Fotos</p>
            </CabinetSection>
            </div>
            )}

            {activeTab === "video" && (
            <div role="tabpanel">
            <CabinetSection title="Meine Videos" className="space-y-3">
              <Input
                ref={masterVideoInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.webm,.mkv,.m4v,.3gp"
                multiple
                onChange={handleMasterVideoInputChange}
                disabled={masterVideosUploading || !canAddMasterVideos}
                className="hidden"
              />
              {masterVideos.length > 0 && (
                <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                  {masterVideos.map((video) => {
                    const isDeleting = deletingMasterVideoId === video.id
                    return (
                      <div
                        key={video.id}
                        className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3.5"
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
                className="h-12 w-full rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 font-medium"
              >
                {masterVideosUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Video hochladen
              </Button>
              <p className="text-xs font-medium text-neutral-500">{masterVideos.length}/{MASTER_VIDEO_LIMIT} Videos</p>
            </CabinetSection>
            </div>
            )}

            {activeTab === "reviews" && (
            <div role="tabpanel">
            <CabinetSection title="Bewertungen" className="space-y-3">
              {masterReviews.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 py-10 text-center text-sm text-neutral-500 lg:py-12">
                  Noch keine Bewertungen
                </p>
              ) : (
                <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                  {masterReviews.map((review) => {
                    const statusLabel = getReviewReportStatusLabel(review.report_status)
                    const isReplyOpen = activeReplyReviewId === review.id
                    const isReportOpen = activeReportReviewId === review.id
                    return (
                      <div key={review.id} className="space-y-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-medium text-neutral-800">
                              {review.buyer_name || "Kunde"}
                            </p>
                            <p className="text-xs text-neutral-400">
                              {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: de })}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
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
                              <Badge variant="outline" className="text-[10px]">
                                {statusLabel}
                              </Badge>
                            )}
                          </div>
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
            </CabinetSection>
            </div>
            )}
            </div>

            {/* Speichern — nur auf Tab Profil */}
            {activeTab === "profile" && (
              <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-40 border-t border-neutral-200/80 bg-white/90 px-4 py-3 backdrop-blur-md lg:hidden">
                <SpeichernButton
                  saving={saving}
                  onClick={handleSave}
                  className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.99]"
                />
              </div>
            )}
          </div>
          </div>
        </>
      )}
    </ProtectedRoute>
  )
}
