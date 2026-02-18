"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getUnreadMessagesCount, getConversations } from "@/lib/api/chat"
import { getAuthToken } from "@/lib/api/client"
import { cn } from "@/lib/utils"

const MESSAGE_SOUND_URL = "/sounds/delivered-message-sound.mp3"

interface MessagesLinkWithBadgeProps {
  className?: string
  iconClassName?: string
  /** Mobile: smaller. Desktop: default. */
  variant?: "mobile" | "desktop"
  ariaLabel?: string
}

/**
 * Ссылка «Сообщения» с индикатором непрочитанных (как у колокольчика).
 * Обновляется по событию notifications:refresh и по интервалу.
 * На любой странице (десктоп и мобильная) при появлении нового сообщения проигрывает звук.
 * На мобильных разблокировка аудио по первому касанию/клику (требование браузеров).
 */
export function MessagesLinkWithBadge({
  className,
  iconClassName,
  variant = "desktop",
  ariaLabel = "Nachrichten",
}: MessagesLinkWithBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0)
  const previousUnreadRef = useRef<number | null>(null)
  const lastSoundPlayedRef = useRef<number>(0)
  const audioUnlockedRef = useRef(false)
  const SOUND_THROTTLE_MS = 4000

  const unlockAudioForMobile = () => {
    if (audioUnlockedRef.current || typeof window === "undefined") return
    audioUnlockedRef.current = true
    try {
      const a = new Audio(MESSAGE_SOUND_URL)
      a.volume = 0
      a.play().then(() => a.pause()).catch(() => {})
    } catch {
      // ignore
    }
  }

  const playNewMessageSound = () => {
    const now = Date.now()
    const lastGlobal = typeof window !== "undefined" ? (window as unknown as { __lastMessageSoundPlayed?: number }).__lastMessageSoundPlayed : undefined
    if (lastGlobal != null && now - lastGlobal < SOUND_THROTTLE_MS) return
    if (now - lastSoundPlayedRef.current < SOUND_THROTTLE_MS) return
    lastSoundPlayedRef.current = now
    if (typeof window !== "undefined") (window as unknown as { __lastMessageSoundPlayed?: number }).__lastMessageSoundPlayed = now
    try {
      const audio = new Audio(MESSAGE_SOUND_URL)
      audio.volume = 0.6
      audio.play().catch(() => {})
    } catch {
      // ignore
    }
  }

  const loadUnread = async () => {
    if (!getAuthToken()) {
      setUnreadCount(0)
      previousUnreadRef.current = null
      return
    }
    try {
      const res = await getUnreadMessagesCount()
      const count = res?.count ?? 0
      const prev = previousUnreadRef.current
      if (prev !== null && count > prev) {
        playNewMessageSound()
      }
      previousUnreadRef.current = count
      setUnreadCount(count)
    } catch {
      try {
        const res = await getConversations({ page: 1, page_size: 50 })
        const items = res?.items ?? []
        const count = items.reduce((sum: number, c: { unread?: number }) => sum + (c.unread ?? 0), 0)
        const prev = previousUnreadRef.current
        if (prev !== null && count > prev) {
          playNewMessageSound()
        }
        previousUnreadRef.current = count
        setUnreadCount(count)
      } catch {
        setUnreadCount(0)
        previousUnreadRef.current = null
      }
    }
  }

  useEffect(() => {
    loadUnread()
    const interval = setInterval(loadUnread, 5000)
    const onRefresh = () => loadUnread()
    window.addEventListener("notifications:refresh", onRefresh)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) loadUnread()
    })
    const unlockOnInteraction = () => unlockAudioForMobile()
    document.addEventListener("click", unlockOnInteraction, { once: true, passive: true })
    document.addEventListener("touchstart", unlockOnInteraction, { once: true, passive: true })
    return () => {
      clearInterval(interval)
      window.removeEventListener("notifications:refresh", onRefresh)
      document.removeEventListener("visibilitychange", onRefresh)
      document.removeEventListener("click", unlockOnInteraction)
      document.removeEventListener("touchstart", unlockOnInteraction)
    }
  }, [])

  const handleLinkClick = () => {
    unlockAudioForMobile()
  }

  const isMobile = variant === "mobile"
  const sizeClass = isMobile
    ? "h-9 w-9 sm:h-10 sm:w-10"
    : "h-10 w-10"
  const iconSize = isMobile ? "h-4 w-4 sm:h-5 sm:w-5" : "h-5 w-5"

  return (
    <span className="relative inline-flex overflow-visible shrink-0">
      <Link
        href="/messages"
        className={cn(
          "relative flex items-center justify-center rounded-sm text-black transition-all duration-200 hover:text-black hover:bg-black/10",
          sizeClass,
          className
        )}
        aria-label={ariaLabel}
        onClick={handleLinkClick}
      >
        <MessageSquare className={cn(iconSize, iconClassName)} />
      </Link>
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 z-10 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold min-w-5 rounded-full pointer-events-none"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </span>
  )
}
