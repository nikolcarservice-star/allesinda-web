"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useCart } from "@/lib/context/cart-context"
import { useAuth } from "@/lib/context/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, Package, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"

export default function CartPage() {
  const { user } = useAuth()
  const { items, removeItem, updateQuantity, clearCart, getTotalItems, getTotalPrice } = useCart()
  const router = useRouter()

  const totalItems = getTotalItems()
  const totalPrice = getTotalPrice()

  const handleCheckout = () => {
    if (items.length === 0) return

    // Check if user is logged in
    if (!user) {
      toast.error("Bitte melden Sie sich zuerst an, um zur Kasse zu gehen", {
        action: {
          label: "Anmelden",
          onClick: () => router.push("/login"),
        },
      })
      return
    }
    
    const target = items[0]
    const checkoutPath =
      target.product.itemType === "rental"
        ? `/booking/rental/${target.product.id}?quantity=${target.quantity}`
        : `/booking/product/${target.product.id}?quantity=${target.quantity}`
    router.push(checkoutPath)
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-background flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center"
          >
            <div className="relative">
              <ShoppingCart className="h-20 w-20 text-muted-foreground/40" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground/60" />
              </div>
            </div>
          </motion.div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Ihr Warenkorb ist leer</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Beginnen Sie, Produkt zu Ihrem Warenkorb hinzuzufügen, um sie hier zu sehen
            </p>
          </div>
          <Button asChild size="lg" className="gap-2">
            <Link href="/?types=product">
              Produkt durchsuchen
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-sides py-4 sm:py-6 md:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between gap-2 sm:gap-4 mb-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Warenkorb</h1>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-0.5 sm:mt-1">
                {totalItems} {totalItems === 1 ? "Artikel" : "Artikel"}
              </p>
            </div>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-muted-foreground hover:text-destructive shrink-0 h-8 sm:h-9"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline ml-1">Alle löschen</span>
              </Button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            <AnimatePresence mode="popLayout">
              {items.map((item, index) => (
                <motion.div
                  key={item.product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-3 sm:p-4 md:p-5">
                      <div className="flex gap-2.5 sm:gap-3 md:gap-4">
                        {/* Product Image */}
                        <Link
                          href={`/detailed/${item.product.itemType}/${item.product.id}`}
                          className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 flex-shrink-0 rounded-md sm:rounded-lg overflow-hidden bg-muted border border-border/50 group"
                        >
                          <Image
                            src={getOptimizedImageUrl(item.product.image_url, 'thumbnail') || "/placeholder.svg"}
                            alt={item.product.title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, 96px"
                            unoptimized={shouldUseUnoptimized(getOptimizedImageUrl(item.product.image_url, 'thumbnail'))}
                          />
                        </Link>

                        {/* Product Info */}
                        <div className="flex-1 flex flex-col gap-2 sm:gap-3 min-w-0">
                          {/* Title and Remove */}
                          <div className="flex items-start justify-between gap-2">
                            <Link 
                              href={`/detailed/${item.product.itemType}/${item.product.id}`}
                              className="flex-1 min-w-0 group pr-1"
                            >
                              <h3 className="font-semibold text-xs sm:text-sm md:text-base lg:text-lg line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                                {item.product.title}
                              </h3>
                              {(() => {
                                const supporting =
                                  item.product.brand ??
                                  (item.product.itemType === "rental"
                                    ? item.product.category ?? "Mietausrüstung"
                                    : item.product.category)
                                if (!supporting) return null
                                return (
                                  <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mt-0.5 line-clamp-1">
                                    {supporting}
                                  </p>
                                )
                              })()}
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 shrink-0 text-muted-foreground hover:text-destructive -mt-1 -mr-1"
                              onClick={() => removeItem(item.product.id)}
                              aria-label="Element entfernen"
                            >
                              <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                            </Button>
                          </div>

                          {/* Quantity and Price - Stack on mobile */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 md:gap-4">
                            {/* Quantity Controls */}
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 sm:h-8 sm:w-8 rounded-md"
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              </Button>
                              <div className="w-8 sm:w-10 text-center">
                                <span className="text-xs sm:text-sm md:text-base font-semibold">{item.quantity}</span>
                              </div>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 sm:h-8 sm:w-8 rounded-md"
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                disabled={item.quantity >= item.product.stock}
                              >
                                <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              </Button>
                            </div>

                            {/* Price */}
                            <div className="text-left sm:text-right">
                              <p className="font-bold text-sm sm:text-base md:text-lg lg:text-xl">
                                €{(item.product.price * item.quantity).toFixed(2)}
                                {item.product.itemType === "rental" ? <span className="text-xs font-semibold"> / Tag</span> : null}
                              </p>
                              {item.quantity > 1 && (
                                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">
                                  €{item.product.price.toFixed(2)} je Stück
                                  {item.product.itemType === "rental" ? " / Tag" : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Continue Shopping - Full width on mobile */}
            <div className="pt-1 sm:pt-2">
              <Button
                variant="outline"
                className="w-full h-11 sm:h-12 text-sm sm:text-base"
                size="lg"
                asChild
              >
                <Link href="/?types=product">
                  <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                  Weiter einkaufen
                </Link>
              </Button>
            </div>
          </div>

          {/* Order Summary - Sticky on desktop, full width on mobile */}
          <div className="lg:col-span-1">
            <Card className="border-border/50 shadow-sm lg:sticky lg:top-4">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg md:text-xl">Bestellübersicht</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {/* Summary Items */}
                <div className="space-y-2 sm:space-y-2.5">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-muted-foreground">Zwischensumme</span>
                    <span className="font-medium">€{totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-muted-foreground">Versand</span>
                    <span className="font-medium text-[10px] sm:text-xs">Wird an der Kasse berechnet</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-muted-foreground">Steuer</span>
                    <span className="font-medium text-[10px] sm:text-xs">Wird an der Kasse berechnet</span>
                  </div>
                </div>

                <Separator />

                {/* Total */}
                <div className="flex justify-between items-center">
                  <span className="text-sm sm:text-base md:text-lg font-semibold">Gesamt</span>
                  <span className="text-lg sm:text-xl md:text-2xl font-bold">€{totalPrice.toFixed(2)}</span>
                </div>

                {/* Checkout Button */}
                <div className="pt-1 sm:pt-2 space-y-2">
                  {items.length === 1 ? (
                    <Button
                      className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold"
                      size="lg"
                      onClick={handleCheckout}
                    >
                      Zur Kasse
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Badge variant="secondary" className="w-full justify-center py-1.5 text-[10px] sm:text-xs">
                        {items.length} Artikel - Einzeln zur Kasse
                      </Badge>
                      <Button
                        variant="outline"
                        className="w-full h-11 sm:h-12 text-sm sm:text-base"
                        size="lg"
                        onClick={() => handleCheckout()}
                      >
                        Erster Artikel zur Kasse
                      </Button>
                    </div>
                  )}
                </div>

                {/* Security Badge */}
                <div className="pt-1 sm:pt-2 border-t">
                  <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
                    🔒 Sichere Kasse • Kostenlose Rücksendungen
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
