"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/lib/context/auth-context"
import { getVapidPublicKey, registerPushSubscription } from "@/lib/api/push"

/** Convert base64url to Uint8Array for Web Push VAPID key */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

/**
 * Registers for Web Push when user is logged in so they receive push notifications
 * (e.g. new message) even when not on the messages page or when app is in background.
 */
export function PushSubscriptionSetup() {
  const { user } = useAuth()
  const registeredRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return

    let cancelled = false
    const run = async () => {
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission().catch(() => {})
        }
        if (Notification.permission !== "granted" || cancelled) return

        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        if (existing && !cancelled) {
          try {
            await registerPushSubscription(existing.toJSON() as Parameters<typeof registerPushSubscription>[0])
          } catch {
            // backend may not support push yet
          }
          return
        }
        if (registeredRef.current) return
        const { publicKey: base64Key } = await getVapidPublicKey()
        if (!base64Key || cancelled) return
        const key = urlBase64ToUint8Array(base64Key)
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key as BufferSource,
        })
        if (!cancelled) {
          await registerPushSubscription(sub.toJSON() as Parameters<typeof registerPushSubscription>[0])
          registeredRef.current = true
        }
      } catch {
        // e.g. backend push not configured or user denied
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return null
}
