"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Bell, Package, MessageSquare, Star, Settings, CheckCheck, Loader2 } from "lucide-react"
import { getNotifications, getUnreadCount, markAsRead } from "@/lib/api/notifications"
import type { Notification } from "@/lib/api/types"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale/de"
import { cn } from "@/lib/utils"
import { getAuthToken } from "@/lib/api/client"

export function NotificationDropdown() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    loadUnreadCount()
    // Refresh unread count every 5 seconds
    const interval = setInterval(loadUnreadCount, 5000)
    const handleRefresh = () => loadUnreadCount()
    const handleVisibility = () => {
      if (!document.hidden) {
        loadUnreadCount()
      }
    }
    window.addEventListener("notifications:refresh", handleRefresh)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      clearInterval(interval)
      window.removeEventListener("notifications:refresh", handleRefresh)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadNotifications()
    }
  }, [open])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const response = await getNotifications({
        page: 1,
        page_size: 10,
        unread_only: false,
      })
      setNotifications(response.items || [])
    } catch (error: any) {
      console.error("Failed to load notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    // Don't make API call if user is not authenticated
    if (!getAuthToken()) {
      setUnreadCount(0)
      return
    }
    
    try {
      const response = await getUnreadCount()
      setUnreadCount(response.count || 0)
    } catch (error: any) {
      // Silently handle errors that shouldn't be shown to users
      const statusCode = error?.statusCode ?? error?.status
      const message = error?.message ?? ''
      
      const isUnauthorized = 
        statusCode === 401 || 
        message.includes("Not authenticated") || 
        message.includes("Unauthorized") ||
        message.includes("401")
      
      const isNetworkError = 
        statusCode === 408 ||
        message.includes("Unable to connect") ||
        message.includes("Network error") ||
        message.includes("timeout") ||
        message.includes("ERR_CONNECTION") ||
        error?.name === "TypeError" ||
        error?.message?.includes("fetch")
      
      // Silently handle auth and network errors - don't show error to user
      if (isUnauthorized || isNetworkError) {
        setUnreadCount(0)
        return
      }
      // Only log other unexpected errors
      console.error("Failed to load unread count:", error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch (error: any) {
        console.error("Failed to mark as read:", error)
      }
    }

    setOpen(false)

    // Navigate based on notification type
    if (notification.related_id) {
      switch (notification.type) {
        case "order":
          router.push(`/orders/${notification.related_id}`)
          break
        case "message":
          router.push("/messages")
          break
        case "review":
          router.push(`/orders/${notification.related_id}`)
          break
        default:
          break
      }
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order":
        return <Package className="h-4 w-4" />
      case "message":
        return <MessageSquare className="h-4 w-4" />
      case "review":
        return <Star className="h-4 w-4" />
      case "system":
        return <Settings className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-sm text-black transition-all duration-200 hover:text-black hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none"
          aria-label="Benachrichtigungen"
        >
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 rounded-lg p-0" alignOffset={10}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Benachrichtigungen</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} ungelesen
              </Badge>
            )}
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground text-center">Keine Benachrichtigungen</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                    !notification.is_read && "bg-muted/30"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full shrink-0 mt-0.5",
                        notification.type === "order" && "bg-blue-100 text-blue-600",
                        notification.type === "message" && "bg-green-100 text-green-600",
                        notification.type === "review" && "bg-yellow-100 text-yellow-600",
                        notification.type === "system" && "bg-purple-100 text-purple-600"
                      )}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold line-clamp-1">{notification.title}</p>
                        {!notification.is_read && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: de })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-center text-sm"
            onClick={() => {
              setOpen(false)
              router.push("/notifications")
            }}
          >
            Alle Benachrichtigungen anzeigen
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

