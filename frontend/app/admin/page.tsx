"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Package, Wrench, Shield, Image as ImageIcon, Calendar, Tag, Star, ShoppingCart, TrendingUp, MessageSquare, Briefcase, ChevronDown, CheckCircle2, XCircle, BarChart3 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { getAdminOverview } from "@/lib/api/admin"
import { useAuth } from "@/lib/context/auth-context"
// Media moderation tab removed - all media is automatically approved
import { CategoriesTable } from "@/components/admin/categories-table"
import { MastersTable } from "@/components/admin/masters-table"
import { ServicesTable } from "@/components/admin/services-table"
import { ProductsTable } from "@/components/admin/products-table"
import { RentalsTable } from "@/components/admin/rentals-table"
import { BookingsTable } from "@/components/admin/bookings-table"
import { FeaturedManager } from "@/components/admin/featured-manager"
import { UsersTable } from "@/components/admin/users-table"
import { ReviewsTable } from "@/components/admin/reviews-table"

export default function AdminPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [overview, setOverview] = useState<{
    total_users: number;
    total_masters: number;
    total_sellers: number;
    total_clients: number;
    media_pending: number;
    media_approved?: number;
    media_rejected?: number;
    profiles_unverified: number;
    profiles_verified?: number;
    total_products: number;
    products_approved?: number;
    products_unapproved?: number;
    total_rentals: number;
    rentals_approved?: number;
    rentals_unapproved?: number;
    total_orders: number;
    total_orders_pending: number;
    total_orders_completed: number;
    total_orders_canceled?: number;
    total_services?: number;
    services_approved?: number;
    total_services_unapproved?: number;
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAdminOverview()
      setOverview(data)
    } catch (error: any) {
      // Only log error if it's not a 401 (authentication error)
      // 401 errors are handled by the auth check above
      if (error.status !== 401) {
        console.error("Failed to load overview:", error)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Check authentication and admin role
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        // Not authenticated - redirect to login
        router.push("/login")
        return
      }
      if (user.role !== "admin") {
        // Not admin - redirect to home
        router.push("/")
        return
      }
      // User is authenticated and is admin - load overview
      loadOverview()
    }
  }, [user, authLoading, router, loadOverview])

  const stats = [
    {
      metric: "Benutzerkonten",
      icon: Users,
      all: overview?.total_users || 0,
      approved: overview?.total_users || 0,
      rejected: 0,
      description: "Gesamtzahl der registrierten Benutzer im System",
      badge: null,
    },
    {
      metric: "Meister-Profile",
      icon: Shield,
      all: overview?.total_masters || 0,
      approved: overview?.profiles_verified || 0,
      rejected: (overview?.total_masters || 0) - (overview?.profiles_verified || 0),
      description: "Dienstleister-Profile",
      badge: overview?.profiles_unverified ? { label: `${overview.profiles_unverified} ausstehend`, variant: "secondary" as const } : null,
    },
    {
      metric: "Medieninhalte",
      icon: ImageIcon,
      all: (overview?.media_pending || 0) + (overview?.media_approved || 0) + (overview?.media_rejected || 0),
      approved: overview?.media_approved || 0,
      rejected: overview?.media_rejected || 0,
      description: "Von Benutzern hochgeladene Fotos und Videos",
      badge: overview?.media_pending ? { label: `${overview.media_pending} ausstehend`, variant: "secondary" as const } : null,
    },
    {
      metric: "Service",
      icon: Briefcase,
      all: overview?.total_services || 0,
      approved: overview?.services_approved || 0,
      rejected: overview?.total_services_unapproved || 0,
      description: "Von Meistern angebotene Service",
      badge: overview?.total_services_unapproved ? { label: `${overview.total_services_unapproved} ausstehend`, variant: "secondary" as const } : null,
    },
    {
      metric: "Produkte",
      icon: Package,
      all: overview?.total_products || 0,
      approved: overview?.products_approved || 0,
      rejected: overview?.products_unapproved || 0,
      description: "Von Verkäufern gelistete Produkte",
      badge: overview?.products_unapproved ? { label: `${overview.products_unapproved} ausstehend`, variant: "secondary" as const } : null,
    },
    {
      metric: "Verleih",
      icon: Wrench,
      all: overview?.total_rentals || 0,
      approved: overview?.rentals_approved || 0,
      rejected: overview?.rentals_unapproved || 0,
      description: "Ausrüstung und Gegenstände zum Verleih",
      badge: overview?.rentals_unapproved ? { label: `${overview.rentals_unapproved} ausstehend`, variant: "secondary" as const } : null,
    },
    {
      metric: "Bestellungen",
      icon: ShoppingCart,
      all: overview?.total_orders || 0,
      approved: overview?.total_orders_completed || 0,
      rejected: overview?.total_orders_canceled || 0,
      description: "Gesamtzahl der Buchungen und Transaktionen",
      badge: overview?.total_orders_pending ? { label: `${overview.total_orders_pending} ausstehend`, variant: "secondary" as const } : null,
    },
    {
      metric: "Verkäufer",
      icon: Users,
      all: overview?.total_sellers || 0,
      approved: overview?.total_sellers || 0,
      rejected: 0,
      description: "Benutzer, die Produkte oder Verleih anbieten",
      badge: null,
    },
    {
      metric: "Kunden",
      icon: Users,
      all: overview?.total_clients || 0,
      approved: overview?.total_clients || 0,
      rejected: 0,
      description: "Reguläre Kunden und Käufer",
      badge: null,
    },
  ]

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Don't render if not authenticated or not admin (will redirect)
  if (!user || user.role !== "admin") {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-sides py-3 sm:py-4 md:py-6 lg:py-8">
        {/* Compact Header */}
        <div className="mb-3 sm:mb-4 md:mb-6">
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight mb-1">
            Mein Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Verwalten Sie Ihren Marktplatz</p>
        </div>

        {/* Modern Management Tabs - Dropdown on mobile, tabs on desktop */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Mobile: Dropdown */}
          <div className="block md:hidden mb-3 sm:mb-4">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full h-9 text-sm border-border/40">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {activeTab === "overview" && <BarChart3 className="h-4 w-4" />}
                    {activeTab === "categories" && <Tag className="h-4 w-4" />}
                    {activeTab === "masters" && <Shield className="h-4 w-4" />}
                    {activeTab === "services" && <Briefcase className="h-4 w-4" />}
                    {activeTab === "products" && <Package className="h-4 w-4" />}
                    {activeTab === "rentals" && <Wrench className="h-4 w-4" />}
                    {activeTab === "bookings" && <Calendar className="h-4 w-4" />}
                    {activeTab === "featured" && <Star className="h-4 w-4" />}
                    {activeTab === "users" && <Users className="h-4 w-4" />}
                    {activeTab === "reviews" && <MessageSquare className="h-4 w-4" />}
                    <span className="font-medium">
                      {activeTab === "overview" && "Übersicht"}
                      {activeTab === "categories" && "Kategorien"}
                      {activeTab === "masters" && "Profile"}
                      {activeTab === "services" && "Service"}
                      {activeTab === "products" && "Produkte"}
                      {activeTab === "rentals" && "Verleih"}
                      {activeTab === "bookings" && "Buchungen"}
                      {activeTab === "featured" && "Empfohlen"}
                      {activeTab === "users" && "Benutzer"}
                      {activeTab === "reviews" && "Bewertungen"}
                    </span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Übersicht</span>
                  </div>
                </SelectItem>
                <SelectItem value="categories">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    <span>Kategorien</span>
                  </div>
                </SelectItem>
                <SelectItem value="masters">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Profile</span>
                  </div>
                </SelectItem>
                <SelectItem value="services">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    <span>Service</span>
                  </div>
                </SelectItem>
                <SelectItem value="products">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span>Produkte</span>
                  </div>
                </SelectItem>
                <SelectItem value="rentals">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    <span>Verleih</span>
                  </div>
                </SelectItem>
                <SelectItem value="bookings">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Buchungen</span>
                  </div>
                </SelectItem>
                <SelectItem value="featured">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    <span>Empfohlen</span>
                  </div>
                </SelectItem>
                <SelectItem value="users">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Benutzer</span>
                  </div>
                </SelectItem>
                <SelectItem value="reviews">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Bewertungen</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Desktop: Modern Tabs */}
          <div className="hidden md:block mb-3 sm:mb-4 md:mb-6">
            <TabsList variant="modern" className="w-full grid grid-cols-10 gap-1 overflow-x-auto">
              <TabsTrigger value="overview" variant="modern" className="flex items-center justify-center gap-1.5">
                <BarChart3 />
                <span className="hidden xl:inline">Übersicht</span>
              </TabsTrigger>
              <TabsTrigger value="categories" variant="modern" className="flex items-center justify-center gap-1.5">
                <Tag />
                <span className="hidden xl:inline">Kategorien</span>
              </TabsTrigger>
              <TabsTrigger value="masters" variant="modern" className="flex items-center justify-center gap-1.5">
                <Shield />
                <span className="hidden xl:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="services" variant="modern" className="flex items-center justify-center gap-1.5">
                <Briefcase />
                <span className="hidden xl:inline">Service</span>
              </TabsTrigger>
              <TabsTrigger value="products" variant="modern" className="flex items-center justify-center gap-1.5">
                <Package />
                <span className="hidden xl:inline">Produkte</span>
              </TabsTrigger>
              <TabsTrigger value="rentals" variant="modern" className="flex items-center justify-center gap-1.5">
                <Wrench />
                <span className="hidden xl:inline">Verleih</span>
              </TabsTrigger>
              <TabsTrigger value="bookings" variant="modern" className="flex items-center justify-center gap-1.5">
                <Calendar />
                <span className="hidden xl:inline">Buchungen</span>
              </TabsTrigger>
              <TabsTrigger value="featured" variant="modern" className="flex items-center justify-center gap-1.5">
                <Star />
                <span className="hidden xl:inline">Empfohlen</span>
              </TabsTrigger>
              <TabsTrigger value="users" variant="modern" className="flex items-center justify-center gap-1.5">
                <Users />
                <span className="hidden xl:inline">Benutzer</span>
              </TabsTrigger>
              <TabsTrigger value="reviews" variant="modern" className="flex items-center justify-center gap-1.5">
                <MessageSquare />
                <span className="hidden xl:inline">Bewertungen</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0">
            <Card className="border border-border/40 shadow-sm">
              <CardHeader className="p-3 sm:p-4 space-y-3">
                <div className="space-y-0.5">
                  <CardTitle className="text-base sm:text-lg font-semibold">Übersichtsstatistiken</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Umfassende Statistiken zu allen Marktplatz-Inhalten und Aktivitäten
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-3 sm:pt-0 sm:pb-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8 sm:py-10 px-3 sm:px-4">
                    <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="block sm:hidden space-y-2 px-3">
                      {stats.map((stat) => {
                        const Icon = stat.icon
                        return (
                          <Card key={stat.metric} className="border border-border/40 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary shrink-0">
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-sm truncate">{stat.metric}</p>
                                    {stat.badge && (
                                      <Badge variant={stat.badge.variant} className="text-[10px] px-2 py-0.5 shrink-0 whitespace-nowrap">
                                        {stat.badge.label}
                                      </Badge>
                                    )}
                                  </div>
                                  {stat.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 truncate">{stat.description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                              <div className="flex flex-col items-center flex-1">
                                <span className="text-[10px] text-muted-foreground">Alle</span>
                                <span className="text-base font-bold mt-0.5">{stat.all}</span>
                              </div>
                              <div className="flex flex-col items-center flex-1">
                                <span className="text-[10px] text-muted-foreground">Genehmigt</span>
                                <span className="text-base font-semibold text-green-600 mt-0.5">{stat.approved}</span>
                              </div>
                              <div className="flex flex-col items-center flex-1">
                                <span className="text-[10px] text-muted-foreground">Abgelehnt</span>
                                <span className="text-base font-semibold text-red-600 mt-0.5">{stat.rejected}</span>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden sm:block px-3 sm:px-4">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="text-xs sm:text-sm h-9 min-w-[200px]">Metrik</TableHead>
                            <TableHead className="text-right text-xs sm:text-sm h-9 w-24">Alle</TableHead>
                            <TableHead className="text-right text-xs sm:text-sm h-9 w-24">Genehmigt</TableHead>
                            <TableHead className="text-right text-xs sm:text-sm h-9 w-24">Abgelehnt</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.map((stat) => {
                            const Icon = stat.icon
                            return (
                              <TableRow key={stat.metric} className="h-auto">
                                <TableCell className="py-2">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary shrink-0">
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-xs sm:text-sm truncate">{stat.metric}</span>
                                        {stat.badge && (
                                          <Badge variant={stat.badge.variant} className="text-[10px] px-1.5 py-0 shrink-0 whitespace-nowrap">
                                            {stat.badge.label}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{stat.description}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right py-2">
                                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">{stat.all}</span>
                                </TableCell>
                                <TableCell className="text-right py-2">
                                  <span className="text-xs sm:text-sm font-semibold text-green-600 whitespace-nowrap">{stat.approved}</span>
                                </TableCell>
                                <TableCell className="text-right py-2">
                                  <span className="text-xs sm:text-sm font-semibold text-red-600 whitespace-nowrap">{stat.rejected}</span>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="mt-0">
            <CategoriesTable />
          </TabsContent>
          <TabsContent value="masters" className="mt-0">
            <MastersTable />
          </TabsContent>
          <TabsContent value="services" className="mt-0">
            <ServicesTable />
          </TabsContent>
          <TabsContent value="products" className="mt-0">
            <ProductsTable />
          </TabsContent>
          <TabsContent value="rentals" className="mt-0">
            <RentalsTable />
          </TabsContent>
          <TabsContent value="bookings" className="mt-0">
            <BookingsTable />
          </TabsContent>
          <TabsContent value="featured" className="mt-0">
            <FeaturedManager />
          </TabsContent>
          <TabsContent value="users" className="mt-0">
            <UsersTable />
          </TabsContent>
          <TabsContent value="reviews" className="mt-0">
            <ReviewsTable />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
