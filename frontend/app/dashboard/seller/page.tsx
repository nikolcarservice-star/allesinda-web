"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from "react"
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
  SheetFooter,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/components/ui/use-mobile"
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
  Package,
  Home,
  Wrench,
  Euro,
  Loader2,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  MapPin,
  ShoppingBag,
  Calendar,
  Settings,
  Save,
  Send,
  Link2,
  ShoppingCart,
  MessageSquare,
  Star,
  Award,
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  Clock,
  Filter,
  Search,
  X,
} from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { toast } from "sonner"
import { logger } from "@/lib/logger"
import {
  getMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/lib/api/products"
import {
  getMyRentals,
  createRental,
  updateRental,
  deleteRental,
} from "@/lib/api/rentals"
import { getMyOrders, updateOrder, completeOrder } from "@/lib/api/orders"
import { getSellerReviews } from "@/lib/api/reviews"
import { getMySellerProfile } from "@/lib/api/sellers"
import { getGermanCities } from "@/lib/api/masters"
import { getCategoriesByType } from "@/lib/api/categories"
import { listRelationships } from "@/lib/api/relationships"
import type {
  Product,
  ProductInput,
  Rental,
  RentalInput,
  Media,
  Order,
  OrderStatus,
  Review,
  Profile,
  Category,
} from "@/lib/api/types"
import Image from "next/image"
import Link from "next/link"
import { ProductRentalMediaUpload } from "@/components/sellers/product-rental-media-upload"
import { ModernMediaUpload } from "@/components/dashboard/modern-media-upload"
import { RelationshipManager } from "@/components/dashboard/relationship-manager"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale/de"
import { cn } from "@/lib/utils"

export default function SellerDashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [profile, setProfile] = useState<Profile | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [completingOrderId, setCompletingOrderId] = useState<number | null>(null)
  const [orderFilter, setOrderFilter] = useState<OrderStatus | "all" | "pending">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [stats, setStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    completed_orders: 0,
    total_revenue: 0,
    average_rating: 0,
    total_reviews: 0,
    total_products: 0,
    total_rentals: 0,
  })

  // Product form
  const [productForm, setProductForm] = useState<ProductInput>({
    title: "",
    description: "",
    price: 0,
    stock: 0,
    city_id: undefined,
    image_url: "",
    brand: "",
    category_id: undefined,
  })
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Rental form
  const [rentalForm, setRentalForm] = useState<RentalInput>({
    title: "",
    description: "",
    price_per_day: 0,
    stock: 1,
    available: true,
    city_id: undefined,
    image_url: "",
    category_id: undefined,
  })
  const [rentalDialogOpen, setRentalDialogOpen] = useState(false)
  const [editingRental, setEditingRental] = useState<Rental | null>(null)

  // Filter orders
  const filteredOrders = useMemo(() => {
    let filtered = [...orders]
    
    // Filter by status
    if (orderFilter !== "all") {
      if (orderFilter === "pending") {
        filtered = filtered.filter(o => o.status === "created" || o.status === "paid")
      } else {
        filtered = filtered.filter(o => o.status === orderFilter)
      }
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(o => 
        o.id.toString().includes(query) ||
        o.buyer?.name?.toLowerCase().includes(query) ||
        o.order_type?.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [orders, orderFilter, searchQuery])

  // Cities
  const [cities, setCities] = useState<Array<{ id: number; name: string }>>([])
  const cityIdToName = useMemo(() => {
    const map = new Map<number, string>()
    cities.forEach((c) => map.set(c.id, c.name))
    return map
  }, [cities])

  // Categories
  const [productCategories, setProductCategories] = useState<Category[]>([])
  const [productSubcategories, setProductSubcategories] = useState<Category[]>([])
  const [rentalCategories, setRentalCategories] = useState<Category[]>([])
  const [rentalSubcategories, setRentalSubcategories] = useState<Category[]>([])
  const [selectedProductCategoryId, setSelectedProductCategoryId] = useState<number | undefined>(undefined)
  const [selectedProductSubcategoryId, setSelectedProductSubcategoryId] = useState<number | undefined>(undefined)
  const [selectedRentalCategoryId, setSelectedRentalCategoryId] = useState<number | undefined>(undefined)
  const [selectedRentalSubcategoryId, setSelectedRentalSubcategoryId] = useState<number | undefined>(undefined)
  const [productLinkCounts, setProductLinkCounts] = useState<Record<number, number>>({})
  const [rentalLinkCounts, setRentalLinkCounts] = useState<Record<number, number>>({})

  useEffect(() => {
    if (user && user.role !== "seller") {
      router.push("/")
      return
    }
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [profileData, productsData, rentalsData, ordersData, reviewsData, citiesRes, productCats, rentalCats] = await Promise.all([
        getMySellerProfile().catch(() => null),
        getMyProducts({ page: 1, page_size: 100 }).catch(() => ({
          items: [],
          total: 0,
          page: 1,
          page_size: 100,
          total_pages: 0,
        })),
        getMyRentals({ page: 1, page_size: 100 }).catch(() => ({
          items: [],
          total: 0,
          page: 1,
          page_size: 100,
          total_pages: 0,
        })),
        getMyOrders({ page: 1, page_size: 50 }).catch(() => ({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 })),
        user ? getSellerReviews(user.id, { page: 1, page_size: 20 }).catch(() => ({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 })) : Promise.resolve({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
        getGermanCities().catch(() => ({ items: [] as Array<{ id: number; name: string }> } as any)),
        getCategoriesByType('product', { activeOnly: true, rootOnly: true }).catch(() => []),
        getCategoriesByType('rental', { activeOnly: true, rootOnly: true }).catch(() => []),
      ])

      if (profileData) {
        setProfile(profileData)
      }
      setProducts(productsData.items || [])
      setRentals(rentalsData.items || [])
      setOrders(ordersData.items || [])
      setReviews(reviewsData.items || [])
      setCities((citiesRes?.items as any[])?.map((c: any) => ({ id: c.id, name: c.name })) ?? [])
      setProductCategories(productCats || [])
      setRentalCategories(rentalCats || [])
      setProductCategories(productCats || [])
      setRentalCategories(rentalCats || [])
      
      // Calculate stats
      const sellerOrders = ordersData.items || []
      const sellerReviews = reviewsData.items || []
      const totalRevenue = sellerOrders
        .filter((o: Order) => o.status === "completed" || o.status === "paid")
        .reduce((sum: number, o: Order) => sum + (o.amount - o.commission), 0)
      const avgRating = sellerReviews.length > 0
        ? sellerReviews.reduce((sum: number, r: Review) => sum + r.rating, 0) / sellerReviews.length
        : 0
      
      setStats({
        total_orders: sellerOrders.length,
        pending_orders: sellerOrders.filter((o: Order) => o.status === "created" || o.status === "paid").length,
        completed_orders: sellerOrders.filter((o: Order) => o.status === "completed").length,
        total_revenue: totalRevenue,
        average_rating: avgRating,
        total_reviews: sellerReviews.length,
        total_products: productsData.items?.length || 0,
        total_rentals: rentalsData.items?.length || 0,
      })
      
      // Load link counts for products and rentals
      const productCounts: Record<number, number> = {}
      const rentalCounts: Record<number, number> = {}
      
      try {
        for (const product of productsData.items || []) {
          try {
            const relationships = await listRelationships('product', product.id)
            productCounts[product.id] = relationships.length
          } catch (error) {
            productCounts[product.id] = 0
          }
        }
        for (const rental of rentalsData.items || []) {
          try {
            const relationships = await listRelationships('rental', rental.id)
            rentalCounts[rental.id] = relationships.length
          } catch (error) {
            rentalCounts[rental.id] = 0
          }
        }
      } catch (error) {
        console.error('Failed to load link counts:', error)
      }
      
      setProductLinkCounts(productCounts)
      setRentalLinkCounts(rentalCounts)
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

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!selectedProductCategoryId) {
      toast.error("Bitte wählen Sie eine Kategorie aus")
      return
    }
    
    if (productSubcategories.length > 0 && !selectedProductSubcategoryId) {
      toast.error("Bitte wählen Sie eine Unterkategorie aus")
      return
    }
    
    if (!productForm.description || productForm.description.trim() === "") {
      toast.error("Bitte geben Sie eine Beschreibung ein")
      return
    }
    
    try {
      setLoading(true)
      const newProduct = await createProduct(productForm)
      setProducts([newProduct, ...products])
      setProductForm({
        title: "",
        description: "",
        price: 0,
        stock: 0,
        city_id: undefined,
        image_url: "",
        brand: "",
        category_id: undefined,
      })
      setSelectedProductCategoryId(undefined)
      setSelectedProductSubcategoryId(undefined)
      setProductSubcategories([])
      setProductDialogOpen(false)
      toast.success("Produkt erfolgreich erstellt! Sie können jetzt Bilder und Videos hochladen.")
      // Keep dialog open for media upload
      setEditingProduct(newProduct)
      setProductDialogOpen(true)
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Erstellen des Produkts")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return

    // Validation
    if (!selectedProductCategoryId) {
      toast.error("Bitte wählen Sie eine Kategorie aus")
      return
    }
    
    if (productSubcategories.length > 0 && !selectedProductSubcategoryId) {
      toast.error("Bitte wählen Sie eine Unterkategorie aus")
      return
    }
    
    if (!productForm.description || productForm.description.trim() === "") {
      toast.error("Bitte geben Sie eine Beschreibung ein")
      return
    }

    try {
      setLoading(true)
      const updated = await updateProduct(editingProduct.id, productForm)
      setProducts(
        products.map((p) => (p.id === updated.id ? updated : p))
      )
      setEditingProduct(null)
      setProductForm({
        title: "",
        description: "",
        price: 0,
        stock: 0,
        city_id: undefined,
        image_url: "",
        brand: "",
        category_id: undefined,
      })
      setSelectedProductCategoryId(undefined)
      setSelectedProductSubcategoryId(undefined)
      setProductSubcategories([])
      setProductDialogOpen(false)
      toast.success("Produkt erfolgreich aktualisiert")
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Aktualisieren des Produkts")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProduct = async (productId: number) => {
    if (!confirm("Sind Sie sicher, dass Sie dieses Produkt löschen möchten?")) return

    try {
      setLoading(true)
      await deleteProduct(productId)
      setProducts(products.filter((p) => p.id !== productId))
      toast.success("Produkt erfolgreich gelöscht")
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Löschen des Produkts")
    } finally {
      setLoading(false)
    }
  }

  const handleEditProduct = async (product: Product) => {
    setEditingProduct(product)
    setProductForm({
      title: product.title,
      description: product.description || "",
      price: product.price,
      stock: product.stock,
      city_id: (product as any).city_id ?? undefined,
      image_url: product.image_url || "",
      brand: product.brand || "",
      category_id: product.category_id ?? undefined,
    })
    
    // Determine if category_id is a parent or subcategory
    if (product.category_id) {
      try {
        const allCategories = await getCategoriesByType('product', { activeOnly: true })
        const category = allCategories.find(c => c.id === product.category_id)
        if (category) {
          if (category.parent_id) {
            // It's a subcategory
            setSelectedProductCategoryId(category.parent_id)
            setSelectedProductSubcategoryId(category.id)
            // Load subcategories for the parent
            const subcats = await getCategoriesByType('product', { activeOnly: true, parentId: category.parent_id })
            setProductSubcategories(subcats)
          } else {
            // It's a parent category
            setSelectedProductCategoryId(category.id)
            setSelectedProductSubcategoryId(undefined)
            // Load subcategories
            const subcats = await getCategoriesByType('product', { activeOnly: true, parentId: category.id })
            setProductSubcategories(subcats)
          }
        }
      } catch (error) {
        console.error('Failed to load category info:', error)
      }
    } else {
      setSelectedProductCategoryId(undefined)
      setSelectedProductSubcategoryId(undefined)
      setProductSubcategories([])
    }
    
    setProductDialogOpen(true)
  }

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!selectedRentalCategoryId) {
      toast.error("Bitte wählen Sie eine Kategorie aus")
      return
    }
    
    if (rentalSubcategories.length > 0 && !selectedRentalSubcategoryId) {
      toast.error("Bitte wählen Sie eine Unterkategorie aus")
      return
    }
    
    if (!rentalForm.description || rentalForm.description.trim() === "") {
      toast.error("Bitte geben Sie eine Beschreibung ein")
      return
    }
    
    try {
      setLoading(true)
      const newRental = await createRental(rentalForm)
      setRentals([newRental, ...rentals])
      setRentalForm({
        title: "",
        description: "",
        price_per_day: 0,
        stock: 1,
        available: true,
        city_id: undefined,
        image_url: "",
        category_id: undefined,
      })
      setSelectedRentalCategoryId(undefined)
      setSelectedRentalSubcategoryId(undefined)
      setRentalSubcategories([])
      toast.success("Verleih erfolgreich erstellt! Sie können jetzt Bilder und Videos hochladen.")
      // Keep dialog open for media upload
      setEditingRental(newRental)
      // Don't close dialog - let user upload media
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Erstellen der Verleih")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRental = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRental) return

    // Validation
    if (!selectedRentalCategoryId) {
      toast.error("Bitte wählen Sie eine Kategorie aus")
      return
    }
    
    if (rentalSubcategories.length > 0 && !selectedRentalSubcategoryId) {
      toast.error("Bitte wählen Sie eine Unterkategorie aus")
      return
    }
    
    if (!rentalForm.description || rentalForm.description.trim() === "") {
      toast.error("Bitte geben Sie eine Beschreibung ein")
      return
    }

    try {
      setLoading(true)
      const updated = await updateRental(editingRental.id, rentalForm)
      setRentals(rentals.map((r) => (r.id === updated.id ? updated : r)))
      setEditingRental(null)
      setRentalForm({
        title: "",
        description: "",
        price_per_day: 0,
        stock: 1,
        available: true,
        city_id: undefined,
        image_url: "",
        category_id: undefined,
      })
      setSelectedRentalCategoryId(undefined)
      setSelectedRentalSubcategoryId(undefined)
      setRentalSubcategories([])
      setRentalDialogOpen(false)
      toast.success("Verleih erfolgreich aktualisiert")
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Aktualisieren der Verleih")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRental = async (rentalId: number) => {
    if (!confirm("Sind Sie sicher, dass Sie diese Verleih löschen möchten?")) return

    try {
      setLoading(true)
      await deleteRental(rentalId)
      setRentals(rentals.filter((r) => r.id !== rentalId))
      toast.success("Verleih erfolgreich gelöscht")
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Löschen der Verleih")
    } finally {
      setLoading(false)
    }
  }

  const handleEditRental = async (rental: Rental) => {
    setEditingRental(rental)
    setRentalForm({
      title: rental.title,
      description: rental.description || "",
      price_per_day: rental.price_per_day,
      stock: rental.stock,
      available: rental.available,
      city_id: (rental as any).city_id ?? undefined,
      image_url: rental.image_url || "",
      category_id: rental.category_id ?? undefined,
    })
    
    // Determine if category_id is a parent or subcategory
    if (rental.category_id) {
      try {
        const allCategories = await getCategoriesByType('rental', { activeOnly: true })
        const category = allCategories.find(c => c.id === rental.category_id)
        if (category) {
          if (category.parent_id) {
            // It's a subcategory
            setSelectedRentalCategoryId(category.parent_id)
            setSelectedRentalSubcategoryId(category.id)
            // Load subcategories for the parent
            const subcats = await getCategoriesByType('rental', { activeOnly: true, parentId: category.parent_id })
            setRentalSubcategories(subcats)
          } else {
            // It's a parent category
            setSelectedRentalCategoryId(category.id)
            setSelectedRentalSubcategoryId(undefined)
            // Load subcategories
            const subcats = await getCategoriesByType('rental', { activeOnly: true, parentId: category.id })
            setRentalSubcategories(subcats)
          }
        }
      } catch (error) {
        console.error('Failed to load category info:', error)
      }
    } else {
      setSelectedRentalCategoryId(undefined)
      setSelectedRentalSubcategoryId(undefined)
      setRentalSubcategories([])
    }
    
    setRentalDialogOpen(true)
  }

  // Handle product category selection
  const handleProductCategoryChange = async (categoryId: string) => {
    const id = Number(categoryId)
    setSelectedProductCategoryId(id)
    setSelectedProductSubcategoryId(undefined)
    setProductForm((prev) => ({ ...prev, category_id: id }))
    
    try {
      const subcats = await getCategoriesByType('product', { activeOnly: true, parentId: id })
      setProductSubcategories(subcats)
    } catch (error) {
      console.error('Failed to load subcategories:', error)
      setProductSubcategories([])
    }
  }

  // Handle product subcategory selection
  const handleProductSubcategoryChange = (subcategoryId: string) => {
    const id = Number(subcategoryId)
    setSelectedProductSubcategoryId(id)
    setProductForm((prev) => ({ ...prev, category_id: id }))
  }

  // Handle rental category selection
  const handleRentalCategoryChange = async (categoryId: string) => {
    const id = Number(categoryId)
    setSelectedRentalCategoryId(id)
    setSelectedRentalSubcategoryId(undefined)
    setRentalForm((prev) => ({ ...prev, category_id: id }))
    
    try {
      const subcats = await getCategoriesByType('rental', { activeOnly: true, parentId: id })
      setRentalSubcategories(subcats)
    } catch (error) {
      console.error('Failed to load subcategories:', error)
      setRentalSubcategories([])
    }
  }

  // Handle rental subcategory selection
  const handleRentalSubcategoryChange = (subcategoryId: string) => {
    const id = Number(subcategoryId)
    setSelectedRentalSubcategoryId(id)
    setRentalForm((prev) => ({ ...prev, category_id: id }))
  }

  const handleQuickStockUpdate = async (productId: number, newStock: number) => {
    try {
      const product = products.find((p) => p.id === productId)
      if (!product) return

      await updateProduct(productId, {
        title: product.title,
        description: product.description ?? undefined,
        price: product.price,
        stock: newStock,
        city_id: product.city_id ?? undefined,
        image_url: product.image_url ?? undefined,
        brand: product.brand ?? undefined,
        category_id: product.category_id ?? undefined,
      })
      setProducts(
        products.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
      )
      toast.success("Bestand aktualisiert")
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Aktualisieren des Bestands")
    }
  }

  const buildRentalPayload = (rental: Rental, overrides: Partial<RentalInput> = {}): RentalInput => ({
    title: overrides.title ?? rental.title,
    description: overrides.description ?? rental.description ?? undefined,
    price_per_day: overrides.price_per_day ?? rental.price_per_day,
    stock: overrides.stock ?? rental.stock,
    available: overrides.available ?? rental.available,
    city_id: overrides.city_id ?? ((rental as any).city_id ?? undefined),
    image_url: overrides.image_url ?? rental.image_url ?? undefined,
    category_id: overrides.category_id ?? (rental.category_id ?? undefined),
  })

  const handleQuickRentalStockUpdate = async (rentalId: number, newStock: number) => {
    try {
      const rental = rentals.find((r) => r.id === rentalId)
      if (!rental) return

      const sanitizedStock = Math.max(0, newStock)
      const payload = buildRentalPayload(rental, {
        stock: sanitizedStock,
        available: sanitizedStock > 0 ? rental.available : false,
      })

      const updated = await updateRental(rentalId, payload)
      setRentals((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      if (editingRental && editingRental.id === updated.id) {
        setEditingRental(updated)
        setRentalForm((prev) => ({
          ...prev,
          stock: updated.stock,
          available: updated.available,
        }))
      }
      toast.success("Verleihsbestand aktualisiert")
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Aktualisieren des Mietbestands")
    }
  }

  const handleQuickAvailabilityToggle = async (rentalId: number) => {
    try {
      const rental = rentals.find((r) => r.id === rentalId)
      if (!rental) return

      if (!rental.available && rental.stock <= 0) {
        toast.error("Fügen Sie Bestand hinzu, bevor Sie diese Verleih verfügbar machen")
        return
      }

      const payload = buildRentalPayload(rental, { available: !rental.available })
      const updated = await updateRental(rentalId, payload)
      setRentals((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      if (editingRental && editingRental.id === updated.id) {
        setEditingRental(updated)
        setRentalForm((prev) => ({
          ...prev,
          available: updated.available,
          stock: updated.stock,
        }))
      }
      toast.success("Verfügbarkeit aktualisiert")
    } catch (error: any) {
      toast.error(error?.message || "Fehler beim Aktualisieren der Verfügbarkeit")
    }
  }

  if (loading && products.length === 0 && rentals.length === 0) {
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

  if (user && user.role !== "seller") {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-sides py-8 sm:py-12">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Diese Seite ist nur für Verkäufer verfügbar. Bitte melden Sie sich mit einem Verkäuferkonto an.
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
                Hallo, {user?.name || "Verkäufer"}! Verwalten Sie Ihre Produkt und Verleih.
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
                      {activeTab === "products" && <Package className="h-4 w-4" />}
                      {activeTab === "rentals" && <Home className="h-4 w-4" />}
                      {activeTab === "orders" && <ShoppingCart className="h-4 w-4" />}
                      {activeTab === "reviews" && <MessageSquare className="h-4 w-4" />}
                      <span className="font-medium">
                        {activeTab === "overview" && "Übersicht"}
                        {activeTab === "products" && "Produkt"}
                        {activeTab === "rentals" && "Mieten"}
                        {activeTab === "orders" && "Bestellungen"}
                        {activeTab === "reviews" && "Bewertungen"}
                      </span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Übersicht</SelectItem>
                  <SelectItem value="products">Produkt</SelectItem>
                  <SelectItem value="rentals">Mieten</SelectItem>
                  <SelectItem value="orders">Bestellungen</SelectItem>
                  <SelectItem value="reviews">Bewertungen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desktop: Tabs */}
            <div className="hidden md:block mb-6">
              <TabsList className="grid w-full grid-cols-5 gap-1 h-auto p-1 bg-muted/50">
                <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Übersicht</span>
                </TabsTrigger>
                <TabsTrigger value="products" className="flex items-center gap-1.5 text-xs">
                  <Package className="h-3.5 w-3.5" />
                  <span>Produkt</span>
                </TabsTrigger>
                <TabsTrigger value="rentals" className="flex items-center gap-1.5 text-xs">
                  <Home className="h-3.5 w-3.5" />
                  <span>Mieten</span>
                </TabsTrigger>
                <TabsTrigger value="orders" className="flex items-center gap-1.5 text-xs">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>Bestellungen</span>
                </TabsTrigger>
                <TabsTrigger value="reviews" className="flex items-center gap-1.5 text-xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Bewertungen</span>
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
                      <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground leading-tight">Gesamtartikel</CardTitle>
                      <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Package className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-2.5 pb-2.5 sm:px-4 sm:pb-4">
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold leading-tight">{stats.total_products + stats.total_rentals}</div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight line-clamp-1">
                      {stats.total_products} Produkt, {stats.total_rentals} Verleih
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
                            Sie haben noch keine Bestellungen erhalten. Vervollständigen Sie Ihr Profil und fügen Sie Produkt/Verleih hinzu, um Kunden anzuziehen.
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
                                Bestellungen ansehen
                                <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-1" />
                              </Button>
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
                        {products.length === 0 && rentals.length === 0 && (
                          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100">Fügen Sie Ihren ersten Artikel hinzu</p>
                              <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300 mt-0.5 sm:mt-1 leading-tight">
                                Produkt und Verleih helfen Kunden, das zu finden, was sie brauchen. Fügen Sie Artikel hinzu, um Ihre Sichtbarkeit zu erhöhen.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveTab("products")}
                                className="mt-1.5 sm:mt-2 h-6 sm:h-7 text-[10px] sm:text-xs border-blue-500/30 hover:bg-blue-500/20 px-2"
                              >
                                Produkt hinzufügen
                                <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                        {products.length === 0 && rentals.length > 0 && (
                          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100">Produkt hinzufügen</p>
                              <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300 mt-0.5 sm:mt-1 leading-tight">
                                Erweitern Sie Ihren Katalog, indem Sie Produkt neben Ihren Verleih hinzufügen.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveTab("products")}
                                className="mt-1.5 sm:mt-2 h-6 sm:h-7 text-[10px] sm:text-xs border-blue-500/30 hover:bg-blue-500/20 px-2"
                              >
                                Produkt hinzufügen
                                <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                        {rentals.length === 0 && products.length > 0 && (
                          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Home className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100">Verleih hinzufügen</p>
                              <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300 mt-0.5 sm:mt-1 leading-tight">
                                Erweitern Sie Ihren Katalog, indem Sie Verleih neben Ihren Produktn hinzufügen.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveTab("rentals")}
                                className="mt-1.5 sm:mt-2 h-6 sm:h-7 text-[10px] sm:text-xs border-blue-500/30 hover:bg-blue-500/20 px-2"
                              >
                                Verleih hinzufügen
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
                          <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs sm:text-sm font-medium truncate">Produkte</span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold shrink-0 ml-2">{stats.total_products}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg border border-border/40 bg-muted/30">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs sm:text-sm font-medium truncate">Mieten</span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold shrink-0 ml-2">{stats.total_rentals}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg border border-border/40 bg-muted/30">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs sm:text-sm font-medium truncate">Gesamtbestellungen</span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold shrink-0 ml-2">{stats.total_orders}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg border border-border/40 bg-muted/30">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs sm:text-sm font-medium truncate">Bewertungen</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                          <span className="text-xs sm:text-sm font-bold">{stats.total_reviews}</span>
                          {stats.average_rating > 0 && (
                            <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                              {stats.average_rating.toFixed(1)}★
                            </Badge>
                          )}
                        </div>
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
                        <CardTitle className="text-sm sm:text-base lg:text-lg font-semibold truncate">Kürzliche Bestellungen</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("orders")}
                        className="text-[10px] sm:text-xs hover:bg-primary/10 hover:text-primary transition-colors h-6 sm:h-7 px-1.5 sm:px-2 shrink-0"
                      >
                        Alle ansehen
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
                                {order.product && (
                                  <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 shrink-0">
                                    {order.product.title}
                                  </Badge>
                                )}
                                {order.rental && (
                                  <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 shrink-0">
                                    {order.rental.title}
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
                              <span className="text-xs sm:text-sm font-semibold">€{order.amount.toFixed(2)}</span>
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
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Bewertungen werden hier angezeigt, sobald Kunden Ihre Artikel bewerten</p>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {reviews.slice(0, 5).map((review) => {
                          const order = orders.find(o => o.id === review.order_id)
                          return (
                            <div key={review.id} className="p-2 sm:p-3 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/50 transition-colors">
                              <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                  <div className="flex items-center shrink-0">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={cn(
                                          "h-2.5 w-2.5 sm:h-3 sm:w-3",
                                          i < review.rating
                                            ? "fill-yellow-400 text-yellow-400"
                                            : "fill-none text-muted-foreground/30"
                                        )}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-[10px] sm:text-xs font-medium truncate">{order?.buyer?.name || "Anonym"}</span>
                                </div>
                                <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
                                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: de })}
                                </span>
                              </div>
                              {review.text && (
                                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 leading-tight">{review.text}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Products Tab */}
            <TabsContent value="products" className="mt-0 space-y-4">
              <Card className="rounded-lg border border-border/40 shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4 sm:p-5 md:p-6">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg md:text-xl font-bold mb-1.5 sm:mb-2">
                      <Package className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                      <span className="truncate">Meine Produkt</span>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground/90 line-clamp-2 sm:line-clamp-none">
                      Verwalten Sie Ihren Produktkatalog und Bestand
                    </CardDescription>
                  </div>
                  {isMobile ? (
                    <Sheet
                      open={productDialogOpen}
                      onOpenChange={(open) => {
                        setProductDialogOpen(open)
                        if (!open) {
                          setEditingProduct(null)
                          setProductForm({
                            title: "",
                            description: "",
                            price: 0,
                            stock: 0,
                            image_url: "",
                            brand: "",
                            category_id: undefined,
                          })
                          setSelectedProductCategoryId(undefined)
                          setSelectedProductSubcategoryId(undefined)
                          setProductSubcategories([])
                        }
                      }}
                    >
                      <SheetTrigger asChild>
                        <Button size="default" className="w-full sm:w-auto shrink-0 text-sm sm:text-base">
                          <Plus className="h-4 w-4" />
                          Produkt hinzufügen
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0 gap-0">
                        <SheetHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b">
                          <SheetTitle className="text-lg sm:text-xl font-semibold">
                            {editingProduct ? "Produkt bearbeiten" : "Neues Produkt hinzufügen"}
                          </SheetTitle>
                          <SheetDescription className="text-sm text-muted-foreground">
                            {editingProduct
                              ? "Produktinformationen aktualisieren"
                              : "Fügen Sie ein neues Produkt zu Ihrem Katalog hinzu"}
                          </SheetDescription>
                        </SheetHeader>
                        <form
                          onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct}
                          className="flex flex-col flex-1 min-h-0"
                        >
                          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
                            <div className="space-y-4 sm:space-y-5">
                              <div className="space-y-2">
                                <Label htmlFor="product_title" className="text-sm font-medium">Titel *</Label>
                                <Input
                                  id="product_title"
                                  value={productForm.title}
                                  onChange={(e) =>
                                    setProductForm({ ...productForm, title: e.target.value })
                                  }
                                  placeholder="Professionelles Farbenset"
                                  required
                                  className="h-10"
                                />
                              </div>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Kategorie *</Label>
                                  <Select
                                    value={selectedProductCategoryId ? String(selectedProductCategoryId) : undefined}
                                    onValueChange={handleProductCategoryChange}
                                    required
                                  >
                                    <SelectTrigger className="w-full h-10">
                                      <SelectValue placeholder="Kategorie auswählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {productCategories.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                          {c.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {selectedProductCategoryId && productSubcategories.length > 0 && (
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Unterkategorie *</Label>
                                    <Select
                                      value={selectedProductSubcategoryId ? String(selectedProductSubcategoryId) : undefined}
                                      onValueChange={handleProductSubcategoryChange}
                                      required
                                    >
                                      <SelectTrigger className="w-full h-10">
                                        <SelectValue placeholder="Unterkategorie auswählen" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {productSubcategories.map((c) => (
                                          <SelectItem key={c.id} value={String(c.id)}>
                                            {c.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="product_description" className="text-sm font-medium">Beschreibung *</Label>
                              <Textarea
                                id="product_description"
                                value={productForm.description}
                                onChange={(e) =>
                                  setProductForm({ ...productForm, description: e.target.value })
                                }
                                placeholder="Beschreiben Sie Ihr Produkt..."
                                rows={3}
                                className="resize-none"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="product_price" className="text-sm font-medium">Preis (€) *</Label>
                                <Input
                                  id="product_price"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={productForm.price}
                                  onChange={(e) =>
                                    setProductForm({
                                      ...productForm,
                                      price: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  placeholder="89.99"
                                  required
                                  className="h-10"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="product_stock" className="text-sm font-medium">Bestand *</Label>
                                <Input
                                  id="product_stock"
                                  type="number"
                                  min="0"
                                  value={productForm.stock}
                                  onChange={(e) =>
                                    setProductForm({
                                      ...productForm,
                                      stock: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  placeholder="10"
                                  required
                                  className="h-10"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="product_brand" className="text-sm font-medium">Marke</Label>
                              <Input
                                id="product_brand"
                                value={productForm.brand}
                                onChange={(e) =>
                                  setProductForm({ ...productForm, brand: e.target.value })
                                }
                                placeholder="Markenname"
                                className="h-10"
                              />
                            </div>
                            <div className="space-y-2 border-t pt-4">
                              <Label className="text-sm font-medium">Bilder & Videos hochladen</Label>
                              <ProductRentalMediaUpload
                                productId={editingProduct?.id}
                                existingMedia={editingProduct?.media || []}
                                onUploadComplete={async () => {
                                  if (editingProduct) {
                                    // Reload product to get updated media
                                    const updated = await getMyProducts({ page: 1, page_size: 100 })
                                    const product = updated.items?.find((p) => p.id === editingProduct.id)
                                    if (product) {
                                      setEditingProduct(product)
                                      setProducts(
                                        products.map((p) => (p.id === product.id ? product : p))
                                      )
                                    }
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Stadt</Label>
                              <Select
                                value={productForm.city_id ? String(productForm.city_id) : ""}
                                onValueChange={(val) => {
                                  const id = val ? Number(val) : undefined
                                  setProductForm((prev) => ({ ...prev, city_id: id }))
                                }}
                              >
                                <SelectTrigger className="w-full h-10">
                                  <SelectValue placeholder="Stadt auswählen">
                                    {productForm.city_id ? cityIdToName.get(productForm.city_id) : "Stadt auswählen"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {cities.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <SheetFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/30 gap-2 sm:gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setProductDialogOpen(false)}
                              className="flex-1 sm:flex-initial"
                            >
                              Abbrechen
                            </Button>
                            <Button type="submit" disabled={loading} className="flex-1 sm:flex-initial">
                              {loading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  {editingProduct ? "Wird aktualisiert..." : "Wird erstellt..."}
                                </>
                              ) : editingProduct ? (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Produkt aktualisieren
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Produkt erstellen
                                </>
                              )}
                            </Button>
                          </SheetFooter>
                        </form>
                      </SheetContent>
                    </Sheet>
                  ) : (
                    <Dialog
                      open={productDialogOpen}
                      onOpenChange={(open) => {
                        setProductDialogOpen(open)
                        if (!open) {
                          setEditingProduct(null)
                          setProductForm({
                            title: "",
                            description: "",
                            price: 0,
                            stock: 0,
                            image_url: "",
                            brand: "",
                            category_id: undefined,
                          })
                          setSelectedProductCategoryId(undefined)
                          setSelectedProductSubcategoryId(undefined)
                          setProductSubcategories([])
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="default" className="w-full sm:w-auto shrink-0 text-sm sm:text-base">
                          <Plus className="h-4 w-4" />
                          Produkt hinzufügen
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            {editingProduct ? "Produkt bearbeiten" : "Neues Produkt hinzufügen"}
                          </DialogTitle>
                          <DialogDescription>
                            {editingProduct
                              ? "Produktinformationen aktualisieren"
                              : "Fügen Sie ein neues Produkt zu Ihrem Katalog hinzu"}
                          </DialogDescription>
                        </DialogHeader>
                        <form
                          onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct}
                          className="space-y-4"
                        >
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="product_title_desktop">Titel *</Label>
                              <Input
                                id="product_title_desktop"
                                value={productForm.title}
                                onChange={(e) =>
                                  setProductForm({ ...productForm, title: e.target.value })
                                }
                                placeholder="Professionelles Farbenset"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Kategorie *</Label>
                                <Select
                                  value={selectedProductCategoryId ? String(selectedProductCategoryId) : undefined}
                                  onValueChange={handleProductCategoryChange}
                                  required
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Kategorie auswählen" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {productCategories.map((c) => (
                                      <SelectItem key={c.id} value={String(c.id)}>
                                        {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {selectedProductCategoryId && productSubcategories.length > 0 && (
                                <div className="space-y-2">
                                  <Label>Unterkategorie *</Label>
                                  <Select
                                    value={selectedProductSubcategoryId ? String(selectedProductSubcategoryId) : undefined}
                                    onValueChange={handleProductSubcategoryChange}
                                    required
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Unterkategorie auswählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {productSubcategories.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                          {c.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="product_description_desktop">Beschreibung *</Label>
                            <Textarea
                              id="product_description_desktop"
                              value={productForm.description}
                              onChange={(e) =>
                                setProductForm({ ...productForm, description: e.target.value })
                              }
                              placeholder="Beschreiben Sie Ihr Produkt..."
                              rows={3}
                              required
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="product_price_desktop">Preis (€) *</Label>
                              <Input
                                id="product_price_desktop"
                                type="number"
                                min="0"
                                step="0.01"
                                value={productForm.price}
                                onChange={(e) =>
                                  setProductForm({
                                    ...productForm,
                                    price: parseFloat(e.target.value) || 0,
                                  })
                                }
                                placeholder="89.99"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="product_stock_desktop">Lagerbestand *</Label>
                              <Input
                                id="product_stock_desktop"
                                type="number"
                                min="0"
                                value={productForm.stock}
                                onChange={(e) =>
                                  setProductForm({
                                    ...productForm,
                                    stock: parseInt(e.target.value) || 0,
                                  })
                                }
                                placeholder="10"
                                required
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="product_brand_desktop">Marke</Label>
                            <Input
                              id="product_brand_desktop"
                              value={productForm.brand}
                              onChange={(e) =>
                                setProductForm({ ...productForm, brand: e.target.value })
                              }
                              placeholder="Markenname"
                            />
                          </div>
                          <div className="space-y-2 border-t pt-4">
                            <Label>Bilder und Videos hochladen</Label>
                            <ProductRentalMediaUpload
                              productId={editingProduct?.id}
                              existingMedia={editingProduct?.media || []}
                              onUploadComplete={async () => {
                                if (editingProduct) {
                                  // Reload product to get updated media
                                  const updated = await getMyProducts({ page: 1, page_size: 100 })
                                  const product = updated.items?.find((p) => p.id === editingProduct.id)
                                  if (product) {
                                    setEditingProduct(product)
                                    setProducts(
                                      products.map((p) => (p.id === product.id ? product : p))
                                    )
                                  }
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>City</Label>
                            <Select
                              value={productForm.city_id ? String(productForm.city_id) : ""}
                              onValueChange={(val) => {
                                const id = val ? Number(val) : undefined
                                setProductForm((prev) => ({ ...prev, city_id: id }))
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Stadt auswählen">
                                  {productForm.city_id ? cityIdToName.get(productForm.city_id) : "Stadt auswählen"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {cities.map((c) => (
                                  <SelectItem key={c.id} value={String(c.id)}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="submit" disabled={loading} className="w-full">
                            {loading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {editingProduct ? "Wird aktualisiert..." : "Wird erstellt..."}
                              </>
                            ) : editingProduct ? (
                              <>
                                <Save className="h-4 w-4" />
                                Produkt aktualisieren
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4" />
                                Produkt erstellen
                              </>
                            )}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
                  {products.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 text-muted-foreground">
                      <Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                      <p className="text-sm sm:text-base">Noch keine Produkt hinzugefügt</p>
                      <p className="text-xs sm:text-sm mt-1">Klicken Sie auf "Produkt hinzufügen", um zu beginnen</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                      {products.map((product) => (
                        <Card key={product.id} className="relative flex h-full flex-col overflow-hidden bg-white transition-all duration-200 border border-border/40 rounded-none shadow-sm hover:shadow-md">
                          <Link href={`/detailed/product/${product.id}`} className="block h-full group">
                            <div className="relative aspect-square overflow-hidden bg-muted/20">
                              <Image
                                src={product.image_url || "/placeholder.svg"}
                                alt={product.title}
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                              />
                            </div>
                          </Link>
                          <CardContent className="relative flex flex-1 flex-col gap-2 p-3">
                            <h3 className="truncate text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                              {product.title}
                            </h3>
                            {product.category && (
                              <Badge variant="outline" className="text-xs w-fit">
                                {product.category}
                              </Badge>
                            )}
                            {(product as any).city_name && (
                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{(product as any).city_name}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-base font-semibold text-foreground">{(product.price || 0).toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-2 border-t mt-auto">
                              <div className="flex items-center gap-1.5">
                                {isMobile ? (
                                  <Sheet>
                                    <SheetTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7 border-primary/20 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors rounded-full"
                                        title="Links verwalten"
                                      >
                                        <Link2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </SheetTrigger>
                                    <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
                                      <SheetHeader>
                                        <SheetTitle className="sr-only">Links verwalten</SheetTitle>
                                      </SheetHeader>
                                      <RelationshipManager
                                        sourceType="product"
                                        sourceId={product.id}
                                        sourceLabel={product.title}
                                      />
                                    </SheetContent>
                                  </Sheet>
                                ) : (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7 border-primary/20 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors rounded-full"
                                        title="Links verwalten"
                                      >
                                        <Link2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-3xl">
                                      <DialogTitle className="sr-only">Links verwalten</DialogTitle>
                                      <RelationshipManager
                                        sourceType="product"
                                        sourceId={product.id}
                                        sourceLabel={product.title}
                                      />
                                    </DialogContent>
                                  </Dialog>
                                )}
                                <span className="text-xs text-muted-foreground font-medium">
                                  {productLinkCounts[product.id] || 0} Links
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditProduct(product)}
                                  disabled={loading}
                                  className="h-7 w-7 rounded-full"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteProduct(product.id)}
                                  disabled={loading}
                                  className="h-7 w-7 text-destructive rounded-full"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rentals Tab */}
            <TabsContent value="rentals" className="mt-0 space-y-4">
              <Card className="rounded-lg border border-border/40 shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4 sm:p-5 md:p-6">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg md:text-xl font-bold mb-1.5 sm:mb-2">
                      <Wrench className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                      <span className="truncate">Meine Verleih</span>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground/90 line-clamp-2 sm:line-clamp-none">
                      Verwalten Sie Ihren Verleihskatalog und Verfügbarkeit
                    </CardDescription>
                  </div>
                  {isMobile ? (
                    <Sheet
                      open={rentalDialogOpen}
                      onOpenChange={(open) => {
                        setRentalDialogOpen(open)
                        if (!open) {
                          setEditingRental(null)
                          setRentalForm({
                            title: "",
                            description: "",
                            price_per_day: 0,
                            stock: 1,
                            available: true,
                            image_url: "",
                            category_id: undefined,
                          })
                          setSelectedRentalCategoryId(undefined)
                          setSelectedRentalSubcategoryId(undefined)
                          setRentalSubcategories([])
                        }
                      }}
                    >
                      <SheetTrigger asChild>
                        <Button size="default" className="w-full sm:w-auto shrink-0 text-sm sm:text-base">
                          <Plus className="h-4 w-4" />
                          Verleih hinzufügen
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0 gap-0">
                        <SheetHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b">
                          <SheetTitle className="text-lg sm:text-xl font-semibold">
                            {editingRental ? "Verleih bearbeiten" : "Neue Verleih hinzufügen"}
                          </SheetTitle>
                          <SheetDescription className="text-sm text-muted-foreground">
                            {editingRental
                              ? "Verleihsinformationen aktualisieren"
                              : "Fügen Sie eine neue Verleih zu Ihrem Katalog hinzu"}
                          </SheetDescription>
                        </SheetHeader>
                        <form
                          onSubmit={editingRental ? handleUpdateRental : handleCreateRental}
                          className="flex flex-col flex-1 min-h-0"
                        >
                          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
                            <div className="space-y-4 sm:space-y-5">
                              <div className="space-y-2">
                                <Label htmlFor="rental_title" className="text-sm font-medium">Titel *</Label>
                                <Input
                                  id="rental_title"
                                  value={rentalForm.title}
                                  onChange={(e) =>
                                    setRentalForm({ ...rentalForm, title: e.target.value })
                                  }
                                  placeholder="Scissor Lift 8m"
                                  required
                                  className="h-10"
                                />
                              </div>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Kategorie *</Label>
                                  <Select
                                    value={selectedRentalCategoryId ? String(selectedRentalCategoryId) : undefined}
                                    onValueChange={handleRentalCategoryChange}
                                    required
                                  >
                                    <SelectTrigger className="w-full h-10">
                                      <SelectValue placeholder="Kategorie auswählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {rentalCategories.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                          {c.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {selectedRentalCategoryId && rentalSubcategories.length > 0 && (
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Unterkategorie *</Label>
                                    <Select
                                      value={selectedRentalSubcategoryId ? String(selectedRentalSubcategoryId) : undefined}
                                      onValueChange={handleRentalSubcategoryChange}
                                      required
                                    >
                                      <SelectTrigger className="w-full h-10">
                                        <SelectValue placeholder="Unterkategorie auswählen" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {rentalSubcategories.map((c) => (
                                          <SelectItem key={c.id} value={String(c.id)}>
                                            {c.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rental_description" className="text-sm font-medium">Beschreibung *</Label>
                              <Textarea
                                id="rental_description"
                                value={rentalForm.description}
                                onChange={(e) =>
                                  setRentalForm({ ...rentalForm, description: e.target.value })
                                }
                                placeholder="Beschreiben Sie Ihre Mietausrüstung..."
                                rows={3}
                                className="resize-none"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="rental_price_per_day" className="text-sm font-medium">Preis pro Tag (€) *</Label>
                                <Input
                                  id="rental_price_per_day"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={rentalForm.price_per_day}
                                  onChange={(e) =>
                                    setRentalForm({
                                      ...rentalForm,
                                      price_per_day: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  placeholder="120.00"
                                  required
                                  className="h-10"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="rental_stock" className="text-sm font-medium">Bestand *</Label>
                                <Input
                                  id="rental_stock"
                                  type="number"
                                  min="0"
                                  value={rentalForm.stock}
                                  onChange={(e) => {
                                    const parsed = parseInt(e.target.value, 10)
                                    const clamped = Math.max(0, Number.isNaN(parsed) ? 0 : parsed)
                                    setRentalForm((prev) => ({
                                      ...prev,
                                      stock: clamped,
                                      available: clamped > 0 ? prev.available : false,
                                    }))
                                  }}
                                  placeholder="5"
                                  required
                                  className="h-10"
                                />
                                {rentalForm.stock <= 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Bestand hinzufügen, um diese Verleih als verfügbar zu markieren.
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Stadt</Label>
                              <Select
                                value={rentalForm.city_id ? String(rentalForm.city_id) : ""}
                                onValueChange={(val) => {
                                  const id = val ? Number(val) : undefined
                                  setRentalForm((prev) => ({ ...prev, city_id: id }))
                                }}
                              >
                                <SelectTrigger className="w-full h-10">
                                  <SelectValue placeholder="Stadt auswählen">
                                    {rentalForm.city_id ? cityIdToName.get(rentalForm.city_id) : "Stadt auswählen"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {cities.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="rental_available"
                                  checked={rentalForm.available && rentalForm.stock > 0}
                                  disabled={rentalForm.stock <= 0}
                                  onChange={(e) =>
                                    setRentalForm({
                                      ...rentalForm,
                                      available: rentalForm.stock > 0 ? e.target.checked : false,
                                    })
                                  }
                                  className="h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed disabled:opacity-70"
                                />
                                <Label htmlFor="rental_available" className="cursor-pointer text-sm font-medium">
                                  Zur Verleih verfügbar
                                </Label>
                              </div>
                              {rentalForm.stock <= 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Bestand hinzufügen, um diese Verleih zu aktivieren.
                                </p>
                              )}
                            </div>
                            <div className="space-y-2 border-t pt-4">
                              <Label className="text-sm font-medium">Bilder & Videos hochladen</Label>
                              <ProductRentalMediaUpload
                                rentalId={editingRental?.id}
                                existingMedia={editingRental?.media || []}
                                onUploadComplete={async () => {
                                  if (editingRental) {
                                    // Reload rental to get updated media
                                    const updated = await getMyRentals({ page: 1, page_size: 100 })
                                    const rental = updated.items?.find((r) => r.id === editingRental.id)
                                    if (rental) {
                                      setEditingRental(rental)
                                      setRentals(
                                        rentals.map((r) => (r.id === rental.id ? rental : r))
                                      )
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                          <SheetFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/30 gap-2 sm:gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setRentalDialogOpen(false)}
                              className="flex-1 sm:flex-initial"
                            >
                              Abbrechen
                            </Button>
                            <Button type="submit" disabled={loading} className="flex-1 sm:flex-initial">
                              {loading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  {editingRental ? "Wird aktualisiert..." : "Wird erstellt..."}
                                </>
                              ) : editingRental ? (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Verleih aktualisieren
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Verleih erstellen
                                </>
                              )}
                            </Button>
                          </SheetFooter>
                        </form>
                      </SheetContent>
                    </Sheet>
                  ) : (
                    <Dialog
                      open={rentalDialogOpen}
                      onOpenChange={(open) => {
                        setRentalDialogOpen(open)
                        if (!open) {
                          setEditingRental(null)
                          setRentalForm({
                            title: "",
                            description: "",
                            price_per_day: 0,
                            stock: 1,
                            available: true,
                            image_url: "",
                            category_id: undefined,
                          })
                          setSelectedRentalCategoryId(undefined)
                          setSelectedRentalSubcategoryId(undefined)
                          setRentalSubcategories([])
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="default" className="w-full sm:w-auto shrink-0 text-sm sm:text-base">
                          <Plus className="h-4 w-4" />
                          Verleih hinzufügen
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            {editingRental ? "Verleih bearbeiten" : "Neue Verleih hinzufügen"}
                          </DialogTitle>
                          <DialogDescription>
                            {editingRental
                              ? "Verleihsinformationen aktualisieren"
                              : "Fügen Sie eine neue Verleih zu Ihrem Katalog hinzu"}
                          </DialogDescription>
                        </DialogHeader>
                        <form
                          onSubmit={editingRental ? handleUpdateRental : handleCreateRental}
                          className="space-y-4"
                        >
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="rental_title_desktop">Titel *</Label>
                              <Input
                                id="rental_title_desktop"
                                value={rentalForm.title}
                                onChange={(e) =>
                                  setRentalForm({ ...rentalForm, title: e.target.value })
                                }
                                placeholder="Scissor Lift 8m"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Kategorie *</Label>
                                <Select
                                  value={selectedRentalCategoryId ? String(selectedRentalCategoryId) : undefined}
                                  onValueChange={handleRentalCategoryChange}
                                  required
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Kategorie auswählen" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rentalCategories.map((c) => (
                                      <SelectItem key={c.id} value={String(c.id)}>
                                        {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {selectedRentalCategoryId && rentalSubcategories.length > 0 && (
                                <div className="space-y-2">
                                  <Label>Unterkategorie *</Label>
                                  <Select
                                    value={selectedRentalSubcategoryId ? String(selectedRentalSubcategoryId) : undefined}
                                    onValueChange={handleRentalSubcategoryChange}
                                    required
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Unterkategorie auswählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {rentalSubcategories.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                          {c.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="rental_description_desktop">Beschreibung *</Label>
                            <Textarea
                              id="rental_description_desktop"
                              value={rentalForm.description}
                              onChange={(e) =>
                                setRentalForm({ ...rentalForm, description: e.target.value })
                              }
                              placeholder="Beschreiben Sie Ihre Verleihsausrüstung..."
                              rows={3}
                              required
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="rental_price_per_day_desktop">Preis pro Tag (€) *</Label>
                              <Input
                                id="rental_price_per_day_desktop"
                                type="number"
                                min="0"
                                step="0.01"
                                value={rentalForm.price_per_day}
                                onChange={(e) =>
                                  setRentalForm({
                                    ...rentalForm,
                                    price_per_day: parseFloat(e.target.value) || 0,
                                  })
                                }
                                placeholder="120.00"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rental_stock_desktop">Lagerbestand *</Label>
                              <Input
                                id="rental_stock_desktop"
                                type="number"
                                min="0"
                                value={rentalForm.stock}
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value, 10)
                                  const clamped = Math.max(0, Number.isNaN(parsed) ? 0 : parsed)
                                  setRentalForm((prev) => ({
                                    ...prev,
                                    stock: clamped,
                                    available: clamped > 0 ? prev.available : false,
                                  }))
                                }}
                                placeholder="5"
                                required
                              />
                              {rentalForm.stock <= 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Add stock to mark this rental as available.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Stadt</Label>
                            <Select
                              value={rentalForm.city_id ? String(rentalForm.city_id) : ""}
                              onValueChange={(val) => {
                                const id = val ? Number(val) : undefined
                                setRentalForm((prev) => ({ ...prev, city_id: id }))
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Stadt auswählen">
                                  {rentalForm.city_id ? cityIdToName.get(rentalForm.city_id) : "Stadt auswählen"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {cities.map((c) => (
                                  <SelectItem key={c.id} value={String(c.id)}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="rental_available_desktop"
                                checked={rentalForm.available && rentalForm.stock > 0}
                                disabled={rentalForm.stock <= 0}
                                onChange={(e) =>
                                  setRentalForm({
                                    ...rentalForm,
                                    available: rentalForm.stock > 0 ? e.target.checked : false,
                                  })
                                }
                                className="h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed disabled:opacity-70"
                              />
                              <Label htmlFor="rental_available_desktop" className="cursor-pointer">
                                Zur Verleih verfügbar
                              </Label>
                            </div>
                            {rentalForm.stock <= 0 && (
                              <p className="text-xs text-muted-foreground">
                                Add stock to enable this rental.
                              </p>
                            )}
                          </div>
                          <div className="space-y-2 border-t pt-4">
                            <Label>Bilder und Videos hochladen</Label>
                            <ProductRentalMediaUpload
                              rentalId={editingRental?.id}
                              existingMedia={editingRental?.media || []}
                              onUploadComplete={async () => {
                                if (editingRental) {
                                  // Reload rental to get updated media
                                  const updated = await getMyRentals({ page: 1, page_size: 100 })
                                  const rental = updated.items?.find((r) => r.id === editingRental.id)
                                  if (rental) {
                                    setEditingRental(rental)
                                    setRentals(
                                      rentals.map((r) => (r.id === rental.id ? rental : r))
                                    )
                                  }
                                }
                              }}
                            />
                          </div>
                          <Button type="submit" disabled={loading} className="w-full">
                            {loading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {editingRental ? "Wird aktualisiert..." : "Wird erstellt..."}
                              </>
                            ) : editingRental ? (
                              <>
                                <Save className="h-4 w-4" />
                                Verleih aktualisieren
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4" />
                                Verleih erstellen
                              </>
                            )}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
                  {rentals.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 text-muted-foreground">
                      <Wrench className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                      <p className="text-sm sm:text-base">Noch keine Verleih hinzugefügt</p>
                      <p className="text-xs sm:text-sm mt-1">Klicken Sie auf "Verleih hinzufügen", um zu beginnen</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                      {rentals.map((rental) => (
                        <Card key={rental.id} className="relative flex h-full flex-col overflow-hidden bg-white transition-all duration-200 border border-border/40 rounded-none shadow-sm hover:shadow-md">
                          <Link href={`/detailed/rental/${rental.id}`} className="block h-full group">
                            <div className="relative aspect-square overflow-hidden bg-muted/20">
                              <Image
                                src={rental.image_url || "/placeholder.svg"}
                                alt={rental.title}
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                              />
                              {rental.stock <= 0 && (
                                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 text-[11px] font-medium text-white/90">
                                  <span className="rounded-full border border-white/40 bg-black/30 px-2 py-1 uppercase tracking-wide backdrop-blur">
                                    Nicht vorrätig
                                  </span>
                                </div>
                              )}
                            </div>
                          </Link>
                          <CardContent className="relative flex flex-1 flex-col gap-2 p-3">
                            <h3 className="truncate text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                              {rental.title}
                            </h3>
                            {rental.category && (
                              <Badge variant="outline" className="text-xs w-fit">
                                {rental.category}
                              </Badge>
                            )}
                            {(rental as any).city_name && (
                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{(rental as any).city_name}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-base font-semibold text-foreground">
                                    {(rental.price_per_day || 0).toFixed(2)}
                                    <span className="text-xs font-normal text-muted-foreground">
                                      /Tag
                                    </span>
                                  </span>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-2 border-t mt-auto">
                              <div className="flex items-center gap-1.5">
                                {isMobile ? (
                                  <Sheet>
                                    <SheetTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7 border-primary/20 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors rounded-full"
                                        title="Links verwalten"
                                      >
                                        <Link2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </SheetTrigger>
                                    <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
                                      <SheetHeader>
                                        <SheetTitle className="sr-only">Links verwalten</SheetTitle>
                                      </SheetHeader>
                                      <RelationshipManager
                                        sourceType="rental"
                                        sourceId={rental.id}
                                        sourceLabel={rental.title}
                                      />
                                    </SheetContent>
                                  </Sheet>
                                ) : (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7 border-primary/20 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors rounded-full"
                                        title="Links verwalten"
                                      >
                                        <Link2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-3xl">
                                      <DialogTitle className="sr-only">Links verwalten</DialogTitle>
                                      <RelationshipManager
                                        sourceType="rental"
                                        sourceId={rental.id}
                                        sourceLabel={rental.title}
                                      />
                                    </DialogContent>
                                  </Dialog>
                                )}
                                <span className="text-xs text-muted-foreground font-medium">
                                  {rentalLinkCounts[rental.id] || 0} Links
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditRental(rental)}
                                  disabled={loading}
                                  className="h-7 w-7 rounded-full"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteRental(rental.id)}
                                  disabled={loading}
                                  className="h-7 w-7 text-destructive rounded-full"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
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
                        Ihre Produkt- und Verleihsbestellungen anzeigen und verwalten
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
                        {orderFilter !== "all" || searchQuery ? "Versuchen Sie, Ihre Filter anzupassen" : "Bestellungen werden hier angezeigt, wenn Kunden Ihre Produkt kaufen oder Ihre Artikel mieten"}
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
                                      onClick={async () => {
                                        if (!confirm("Sind Sie sicher, dass Sie diese Bestellung als abgeschlossen markieren möchten?")) return
                                        
                                        try {
                                          setCompletingOrderId(order.id)
                                          await completeOrder(order.id)
                                          toast.success("Bestellung als abgeschlossen markiert")
                                          loadData()
                                        } catch (error: any) {
                                          toast.error(error?.message || "Fehler beim Abschließen der Bestellung")
                                        } finally {
                                          setCompletingOrderId(null)
                                        }
                                      }}
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
                                      onClick={async () => {
                                        if (!confirm("Sind Sie sicher, dass Sie diese Bestellung als abgeschlossen markieren möchten?")) return
                                        
                                        try {
                                          setCompletingOrderId(order.id)
                                          await completeOrder(order.id)
                                          toast.success("Bestellung als abgeschlossen markiert")
                                          loadData()
                                        } catch (error: any) {
                                          toast.error(error?.message || "Fehler beim Abschließen der Bestellung")
                                        } finally {
                                          setCompletingOrderId(null)
                                        }
                                      }}
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
                      <p className="text-[10px] sm:text-xs">Bewertungen werden hier angezeigt, sobald Kunden Ihre Produkt oder Verleih bewerten</p>
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
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  )
}

