"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ShoppingCart, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart, type CartProduct } from "@/lib/context/cart-context"
import { useAuth } from "@/lib/context/auth-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { CategoryType } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface DetailedAddToCartButtonProps {
  product: CartProduct
  available: boolean
  stock: number
  type: CategoryType
  className?: string
  variant?: "solid" | "outline"
}

export function DetailedAddToCartButton({
  product,
  available,
  stock,
  type,
  className,
  variant = "solid",
}: DetailedAddToCartButtonProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { items, addItem } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const resetTimerRef = useRef<number | null>(null)

  const currentQuantity = useMemo(
    () => items.find((item) => item.product.id === product.id)?.quantity ?? 0,
    [items, product.id],
  )

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const isOutOfStock = !available || stock <= 0
  const remaining = Math.max(stock - currentQuantity, 0)
  const hasReachedLimit = !isOutOfStock && remaining === 0

  const handleClick = () => {
    if (isOutOfStock || hasReachedLimit) return

    addItem(product)
    setJustAdded(true)
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current)
    }
    resetTimerRef.current = window.setTimeout(() => setJustAdded(false), 1200)
  }

  const mainLabel = (() => {
    if (isOutOfStock) return "Nicht vorrätig"
    if (hasReachedLimit) return "Maximale Menge erreicht"
    if (justAdded) return "Hinzufügen gelegt"
    if (currentQuantity > 0) {
      return type === "master" ? "Im Warenkorb" : "Weiteres hinzufügen"
    }
    return "Hinzufügen"
  })()

  const subLabel = (() => {
    if (isOutOfStock) return "Check back soon"
    if (hasReachedLimit) return `${currentQuantity} unit${currentQuantity === 1 ? "" : "s"} in your cart`
    if (currentQuantity > 0) {
      return type === "master" ? null : `${currentQuantity} in cart`
    }
    return null
  })()

  const isServiceAlreadyInCart = type === "master" && currentQuantity > 0
  const disabled = isOutOfStock || hasReachedLimit || isServiceAlreadyInCart

  const isOutline = variant === "outline"

  return (
    <Button
      type="button"
      size="lg"
      onClick={handleClick}
      disabled={disabled}
      variant={isOutline ? "outline" : undefined}
      className={cn(
        isOutline
          ? cn(
              // Fixed width: icon-only on xs, fixed width from sm+ so "In cart" == "Add to cart"
              "flex items-center justify-center gap-2 w-10 sm:w-[7.5rem]",
              className,
            )
          : cn(
              // Solid: keep fixed min width at all times
              "group relative flex items-center justify-between gap-3 overflow-hidden rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary via-primary to-primary/95 px-5 py-3 text-left text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:border-border/40 disabled:bg-muted/80 disabled:from-muted disabled:via-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:translate-y-0 min-w-[6.5rem]",
              justAdded && "border-emerald-500/60 bg-gradient-to-br from-emerald-500 via-emerald-500 to-emerald-600 shadow-emerald-500/30",
              className,
            )
      )}
    >
      {isOutline ? (
        <div className="flex items-center justify-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline text-sm font-semibold leading-tight tracking-tight">{mainLabel}</span>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm font-bold leading-tight tracking-tight">{mainLabel}</span>
            {subLabel ? (
              <span className="text-[0.7rem] font-medium leading-tight text-primary-foreground/75">{subLabel}</span>
            ) : null}
          </div>
          <div className="flex-shrink-0 rounded-full bg-primary-foreground/10 p-1.5 transition-all duration-300 group-hover:bg-primary-foreground/20 group-hover:scale-110">
            {justAdded ? (
              <Check className="h-4 w-4 text-primary-foreground transition-all duration-300" />
            ) : (
              <ShoppingCart className="h-4 w-4 text-primary-foreground transition-transform duration-300 group-hover:scale-110" />
            )}
          </div>
        </>
      )}
    </Button>
  )
}

