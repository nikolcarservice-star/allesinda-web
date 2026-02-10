"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import type { CategoryType, Product } from "@/lib/api/types"
import { toast } from "sonner"

interface CartItem {
  product: CartProduct
  quantity: number
}

interface CartContextType {
  items: CartItem[]
  addItem: (product: CartProduct) => void
  removeItem: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = "allesinda_cart"

export type CartProduct = Product & {
  itemType: CategoryType
  price_per_day?: number | null
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const lastToastAtRef = React.useRef<number>(0)

  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(CART_STORAGE_KEY)
        if (!stored) return
        const parsed = JSON.parse(stored)
        if (!Array.isArray(parsed)) return
        const normalised = parsed
          .map((item) => {
            if (!item?.product) return null
            const product = item.product as Partial<CartProduct>
            if (!product?.id) return null
            return {
              quantity: typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1,
              product: {
                // Explicitly map known fields to guard against schema changes
                id: Number(product.id),
                itemType: (product.itemType as CategoryType) ?? "product",
                title: product.title ?? "Unknown item",
                description: product.description ?? "",
                price: typeof product.price === "number" ? product.price : 0,
                stock: typeof product.stock === "number" ? product.stock : 0,
                image_url: product.image_url,
                brand: product.brand,
                category_id: (product as any).category_id ?? undefined,
                category: product.category, // Keep for backward compatibility in display
                city_id: (product as any).city_id ?? undefined,
                city_name: (product as any).city_name || undefined,
                seller_id: typeof product.seller_id === "number" ? product.seller_id : 0,
                rating: typeof product.rating === "number" ? product.rating : 0,
                total_reviews: typeof product.total_reviews === "number" ? product.total_reviews : 0,
                created_at: product.created_at ?? new Date().toISOString(),
                updated_at: product.updated_at ?? new Date().toISOString(),
                media: product.media,
                seller_name: product.seller_name,
                seller: product.seller,
                likes_count: product.likes_count,
                price_per_day: product.price_per_day ?? null,
              } satisfies CartProduct,
            } satisfies CartItem
          })
          .filter(Boolean) as CartItem[]
        setItems(normalised)
      } catch (error) {
        console.error("Failed to load cart from localStorage:", error)
      }
    }
  }, [])

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
      } catch (error) {
        console.error("Failed to save cart to localStorage:", error)
      }
    }
  }, [items])

  const addItem = useCallback((product: CartProduct) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.product.id === product.id)

      if (existingItem) {
        // Services (master) are single-quantity entries; silently keep as-is
        if (existingItem.product.itemType === "master") {
          return prevItems
        }

        // For product/rental increase quantity WITHOUT extra toast spam
        return prevItems.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }

      // Add new item (quantity 1). Show a single toast on first add only
      const updated = [...prevItems, { product, quantity: 1 }]
      const now = Date.now()
      if (now - lastToastAtRef.current > 1200) {
        toast.success(`${product.title} added to cart`)
        lastToastAtRef.current = now
      }
      return updated
    })
  }, [])

  const removeItem = useCallback((productId: number) => {
    setItems((prevItems) => {
      const item = prevItems.find((item) => item.product.id === productId)
      const updated = prevItems.filter((item) => item.product.id !== productId)
      if (item) {
        toast.success(`${item.product.title} removed from cart`)
      }
      return updated
    })
  }, [])

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    )
  }, [removeItem])

  const clearCart = useCallback(() => {
    setItems([])
    toast.success("Cart cleared")
  }, [])

  const getTotalItems = useCallback(() => {
    return items.reduce((total, item) => total + item.quantity, 0)
  }, [items])

  const getTotalPrice = useCallback(() => {
    return items.reduce((total, item) => total + item.product.price * item.quantity, 0)
  }, [items])

  const value: CartContextType = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}

