"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, CheckCheck, Trash2, Loader2, Package, MessageSquare, Star, Settings, Grid3x3, Mail } from "lucide-react"
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, getUnreadCount } from "@/lib/api/notifications"
import type { Notification } from "@/lib/api/types"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale/de"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { logger } from "@/lib/logger"

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  useEffect(() => {
    loadNotifications()
    loadUnreadCount()
  }, [filter])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const response = await getNotifications({
        page: 1,
        page_size: 50,
        unread_only: filter === "unread",
      })
      setNotifications(response.items || [])
    } catch (error: any) {
      logger.error("Failed to load notifications:", error)
      toast.error("Fehler beim Laden der Benachrichtigungen")
    } finally {
      setLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    try {
      const response = await getUnreadCount()
      setUnreadCount(response.count || 0)
    } catch (error: any) {
      console.error("Failed to load unread count:", error)
    }
  }

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.is_read) return

    try {
      await markAsRead(notification.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error: any) {
      console.error("Failed to mark as read:", error)
      toast.error("Fehler beim Markieren der Benachrichtigung als gelesen")
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true)
      await markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
      toast.success("Alle Benachrichtigungen als gelesen markiert")
    } catch (error: any) {
      console.error("Failed to mark all as read:", error)
      toast.error("Fehler beim Markieren aller als gelesen")
    } finally {
      setMarkingAll(false)
    }
  }

  const handleDelete = async (notificationId: number) => {
    try {
      await deleteNotification(notificationId)
      const notification = notifications.find((n) => n.id === notificationId)
      if (notification && !notification.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      toast.success("Benachrichtigung gelöscht")
    } catch (error: any) {
      console.error("Failed to delete notification:", error)
      toast.error("Fehler beim Löschen der Benachrichtigung")
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order":
        return <Package className="h-5 w-5" />
      case "message":
        return <MessageSquare className="h-5 w-5" />
      case "review":
        return <Star className="h-5 w-5" />
      case "system":
        return <Settings className="h-5 w-5" />
      default:
        return <Bell className="h-5 w-5" />
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification)
    }

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-sides py-8 sm:py-10 md:py-12">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2">Benachrichtigungen</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Bleiben Sie auf dem Laufenden mit Ihren Bestellungen, Nachrichten und Bewertungen
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                className="gap-2"
              >
                {markingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                Alle als gelesen markieren
              </Button>
            )}
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6 sm:mb-8">
            <TabsList variant="modern" className="w-full sm:w-auto !inline-grid grid-cols-2">
              <TabsTrigger variant="modern" value="all" className="text-xs sm:text-sm gap-1.5">
                <Grid3x3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Alle</span>
              </TabsTrigger>
              <TabsTrigger variant="modern" value="unread" className="text-xs sm:text-sm gap-1.5">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Ungelesen</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] sm:text-xs px-1.5 py-0 h-4 sm:h-5">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine Benachrichtigungen</h3>
              <p className="text-sm text-muted-foreground text-center">
                {filter === "unread"
                  ? "Sie sind auf dem neuesten Stand! Keine ungelesenen Benachrichtigungen."
                  : "Sie haben noch keine Benachrichtigungen."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={cn(
                    "cursor-pointer hover:shadow-md transition-shadow",
                    !notification.is_read && "border-l-4 border-l-primary bg-muted/30"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
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
                          <h3 className="font-semibold text-sm sm:text-base">{notification.title}</h3>
                          {!notification.is_read && (
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: de })}
                          </p>
                          <div className="flex items-center gap-2">
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMarkAsRead(notification)
                                }}
                                className="h-7 text-xs"
                              >
                                Als gelesen markieren
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(notification.id)
                              }}
                              className="h-7 text-xs text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}

