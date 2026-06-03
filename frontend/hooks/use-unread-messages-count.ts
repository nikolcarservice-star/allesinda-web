"use client"

import { useCallback, useEffect, useState } from "react"
import { getUnreadMessagesCount, getConversations } from "@/lib/api/chat"
import { getAuthToken } from "@/lib/api/client"

export function useUnreadMessagesCount(enabled = true) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!enabled || !getAuthToken()) {
      setCount(0)
      return 0
    }
    try {
      const res = await getUnreadMessagesCount()
      const next = res?.count ?? 0
      setCount(next)
      return next
    } catch {
      try {
        const res = await getConversations({ page: 1, page_size: 50 })
        const next = (res?.items ?? []).reduce((sum, c) => sum + (c.unread ?? 0), 0)
        setCount(next)
        return next
      } catch {
        setCount(0)
        return 0
      }
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => void refresh(), 5000)
    const onRefresh = () => void refresh()
    const onVisible = () => {
      if (!document.hidden) void refresh()
    }
    window.addEventListener("notifications:refresh", onRefresh)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(interval)
      window.removeEventListener("notifications:refresh", onRefresh)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refresh])

  return { count, refresh }
}
