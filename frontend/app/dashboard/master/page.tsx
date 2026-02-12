"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Plus,
  Edit,
  Trash2,
  Upload,
  Calendar,
  Euro,
  Loader2,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  Video,
  Play,
  Clock,
  MapPin,
  User,
  Settings,
  Sparkles,
  Save,
  Link2,
  ShoppingCart,
  MessageSquare,
  Star,
  TrendingUp,
  Eye,
  Filter,
  Search,
  X,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Award,
  Zap,
  Camera,
  Building2,
  FileText,
  Tag,
} from "lucide-react"
import { RelationshipManager } from "@/components/dashboard/relationship-manager"
import { ModernMediaUpload } from "@/components/dashboard/modern-media-upload"
import { GalleryCard } from "@/components/gallery/gallery-card"
import { VideoPlayer } from "@/components/shared/video-player"
import { useAuth } from "@/lib/context/auth-context"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { toast } from "sonner"
import {
  getMyProfile,
  updateMyProfile,
  uploadProfileImage,
  deleteProfileImage,
  getMyServices,
  addService,
  updateService,
  deleteService,
  getGermanCities,
} from "@/lib/api/masters"
import { getMyMedia, deleteMedia } from "@/lib/api/media"
import { getMyAvailabilitySlots, addAvailabilitySlot, deleteAvailabilitySlot } from "@/lib/api/availability"
import { getOptimizedImageUrl, shouldUseUnoptimized, cn } from "@/lib/utils"
import { getMyPromotions, createPromotion, deletePromotion } from "@/lib/api/promotions"
import { getMyOrders, updateOrder, completeOrder } from "@/lib/api/orders"
import { getSellerReviews } from "@/lib/api/reviews"
import { getCategoriesByType } from "@/lib/api/categories"
import type {
  Profile,
  ProfileInput,
  Service,
  ServiceInput,
  Media,
  AvailabilitySlot,
  AvailabilitySlotInput,
  Promotion,
  PromotionInput,
  Order,
  OrderStatus,
  Review,
} from "@/lib/api/types"
import { CityCombobox } from "@/components/shared/city-combobox"
import Image from "next/image"
import { formatDistanceToNow, format } from "date-fns"
import { de } from "date-fns/locale/de"

