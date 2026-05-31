"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, User, Mail, Phone, Shield, Key, CheckCircle, AlertCircle, Lock, Save, Tag, X, Image as ImageIcon, Plus, Trash2, Video, Star, Flag } from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { changePassword, setup2FA, verify2FA, disable2FA } from "@/lib/api/auth"
import { getMyProfile, updateMyProfile } from "@/lib/api/masters"
import { getCategoriesByType } from "@/lib/api/categories"
import { getMyMedia, uploadMedia, deleteMedia } from "@/lib/api/media"
import { getSellerReviews, replyToReview, reportReview } from "@/lib/api/reviews"
import { getOptimizedImageUrl } from "@/lib/utils"
import type { Category, Media, ProfileInput, Review } from "@/lib/api/types"
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

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [masterProfileLoading, setMasterProfileLoading] = useState(false)
  const [masterProfileSaving, setMasterProfileSaving] = useState(false)
  const [masterProfileId, setMasterProfileId] = useState<number | null>(null)
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
  const masterPhotoInputRef = useRef<HTMLInputElement>(null)
  const masterVideoInputRef = useRef<HTMLInputElement>(null)
  const [masterProfileForm, setMasterProfileForm] = useState<ProfileInput>({
    about: "",
    category_id: undefined,
    keywords: "",
  })
  
  // Password change
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  
  // 2FA
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    secret: string
    qr_code_url: string
    backup_codes: string[]
  } | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [disable2FAData, setDisable2FAData] = useState({ password: "", code: "" })

  useEffect(() => {
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  useEffect(() => {
    if (!user || user.role !== "master") return

    let mounted = true

    const loadMasterSettings = async () => {
      setMasterProfileLoading(true)
      try {
        const [profile, categories, mediaData] = await Promise.all([
          getMyProfile(),
          getCategoriesByType("master", { activeOnly: true, rootOnly: true }),
          getMyMedia({ page: 1, page_size: 100 }),
        ])

        if (!mounted) return

        setMasterProfileForm({
          about: (profile.about || "").slice(0, ABOUT_LIMIT),
          category_id: profile.category_id ?? undefined,
          keywords: profile.keywords || "",
        })
        setMasterProfileId(profile.id)
        setMasterCategories(categories)
        setMasterPhotos(
          (mediaData.items || []).filter(
            (item) => item.media_type === "photo" && item.profile_id === profile.id,
          ),
        )
        setMasterVideos(
          (mediaData.items || []).filter(
            (item) => item.media_type === "video" && item.profile_id === profile.id,
          ),
        )
        const reviewsData = await getSellerReviews(profile.user_id, { page: 1, page_size: 20 }).catch(() => ({
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          total_pages: 0,
        }))
        if (!mounted) return
        setMasterReviews(reviewsData.items || [])
      } catch (err: any) {
        if (mounted) {
          toast.error(err?.message || "Meisterprofil konnte nicht geladen werden")
        }
      } finally {
        if (mounted) {
          setMasterProfileLoading(false)
        }
      }
    }

    loadMasterSettings()

    return () => {
      mounted = false
    }
  }, [user])

  const serviceTags = parseServiceTags(masterProfileForm.keywords)
  const selectedCategoryName = masterCategories.find((category) => category.id === masterProfileForm.category_id)?.name
  const suggestedTags = getSuggestedTags(selectedCategoryName).filter(
    (tag) => !serviceTags.some((existingTag) => existingTag.toLowerCase() === tag.toLowerCase()),
  )
  const canAddMasterPhotos = masterPhotos.length < MASTER_PHOTO_LIMIT
  const canAddMasterVideos = masterVideos.length < MASTER_VIDEO_LIMIT

  const reloadMasterPhotos = async (profileId = masterProfileId) => {
    if (!profileId) return
    const mediaData = await getMyMedia({ page: 1, page_size: 100 })
    setMasterPhotos(
      (mediaData.items || []).filter(
        (item) => item.media_type === "photo" && item.profile_id === profileId,
      ),
    )
  }

  const reloadMasterVideos = async (profileId = masterProfileId) => {
    if (!profileId) return
    const mediaData = await getMyMedia({ page: 1, page_size: 100 })
    setMasterVideos(
      (mediaData.items || []).filter(
        (item) => item.media_type === "video" && item.profile_id === profileId,
      ),
    )
  }

  const getVideoTitle = (video: Media) => {
    if (video.title?.trim()) return video.title.trim()
    const path = video.url.split("?")[0]
    return decodeURIComponent(path.split("/").pop() || `Video ${video.id}`)
  }

  const getReviewReportStatusLabel = (status?: string | null) => {
    if (status === "in_review") return "In Prüfung"
    if (status === "removed") return "Entfernt"
    if (status === "rejected") return "Abgelehnt"
    return null
  }

  const addServiceTag = (value: string) => {
    const tag = value.replace(/,/g, " ").trim()
    if (!tag) return

    const exists = serviceTags.some((existingTag) => existingTag.toLowerCase() === tag.toLowerCase())
    if (exists) {
      setServiceTagInput("")
      return
    }

    setMasterProfileForm((prev) => ({
      ...prev,
      keywords: stringifyServiceTags([...serviceTags, tag]),
    }))
    setServiceTagInput("")
  }

  const removeServiceTag = (tagToRemove: string) => {
    setMasterProfileForm((prev) => ({
      ...prev,
      keywords: stringifyServiceTags(serviceTags.filter((tag) => tag !== tagToRemove)),
    }))
  }

  const handleServiceTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" && event.key !== ",") return
    event.preventDefault()
    addServiceTag(serviceTagInput)
  }

  const handleSaveMasterProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setMasterProfileSaving(true)

    try {
      const updated = await updateMyProfile({
        about: (masterProfileForm.about || "").slice(0, ABOUT_LIMIT),
        category_id: masterProfileForm.category_id,
        keywords: stringifyServiceTags(serviceTags),
      })

      setMasterProfileForm({
        about: (updated.about || "").slice(0, ABOUT_LIMIT),
        category_id: updated.category_id ?? undefined,
        keywords: updated.keywords || "",
      })
      toast.success("Meisterprofil gespeichert")
    } catch (err: any) {
      toast.error(err?.message || "Meisterprofil konnte nicht gespeichert werden")
    } finally {
      setMasterProfileSaving(false)
    }
  }

  const handleMasterPhotoInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    if (event.target) event.target.value = ""
    if (!selectedFiles.length || !masterProfileId) return

    const remainingSlots = MASTER_PHOTO_LIMIT - masterPhotos.length
    if (remainingSlots <= 0) {
      toast.error(`Maximal ${MASTER_PHOTO_LIMIT} Fotos erlaubt`)
      return
    }

    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"))
    if (imageFiles.length !== selectedFiles.length) {
      toast.error("Nur Bilddateien sind erlaubt")
    }

    const filesToUpload = imageFiles.slice(0, remainingSlots)
    if (imageFiles.length > remainingSlots) {
      toast.error(`Sie können noch ${remainingSlots} Foto${remainingSlots === 1 ? "" : "s"} hochladen`)
    }
    if (!filesToUpload.length) return

    try {
      setMasterPhotosUploading(true)
      const uploadedPhotos: Media[] = []
      for (const file of filesToUpload) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} ist größer als 10MB`)
          continue
        }

        const uploaded = await uploadMedia(file, {
          media_type: "photo",
          profile_id: masterProfileId,
          category_id: masterProfileForm.category_id,
        })
        uploadedPhotos.push(uploaded)
      }

      if (uploadedPhotos.length > 0) {
        setMasterPhotos((prev) => [...prev, ...uploadedPhotos].slice(0, MASTER_PHOTO_LIMIT))
        toast.success(`${uploadedPhotos.length} Foto${uploadedPhotos.length === 1 ? "" : "s"} hochgeladen`)
        reloadMasterPhotos(masterProfileId).catch(() => undefined)
      }
    } catch (err: any) {
      toast.error(err?.message || "Foto konnte nicht hochgeladen werden")
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
    } catch (err: any) {
      toast.error(err?.message || "Foto konnte nicht gelöscht werden")
    } finally {
      setDeletingMasterPhotoId(null)
    }
  }

  const handleMasterVideoInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    if (event.target) event.target.value = ""
    if (!selectedFiles.length || !masterProfileId) return

    const remainingSlots = MASTER_VIDEO_LIMIT - masterVideos.length
    if (remainingSlots <= 0) {
      toast.error(`Maximal ${MASTER_VIDEO_LIMIT} Videos erlaubt`)
      return
    }

    const videoFiles = selectedFiles.filter((file) => file.type.startsWith("video/"))
    if (videoFiles.length !== selectedFiles.length) {
      toast.error("Nur Videodateien sind erlaubt")
    }

    const filesToUpload = videoFiles.slice(0, remainingSlots)
    if (videoFiles.length > remainingSlots) {
      toast.error(`Sie können noch ${remainingSlots} Video${remainingSlots === 1 ? "" : "s"} hochladen`)
    }
    if (!filesToUpload.length) return

    try {
      setMasterVideosUploading(true)
      const uploadedVideos: Media[] = []
      for (const file of filesToUpload) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} ist größer als 50MB`)
          continue
        }

        const uploaded = await uploadMedia(file, {
          media_type: "video",
          profile_id: masterProfileId,
          category_id: masterProfileForm.category_id,
          title: file.name,
        })
        uploadedVideos.push(uploaded)
      }

      if (uploadedVideos.length > 0) {
        setMasterVideos((prev) => [...prev, ...uploadedVideos].slice(0, MASTER_VIDEO_LIMIT))
        toast.success(`${uploadedVideos.length} Video${uploadedVideos.length === 1 ? "" : "s"} hochgeladen`)
        reloadMasterVideos(masterProfileId).catch(() => undefined)
      }
    } catch (err: any) {
      toast.error(err?.message || "Video konnte nicht hochgeladen werden")
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
    } catch (err: any) {
      toast.error(err?.message || "Video konnte nicht gelöscht werden")
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
    } catch (err: any) {
      toast.error(err?.message || "Antwort konnte nicht gespeichert werden")
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
    } catch (err: any) {
      toast.error(err?.message || "Bewertung konnte nicht gemeldet werden")
    } finally {
      setReportingReviewId(null)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("Passwörter stimmen nicht überein")
      setLoading(false)
      return
    }

    if (passwordData.new_password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen lang sein")
      setLoading(false)
      return
    }

    try {
      await changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      })
      toast.success("Passwort erfolgreich geändert")
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" })
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Fehler beim Ändern des Passworts"
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleSetup2FA = async () => {
    setTwoFactorLoading(true)
    try {
      const setup = await setup2FA()
      setTwoFactorSetup(setup)
      toast.success("2FA-Einrichtung gestartet. Scannen Sie den QR-Code mit Ihrer Authenticator-App.")
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Fehler bei der 2FA-Einrichtung"
      toast.error(errorMessage)
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const handleVerify2FA = async () => {
    if (!twoFactorSetup) return

    setTwoFactorLoading(true)
    try {
      await verify2FA({ code: twoFactorCode })
      toast.success("2FA erfolgreich aktiviert!")
      setTwoFactorSetup(null)
      setTwoFactorCode("")
      await refreshUser()
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Ungültiger 2FA-Code"
      toast.error(errorMessage)
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const handleDisable2FA = async () => {
    setTwoFactorLoading(true)
    try {
      await disable2FA(disable2FAData)
      toast.success("2FA erfolgreich deaktiviert!")
      setDisable2FAData({ password: "", code: "" })
      await refreshUser()
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Fehler beim Deaktivieren von 2FA"
      toast.error(errorMessage)
    } finally {
      setTwoFactorLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <ProtectedRoute>
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background via-muted/10 to-background p-sides py-6 sm:py-8 md:py-10">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-5 sm:mb-6 md:mb-8">
            <div className="space-y-1.5 sm:space-y-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Profileinstellungen
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground/90">Verwalten Sie Ihre Kontoeinstellungen und Präferenzen</p>
            </div>
          </div>

          <Tabs defaultValue="account" className="space-y-4 sm:space-y-6">
            <TabsList variant="modern" className="grid w-full grid-cols-2 mb-6 sm:mb-8">
              <TabsTrigger variant="modern" value="account" className="flex items-center justify-center gap-1.5">
                <User className="shrink-0" />
                <span>Konto</span>
              </TabsTrigger>
              <TabsTrigger variant="modern" value="security" className="flex items-center justify-center gap-1.5">
                <Shield className="shrink-0" />
                <span>Sicherheit</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-4 sm:space-y-5 md:space-y-6">
              <Card className="border border-border shadow-sm bg-gradient-to-br from-card to-card/95 rounded-lg">
                <CardHeader className="p-4 sm:p-5 md:p-6">
                  <CardTitle className="text-base sm:text-lg md:text-xl font-bold">Kontoinformationen</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground/90">Ihre Kontodaten</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6 pt-0">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm sm:text-base">Name</Label>
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <Input value={user.name} disabled className="h-10 sm:h-11 text-sm sm:text-base" />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm sm:text-base">E-Mail</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 flex-1 w-full">
                        <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                        <Input value={user.email} disabled className="h-10 sm:h-11 text-sm sm:text-base flex-1" />
                      </div>
                      {user.email_verified ? (
                        <div className="flex items-center gap-1 text-green-600 text-xs sm:text-sm shrink-0">
                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Verifiziert
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-yellow-600 text-xs sm:text-sm shrink-0">
                          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Unverifiziert
                        </div>
                      )}
                    </div>
                  </div>
                  {user.phone && (
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label className="text-sm sm:text-base">Telefon</Label>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                        <Input value={user.phone} disabled className="h-10 sm:h-11 text-sm sm:text-base" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm sm:text-base">Rolle</Label>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <Input value={user.role} disabled className="capitalize h-10 sm:h-11 text-sm sm:text-base" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {user.role === "master" && (
                <Card className="border border-border shadow-sm bg-gradient-to-br from-card to-card/95 rounded-lg">
                  <CardHeader className="p-4 sm:p-5 md:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-bold">
                      <ImageIcon className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                      Meine Fotos
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground/90">
                      Bis zu {MASTER_PHOTO_LIMIT} Fotos für Ihr Meisterprofil
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0 md:p-6 md:pt-0">
                    {masterProfileLoading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Fotos werden geladen...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Input
                          ref={masterPhotoInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleMasterPhotoInputChange}
                          disabled={!masterProfileId || masterPhotosUploading || !canAddMasterPhotos}
                          className="hidden"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          {masterPhotos.map((photo) => {
                            const photoUrl = getOptimizedImageUrl(photo.thumbnail_url || photo.url, "thumbnail")
                            const isDeleting = deletingMasterPhotoId === photo.id

                            return (
                              <div key={photo.id} className="relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted">
                                <img
                                  src={photoUrl}
                                  alt={photo.title || "Meister Foto"}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMasterPhoto(photo.id)}
                                  disabled={isDeleting || masterPhotosUploading}
                                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition hover:bg-black disabled:opacity-60"
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
                            disabled={!masterProfileId || masterPhotosUploading || !canAddMasterPhotos}
                            className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/40 text-xs font-semibold text-muted-foreground transition hover:border-primary/60 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {masterPhotosUploading ? (
                              <Loader2 className="mb-1 h-5 w-5 animate-spin" />
                            ) : (
                              <Plus className="mb-1 h-5 w-5" />
                            )}
                            {canAddMasterPhotos ? "Foto" : "Limit"}
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{masterPhotos.length}/{MASTER_PHOTO_LIMIT} Fotos</span>
                          <span>JPG, PNG, WebP · max. 10MB</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {user.role === "master" && (
                <Card className="border border-border shadow-sm bg-gradient-to-br from-card to-card/95 rounded-lg">
                  <CardHeader className="p-4 sm:p-5 md:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-bold">
                      <Star className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                      Bewertungen
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground/90">
                      Kundenbewertungen lesen, beantworten oder melden
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0 md:p-6 md:pt-0">
                    {masterProfileLoading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Bewertungen werden geladen...
                      </div>
                    ) : masterReviews.length > 0 ? (
                      <div className="space-y-3">
                        {masterReviews.map((review) => {
                          const statusLabel = getReviewReportStatusLabel(review.report_status)
                          const isReplyOpen = activeReplyReviewId === review.id
                          const isReportOpen = activeReportReviewId === review.id

                          return (
                            <div key={review.id} className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-1 text-amber-500">
                                  {Array.from({ length: 5 }).map((_, index) => (
                                    <Star
                                      key={index}
                                      className={index < review.rating ? "h-4 w-4 fill-current" : "h-4 w-4 text-muted-foreground/30"}
                                    />
                                  ))}
                                </div>
                                {statusLabel && (
                                  <Badge variant="outline" className="shrink-0 text-[10px]">
                                    {statusLabel}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-foreground">
                                {review.report_status === "removed" ? "Diese Bewertung wurde entfernt." : review.text || "Ohne Text"}
                              </p>
                              {review.master_response && (
                                <div className="rounded-lg bg-background p-3 text-sm">
                                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Ihre Antwort</p>
                                  <p>{review.master_response}</p>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setActiveReplyReviewId(isReplyOpen ? null : review.id)
                                    setReplyDrafts((prev) => ({ ...prev, [review.id]: prev[review.id] ?? review.master_response ?? "" }))
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
                                    onChange={(event) =>
                                      setReplyDrafts((prev) => ({ ...prev, [review.id]: event.target.value }))
                                    }
                                    placeholder="Antwort an den Kunden schreiben..."
                                    rows={3}
                                    className="resize-none text-sm"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={savingReviewId === review.id}
                                    onClick={() => handleReplyToReview(review.id)}
                                    className="w-full rounded-xl"
                                  >
                                    {savingReviewId === review.id && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Antwort speichern
                                  </Button>
                                </div>
                              )}
                              {isReportOpen && (
                                <div className="space-y-2 rounded-lg bg-background p-3">
                                  <p className="text-xs font-semibold text-muted-foreground">Grund auswählen</p>
                                  <div className="grid gap-2">
                                    {REVIEW_REPORT_REASONS.map((reason) => (
                                      <Button
                                        key={reason}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={reportingReviewId === review.id}
                                        onClick={() => handleReportReview(review.id, reason)}
                                        className="justify-start rounded-lg text-xs"
                                      >
                                        {reason}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                        Noch keine Bewertungen erhalten
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {user.role === "master" && (
                <Card className="border border-border shadow-sm bg-gradient-to-br from-card to-card/95 rounded-lg">
                  <CardHeader className="p-4 sm:p-5 md:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-bold">
                      <Video className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                      Meine Videos
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground/90">
                      Bis zu {MASTER_VIDEO_LIMIT} Videos für Ihr Meisterprofil
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0 md:p-6 md:pt-0">
                    {masterProfileLoading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Videos werden geladen...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Input
                          ref={masterVideoInputRef}
                          type="file"
                          accept="video/*"
                          multiple
                          onChange={handleMasterVideoInputChange}
                          disabled={!masterProfileId || masterVideosUploading || !canAddMasterVideos}
                          className="hidden"
                        />
                        {masterVideos.length > 0 ? (
                          <div className="space-y-2">
                            {masterVideos.map((video) => {
                              const isDeleting = deletingMasterVideoId === video.id

                              return (
                                <div
                                  key={video.id}
                                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"
                                >
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Video className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-foreground">{getVideoTitle(video)}</p>
                                    <p className="text-xs text-muted-foreground">Video</p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteMasterVideo(video.id)}
                                    disabled={isDeleting || masterVideosUploading}
                                    className="h-9 w-9 shrink-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    aria-label={`${getVideoTitle(video)} löschen`}
                                  >
                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                            Noch keine Videos hochgeladen
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => masterVideoInputRef.current?.click()}
                          disabled={!masterProfileId || masterVideosUploading || !canAddMasterVideos}
                          className="h-11 w-full rounded-xl border-dashed font-semibold"
                        >
                          {masterVideosUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          {canAddMasterVideos ? "Video hochladen" : "Video-Limit erreicht"}
                        </Button>
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{masterVideos.length}/{MASTER_VIDEO_LIMIT} Videos</span>
                          <span>MP4, MOV, WebM · max. 50MB</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {user.role === "master" && (
                <Card className="border border-border shadow-sm bg-gradient-to-br from-card to-card/95 rounded-lg">
                  <CardHeader className="p-4 sm:p-5 md:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-bold">
                      <Tag className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                      Meisterprofil
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground/90">
                      Kategorie, Service-Tags und Beschreibung für Kunden
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0 md:p-6 md:pt-0">
                    {masterProfileLoading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Meisterprofil wird geladen...
                      </div>
                    ) : (
                      <form onSubmit={handleSaveMasterProfile} className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="master_category" className="text-sm font-semibold">
                            Hauptkategorie
                          </Label>
                          <Select
                            value={masterProfileForm.category_id ? String(masterProfileForm.category_id) : ""}
                            onValueChange={(value) => {
                              const parsed = Number(value)
                              setMasterProfileForm((prev) => ({
                                ...prev,
                                category_id: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                              }))
                            }}
                            disabled={masterProfileSaving || masterCategories.length === 0}
                          >
                            <SelectTrigger id="master_category" className="h-11 text-sm">
                              <SelectValue
                                placeholder={
                                  masterCategories.length === 0 ? "Keine Kategorien verfügbar" : "Kategorie auswählen"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {masterCategories.map((category) => (
                                <SelectItem key={category.id} value={String(category.id)}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Wählen Sie eine Hauptkategorie, z.B. Elektrik, Reinigung oder Sanitär.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="service_tags" className="text-sm font-semibold">
                              Service-Tags
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="service_tags"
                                value={serviceTagInput}
                                onChange={(event) => setServiceTagInput(event.target.value)}
                                onKeyDown={handleServiceTagKeyDown}
                                placeholder="z.B. Lampen montieren"
                                disabled={masterProfileSaving}
                                className="h-11 text-sm"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => addServiceTag(serviceTagInput)}
                                disabled={masterProfileSaving || !serviceTagInput.trim()}
                                className="h-11 shrink-0"
                              >
                                Hinzufügen
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Enter drücken oder Komma eingeben, um einen Tag hinzuzufügen.
                            </p>
                          </div>

                          {serviceTags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {serviceTags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="gap-1.5 rounded-full px-3 py-1.5 text-xs">
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => removeServiceTag(tag)}
                                    disabled={masterProfileSaving}
                                    className="rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
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
                              <p className="text-xs font-medium text-muted-foreground">Vorschläge</p>
                              <div className="flex flex-wrap gap-2">
                                {suggestedTags.slice(0, 5).map((tag) => (
                                  <Button
                                    key={tag}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addServiceTag(tag)}
                                    disabled={masterProfileSaving}
                                    className="h-8 rounded-full px-3 text-xs"
                                  >
                                    {tag}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="master_about" className="text-sm font-semibold">
                            Über mich
                          </Label>
                          <Textarea
                            id="master_about"
                            value={masterProfileForm.about || ""}
                            onChange={(event) =>
                              setMasterProfileForm((prev) => ({
                                ...prev,
                                about: event.target.value.slice(0, ABOUT_LIMIT),
                              }))
                            }
                            placeholder="Schreiben Sie kurz über Ihre Erfahrung, Arbeitsweise und Spezialisierung."
                            rows={7}
                            maxLength={ABOUT_LIMIT}
                            disabled={masterProfileSaving}
                            className="min-h-[160px] resize-none text-sm"
                          />
                          <div className="flex justify-end text-xs text-muted-foreground">
                            {(masterProfileForm.about || "").length}/{ABOUT_LIMIT} Zeichen
                          </div>
                        </div>

                        <Button type="submit" disabled={masterProfileSaving} size="large" className="w-full text-sm sm:w-auto sm:text-base">
                          {masterProfileSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Wird gespeichert...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              Meisterprofil speichern
                            </>
                          )}
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="security" className="space-y-5 sm:space-y-6">
              <Card className="border border-border shadow-none bg-gradient-to-br from-card to-card/95">
                <CardHeader className="p-5 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl font-bold">Passwort ändern</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground/90">Aktualisieren Sie Ihr Passwort, um Ihr Konto sicher zu halten</CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 pt-0">
                  <form onSubmit={handleChangePassword} className="space-y-4 sm:space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="current_password" className="text-sm sm:text-base font-semibold">Aktuelles Passwort</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                        <Input
                          id="current_password"
                          type="password"
                          value={passwordData.current_password}
                          onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                          required
                          disabled={loading}
                          size="medium"
                          className="pl-12"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new_password" className="text-sm sm:text-base font-semibold">Neues Passwort</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                        <Input
                          id="new_password"
                          type="password"
                          value={passwordData.new_password}
                          onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                          required
                          disabled={loading}
                          minLength={8}
                          size="medium"
                          className="pl-12"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm_password" className="text-sm sm:text-base font-semibold">Neues Passwort bestätigen</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                        <Input
                          id="confirm_password"
                          type="password"
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                          required
                          disabled={loading}
                          minLength={8}
                          size="medium"
                          className="pl-12"
                        />
                      </div>
                    </div>
                    <Button type="submit" size="large" disabled={loading} className="w-full sm:w-auto text-sm sm:text-base">
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Wird geändert...
                        </>
                      ) : (
                        <>
                          <Key className="h-4 w-4" />
                          Passwort ändern
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border border-border shadow-none bg-gradient-to-br from-card to-card/95">
                <CardHeader className="p-5 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl font-bold">Zwei-Faktor-Authentifizierung</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground/90">
                    {user.two_factor_enabled
                      ? "2FA ist aktiviert. Fügen Sie eine zusätzliche Sicherheitsebene zu Ihrem Konto hinzu."
                      : "Aktivieren Sie 2FA, um eine zusätzliche Sicherheitsebene zu Ihrem Konto hinzuzufügen."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-5 p-5 sm:p-6 pt-0">
                  {user.two_factor_enabled ? (
                    <div className="space-y-4">
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>Zwei-Faktor-Authentifizierung ist für Ihr Konto aktiviert.</AlertDescription>
                      </Alert>
                      <div className="space-y-2">
                        <Label htmlFor="disable_password">Passwort</Label>
                        <Input
                          id="disable_password"
                          type="password"
                          value={disable2FAData.password}
                          onChange={(e) => setDisable2FAData({ ...disable2FAData, password: e.target.value })}
                          placeholder="Geben Sie Ihr Passwort ein"
                          disabled={twoFactorLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="disable_code">2FA-Code oder Backup-Code</Label>
                        <Input
                          id="disable_code"
                          type="text"
                          value={disable2FAData.code}
                          onChange={(e) => setDisable2FAData({ ...disable2FAData, code: e.target.value })}
                          placeholder="Geben Sie den 2FA-Code oder Backup-Code ein"
                          disabled={twoFactorLoading}
                          maxLength={8}
                        />
                      </div>
                      <Button variant="destructive" onClick={handleDisable2FA} disabled={twoFactorLoading} size="large" className="w-full sm:w-auto text-sm sm:text-base">
                        {twoFactorLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Wird deaktiviert...
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            2FA deaktivieren
                          </>
                        )}
                      </Button>
                    </div>
                  ) : twoFactorSetup ? (
                    <div className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Scannen Sie diesen QR-Code mit Ihrer Authenticator-App (Google Authenticator, Authy, etc.)
                        </AlertDescription>
                      </Alert>
                      <div className="flex justify-center">
                        <img src={twoFactorSetup.qr_code_url} alt="2FA QR-Code" className="border rounded" />
                      </div>
                      <div className="space-y-2">
                        <Label>Backup-Codes</Label>
                        <Alert>
                          <AlertDescription>
                            Speichern Sie diese Backup-Codes an einem sicheren Ort. Sie können sie verwenden, wenn Sie den Zugriff auf Ihre Authenticator-App verlieren.
                          </AlertDescription>
                        </Alert>
                        <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded">
                          {twoFactorSetup.backup_codes.map((code, i) => (
                            <code key={i} className="text-sm font-mono">
                              {code}
                            </code>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="verify_code">2FA-Code eingeben</Label>
                        <Input
                          id="verify_code"
                          type="text"
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value)}
                          placeholder="Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein"
                          maxLength={6}
                          disabled={twoFactorLoading}
                        />
                      </div>
                      <Button onClick={handleVerify2FA} disabled={twoFactorLoading || !twoFactorCode} size="large" className="w-full sm:w-auto text-sm sm:text-base">
                        {twoFactorLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Wird verifiziert...
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            2FA verifizieren und aktivieren
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={handleSetup2FA} disabled={twoFactorLoading} size="large" className="w-full sm:w-auto text-sm sm:text-base">
                        {twoFactorLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Wird eingerichtet...
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            2FA aktivieren
                          </>
                        )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  )
}


