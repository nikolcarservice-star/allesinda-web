"use client"

import { useState, useRef, type ReactNode } from "react"
import { ShoppingCart, Plus, Minus, Trash2, ArrowRight, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useCart } from "@/lib/context/cart-context"
import Image from "next/image"
import Link from "next/link"
import { getOptimizedImageUrl, shouldUseUnoptimized } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "motion/react"

type AllesindaCartModalProps = {
  triggerClassName?: string
  iconClassName?: string
  renderTrigger?: (props: { onClick: () => void; totalItems: number }) => ReactNode
}

export function AllesindaCartModal({
  triggerClassName,
  iconClassName,
  renderTrigger,
}: AllesindaCartModalProps = {}) {
  const { items, removeItem, updateQuantity, getTotalItems, getTotalPrice } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const isOpeningRef = useRef(false)

  const totalItems = getTotalItems()
  const totalPrice = getTotalPrice()

  // Close modal when clicking outside or on link
  const handleClose = () => {
    isOpeningRef.current = false
    setIsOpen(false)
  }
  const handleOpen = () => {
    isOpeningRef.current = true
    setIsOpen(true)
    // Reset opening flag after a short delay
    setTimeout(() => {
      isOpeningRef.current = false
    }, 300)
  }

  const trigger = renderTrigger ? (
    renderTrigger({ onClick: handleOpen, totalItems })
  ) : (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "relative h-9 w-9 sm:h-10 sm:w-10 hover:bg-primary/10 hover:text-primary rounded-md",
        triggerClassName
      )}
      onClick={handleOpen}
      aria-label="Warenkorb öffnen"
    >
      <ShoppingCart className={cn("h-4 w-4 sm:h-5 sm:w-5", iconClassName)} />
      {totalItems > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] sm:text-xs font-bold"
        >
          {totalItems > 9 ? "9+" : totalItems}
        </Badge>
      )}
    </Button>
  )

  return (
    <>
      {trigger}

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          side="right" 
          className={cn(
            "w-full sm:w-full sm:max-w-md flex flex-col p-0 gap-0 z-[60]",
            // Position close button at right edge and center icon
            "pt-0",
            "[&>button]:top-4 [&>button]:right-2 sm:[&>button]:right-3 md:[&>button]:right-4 [&>button]:flex [&>button]:items-center [&>button]:justify-center"
          )}
          onInteractOutside={(e) => {
            // Prevent closing when cart is just opening or when interacting with mobile menu
            if (isOpeningRef.current) {
              e.preventDefault()
              return
            }
            const target = e.target as HTMLElement
            // Prevent closing when clicking on mobile menu sheet
            if (target?.closest('[data-slot="sheet-content"]')) {
              const sheetContent = target.closest('[data-slot="sheet-content"]') as HTMLElement
              // If it's the mobile menu (left side) or another sheet, prevent closing
              if (sheetContent && sheetContent.getAttribute('data-state') !== 'open') {
                e.preventDefault()
              }
            }
          }}
        >
          {/* Header */}
          <SheetHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b relative">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-2">
                <SheetTitle className="text-xl sm:text-2xl font-bold">Warenkorb</SheetTitle>
                <SheetDescription className="mt-1.5 text-xs sm:text-sm">
                  {totalItems === 0
                    ? "Ihr Warenkorb ist leer"
                    : `${totalItems} ${totalItems === 1 ? "Artikel" : "Artikel"} in Ihrem Warenkorb`}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Content */}
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 px-4 sm:px-6 py-12 sm:py-16">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <ShoppingCart className="h-20 w-20 sm:h-24 sm:w-24 text-muted-foreground/30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50" />
                </div>
              </motion.div>
              <div className="text-center space-y-2">
                <h3 className="text-lg sm:text-xl font-semibold">Ihr Warenkorb ist leer</h3>
                <p className="text-sm sm:text-base text-muted-foreground max-w-sm">
                  Beginnen Sie, Produkt zu Ihrem Warenkorb hinzuzufügen
                </p>
              </div>
              <Button onClick={handleClose} asChild size="lg" className="mt-2">
                <Link href="/?types=product">
                  Produkt durchsuchen
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Scrollable Items */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">
                <AnimatePresence mode="popLayout">
                  {items.map((item, index) => (
                    <motion.div
                      key={item.product.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <CartItemCard
                        item={item}
                        onRemove={() => removeItem(item.product.id)}
                        onUpdateQuantity={(quantity) => updateQuantity(item.product.id, quantity)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Fixed Footer */}
              <div className="border-t bg-background px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4">
                {/* Total */}
                <div className="flex justify-between items-center">
                  <span className="text-base sm:text-lg font-semibold">Gesamt</span>
                  <span className="text-lg sm:text-xl font-bold">€{totalPrice.toFixed(2)}</span>
                </div>

                {/* CTA Button */}
                <Button
                  className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold"
                  size="lg"
                  onClick={handleClose}
                  asChild
                >
                  <Link href="/cart">
                    Vollständigen Warenkorb anzeigen
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function CartItemCard({
  item,
  onRemove,
  onUpdateQuantity,
}: {
  item: { product: any; quantity: number }
  onRemove: () => void
  onUpdateQuantity: (quantity: number) => void
}) {
  const imageUrl = getOptimizedImageUrl(item.product.image_url, 'thumbnail') || "/placeholder.svg"
  const isService = item.product.itemType === "master"
  const canAddMore = !isService && item.quantity < item.product.stock

  return (
    <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
      {/* Product Image */}
      <Link
        href={`/detailed/${isService ? "master" : "product"}/${item.product.id}`}
        className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-md overflow-hidden bg-background border border-border/50 group"
        onClick={(e) => {
          // Close modal when clicking product
          e.stopPropagation()
        }}
      >
        <Image
          src={imageUrl}
          alt={item.product.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 64px, 80px"
          unoptimized={shouldUseUnoptimized(imageUrl)}
        />
      </Link>

      {/* Product Info */}
      <div className="flex-1 flex flex-col gap-2 sm:gap-2.5 min-w-0">
        {/* Title and Remove */}
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/detailed/${isService ? "master" : "product"}/${item.product.id}`}
            className="flex-1 min-w-0 group"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-semibold text-xs sm:text-sm md:text-base line-clamp-2 group-hover:text-primary transition-colors leading-tight">
              {item.product.title}
            </h4>
            {item.product.brand && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {item.product.brand}
              </p>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={onRemove}
            aria-label="Element entfernen"
          >
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {/* Quantity and Price */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Quantity Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-md"
              onClick={() => onUpdateQuantity(item.quantity - 1)}
              disabled={item.quantity <= 1 || isService}
            >
              <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Button>
            <div className="w-7 sm:w-8 text-center">
              <span className="text-xs sm:text-sm font-semibold">{item.quantity}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-md"
              onClick={() => onUpdateQuantity(item.quantity + 1)}
              disabled={!canAddMore || isService}
            >
              <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Button>
          </div>

          {/* Price */}
          <div className="text-right">
            <p className="font-bold text-sm sm:text-base md:text-lg">
              €{(item.product.price * item.quantity).toFixed(2)}
            </p>
            {item.quantity > 1 && !isService && (
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                €{item.product.price.toFixed(2)} pro Stück
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