export default function MasterDashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [profile, setProfile] = useState<Profile | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [selectedVideo, setSelectedVideo] = useState<Media | null>(null)
  const [completingOrderId, setCompletingOrderId] = useState<number | null>(null)
  const [cities, setCities] = useState<Array<{ id: number; name: string; latitude: number; longitude: number }>>([])
  const [cityQuery, setCityQuery] = useState("")
  const [citiesLoading, setCitiesLoading] = useState(false)
  
  // Filter states
  const [orderFilter, setOrderFilter] = useState<OrderStatus | "all" | "pending">("all")
  const [mediaFilter, setMediaFilter] = useState<"all" | "approved" | "pending" | "rejected">("all")
  const [searchQuery, setSearchQuery] = useState("")

  const [stats, setStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    completed_orders: 0,
    total_revenue: 0,
    average_rating: 0,
    total_reviews: 0,
    total_services: 0,
    total_media: 0,
    pending_media: 0,
    active_promotions: 0,
    upcoming_slots: 0,
  })

  // Profile form
  const [profileForm, setProfileForm] = useState<ProfileInput>({
    city_id: undefined,
    about: "",
    category_id: undefined,
    keywords: "",
    response_time_hours: undefined,
  })
  const [profileCategories, setProfileCategories] = useState<Array<{ id: number; name: string }>>([])
  const [profileCategoriesLoading, setProfileCategoriesLoading] = useState(false)
  const selectedCityName = useMemo(() => {
    const cid = (profileForm as any).city_id as number | undefined
    const found = cid ? cities.find((c) => c.id === cid) : undefined
    return found?.name || (profile as any)?.city_name || ""
  }, [cities, (profileForm as any).city_id, profile])

  // Service form
  const [serviceForm, setServiceForm] = useState<ServiceInput>({
    title: "",
    description: "",
    price_from: 0,
  })
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)

  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)

  // Availability form
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilitySlotInput>({
    start_time: "",
    end_time: "",
    is_available: true,
  })
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false)

  // Promotion form
  const [promotionForm, setPromotionForm] = useState<PromotionInput>({
    start_date: "",
    end_date: "",
  })
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(max-width: 639px)').matches
    }
    return false
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 639px)')
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (user && user.role !== "master") {
      router.push("/")
      return
    }
    loadData()
    ;(async () => {
      try {
        setCitiesLoading(true)
        const res = await getGermanCities({ limit: 500 })
        const items = (res.items || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          latitude: c.latitude,
          longitude: c.longitude,
        }))
        setCities(items)
      } catch {
        // ignore
      } finally {
        setCitiesLoading(false)
      }
      // Load master root categories for profile selection
      try {
        setProfileCategoriesLoading(true)
        const cats = await getCategoriesByType("master", { activeOnly: true, rootOnly: true })
        setProfileCategories(cats || [])
      } catch (error) {
        console.error("Failed to load master categories for profile:", error)
        setProfileCategories([])
      } finally {
        setProfileCategoriesLoading(false)
      }
    })()
  }, [user])

  // Debounced backend city search
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        setCitiesLoading(true)
        const res = await getGermanCities(cityQuery && cityQuery.trim().length > 0 ? { q: cityQuery.trim(), limit: 500 } as any : { limit: 500 } as any)
        if (cancelled) return
        const items = (res.items || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          latitude: c.latitude,
          longitude: c.longitude,
        }))
        setCities(items)
      } catch {
        if (!cancelled) setCities([])
      } finally {
        if (!cancelled) setCitiesLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [cityQuery])

  const loadDataRef = useRef<() => Promise<void>>(null as any)

  const loadData = async () => {
    try {
      setLoading(true)
      const profileData = await getMyProfile().catch(() => null)
      
      const [servicesData, mediaData, availabilityData, promotionsData, ordersData, reviewsData] = await Promise.all([
        getMyServices().catch(() => []),
        getMyMedia().catch(() => ({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 })),
        getMyAvailabilitySlots().catch(() => []),
        getMyPromotions().catch(() => []),
        getMyOrders({ page: 1, page_size: 50 }).catch(() => ({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 })),
        profileData ? getSellerReviews(profileData.user_id, { page: 1, page_size: 20 }).catch(() => ({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 })) : Promise.resolve({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
      ])

      if (profileData) {
        setProfile(profileData)
        setProfileForm({
          city_id: (profileData as any).city_id,
          about: profileData.about || "",
          category_id: (profileData as any).category_id ?? undefined,
          keywords: (profileData as any).keywords ?? "",
          response_time_hours: profileData.response_time_hours,
        })
      }

      setServices(servicesData)
      setMedia(mediaData.items || [])
      setAvailabilitySlots(availabilityData)
      setPromotions(promotionsData)
      const ordersList = ordersData.items || []
      setOrders(ordersList)
      setReviews(reviewsData.items || [])
      
      // Calculate enhanced stats
      const sellerOrders = ordersList
      const sellerReviews = reviewsData.items || []
      const totalRevenue = sellerOrders
        .filter((o: Order) => o.status === "completed" || o.status === "paid")
        .reduce((sum: number, o: Order) => sum + (o.amount - o.commission), 0)
      const avgRating = sellerReviews.length > 0
        ? sellerReviews.reduce((sum: number, r: Review) => sum + r.rating, 0) / sellerReviews.length
        : profileData?.rating || 0
      
      const now = new Date()
      const upcomingSlots = availabilityData.filter((slot: AvailabilitySlot) => 
        new Date(slot.start_time) > now && slot.is_available
      ).length
      
      // Calculate pending orders (matching the filter logic)
      const pendingOrdersCount = sellerOrders.filter((o: Order) => o.status === "created" || o.status === "paid").length
      
      setStats({
        total_orders: sellerOrders.length,
        pending_orders: pendingOrdersCount,
        completed_orders: sellerOrders.filter((o: Order) => o.status === "completed").length,
        total_revenue: totalRevenue,
        average_rating: avgRating,
        total_reviews: sellerReviews.length,
        total_services: servicesData.length,
        total_media: mediaData.items?.length || 0,
        pending_media: mediaData.items?.filter((m: Media) => m.status === "pending").length || 0,
        active_promotions: promotionsData.filter((p: Promotion) => p.is_active && new Date(p.end_date) > now).length,
        upcoming_slots: upcomingSlots,
      })
    } catch (error: any) {
      if (error?.statusCode === 401) {
        router.push("/login")
      } else {
        toast.error("Fehler beim Laden der Dashboard-Daten")
      }
    } finally {
      setLoading(false)
    }
  }
  loadDataRef.current = loadData

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      const updated = await updateMyProfile(profileForm)
      setProfile(updated)
      toast.success("Profil erfolgreich aktualisiert")
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Aktualisieren des Profils")
    } finally {
      setLoading(false)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error("Nur Bilddateien sind erlaubt")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Die Bildgröße muss kleiner als 5MB sein")
      return
    }

    try {
      setLoading(true)
      const updated = await uploadProfileImage(file)
      setProfile(updated)
      toast.success("Profilbild erfolgreich hochgeladen")
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Hochladen des Profilbildes")
    } finally {
      setLoading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleDeleteProfileImage = async () => {
    if (!profile?.image_url) return

    if (!confirm("Sind Sie sicher, dass Sie Ihr Profilbild löschen möchten?")) {
      return
    }

    try {
      setLoading(true)
      const updated = await deleteProfileImage()
      setProfile(updated)
      toast.success("Profilbild erfolgreich gelöscht")
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Löschen des Profilbildes")
    } finally {
      setLoading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      const newService = await addService(serviceForm)
      setServices([...services, newService])
      setServiceForm({ title: "", description: "", price_from: 0 })
      setServiceDialogOpen(false)
      setEditingService(null)
      toast.success("Dienstleistung erfolgreich hinzugefügt")
      loadData()
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Hinzufügen der Dienstleistung")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingService) return

    try {
      setLoading(true)
      const updated = await updateService(editingService.id, serviceForm)
      setServices(services.map((s) => (s.id === updated.id ? updated : s)))
      setServiceForm({ title: "", description: "", price_from: 0 })
      setServiceDialogOpen(false)
      setEditingService(null)
      toast.success("Dienstleistung erfolgreich aktualisiert")
      loadData()
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Aktualisieren der Dienstleistung")
    } finally {
      setLoading(false)
    }
  }

  const handleEditService = (service: Service) => {
    setEditingService(service)
    setServiceForm({
      title: service.title,
      description: service.description || "",
      price_from: service.price_from,
    })
    setServiceDialogOpen(true)
  }

  const handleDeleteService = async (serviceId: number) => {
    if (!confirm("Sind Sie sicher, dass Sie diese Dienstleistung löschen möchten?")) return

    try {
      setLoading(true)
      await deleteService(serviceId)
      setServices(services.filter((s) => s.id !== serviceId))
      toast.success("Dienstleistung erfolgreich gelöscht")
      loadData()
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Löschen der Dienstleistung")
    } finally {
      setLoading(false)
    }
  }

  const handleMediaUploadComplete = async () => {
    try {
      const mediaData = await getMyMedia({ page: 1, page_size: 100 })
      setMedia(mediaData.items || [])
      loadData()
    } catch (error: any) {
      console.error("Failed to reload media:", error)
    }
  }

  const handleDeleteMedia = useCallback(async (mediaId: number) => {
    if (!confirm("Sind Sie sicher, dass Sie dieses Medium löschen möchten?")) return
    try {
      setLoading(true)
      await deleteMedia(mediaId)
      setMedia((prev: Media[]) => prev.filter((m: Media) => m.id !== mediaId))
      toast.success("Medium erfolgreich gelöscht")
      loadDataRef.current?.()
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Löschen des Mediums")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleVideoClick = useCallback((item: Media) => {
    setSelectedVideo(item)
  }, [])

  const onDeleteMediaItem = useCallback((mediaItem: Media) => {
    handleDeleteMedia(mediaItem.id)
  }, [handleDeleteMedia])

  const handleCompleteOrder = useCallback(async (order: Order) => {
    if (!confirm("Sind Sie sicher, dass Sie diese Bestellung als abgeschlossen markieren möchten?")) return
    try {
      setCompletingOrderId(order.id)
      await completeOrder(order.id)
      toast.success("Bestellung als abgeschlossen markiert")
      loadDataRef.current?.()
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Abschließen der Bestellung")
    } finally {
      setCompletingOrderId(null)
    }
  }, [])

  const handleAddAvailability = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      const newSlot = await addAvailabilitySlot(availabilityForm)
      setAvailabilitySlots([...availabilitySlots, newSlot].sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ))
      setAvailabilityForm({ start_time: "", end_time: "", is_available: true })
      setAvailabilityDialogOpen(false)
      toast.success("Verfügbarkeitszeitraum erfolgreich hinzugefügt")
      loadData()
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Hinzufügen des Verfügbarkeitszeitraums")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAvailability = async (slotId: number) => {
    if (!confirm("Sind Sie sicher, dass Sie diesen Verfügbarkeitszeitraum löschen möchten?")) return

    try {
      setLoading(true)
      await deleteAvailabilitySlot(slotId)
      setAvailabilitySlots(availabilitySlots.filter((s) => s.id !== slotId))
      toast.success("Verfügbarkeitszeitraum erfolgreich gelöscht")
      loadData()
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Löschen des Verfügbarkeitszeitraums")
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      // Convert datetime-local format to ISO format
      const formattedData = {
        start_date: promotionForm.start_date ? new Date(promotionForm.start_date).toISOString() : "",
        end_date: promotionForm.end_date ? new Date(promotionForm.end_date).toISOString() : "",
      }
      const newPromotion = await createPromotion(formattedData)
      setPromotions([...promotions, newPromotion])
      setPromotionForm({ start_date: "", end_date: "" })
      setPromotionDialogOpen(false)
      toast.success("Aktion erfolgreich erstellt")
      loadData()
    } catch (error: any) {
      console.error("Promotion creation error:", error)
      toast.error(error?.message || "Fehler beim Erstellen der Aktion")
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePromotion = async (promotionId: number) => {
    if (!confirm("Sind Sie sicher, dass Sie diese Aktion löschen möchten?")) return

    try {
      setLoading(true)
      await deletePromotion(promotionId)
      setPromotions(promotions.filter((p) => p.id !== promotionId))
      toast.success("Aktion erfolgreich gelöscht")
      loadData()
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Löschen der Aktion")
    } finally {
      setLoading(false)
    }
  }

  // Filtered data
  const filteredOrders = useMemo(() => {
    let filtered = orders
    if (orderFilter !== "all") {
      if (orderFilter === "pending") {
        // Show both "created" and "paid" orders as pending (matching Overview tab logic)
        filtered = filtered.filter(o => o.status === "created" || o.status === "paid")
      } else {
        filtered = filtered.filter(o => o.status === orderFilter)
      }
    }
    if (searchQuery) {
      filtered = filtered.filter(o => 
        o.id.toString().includes(searchQuery) ||
        o.buyer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.service?.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return filtered
  }, [orders, orderFilter, searchQuery])

  const filteredMedia = useMemo(() => {
    if (mediaFilter === "all") return media
    return media.filter(m => m.status === mediaFilter)
  }, [media, mediaFilter])

  const filteredServices = useMemo(() => {
    if (!searchQuery) return services
    return services.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [services, searchQuery])

  if (loading && !profile) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (user && user.role !== "master") {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Diese Seite ist nur für Meister verfügbar. Bitte melden Sie sich mit einem Meisterkonto an.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
          {/* Enhanced Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Mein Dashboard
            </h1>
                {profile?.verified && (
                  <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 px-3 py-1.5 font-semibold shrink-0">
                    <Award className="h-3.5 w-3.5 mr-1.5" />
                    Verifiziert
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Hallo, {user?.name || "Meister"}! Verwalten Sie Ihr Profil und Ihre Service.
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Mobile: Dropdown */}
            <div className="block md:hidden mb-4">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {activeTab === "overview" && <BarChart3 className="h-4 w-4" />}
                      {activeTab === "profile" && <User className="h-4 w-4" />}
                      {activeTab === "services" && <Settings className="h-4 w-4" />}
                      {activeTab === "gallery" && <ImageIcon className="h-4 w-4" />}
                      {activeTab === "availability" && <Calendar className="h-4 w-4" />}
                      {activeTab === "promotions" && <Sparkles className="h-4 w-4" />}
                      {activeTab === "orders" && <ShoppingCart className="h-4 w-4" />}
                      {activeTab === "reviews" && <MessageSquare className="h-4 w-4" />}
                      {activeTab === "relationships" && <Link2 className="h-4 w-4" />}
                      <span className="font-medium">
                        {activeTab === "overview" && "Übersicht"}
                        {activeTab === "profile" && "Profil"}
                        {activeTab === "services" && "Service"}
                        {activeTab === "gallery" && "Galerie"}
                        {activeTab === "availability" && "Verfügbarkeit"}
                        {activeTab === "promotions" && "Aktionen"}
                        {activeTab === "orders" && "Bestellungen"}
                        {activeTab === "reviews" && "Bewertungen"}
                        {activeTab === "relationships" && "Verbindungen"}
                      </span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Übersicht</SelectItem>
                  <SelectItem value="profile">Profil</SelectItem>
                  <SelectItem value="services">Service</SelectItem>
                  <SelectItem value="gallery">Galerie</SelectItem>
                  <SelectItem value="availability">Verfügbarkeit</SelectItem>
                  <SelectItem value="promotions">Aktionen</SelectItem>
                  <SelectItem value="orders">Bestellungen</SelectItem>
                  <SelectItem value="reviews">Bewertungen</SelectItem>
                  <SelectItem value="relationships">Verbindungen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desktop: Tabs */}
            <div className="hidden md:block mb-6">
              <TabsList className="grid w-full grid-cols-9 gap-1 h-auto p-1 bg-muted/50">
                <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Übersicht</span>
                </TabsTrigger>
                <TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs">
                  <User className="h-3.5 w-3.5" />
                  <span>Profil</span>
                </TabsTrigger>
                <TabsTrigger value="services" className="flex items-center gap-1.5 text-xs">
                  <Settings className="h-3.5 w-3.5" />
                  <span>Service</span>
                </TabsTrigger>
                <TabsTrigger value="gallery" className="flex items-center gap-1.5 text-xs">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Galerie</span>
                </TabsTrigger>
                <TabsTrigger value="availability" className="flex items-center gap-1.5 text-xs">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Verfügbarkeit</span>
                </TabsTrigger>
                <TabsTrigger value="promotions" className="flex items-center gap-1.5 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Aktionen</span>
                </TabsTrigger>
                <TabsTrigger value="orders" className="flex items-center gap-1.5 text-xs">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>Bestellungen</span>
                </TabsTrigger>
                <TabsTrigger value="reviews" className="flex items-center gap-1.5 text-xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Bewertungen</span>
                </TabsTrigger>
                <TabsTrigger value="relationships" className="flex items-center gap-1.5 text-xs">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Verbindungen</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-0 space-y-3 sm:space-y-4">
              {/* Key Performance Metrics */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 lg:grid-cols-4">
                <Card className="border border-border/40 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 px-2.5 pt-2.5 sm:pb-3 sm:px-4 sm:pt-4">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground leading-tight">Gesamtumsatz</CardTitle>
                      <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                        <Euro className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                      </div>
                </div>
              </CardHeader>
                  <CardContent className="px-2.5 pb-2.5 sm:px-4 sm:pb-4">
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold leading-tight">€{stats.total_revenue.toFixed(2)}</div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight line-clamp-1">
                      {stats.completed_orders} abgeschlossene Bestellungen
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-border/40 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 px-2.5 pt-2.5 sm:pb-3 sm:px-4 sm:pt-4">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground leading-tight">Ausstehende Bestellungen</CardTitle>
                      <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                        <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-2.5 pb-2.5 sm:px-4 sm:pb-4">
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold leading-tight">{stats.pending_orders}</div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight line-clamp-1">
                      {stats.pending_orders > 0 ? "Benötigt Aufmerksamkeit" : "Alles erledigt"}
                </p>
              </CardContent>
            </Card>

                <Card className="border border-border/40 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 px-2.5 pt-2.5 sm:pb-3 sm:px-4 sm:pt-4">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground leading-tight">Durchschnittliche Bewertung</CardTitle>
                      <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Star className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400 fill-current" />
                      </div>
                </div>
              </CardHeader>
                  <CardContent className="px-2.5 pb-2.5 sm:px-4 sm:pb-4">
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold leading-tight">{stats.average_rating.toFixed(1)}</div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight line-clamp-1">
                      {stats.total_reviews} {stats.total_reviews === 1 ? "Bewertung" : "Bewertungen"}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-border/40 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 px-2.5 pt-2.5 sm:pb-3 sm:px-4 sm:pt-4">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground leading-tight">Aktive Service</CardTitle>
                      <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Settings className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-2.5 pb-2.5 sm:px-4 sm:pb-4">
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold leading-tight">{stats.total_services}</div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight line-clamp-1">
                      {services.length > 0 ? "Service verfügbar" : "Fügen Sie Ihre erste Dienstleistung hinzu"}
                </p>
              </CardContent>
            </Card>
              </div>

              {/* Business Insights & Actions */}
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                {/* Performance Insights */}
                <Card className="border border-border/40 shadow-sm">
                  <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                      <CardTitle className="text-sm sm:text-base lg:text-lg font-semibold">Leistungseinblicke</CardTitle>
                </div>
              </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 space-y-2 sm:space-y-3">
                    {stats.total_orders === 0 ? (
                      <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100">Loslegen</p>
                          <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300 mt-0.5 sm:mt-1 leading-tight">
                            Sie haben noch keine Bestellungen erhalten. Vervollständigen Sie Ihr Profil und fügen Sie Service hinzu, um Kunden anzuziehen.
                          </p>
                </div>
                      </div>
                    ) : (
                      <>
                        {stats.pending_orders > 0 && (
                          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-yellow-900 dark:text-yellow-100">
                                {stats.pending_orders} {stats.pending_orders === 1 ? "Bestellung" : "Bestellungen"} ausstehend
                              </p>
                              <p className="text-[10px] sm:text-xs text-yellow-700 dark:text-yellow-300 mt-0.5 sm:mt-1 leading-tight">
                                Überprüfen und beantworten Sie ausstehende Bestellungen, um Kunden zufrieden zu halten.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveTab("orders")}
                                className="mt-1.5 sm:mt-2 h-6 sm:h-7 text-[10px] sm:text-xs border-yellow-500/30 hover:bg-yellow-500/20 px-2"
                              >
                                Bestellungen anzeigen
                                <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                        {stats.pending_media > 0 && (
                          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-yellow-900 dark:text-yellow-100">
                                {stats.pending_media} Medien-{stats.pending_media === 1 ? "Artikel" : "Artikel"} wartend auf Genehmigung
                              </p>
                              <p className="text-[10px] sm:text-xs text-yellow-700 dark:text-yellow-300 mt-0.5 sm:mt-1 leading-tight">
                                Ihre Medien werden überprüft. Genehmigte Inhalte werden in Ihrer Galerie angezeigt.
                              </p>
                            </div>
                          </div>
                        )}
                        {stats.average_rating >= 4.5 && stats.total_reviews >= 5 && (
                          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-green-900 dark:text-green-100">Hervorragende Bewertung!</p>
                              <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300 mt-0.5 sm:mt-1 leading-tight">
                                Sie halten einen großartigen Ruf mit {stats.average_rating.toFixed(1)} Sternen. Machen Sie weiter so!
                              </p>
                            </div>
                          </div>
                        )}
                        {services.length === 0 && (
                          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100">Fügen Sie Ihre erste Dienstleistung hinzu</p>
                              <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300 mt-0.5 sm:mt-1 leading-tight">
                                Service helfen Kunden zu verstehen, was Sie anbieten. Fügen Sie Service hinzu, um Ihre Sichtbarkeit zu erhöhen.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveTab("services")}
                                className="mt-1.5 sm:mt-2 h-6 sm:h-7 text-[10px] sm:text-xs border-blue-500/30 hover:bg-blue-500/20 px-2"
                              >
                                Dienstleistung hinzufügen
                                <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                        {media.length === 0 && (
                          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100">Präsentieren Sie Ihre Arbeit</p>
                              <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300 mt-0.5 sm:mt-1 leading-tight">
                                Laden Sie Fotos und Videos Ihrer Arbeit hoch, um Vertrauen aufzubauen und mehr Kunden anzuziehen.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setMediaDialogOpen(true)
                                  setActiveTab("gallery")
                                }}
                                className="mt-1.5 sm:mt-2 h-6 sm:h-7 text-[10px] sm:text-xs border-blue-500/30 hover:bg-blue-500/20 px-2"
                              >
                                Medien hochladen
                                <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
              </CardContent>
            </Card>

                {/* Quick Stats */}
                <Card className="border border-border/40 shadow-sm">
                  <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                      <CardTitle className="text-sm sm:text-base lg:text-lg font-semibold">Schnellstatistiken</CardTitle>
                </div>
              </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg border border-border/40 bg-muted/30">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs sm:text-sm font-medium truncate">Medieninhalt</span>
                </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                          <span className="text-xs sm:text-sm font-bold">{stats.total_media}</span>
                          {stats.pending_media > 0 && (
                            <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
                              {stats.pending_media} ausstehend
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg border border-border/40 bg-muted/30">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs sm:text-sm font-medium truncate">Aktive Aktionen</span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold shrink-0 ml-2">
                          {promotions.filter(p => {
                            const now = new Date()
                            const start = new Date(p.start_date)
                            const end = new Date(p.end_date)
                            return start <= now && now <= end
                          }).length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg border border-border/40 bg-muted/30">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs sm:text-sm font-medium truncate">Verfügbarkeitszeiträume</span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold shrink-0 ml-2">{availabilitySlots.filter(s => s.is_available).length}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg border border-border/40 bg-muted/30">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs sm:text-sm font-medium truncate">Antwortzeit</span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold shrink-0 ml-2">
                          {profile?.response_time_hours ? `${profile.response_time_hours}h` : "Nicht gesetzt"}
                        </span>
                      </div>
                    </div>
              </CardContent>
            </Card>
          </div>

              {/* Recent Orders & Reviews */}
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                {/* Recent Orders */}
                <Card className="border border-border/40 shadow-sm">
                  <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                        <CardTitle className="text-sm sm:text-base lg:text-lg font-semibold truncate">Aktuelle Bestellungen</CardTitle>
                    </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("orders")}
                        className="text-[10px] sm:text-xs hover:bg-primary/10 hover:text-primary transition-colors h-6 sm:h-7 px-1.5 sm:px-2 shrink-0"
                      >
                        Alle anzeigen
                        <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-0.5 sm:ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                    {orders.slice(0, 5).length === 0 ? (
                      <div className="text-center py-6 sm:py-8 text-muted-foreground">
                        <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1.5 sm:mb-2 opacity-50" />
                        <p className="text-xs sm:text-sm">Noch keine Bestellungen</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Vervollständigen Sie Ihr Profil, um Bestellungen zu erhalten</p>
                    </div>
                    ) : (
                      <div className="space-y-1.5 sm:space-y-2">
                        {orders.slice(0, 5).map((order) => (
                          <div key={order.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setActiveTab("orders")}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                                <p className="text-xs sm:text-sm font-medium truncate">Bestellung #{order.id}</p>
                                {order.service && (
                                  <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 shrink-0">
                                    {order.service.title}
                                  </Badge>
                                )}
                    </div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                {order.buyer?.name || "Unbekannt"} • {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: de })}
                              </p>
                    </div>
                            <div className="flex items-center justify-end gap-1.5 sm:gap-2 sm:ml-4 sm:justify-start shrink-0">
                              <Badge
                                className={cn(
                                  "text-[9px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-md shrink-0",
                                  order.status === "completed" && "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20",
                                  order.status === "paid" && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
                                  order.status === "created" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20",
                                  order.status === "canceled" && "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                                )}
                              >
                                {order.status === "created" ? "Erstellt" : 
                                 order.status === "paid" ? "Bezahlt" : 
                                 order.status === "completed" ? "Abgeschlossen" : 
                                 order.status === "canceled" ? "Storniert" : order.status}
                              </Badge>
                              <span className="text-xs sm:text-sm font-semibold shrink-0">€{order.amount.toFixed(2)}</span>
                    </div>
                    </div>
                        ))}
                    </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Reviews */}
                <Card className="border border-border/40 shadow-sm">
                  <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                        <CardTitle className="text-sm sm:text-base lg:text-lg font-semibold truncate">Aktuelle Bewertungen</CardTitle>
                    </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("reviews")}
                        className="text-[10px] sm:text-xs hover:bg-primary/10 hover:text-primary transition-colors h-6 sm:h-7 px-1.5 sm:px-2 shrink-0"
                      >
                        Alle anzeigen
                        <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-0.5 sm:ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                    {reviews.slice(0, 5).length === 0 ? (
                      <div className="text-center py-6 sm:py-8 text-muted-foreground">
                        <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1.5 sm:mb-2 opacity-50" />
                        <p className="text-xs sm:text-sm">Noch keine Bewertungen</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Schließen Sie Bestellungen ab, um Bewertungen zu erhalten</p>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {reviews.slice(0, 5).map((review) => {
                          const order = orders.find(o => o.id === review.order_id)
                          const buyerName = order?.buyer?.name
                          return (
                            <div key={review.id} className="p-2 sm:p-3 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 shrink-0 ${
                                        star <= review.rating
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-muted-foreground"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
                                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: de })}
                                </span>
                              </div>
                              {review.text && (
                                <p className="text-[10px] sm:text-xs text-foreground line-clamp-2 leading-tight">{review.text}</p>
                              )}
                              {buyerName && (
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">— {buyerName}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
            </div>

              {/* Quick Actions */}
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base sm:text-lg font-semibold">Schnellaktionen</CardTitle>
            </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button
                      variant="outline"
                      className="h-auto flex-col gap-2 py-4 sm:py-5 border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
                      onClick={() => setActiveTab("services")}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                        <Plus className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold">Dienstleistung hinzufügen</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto flex-col gap-2 py-4 sm:py-5 border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
                      onClick={() => {
                        setMediaDialogOpen(true)
                        setActiveTab("gallery")
                      }}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                        <Upload className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold">Medien hochladen</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto flex-col gap-2 py-4 sm:py-5 border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
                      onClick={() => setActiveTab("availability")}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold">Zeitraum hinzufügen</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto flex-col gap-2 py-4 sm:py-5 border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
                      onClick={() => setActiveTab("promotions")}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold">Aktion erstellen</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4 mt-0">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                {/* Profile Image Card */}
                <Card className="border border-border/50 shadow-md bg-gradient-to-br from-card via-card to-muted/30 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3 px-4 sm:px-6">
                    <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-sm shrink-0">
                        <Camera className="h-5 w-5 text-primary" />
                      </div>
                      <span className="truncate">Profilbild</span>
                  </CardTitle>
                </CardHeader>
                  <CardContent className="space-y-4 sm:space-y-5 px-4 sm:px-6 pb-4 sm:pb-6">
                    <div className="flex flex-col items-center gap-4 sm:gap-5">
                      {/* Profile Image Display */}
                      <div className="relative group">
                        {profile?.image_url ? (
                          <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-background shadow-xl ring-4 ring-primary/10 group-hover:ring-primary/20 transition-all">
                            <Image
                              src={getOptimizedImageUrl(profile.image_url, 'thumbnail') || "/placeholder.svg"}
                              alt="Profile"
                              fill
                              className="object-cover transition-transform group-hover:scale-105"
                              unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(profile.image_url, 'thumbnail'))}
                              sizes="(max-width: 640px) 112px, (max-width: 768px) 128px, 160px"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            {/* Edit Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 sm:p-3 shadow-lg">
                                <Camera className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-muted via-muted/80 to-muted/60 border-4 border-dashed border-border/60 shadow-lg flex items-center justify-center ring-2 ring-primary/10 group-hover:ring-primary/20 transition-all overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent" />
                            <User className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 text-muted-foreground/40 relative z-10" />
                            <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-primary/20 backdrop-blur-sm border-2 border-background flex items-center justify-center shadow-lg ring-2 ring-primary/10">
                              <Camera className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* File Upload Section */}
                      <div className="w-full space-y-2.5 sm:space-y-3">
                          <Input
                          ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleProfileImageUpload}
                            disabled={loading}
                          className="hidden"
                        />
                        <div className="flex flex-col gap-2 sm:gap-2.5 w-full">
                          <Button
                            type="button"
                            onClick={handleUploadClick}
                            disabled={loading}
                            className="h-10 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm hover:shadow-md transition-all text-sm sm:text-base"
                          >
                            <Upload className="h-4 w-4 mr-2 shrink-0" />
                            <span className="truncate">{profile?.image_url ? "Foto ändern" : "Foto hochladen"}</span>
                          </Button>
                          {profile?.image_url && (
                            <Button
                              type="button"
                              onClick={handleDeleteProfileImage}
                              disabled={loading}
                              variant="destructive"
                              className="h-10 w-full font-semibold shadow-sm hover:shadow-md transition-all text-sm sm:text-base"
                            >
                              <Trash2 className="h-4 w-4 mr-2 shrink-0" />
                              Foto löschen
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground px-2">
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                            <span>JPG, PNG</span>
                      </div>
                          <span className="shrink-0">•</span>
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                            <span>GIF, WebP</span>
                    </div>
                          <span className="shrink-0">•</span>
                          <span className="font-medium shrink-0">Max 5MB</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Profile Info Card */}
                <Card className="border border-border/50 shadow-sm md:col-span-2">
                  <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="truncate">Profilinformationen</span>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Aktualisieren Sie Ihre Meister-Profilinformationen, damit Kunden Sie finden können
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                    <form onSubmit={handleUpdateProfile} className="space-y-4 sm:space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city" className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                            <span>Stadt</span>
                          </Label>
                        <CityCombobox
                          variant="form"
                          size="md"
                            className="w-full h-10 sm:h-11 text-sm"
                          value={(profileForm as any).city_id}
                          onChange={(id) => {
                                        setProfileForm((prev) => ({
                                          ...prev,
                              city_id: id,
                                        }))
                          }}
                            placeholder="Wählen Sie Ihre Stadt"
                        />
                      </div>
                        <div className="space-y-2">
                          <Label htmlFor="category_id" className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                            <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                            <span>Kategorie</span>
                          </Label>
                          <Select
                            value={profileForm.category_id ? String(profileForm.category_id) : ""}
                            onValueChange={(value) => {
                              const parsed = Number(value)
                              setProfileForm((prev) => ({
                                ...prev,
                                category_id: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                              }))
                            }}
                            disabled={loading || profileCategoriesLoading}
                          >
                            <SelectTrigger size="default" className="text-sm h-10 sm:h-11">
                              <SelectValue placeholder={profileCategoriesLoading ? "Lädt…" : "Kategorie auswählen"} />
                            </SelectTrigger>
                            <SelectContent className="rounded-md border">
                              {profileCategories.map((cat) => (
                                <SelectItem key={cat.id} value={String(cat.id)}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Ihre Hauptkategorie hilft Kunden, Sie besser zu finden.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="response_time_hours" className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                            <span>Antwortzeit</span>
                          </Label>
                          <div className="relative">
                      <Input
                        id="response_time_hours"
                        type="number"
                        min="0"
                        max="168"
                        value={profileForm.response_time_hours || ""}
                        onChange={(e) =>
                          setProfileForm({
                            ...profileForm,
                            response_time_hours: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                              placeholder="z.B. 2"
                              className="text-sm h-10 sm:h-11 pl-9 sm:pl-10"
                      />
                            <span className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-muted-foreground">h</span>
                    </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Stunden bis zur Beantwortung von Kundenanfragen</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="keywords" className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                            <span>Schlüsselwörter</span>
                          </Label>
                          <Input
                            id="keywords"
                            value={profileForm.keywords || ""}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, keywords: e.target.value }))}
                            placeholder="z.B. Elektriker, Notdienst, Renovierung"
                            className="text-sm h-10 sm:h-11"
                            disabled={loading}
                            autoComplete="off"
                          />
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Durch Kommas trennen. Diese werden in der Suche genutzt.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="about" className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span>Über Sie</span>
                        </Label>
                        <Textarea
                          id="about"
                          value={profileForm.about}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, about: e.target.value })
                          }
                          placeholder="Erzählen Sie Kunden von Ihrer Erfahrung, Ihren Fähigkeiten und was Sie besonders macht..."
                          rows={6}
                          className="text-sm resize-none min-h-[120px] sm:min-h-[140px]"
                        />
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {profileForm.about?.length || 0} Zeichen
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                        <Button 
                          type="submit" 
                          disabled={loading} 
                          className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200 px-6 h-10 sm:h-11 text-sm sm:text-base"
                        >
                      {loading ? (
                        <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Wird gespeichert...
                        </>
                      ) : (
                        <>
                              <Save className="h-4 w-4 mr-2" />
                              Änderungen speichern
                        </>
                      )}
                    </Button>
                        {profile?.verified && (
                          <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 px-3 py-1.5 sm:py-1 text-xs sm:text-sm shrink-0 justify-center sm:justify-start">
                            <CheckCircle className="h-3 w-3 mr-1 shrink-0" />
                            Verifiziert
                          </Badge>
                        )}
                      </div>
                  </form>
                </CardContent>
              </Card>
              </div>

              {/* Profile Stats */}
              {profile && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border border-border/50 shadow-sm bg-card/60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Bewertung</p>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <p className="text-lg font-bold">{profile.rating.toFixed(1)}</p>
                          </div>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                          <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-border/50 shadow-sm bg-card/60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Bewertungen</p>
                          <p className="text-lg font-bold">{profile.total_reviews}</p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-border/50 shadow-sm bg-card/60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Abgeschlossene Aufträge</p>
                          <p className="text-lg font-bold">{profile.completed_jobs}</p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-border/50 shadow-sm bg-card/60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Antwortzeit</p>
                          <p className="text-lg font-bold">
                            {profile.response_time_hours ? `${profile.response_time_hours}h` : "N/A"}
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-4 mt-0">
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <div className="space-y-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold mb-1">
                        <Settings className="h-5 w-5 text-primary" />
                        Meine Service
                    </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                      Verwalten Sie Ihre Service und Preise
                    </CardDescription>
                  </div>
                    {/* Search and Add Button */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Service suchen..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 h-9 sm:h-10 text-sm border-border/40"
                        />
                        {searchQuery && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                            onClick={() => setSearchQuery("")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      {/* Mobile: Use Sheet */}
                      {isMobile ? (
                        <Sheet
                          open={serviceDialogOpen}
                          onOpenChange={(open) => {
                            setServiceDialogOpen(open)
                            if (!open) {
                              setEditingService(null)
                              setServiceForm({ title: "", description: "", price_from: 0 })
                            }
                          }}
                        >
                          <SheetTrigger asChild>
                            <Button size="default" className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all h-9 sm:h-10">
                              <Plus className="h-4 w-4 mr-2" />
                              Dienstleistung hinzufügen
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-0">
                            <SheetHeader className="pb-3 border-b px-4 pt-4 pr-12">
                              <SheetTitle className="text-base font-semibold">
                                {editingService ? "Dienstleistung bearbeiten" : "Neue Dienstleistung hinzufügen"}
                              </SheetTitle>
                            </SheetHeader>

                            <div className="px-4 py-4 overflow-y-auto">
                              <form onSubmit={editingService ? handleUpdateService : handleAddService} className="space-y-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor="service_title_mobile" className="text-xs font-medium">
                                    Titel <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    id="service_title_mobile"
                                    value={serviceForm.title}
                                    onChange={(e) =>
                                      setServiceForm({ ...serviceForm, title: e.target.value })
                                    }
                                    placeholder="z.B. Professionelle Klempnerreparatur"
                                    required
                                    className="h-9 text-xs"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <Label htmlFor="service_description_mobile" className="text-xs font-medium">
                                    Beschreibung
                                  </Label>
                                  <Textarea
                                    id="service_description_mobile"
                                    value={serviceForm.description}
                                    onChange={(e) =>
                                      setServiceForm({ ...serviceForm, description: e.target.value })
                                    }
                                    placeholder="Beschreiben Sie Ihre Dienstleistung..."
                                    rows={4}
                                    className="text-xs resize-none"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <Label htmlFor="service_price_mobile" className="text-xs font-medium">
                                    Preis ab (€) <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    id="service_price_mobile"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={serviceForm.price_from}
                                    onChange={(e) =>
                                      setServiceForm({
                                        ...serviceForm,
                                        price_from: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    placeholder="0.00"
                                    required
                                    className="h-9 text-xs"
                                  />
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      setServiceDialogOpen(false)
                                      setEditingService(null)
                                      setServiceForm({ title: "", description: "", price_from: 0 })
                                    }}
                                    className="flex-1 h-9 text-xs"
                                  >
                                    Abbrechen
                                  </Button>
                                  <Button 
                                    type="submit" 
                                    disabled={loading} 
                                    className="flex-1 h-9 text-xs"
                                  >
                                    {loading ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                        {editingService ? "Wird aktualisiert..." : "Wird hinzugefügt..."}
                                      </>
                                    ) : editingService ? (
                                      <>
                                        <Save className="h-3.5 w-3.5 mr-1.5" />
                                        Speichern
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                                        Hinzufügen
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </form>
                            </div>
                          </SheetContent>
                        </Sheet>
                      ) : (
                        /* Desktop: Use Dialog */
                  <Dialog
                    open={serviceDialogOpen}
                    onOpenChange={(open) => {
                      setServiceDialogOpen(open)
                      if (!open) {
                        setEditingService(null)
                        setServiceForm({ title: "", description: "", price_from: 0 })
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                            <Button size="default" className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all">
                              <Plus className="h-4 w-4 mr-2" />
                        Dienstleistung hinzufügen
                      </Button>
                    </DialogTrigger>
                          <DialogContent className="max-w-md [&_[data-slot=dialog-close]]:!absolute [&_[data-slot=dialog-close]]:!top-4 [&_[data-slot=dialog-close]]:!right-4 [&_[data-slot=dialog-close]]:sm:!top-6 [&_[data-slot=dialog-close]]:sm:!right-6 [&_[data-slot=dialog-close]]:!z-50">
                      <DialogHeader>
                        <DialogTitle>
                          {editingService ? "Dienstleistung bearbeiten" : "Neue Dienstleistung hinzufügen"}
                        </DialogTitle>
                        <DialogDescription>
                          {editingService
                            ? "Dienstleistungsinformationen aktualisieren"
                            : "Fügen Sie eine neue Dienstleistung zu Ihrem Profil hinzu"}
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={editingService ? handleUpdateService : handleAddService}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="service_title">Titel</Label>
                          <Input
                            id="service_title"
                            value={serviceForm.title}
                            onChange={(e) =>
                              setServiceForm({ ...serviceForm, title: e.target.value })
                            }
                            placeholder="z.B. Professionelle Klempnerreparatur"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="service_description">Beschreibung</Label>
                          <Textarea
                            id="service_description"
                            value={serviceForm.description}
                            onChange={(e) =>
                              setServiceForm({ ...serviceForm, description: e.target.value })
                            }
                            placeholder="Beschreiben Sie Ihre Dienstleistung..."
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="service_price">Preis ab (€)</Label>
                          <Input
                            id="service_price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={serviceForm.price_from}
                            onChange={(e) =>
                              setServiceForm({
                                ...serviceForm,
                                price_from: parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder="80.00"
                            required
                          />
                        </div>
                              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all">
                          {loading ? (
                            <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              {editingService ? "Wird aktualisiert..." : "Wird hinzugefügt..."}
                            </>
                          ) : editingService ? (
                            <>
                                    <Save className="h-4 w-4 mr-2" />
                              Dienstleistung aktualisieren
                            </>
                          ) : (
                            <>
                                    <Plus className="h-4 w-4 mr-2" />
                              Dienstleistung hinzufügen
                            </>
                          )}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {filteredServices.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground">
                      <Settings className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                      <p className="text-sm font-medium mb-1">
                        {searchQuery ? "Keine Service gefunden" : "Noch keine Service hinzugefügt"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {searchQuery ? "Versuchen Sie einen anderen Suchbegriff" : "Klicken Sie auf 'Dienstleistung hinzufügen', um zu beginnen"}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile: Card Layout */}
                      <div className="block sm:hidden space-y-2">
                        {filteredServices.map((service) => (
                          <Card key={service.id} className="border border-border/40 shadow-sm">
                            <CardContent className="p-3 sm:p-4">
                              <div className="space-y-2.5">
                                <div>
                                  <h3 className="font-semibold text-sm mb-1 leading-tight">{service.title}</h3>
                                  {service.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{service.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                  <div className="flex items-center gap-1.5">
                                    <Euro className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold text-sm">€{service.price_from.toFixed(2)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditService(service)}
                                      disabled={loading}
                                      className="h-8 w-8 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                      title="Dienstleistung bearbeiten"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteService(service.id)}
                                      disabled={loading}
                                      className="h-8 w-8 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                      title="Dienstleistung löschen"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      {/* Desktop: Table Layout */}
                      <div className="hidden sm:block w-full overflow-x-auto">
                        <Table>
                        <TableHeader>
                          <TableRow>
                              <TableHead className="w-[40%]">Titel</TableHead>
                              <TableHead className="w-[35%]">Beschreibung</TableHead>
                              <TableHead className="w-[15%]">Preis</TableHead>
                              <TableHead className="text-right w-[10%]">Aktionen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredServices.map((service) => (
                            <TableRow key={service.id}>
                                <TableCell className="font-medium">{service.title}</TableCell>
                                <TableCell className="text-muted-foreground">
                                {service.description || "-"}
                              </TableCell>
                                <TableCell>
                                <div className="flex items-center gap-1">
                                    <Euro className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold">{service.price_from.toFixed(2)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditService(service)}
                                    disabled={loading}
                                      className="h-8 w-8 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                      title="Dienstleistung bearbeiten"
                                  >
                                      <Edit className="h-4 w-4" />
                                  </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteService(service.id)}
                                  disabled={loading}
                                      className="h-8 w-8 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                      title="Dienstleistung löschen"
                                >
                                      <Trash2 className="h-4 w-4" />
                                </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Gallery Tab */}
            <TabsContent value="gallery" className="space-y-4 mt-0">
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <div className="space-y-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold mb-1">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        Arbeitsgalerie
                    </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                      Laden Sie Vorher/Nachher-Fotos und Videos Ihrer Arbeit hoch
                    </CardDescription>
                  </div>
                    {/* Filter and Upload Button */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                      <Select value={mediaFilter} onValueChange={(v: any) => setMediaFilter(v)}>
                        <SelectTrigger className="w-full sm:w-32 h-9 sm:h-10 text-sm border-border/40">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="approved">Genehmigt</SelectItem>
                          <SelectItem value="pending">Ausstehend</SelectItem>
                          <SelectItem value="rejected">Abgelehnt</SelectItem>
                        </SelectContent>
                      </Select>
                      {/* Mobile: Use Sheet */}
                      {isMobile ? (
                        <Sheet open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
                          <SheetTrigger asChild>
                            <Button size="default" className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all h-9 sm:h-10">
                              <Upload className="h-4 w-4 mr-2" />
                              Medien hochladen
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-0">
                            <SheetHeader className="pb-3 border-b px-4 pt-4 pr-12">
                              <SheetTitle className="text-base font-semibold">
                                Arbeitsgalerie-Medien hochladen
                              </SheetTitle>
                            </SheetHeader>
                            <div className="px-4 py-4">
                              <ModernMediaUpload
                                profileId={profile?.id}
                                existingMedia={media}
                                onUploadComplete={handleMediaUploadComplete}
                                onMediaChange={(newMedia) => {
                                  setMedia(newMedia)
                                  setMediaDialogOpen(false)
                                }}
                                allowBeforeAfter={true}
                                allowBatch={true}
                                maxFiles={20}
                              />
                            </div>
                          </SheetContent>
                        </Sheet>
                      ) : (
                        /* Desktop: Use Dialog */
                  <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
                    <DialogTrigger asChild>
                            <Button size="default" className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all h-9 sm:h-10">
                              <Upload className="h-4 w-4 mr-2" />
                              Medien hochladen
                      </Button>
                    </DialogTrigger>
                          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Arbeitsgalerie-Medien hochladen</DialogTitle>
                        <DialogDescription>
                          Laden Sie Fotos oder Videos Ihrer Arbeit hoch. Sie können mehrere Dateien gleichzeitig hochladen.
                        </DialogDescription>
                      </DialogHeader>
                      <ModernMediaUpload
                        profileId={profile?.id}
                        existingMedia={media}
                        onUploadComplete={handleMediaUploadComplete}
                        onMediaChange={(newMedia) => {
                          setMedia(newMedia)
                          setMediaDialogOpen(false)
                        }}
                        allowBeforeAfter={true}
                        allowBatch={true}
                        maxFiles={20}
                      />
                    </DialogContent>
                  </Dialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {filteredMedia.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground">
                      <ImageIcon className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                      <p className="text-sm font-medium mb-1">
                        {mediaFilter !== "all" 
                          ? `Keine ${mediaFilter === "approved" ? "genehmigten" : mediaFilter === "pending" ? "ausstehenden" : "abgelehnten"} Medien`
                          : "Noch keine Medien hochgeladen"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {mediaFilter === "all" ? "Klicken Sie auf 'Medien hochladen', um Ihre Arbeiten zu präsentieren" : "Versuchen Sie einen anderen Filter"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                      {filteredMedia.map((item) => (
                        <GalleryCard
                          key={item.id}
                          item={item}
                          href={`/gallery/${item.id}`}
                          hideProfile={true}
                          showStatusBadge={false}
                          showTypeBadge={true}
                          onVideoClick={item.media_type === "video" ? handleVideoClick : undefined}
                          onDelete={onDeleteMediaItem}
                          isDeleting={loading}
                        />
                      ))}
                                </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Availability Tab */}
            <TabsContent value="availability" className="space-y-4 mt-0">
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <div className="space-y-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold mb-1">
                        <Calendar className="h-5 w-5 text-primary" />
                        Verfügbarkeitskalender
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Verwalten Sie Ihre verfügbaren Zeiträume
                      </CardDescription>
                                </div>
                    {/* Add Button */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                      {/* Mobile: Use Sheet */}
                      {isMobile ? (
                        <Sheet open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
                          <SheetTrigger asChild>
                            <Button size="default" className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all h-9 sm:h-10">
                              <Plus className="h-4 w-4 mr-2" />
                              Zeitraum hinzufügen
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-0">
                            <SheetHeader className="pb-3 border-b px-4 pt-4 pr-12">
                              <SheetTitle className="text-base font-semibold">
                                Verfügbarkeitszeitraum hinzufügen
                              </SheetTitle>
                            </SheetHeader>
                            <div className="px-4 py-4">
                              <form onSubmit={handleAddAvailability} className="space-y-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor="start_time_mobile" className="text-xs font-medium">
                                    Startzeit <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    id="start_time_mobile"
                                    type="datetime-local"
                                    value={availabilityForm.start_time}
                                    onChange={(e) =>
                                      setAvailabilityForm({ ...availabilityForm, start_time: e.target.value })
                                    }
                                    required
                                    className="h-9 text-xs"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="end_time_mobile" className="text-xs font-medium">
                                    Endzeit <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    id="end_time_mobile"
                                    type="datetime-local"
                                    value={availabilityForm.end_time}
                                    onChange={(e) =>
                                      setAvailabilityForm({ ...availabilityForm, end_time: e.target.value })
                                    }
                                    required
                                    className="h-9 text-xs"
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id="is_available_mobile"
                                    checked={availabilityForm.is_available}
                                    onChange={(e) =>
                                      setAvailabilityForm({
                                        ...availabilityForm,
                                        is_available: e.target.checked,
                                      })
                                    }
                                    className="h-4 w-4 rounded border-gray-300"
                                  />
                                  <Label htmlFor="is_available_mobile" className="text-xs cursor-pointer">
                                    Verfügbar
                                  </Label>
                                </div>
                                <div className="flex gap-2 pt-2">
                              <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      setAvailabilityDialogOpen(false)
                                      setAvailabilityForm({ start_time: "", end_time: "", is_available: true })
                                    }}
                                    className="flex-1 h-9 text-xs"
                                  >
                                    Abbrechen
                              </Button>
                                  <Button type="submit" disabled={loading} className="flex-1 h-9 text-xs">
                                    {loading ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                        Wird hinzugefügt...
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                                        Hinzufügen
                                      </>
                                    )}
                                  </Button>
                            </div>
                              </form>
                    </div>
                          </SheetContent>
                        </Sheet>
                      ) : (
                        /* Desktop: Use Dialog */
                  <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
                    <DialogTrigger asChild>
                            <Button size="default" className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all h-9 sm:h-10">
                              <Plus className="h-4 w-4 mr-2" />
                        Zeitraum hinzufügen
                      </Button>
                    </DialogTrigger>
                          <DialogContent className="max-w-[95vw] sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Verfügbarkeitszeitraum hinzufügen</DialogTitle>
                        <DialogDescription>
                          Fügen Sie einen Zeitraum hinzu, in dem Sie verfügbar sind
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddAvailability} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="start_time">Startzeit</Label>
                          <Input
                            id="start_time"
                            type="datetime-local"
                            value={availabilityForm.start_time}
                            onChange={(e) =>
                              setAvailabilityForm({ ...availabilityForm, start_time: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end_time">Endzeit</Label>
                          <Input
                            id="end_time"
                            type="datetime-local"
                            value={availabilityForm.end_time}
                            onChange={(e) =>
                              setAvailabilityForm({ ...availabilityForm, end_time: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="is_available"
                            checked={availabilityForm.is_available}
                            onChange={(e) =>
                              setAvailabilityForm({
                                ...availabilityForm,
                                is_available: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <Label htmlFor="is_available" className="cursor-pointer">
                            Verfügbar
                          </Label>
                        </div>
                              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all">
                          {loading ? (
                            <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Wird hinzugefügt...
                            </>
                          ) : (
                            <>
                                    <Plus className="h-4 w-4 mr-2" />
                              Zeitraum hinzufügen
                            </>
                          )}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {availabilitySlots.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground">
                      <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                      <p className="text-sm font-medium mb-1">Noch keine Verfügbarkeitszeiträume hinzugefügt</p>
                      <p className="text-xs text-muted-foreground">Klicken Sie auf "Zeitraum hinzufügen", um Ihre Verfügbarkeit festzulegen</p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile: Card Layout */}
                      <div className="block sm:hidden space-y-2">
                        {availabilitySlots.map((slot) => (
                          <Card key={slot.id} className="border border-border/40 shadow-sm">
                            <CardContent className="p-3">
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <p className="text-[10px] text-muted-foreground mb-0.5">Start</p>
                                    <p className="font-semibold text-xs leading-tight">{format(new Date(slot.start_time), "MMM d, yyyy")}</p>
                                    <p className="text-[10px] text-muted-foreground">{format(new Date(slot.start_time), "h:mm a")}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-muted-foreground mb-0.5">Ende</p>
                                    <p className="font-semibold text-xs leading-tight">{format(new Date(slot.end_time), "MMM d, yyyy")}</p>
                                    <p className="text-[10px] text-muted-foreground">{format(new Date(slot.end_time), "h:mm a")}</p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                  <Badge
                                    variant={slot.is_available ? "default" : "secondary"}
                                    className={cn(
                                      "text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0",
                                      slot.is_available 
                                        ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                                        : "bg-gray-500/10 text-gray-700 dark:text-gray-400 border border-gray-500/20"
                                    )}
                                  >
                                    {slot.is_available ? "Verfügbar" : "Nicht verfügbar"}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteAvailability(slot.id)}
                                    disabled={loading}
                                    className="h-7 w-7 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                    title="Zeitraum löschen"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      {/* Desktop: Table Layout */}
                      <div className="hidden sm:block w-full overflow-x-auto">
                        <Table>
                        <TableHeader>
                          <TableRow>
                              <TableHead className="w-[35%]">Startzeit</TableHead>
                              <TableHead className="w-[35%]">Endzeit</TableHead>
                              <TableHead className="w-[15%]">Status</TableHead>
                              <TableHead className="text-right w-[15%]">Aktionen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {availabilitySlots.map((slot) => (
                            <TableRow key={slot.id}>
                                <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">{format(new Date(slot.start_time), "MMM d, yyyy")}</span>
                                    <span className="text-xs text-muted-foreground">{format(new Date(slot.start_time), "h:mm a")}</span>
                                </div>
                              </TableCell>
                                <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">{format(new Date(slot.end_time), "MMM d, yyyy")}</span>
                                    <span className="text-xs text-muted-foreground">{format(new Date(slot.end_time), "h:mm a")}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={slot.is_available ? "default" : "secondary"}
                                    className={cn(
                                      "text-xs font-semibold px-2.5 py-0.5 rounded-md",
                                      slot.is_available 
                                        ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                                        : "bg-gray-500/10 text-gray-700 dark:text-gray-400 border border-gray-500/20"
                                    )}
                                >
                                  {slot.is_available ? "Verfügbar" : "Nicht verfügbar"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteAvailability(slot.id)}
                                  disabled={loading}
                                    className="h-8 w-8 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                    title="Zeitraum löschen"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Promotions Tab */}
            <TabsContent value="promotions" className="space-y-4 mt-0">
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold mb-1">
                        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        Profilaktionen
                    </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                      Bewerben Sie Ihr Profil für mehr Sichtbarkeit
                    </CardDescription>
                  </div>
                    {isMobile ? (
                      <Sheet
                        open={promotionDialogOpen}
                        onOpenChange={(open) => {
                          setPromotionDialogOpen(open)
                          if (!open) {
                            setPromotionForm({ start_date: "", end_date: "" })
                          }
                        }}
                      >
                        <SheetTrigger asChild>
                          <Button size="default" className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all h-9 sm:h-10">
                            <Plus className="h-4 w-4 mr-2" />
                            Aktion erstellen
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-0">
                          <SheetHeader className="pb-3 border-b px-4 pt-4 pr-12">
                            <SheetTitle className="text-base font-semibold">
                              Profilaktion erstellen
                            </SheetTitle>
                          </SheetHeader>
                          <div className="px-4 py-4">
                            <form onSubmit={handleCreatePromotion} className="space-y-3">
                              <div className="space-y-1.5">
                                <Label htmlFor="start_date_mobile" className="text-xs font-medium">
                                  Startdatum <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  id="start_date_mobile"
                                  type="datetime-local"
                                  value={promotionForm.start_date}
                                  onChange={(e) =>
                                    setPromotionForm({ ...promotionForm, start_date: e.target.value })
                                  }
                                  required
                                  className="h-9 text-xs"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="end_date_mobile" className="text-xs font-medium">
                                  Enddatum <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  id="end_date_mobile"
                                  type="datetime-local"
                                  value={promotionForm.end_date}
                                  onChange={(e) =>
                                    setPromotionForm({ ...promotionForm, end_date: e.target.value })
                                  }
                                  required
                                  className="h-9 text-xs"
                                />
                              </div>
                              <Alert className="text-xs">
                                <AlertCircle className="h-3.5 w-3.5" />
                                <AlertDescription className="text-xs">
                                  Die Zahlung für die Aktion wird nach der Erstellung abgewickelt. Sie werden zur Zahlung weitergeleitet.
                                </AlertDescription>
                              </Alert>
                              <div className="flex gap-2 pt-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setPromotionDialogOpen(false)
                                    setPromotionForm({ start_date: "", end_date: "" })
                                  }}
                                  className="flex-1 h-9 text-xs"
                                >
                                  Abbrechen
                                </Button>
                                <Button
                                  type="submit"
                                  disabled={loading}
                                  className="flex-1 h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all"
                                >
                                  {loading ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                                      Wird erstellt...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3.5 w-3.5 mr-2" />
                                      Erstellen
                                    </>
                                  )}
                                </Button>
                              </div>
                            </form>
                          </div>
                        </SheetContent>
                      </Sheet>
                    ) : (
                  <Dialog open={promotionDialogOpen} onOpenChange={setPromotionDialogOpen}>
                    <DialogTrigger asChild>
                          <Button size="default" className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all h-9 sm:h-10">
                            <Plus className="h-4 w-4 mr-2" />
                            Aktion erstellen
                      </Button>
                    </DialogTrigger>
                        <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Profilaktion erstellen</DialogTitle>
                        <DialogDescription>
                          Legen Sie einen Datumsbereich für Ihre Profilaktion fest
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreatePromotion} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="start_date">Startdatum</Label>
                          <Input
                            id="start_date"
                            type="datetime-local"
                            value={promotionForm.start_date}
                            onChange={(e) =>
                              setPromotionForm({ ...promotionForm, start_date: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end_date">Enddatum</Label>
                          <Input
                            id="end_date"
                            type="datetime-local"
                            value={promotionForm.end_date}
                            onChange={(e) =>
                              setPromotionForm({ ...promotionForm, end_date: e.target.value })
                            }
                            required
                          />
                        </div>
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Die Zahlung für die Aktion wird nach der Erstellung abgewickelt. Sie werden zur Zahlung weitergeleitet.
                          </AlertDescription>
                        </Alert>
                            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all">
                          {loading ? (
                            <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Wird erstellt...
                            </>
                          ) : (
                            <>
                                  <Sparkles className="h-4 w-4 mr-2" />
                              Aktion erstellen
                            </>
                          )}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {promotions.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground">
                      <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                      <p className="text-xs sm:text-sm font-medium mb-1">Keine aktiven Aktionen</p>
                      <p className="text-[10px] sm:text-xs">Klicken Sie auf "Aktion erstellen", um Ihr Profil zu bewerben</p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile: Card Layout */}
                      <div className="block sm:hidden space-y-2">
                        {promotions.map((promotion) => (
                          <Card key={promotion.id} className="border border-border/40 shadow-sm">
                            <CardContent className="p-3">
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <p className="text-[10px] text-muted-foreground mb-0.5">Start</p>
                                    <p className="font-semibold text-xs leading-tight">{format(new Date(promotion.start_date), "MMM d, yyyy")}</p>
                                    <p className="text-[10px] text-muted-foreground">{format(new Date(promotion.start_date), "h:mm a")}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-muted-foreground mb-0.5">Ende</p>
                                    <p className="font-semibold text-xs leading-tight">{format(new Date(promotion.end_date), "MMM d, yyyy")}</p>
                                    <p className="text-[10px] text-muted-foreground">{format(new Date(promotion.end_date), "h:mm a")}</p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                  <Badge 
                                    variant={promotion.is_active ? "default" : "secondary"}
                                    className={cn(
                                      "text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0",
                                      promotion.is_active
                                        ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                                        : "bg-gray-500/10 text-gray-700 dark:text-gray-400 border border-gray-500/20"
                                    )}
                                  >
                                    {promotion.is_active ? "Aktiv" : "Inaktiv"}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeletePromotion(promotion.id)}
                                    disabled={loading}
                                    className="h-7 w-7 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                    title="Aktion löschen"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      {/* Desktop: Table Layout */}
                      <div className="hidden sm:block w-full overflow-x-auto">
                        <Table>
                        <TableHeader>
                          <TableRow>
                              <TableHead className="w-[30%]">Startdatum</TableHead>
                              <TableHead className="w-[30%]">Enddatum</TableHead>
                              <TableHead className="w-[20%]">Status</TableHead>
                              <TableHead className="text-right w-[20%]">Aktionen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {promotions.map((promotion) => (
                            <TableRow key={promotion.id}>
                                <TableCell className="font-medium">
                                  <div className="flex flex-col">
                                    <span>{format(new Date(promotion.start_date), "MMM d, yyyy")}</span>
                                    <span className="text-xs text-muted-foreground">{format(new Date(promotion.start_date), "h:mm a")}</span>
                                  </div>
                              </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span>{format(new Date(promotion.end_date), "MMM d, yyyy")}</span>
                                    <span className="text-xs text-muted-foreground">{format(new Date(promotion.end_date), "h:mm a")}</span>
                                  </div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={promotion.is_active ? "default" : "secondary"}
                                    className={cn(
                                      "text-xs font-semibold px-2.5 py-0.5 rounded-md",
                                      promotion.is_active
                                        ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                                        : "bg-gray-500/10 text-gray-700 dark:text-gray-400 border border-gray-500/20"
                                    )}
                                >
                                  {promotion.is_active ? "Aktiv" : "Inaktiv"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeletePromotion(promotion.id)}
                                  disabled={loading}
                                    className="h-8 w-8 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                    title="Aktion löschen"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders" className="space-y-4 mt-0">
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold mb-1">
                        <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Meine Bestellungen
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Zeigen und verwalten Sie Ihre Dienstleistungsbestellungen
                  </CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                        <Input
                          placeholder="Bestellungen suchen..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 h-9 text-xs sm:text-sm"
                        />
                        {searchQuery && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                            onClick={() => setSearchQuery("")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Select value={orderFilter} onValueChange={(v: any) => setOrderFilter(v)}>
                        <SelectTrigger className="w-full sm:w-32 h-9 text-xs sm:text-sm">
                          <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="pending">Ausstehend</SelectItem>
                          <SelectItem value="created">Erstellt</SelectItem>
                          <SelectItem value="paid">Bezahlt</SelectItem>
                          <SelectItem value="completed">Abgeschlossen</SelectItem>
                          <SelectItem value="canceled">Storniert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground">
                      <ShoppingCart className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                      <p className="text-xs sm:text-sm font-medium mb-1">
                        {orderFilter !== "all" || searchQuery ? "Keine Bestellungen gefunden" : "Noch keine Bestellungen"}
                      </p>
                      <p className="text-[10px] sm:text-xs">
                        {orderFilter !== "all" || searchQuery ? "Versuchen Sie, Ihre Filter anzupassen" : "Bestellungen werden hier angezeigt, wenn Kunden Ihre Service buchen"}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile: Card Layout */}
                      <div className="block sm:hidden space-y-2">
                        {filteredOrders.map((order) => (
                          <Card key={order.id} className="border border-border/40 shadow-sm">
                            <CardContent className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-1 flex-1 min-w-0">
                                    <p className="font-semibold text-xs">Bestellung #{order.id}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{order.buyer?.name || "Unbekannt"}</p>
                                    <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: de })}</p>
                                  </div>
                                  <Badge
                                    variant={
                                      order.status === "completed" ? "default" :
                                      order.status === "paid" ? "secondary" :
                                      order.status === "created" ? "outline" : "destructive"
                                    }
                                    className={cn(
                                      "text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0",
                                      order.status === "completed" && "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20",
                                      order.status === "paid" && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
                                      order.status === "created" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20",
                                      order.status === "canceled" && "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                                    )}
                                  >
                                    {order.status === "created" ? "Erstellt" : 
                                 order.status === "paid" ? "Bezahlt" : 
                                 order.status === "completed" ? "Abgeschlossen" : 
                                 order.status === "canceled" ? "Storniert" : order.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                  <div className="flex items-center gap-1">
                                    <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="font-semibold text-xs">€{order.amount.toFixed(2)}</span>
                                  </div>
                                  {order.status === "paid" && (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => handleCompleteOrder(order)}
                                      disabled={completingOrderId === order.id}
                                      className="h-7 text-[10px] bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md transition-all px-2 disabled:opacity-50"
                                    >
                                      {completingOrderId === order.id ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          Wird abgeschlossen...
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Abschließen
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      {/* Desktop: Table Layout */}
                      <div className="hidden sm:block w-full overflow-x-auto">
                        <Table>
                        <TableHeader>
                          <TableRow>
                              <TableHead className="w-[12%]">Bestell-ID</TableHead>
                              <TableHead className="w-[20%]">Kunde</TableHead>
                              <TableHead className="w-[15%]">Betrag</TableHead>
                              <TableHead className="w-[15%]">Status</TableHead>
                              <TableHead className="hidden md:table-cell w-[18%]">Datum</TableHead>
                              <TableHead className="text-right w-[20%]">Aktionen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOrders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell className="font-medium">#{order.id}</TableCell>
                                <TableCell>
                                {order.buyer?.name || "Unbekannt"}
                              </TableCell>
                                <TableCell>
                                <div className="flex items-center gap-1">
                                    <Euro className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold">{order.amount.toFixed(2)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    order.status === "completed" ? "default" :
                                    order.status === "paid" ? "secondary" :
                                    order.status === "created" ? "outline" : "destructive"
                                  }
                                    className={cn(
                                      "text-xs font-semibold px-2.5 py-0.5 rounded-md",
                                      order.status === "completed" && "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20",
                                      order.status === "paid" && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
                                      order.status === "created" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20",
                                      order.status === "canceled" && "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                                    )}
                                  >
                                    {order.status === "created" ? "Erstellt" : 
                                 order.status === "paid" ? "Bezahlt" : 
                                 order.status === "completed" ? "Abgeschlossen" : 
                                 order.status === "canceled" ? "Storniert" : order.status}
                                </Badge>
                              </TableCell>
                                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: de })}
                              </TableCell>
                              <TableCell className="text-right">
                                {order.status === "paid" && (
                                  <Button
                                      variant="default"
                                    size="sm"
                                    onClick={() => handleCompleteOrder(order)}
                                      disabled={completingOrderId === order.id}
                                      className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                                    >
                                      {completingOrderId === order.id ? (
                                        <>
                                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                          Wird abgeschlossen...
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                    Abschließen
                                        </>
                                      )}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews" className="space-y-4 mt-0">
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold mb-1">
                      <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Kundenbewertungen
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Bewertungen von Ihren Kunden
                  </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {reviews.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground">
                      <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                      <p className="text-xs sm:text-sm font-medium mb-1">Noch keine Bewertungen</p>
                      <p className="text-[10px] sm:text-xs">Bewertungen werden hier angezeigt, sobald Kunden Ihre Service bewerten</p>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {/* Rating Summary */}
                      <div className="p-3 sm:p-4 rounded-lg border border-border/40 bg-muted/30">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="text-center">
                            <div className="text-3xl sm:text-4xl font-bold">{stats.average_rating.toFixed(1)}</div>
                            <div className="flex items-center justify-center gap-0.5 sm:gap-1 mt-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                  className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                                    star <= Math.floor(stats.average_rating)
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{stats.total_reviews} Bewertungen</p>
                          </div>
                        </div>
                      </div>

                      {/* Reviews List */}
                      {reviews.map((review) => {
                        const order = orders.find(o => o.id === review.order_id)
                        return (
                          <Card key={review.id} className="border border-border/40 shadow-sm">
                            <CardContent className="p-3 sm:p-4">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    {order?.buyer?.name && (
                                      <p className="font-semibold text-xs sm:text-sm mb-1.5 truncate">{order.buyer.name}</p>
                                    )}
                                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={star}
                                          className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                                        star <= review.rating
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-muted-foreground"
                                      }`}
                                    />
                                  ))}
                                  <span className="text-xs sm:text-sm font-medium">{review.rating}/5</span>
                                </div>
                                {review.text && (
                                      <p className="text-xs sm:text-sm text-muted-foreground mb-1.5 line-clamp-3">{review.text}</p>
                                )}
                                <p className="text-[10px] sm:text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: de })}
                                </p>
                                  </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Relationships Tab */}
            <TabsContent value="relationships" className="space-y-4 mt-0">
              {loading || !profile ? (
                <Card className="border border-border/40 shadow-sm">
                  <CardContent className="flex items-center justify-center py-8 sm:py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-border/40 shadow-sm">
                  <CardHeader className="p-4 pb-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold mb-1">
                        <Link2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        Verbindungen
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Verknüpfen Sie Ihr Profil mit Produkten, Verleihe und anderen Meistern
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                <RelationshipManager
                  sourceType="master"
                  sourceId={profile.id}
                  sourceLabel={user?.name ?? undefined}
                />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayer
          videoUrl={selectedVideo.url || ""}
          thumbnailUrl={selectedVideo.thumbnail_url || undefined}
          title={selectedVideo.title || undefined}
          isOpen={true}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </ProtectedRoute>
  )
}
