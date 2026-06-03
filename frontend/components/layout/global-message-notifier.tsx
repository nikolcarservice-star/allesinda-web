"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/context/auth-context"
import { useUnreadMessagesCount } from "@/hooks/use-unread-messages-count"
import {
  playNewMessageNotificationSound,
  unlockMessageNotificationAudio,
} from "@/lib/utils/message-notification-sound"
import { toast } from "sonner"

/**
 * Global listener: toast + sound when unread message count increases (any page, incl. mobile home).
 */
export function GlobalMessageNotifier() {
  const { user } = useAuth()
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const { count, refresh } = useUnreadMessagesCount(Boolean(user))
  const previousRef = useRef<number | null>(null)
  const mountRef = useRef(Date.now())

  useEffect(() => {
    const unlock = () => unlockMessageNotificationAudio()
    document.addEventListener("click", unlock, { once: true, passive: true })
    document.addEventListener("touchstart", unlock, { once: true, passive: true })
    return () => {
      document.removeEventListener("click", unlock)
      document.removeEventListener("touchstart", unlock)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      previousRef.current = null
      return
    }
    const prev = previousRef.current
    previousRef.current = count

    if (prev === null) return
    if (count <= prev) return
    if (Date.now() - mountRef.current < 4000) return

    const inOpenChat =
      pathname.startsWith("/messages") &&
      typeof window !== "undefined" &&
      (window as unknown as { __messagesChatOpen?: boolean }).__messagesChatOpen === true

    playNewMessageNotificationSound()

    if (!inOpenChat) {
      toast.info("Neue Nachricht", {
        description: "Sie haben eine neue Chat-Nachricht erhalten.",
        action: {
          label: "Öffnen",
          onClick: () => router.push("/messages"),
        },
      })
    }

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      document.hidden
    ) {
      try {
        new Notification("Neue Nachricht", {
          body: "Sie haben eine neue Chat-Nachricht erhalten.",
          tag: "message",
        })
      } catch {
        // ignore
      }
    }
  }, [count, user, pathname, router])

  useEffect(() => {
    const onRefresh = () => void refresh()
    window.addEventListener("notifications:refresh", onRefresh)
    return () => window.removeEventListener("notifications:refresh", onRefresh)
  }, [refresh])

  return null
}
