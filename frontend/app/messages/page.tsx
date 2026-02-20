"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import type { ChangeEvent } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddToHomeScreenSheet } from "@/components/layout/add-to-home-screen-sheet"
import { Search, Send, Paperclip, MoreVertical, Phone, Video, ArrowLeft, Loader2, MessageCircle, Check, CheckCheck, Download, X } from "lucide-react"
import { cn, getOptimizedImageUrl } from "@/lib/utils"
import { toast } from "sonner"
import { getConversations, getMessages, sendMessage as sendMessageAPI, getWebSocketUrl, createConversation, markConversationRead, uploadAttachment as uploadAttachmentAPI, blockConversation as blockConversationAPI, unblockConversation as unblockConversationAPI, deleteConversation as deleteConversationAPI } from "@/lib/api/chat"
import { getCurrentUser } from "@/lib/api/auth"
import { ApiClientError } from "@/lib/api/client"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { logger } from "@/lib/logger"

interface MessageAttachment {
  id: number | string
  fileUrl: string
  rawUrl?: string
  fileName: string
  fileType: string
  fileSize?: number | null
  createdAt?: string
}

interface Message {
  id: number | string
  sender: "me" | "them"
  content: string
  timestamp: string
  is_read?: boolean
  sender_id?: number
  created_at?: string
  attachments?: MessageAttachment[]
}

interface Conversation {
  id: number | string
  name: string
  avatar: string
  lastMessage: string
  timestamp: string
  unread: number
  online: boolean
  profession: string
  buyer_id?: number
  seller_id?: number
  lastMessageRead?: boolean
  lastMessageSenderId?: number
  otherUserId?: number
  otherUserEmail?: string
  otherUserPhone?: string
  otherUserRole?: string
  otherProfileId?: number
  isBlocked?: boolean
  blockedByUserId?: number | null
}

function MessagesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messageInput, setMessageInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [initializingConversation, setInitializingConversation] = useState(false)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [videoCallLoading, setVideoCallLoading] = useState(false)
  const [messagePagination, setMessagePagination] = useState<Record<string, { page: number; hasMore: boolean; total: number; totalPages: number }>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const markingReadMapRef = useRef<Record<string, boolean>>({})
  const messagesTopRef = useRef<HTMLDivElement>(null)
  const pendingReadReceiptsRef = useRef<Set<string>>(new Set())
  const isMobile = useIsMobile()

  const INSTALL_BANNER_KEY = "messages-install-banner-dismissed"
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false)
  const [showInstallInstructions, setShowInstallInstructions] = useState(false)
  const [installPromptPending, setInstallPromptPending] = useState(false)
  const installPromptRef = useRef<{ prompt: () => Promise<{ outcome: string }> } | null>(null)

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" && window.localStorage.getItem(INSTALL_BANNER_KEY)
      if (stored === "1") setInstallBannerDismissed(true)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      installPromptRef.current = e as unknown as { prompt: () => Promise<{ outcome: string }> }
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const dismissInstallBanner = useCallback(() => {
    setInstallBannerDismissed(true)
    try {
      typeof window !== "undefined" && window.localStorage.setItem(INSTALL_BANNER_KEY, "1")
    } catch {
      // ignore
    }
  }, [])

  const handleInstallClick = useCallback(() => {
    const deferred = installPromptRef.current
    if (deferred) {
      setInstallPromptPending(true)
      deferred
        .prompt()
        .then(() => setInstallPromptPending(false))
        .catch(() => setInstallPromptPending(false))
    } else {
      setShowInstallInstructions(true)
    }
  }, [])

  const mapConversationResponse = useCallback((raw: any): Conversation => ({
    id: raw.id,
    name: raw.name || "Unbekannter Benutzer",
    avatar: getOptimizedImageUrl(raw.avatar, 'thumbnail') || "/placeholder-user.jpg",
    lastMessage: raw.lastMessage || "Noch keine Nachrichten",
    timestamp: raw.timestamp || "",
    unread: typeof raw.unread === 'number' ? raw.unread : (raw.unread ? Number(raw.unread) : 0),
    online: raw.online || false,
    profession: raw.profession || "Benutzer",
    buyer_id: raw.buyer_id,
    seller_id: raw.seller_id,
    lastMessageRead: raw.lastMessageRead ?? true,
    lastMessageSenderId: raw.lastMessageSenderId,
    otherUserId: raw.other_user_id,
    otherUserEmail: raw.other_user_email,
    otherUserPhone: raw.other_user_phone,
    otherUserRole: raw.other_user_role,
    otherProfileId: raw.other_profile_id,
    isBlocked: raw.is_blocked ?? false,
    blockedByUserId: raw.blocked_by_user_id ?? null,
  }), [])

  const mapAttachmentResponse = useCallback((attachment: any): MessageAttachment => {
    const raw = attachment.file_url || attachment.fileUrl || ""
    // For attachments, use original URL (not optimized) since they're files, not images
    const normalized = getOptimizedImageUrl(raw, 'original')
    const apiBase = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL || window.location.origin) : process.env.NEXT_PUBLIC_API_URL
    const absolute = normalized && !/^https?:\/\//i.test(normalized)
      ? `${(apiBase || "").replace(/\/$/, "")}${normalized.startsWith("/") ? normalized : `/${normalized}`}`
      : normalized

    return {
      id: attachment.id,
      fileUrl: absolute,
      rawUrl: raw,
      fileName: attachment.file_name || attachment.fileName || "Anhang",
      fileType: attachment.file_type || attachment.fileType || "application/octet-stream",
      fileSize: attachment.file_size ?? attachment.fileSize ?? null,
      createdAt: attachment.created_at ?? attachment.createdAt,
    }
  }, [])

  const mapMessageResponse = useCallback((payload: any): Message => {
    const senderId = payload.sender_id ?? payload.senderId
    const rawId = payload.id ?? payload.message_id ?? payload.messageId
    const messageId = rawId != null ? String(rawId) : `temp-${Date.now()}`
    const createdAt = payload.created_at ?? payload.createdAt ?? new Date().toISOString()
    const derivedTimestamp = new Date(createdAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

    let sender: "me" | "them" = "them"
    if (payload.sender === "me" || payload.sender === "them") {
      sender = payload.sender
    } else if (typeof senderId === "number" && currentUserId) {
      sender = senderId === currentUserId ? "me" : "them"
    }

    const resolvedSenderId =
      typeof senderId === "number"
        ? senderId
        : sender === "me"
          ? currentUserId ?? undefined
          : undefined

    return {
      id: messageId,
      sender,
      content: payload.content ?? payload.body ?? "",
      timestamp: payload.timestamp || derivedTimestamp,
      is_read: payload.is_read ?? payload.isRead ?? false,
      sender_id: resolvedSenderId,
      created_at: createdAt,
      attachments: Array.isArray(payload.attachments)
        ? payload.attachments.map(mapAttachmentResponse)
        : [],
    }
  }, [currentUserId, mapAttachmentResponse])

  const updateConversationBlockState = useCallback((conversationId: string, isBlocked: boolean, blockedBy: number | null) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id.toString() === conversationId
          ? {
              ...conv,
              isBlocked,
              blockedByUserId: blockedBy,
            }
          : conv,
      ),
    )

    setSelectedConversation((prev) =>
      prev && prev.id.toString() === conversationId
        ? {
            ...prev,
            isBlocked,
            blockedByUserId: blockedBy,
          }
        : prev,
    )
  }, [])

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getCurrentUser()
        setCurrentUserId(user.id)
      } catch (error) {
        logger.error("Failed to load user:", error)
        // Only redirect if it's a 401 (unauthorized), not network errors
        if (error instanceof ApiClientError) {
          if (error.statusCode === 401) {
            toast.error("Bitte melden Sie sich an, um Nachrichten anzuzeigen")
            router.push("/")
            return
          }
          // For network errors (statusCode 0) or other errors, show page but with error message
          const errorMessage = error.statusCode === 0 || error.statusCode === 408
            ? "Verbindung zum Server nicht möglich. Bitte überprüfen Sie, ob das Backend läuft."
            : error.message
          toast.error(errorMessage)
        } else {
          // For non-ApiClientError errors, show page but with error message
          toast.error("Verbindung zum Server nicht möglich. Bitte überprüfen Sie Ihre Verbindung.")
        }
        // Don't set currentUserId, but still show the page
        // The page will show with empty state
      }
    }
    loadUser()
  }, [router])

  // Define initializeConversationWithSeller before useEffects that use it
  const initializeConversationWithSeller = useCallback(async (sellerId: number) => {
    try {
      setInitializingConversation(true)
      await createConversation(sellerId)
      
      // Reload conversations to get enhanced details (name, avatar, profession, etc.)
      // The backend's list endpoint includes user details via get_conversation_detail
      const response = await getConversations({ page: 1, page_size: 50 })
      
      // Map backend response to frontend format
      const mappedConversations: Conversation[] = response.items.map((conv: any) => mapConversationResponse(conv))
      
      // Find the newly created conversation (should be first or match seller_id)
      const newConv = mappedConversations.find(
        (conv) => conv.seller_id === sellerId || conv.buyer_id === sellerId
      )
      
      if (newConv) {
        setConversations(mappedConversations)
        // Select the new conversation
        setSelectedConversation(newConv)
        setShowMobileChat(true)
      } else {
        // Fallback: if not found, just reload conversations
        setConversations(mappedConversations)
        if (mappedConversations.length > 0) {
          setSelectedConversation(mappedConversations[0])
          setShowMobileChat(true)
        }
      }
      
      // Remove seller_id from URL
      router.replace("/messages", { scroll: false })
    } catch (error) {
      logger.error("Failed to create conversation:", error)
      toast.error("Fehler beim Starten der Unterhaltung. Bitte versuchen Sie es erneut.")
    } finally {
      setInitializingConversation(false)
    }
  }, [router, mapConversationResponse])

  // Load conversations when user is loaded
  useEffect(() => {
    if (currentUserId) {
      loadConversations()
    } else {
      // If no user ID yet, still try to load (might be network error)
      // The API will return 401 if not authenticated, which we handle
      loadConversations()
    }
  }, [currentUserId])

  // In-page "push" notifications (Browser Notification API)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("Notification" in window)) return
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Handle seller_id query parameter after conversations are loaded
  useEffect(() => {
    const sellerIdParam = searchParams?.get("seller_id")
    if (sellerIdParam && currentUserId && conversations.length >= 0 && !initializingConversation) {
      const sellerId = parseInt(sellerIdParam)
      // Find existing conversation with this seller
      const existingConv = conversations.find(
        (conv) => conv.seller_id === sellerId || conv.buyer_id === sellerId
      )
      
      if (existingConv && existingConv.id !== selectedConversation?.id) {
        // Select existing conversation
        setSelectedConversation(existingConv)
        setShowMobileChat(true)
        // Remove seller_id from URL
        router.replace("/messages", { scroll: false })
      } else if (!existingConv && !loading) {
        // Create new conversation if it doesn't exist
        initializeConversationWithSeller(sellerId)
      }
    }
  }, [conversations, searchParams, currentUserId, loading, initializingConversation, selectedConversation, router, initializeConversationWithSeller])

  const loadConversations = async () => {
    try {
      setLoading(true)
      const response = await getConversations({ page: 1, page_size: 50 })
      
      // Map backend response to frontend format
      const mappedConversations: Conversation[] = response.items.map((conv: any) => mapConversationResponse(conv))
      
      setConversations(mappedConversations)
      
      // Prefer selecting by conversation_id param (e.g. from email notifications)
      const conversationIdParam = searchParams?.get("conversation_id")
      if (conversationIdParam && mappedConversations.length > 0) {
        const found = mappedConversations.find((c) => String(c.id) === String(conversationIdParam))
        if (found) {
          setSelectedConversation(found)
          setShowMobileChat(true)
          router.replace("/messages", { scroll: false })
          return
        }
      }

      // Select first conversation if available and no seller_id param
      const sellerIdParam = searchParams?.get("seller_id")
      if (!sellerIdParam && mappedConversations.length > 0 && !selectedConversation) {
        setSelectedConversation(mappedConversations[0])
      }
    } catch (error) {
      logger.error("Failed to load conversations:", error)
      if (error instanceof ApiClientError && error.statusCode === 401) {
        toast.error("Bitte melden Sie sich an, um Nachrichten anzuzeigen")
        router.push("/")
      } else {
        // For network errors or other errors, show page with empty state
        const errorMessage = error instanceof ApiClientError 
          ? error.message 
          : "Failed to connect to server. Please check if the backend is running."
        toast.error(errorMessage)
        // Fallback to empty state - show page anyway
        setConversations([])
      }
    } finally {
      setLoading(false)
    }
  }

  // Refresh conversation list in background (unread counts, last message) without full page reload — desktop & mobile
  const refreshConversationsList = useCallback(async () => {
    try {
      const response = await getConversations({ page: 1, page_size: 50 })
      const freshItems = response.items.map((conv: any) => mapConversationResponse(conv))
      setConversations((prev) => {
        const byId = new Map(prev.map((c) => [c.id.toString(), c]))
        const merged = freshItems.map((fresh) => {
          const existing = byId.get(fresh.id.toString())
          if (!existing) return fresh
          return {
            ...existing,
            unread: fresh.unread,
            lastMessage: fresh.lastMessage,
            timestamp: fresh.timestamp,
            lastMessageRead: fresh.lastMessageRead,
            lastMessageSenderId: fresh.lastMessageSenderId,
            online: fresh.online,
          }
        })
        return merged
      })
      setSelectedConversation((prev) => {
        if (!prev) return prev
        const updated = freshItems.find((c) => String(c.id) === String(prev.id))
        if (!updated) return prev
        return {
          ...prev,
          unread: updated.unread,
          lastMessage: updated.lastMessage,
          timestamp: updated.timestamp,
          lastMessageRead: updated.lastMessageRead,
          lastMessageSenderId: updated.lastMessageSenderId,
          online: updated.online,
        }
      })
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notifications:refresh"))
      }
    } catch {
      // Silent fail for background refresh
    }
  }, [mapConversationResponse])

  // Poll conversations list so new/unread messages appear without page refresh
  useEffect(() => {
    if (!currentUserId) return
    const interval = setInterval(refreshConversationsList, 8000)
    return () => clearInterval(interval)
  }, [currentUserId, refreshConversationsList])

  const markConversationAsRead = useCallback(async (conversationId: string, providedMessages?: Message[]) => {
    if (!currentUserId) return
    if (markingReadMapRef.current[conversationId]) return

    const existingMessages = providedMessages ?? messages[conversationId]
    const hasUnread = existingMessages ? existingMessages.some((msg) => msg.sender === "them" && !msg.is_read) : false

    if (!hasUnread && !providedMessages) {
      return
    }

    markingReadMapRef.current[conversationId] = true
    try {
      setMessages((prev) => {
        const existing = prev[conversationId]
        if (!existing) return prev
        const updated = existing.map((msg) =>
          (msg.sender === "them" || (msg.sender_id && msg.sender_id !== currentUserId))
            ? { ...msg, is_read: true }
            : msg,
        )
        return {
          ...prev,
          [conversationId]: updated,
        }
      })

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id.toString() === conversationId
            ? {
                ...conv,
                unread: 0,
                lastMessageRead: conv.lastMessageSenderId === currentUserId ? conv.lastMessageRead : true,
              }
            : conv,
        ),
      )

      setSelectedConversation((prev) =>
        prev && prev.id?.toString() === conversationId
          ? {
              ...prev,
              unread: 0,
              lastMessageRead: prev.lastMessageSenderId === currentUserId ? prev.lastMessageRead : true,
            }
          : prev,
      )

      await markConversationRead(Number(conversationId))
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notifications:refresh"))
      }
    } catch (error) {
      logger.error("Failed to mark conversation as read:", error)
    } finally {
      markingReadMapRef.current[conversationId] = false
    }
  }, [currentUserId, messages])

  const loadConversationMessages = async (conversationId: string, page: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMoreMessages(true)
      } else {
        setLoadingMessages(true)
      }

      const pageSize = 30 // Load 30 messages per page for better performance
      const response = await getMessages(parseInt(conversationId), { page, page_size: pageSize })

      const totalCount = response.total || 0
      const totalPages = response.total_pages || Math.max(1, Math.ceil(totalCount / pageSize))

      // If we requested a page beyond the available range (e.g. data shrank), fall back to last page
      if (!append && page > totalPages && totalPages > 0) {
        await loadConversationMessages(conversationId, totalPages, false)
        return
      }

      // Map backend messages to frontend format
      const mappedMessages: Message[] = (response.items || [])
        .slice()
        .reverse()
        .map((msg: any) => mapMessageResponse(msg))

      setMessages((prev) => {
        const existingMessages = prev[conversationId] || []
        if (append) {
          // Prepend older messages when loading more
          const merged = [...mappedMessages, ...existingMessages]
          const deduped = merged.filter((msg, index, arr) =>
            arr.findIndex((other) => String(other.id) === String(msg.id)) === index,
          )
          return {
            ...prev,
            [conversationId]: deduped,
          }
        }

        // Replace messages when loading initial page
        return {
          ...prev,
          [conversationId]: mappedMessages,
        }
      })

      // Update pagination state
      const hasMore = page < totalPages
      setMessagePagination((prev) => ({
        ...prev,
        [conversationId]: {
          page,
          hasMore,
          total: totalCount,
          totalPages,
        },
      }))

      // Update conversation with last message read status
      const allMessages = append
        ? [...mappedMessages, ...(messages[conversationId] || [])]
        : mappedMessages
      if (allMessages.length > 0) {
        const lastMessage = allMessages[allMessages.length - 1]
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id.toString() === conversationId
              ? {
                  ...conv,
                  lastMessageRead: lastMessage.is_read ?? false,
                  lastMessageSenderId: lastMessage.sender_id,
                }
              : conv,
          ),
        )
      }

      if (!append) {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id.toString() === conversationId
              ? {
                  ...conv,
                  unread: 0,
                }
              : conv,
          ),
        )

        await markConversationAsRead(conversationId, allMessages)
        connectWebSocket(parseInt(conversationId))
      }
    } catch (error) {
      logger.error("Failed to load messages:", error)
      toast.error("Fehler beim Laden der Nachrichten")
      if (!append) {
        setMessages((prev) => ({
          ...prev,
          [conversationId]: [],
        }))
      }
    } finally {
      if (append) {
        setLoadingMoreMessages(false)
      } else {
        setLoadingMessages(false)
      }
    }
  }

  // Load more messages (older messages) when scrolling up
  const loadMoreMessages = useCallback(async () => {
    if (!selectedConversation || loadingMoreMessages) return
    
    const conversationId = selectedConversation.id.toString()
    const pagination = messagePagination[conversationId]
    
    if (!pagination || !pagination.hasMore) return

    // Get current scroll position before loading
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
    if (!viewport) return
    
    const scrollHeightBefore = viewport.scrollHeight
    const scrollTopBefore = viewport.scrollTop

    // Load next page
    await loadConversationMessages(conversationId, pagination.page + 1, true)

    // Restore scroll position after loading (maintain position relative to top)
    requestAnimationFrame(() => {
      if (viewport) {
        const scrollHeightAfter = viewport.scrollHeight
        const scrollDiff = scrollHeightAfter - scrollHeightBefore
        viewport.scrollTop = scrollTopBefore + scrollDiff
      }
    })
  }, [selectedConversation, messagePagination, loadingMoreMessages, loadConversationMessages])

  // Load messages for selected conversation
  useEffect(() => {
    if (selectedConversation && currentUserId) {
      // Reset pagination and load first page
      loadConversationMessages(selectedConversation.id.toString(), 1, false)
    }
  }, [selectedConversation?.id, currentUserId])

  // Handle scroll to load more messages
  useEffect(() => {
    if (!selectedConversation || loadingMoreMessages) return

    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
    if (!viewport) return

    let scrollTimeout: NodeJS.Timeout
    const handleScroll = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        // Load more when scrolled near the top (within 300px)
        if (viewport.scrollTop < 300) {
          loadMoreMessages()
        }
      }, 100) // Debounce scroll events
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      clearTimeout(scrollTimeout)
      viewport.removeEventListener('scroll', handleScroll)
    }
  }, [selectedConversation, loadingMoreMessages, loadMoreMessages])

  const connectWebSocket = (conversationId: number) => {
    // Close existing connection
    if (wsRef.current) {
      try {
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.onclose = null
        if (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, "Switching conversations")
        }
      } catch (error) {
        logger.error("Error closing existing WebSocket:", error)
      }
      wsRef.current = null
    }

    try {
      const token = localStorage.getItem("auth_token")
      const wsUrl = getWebSocketUrl(conversationId, token || undefined)
      const ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        logger.log("WebSocket connected")
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === "new_message") {
            // Add new message to state
            const newMessage = mapMessageResponse({
              ...data,
              sender: data.sender_id === currentUserId ? "me" : "them",
              content: data.body,
              created_at: data.created_at,
            })

            const newMessageIdString = String(newMessage.id)
            if (pendingReadReceiptsRef.current.has(newMessageIdString)) {
              newMessage.is_read = true
              pendingReadReceiptsRef.current.delete(newMessageIdString)
            }

            let updatedList: Message[] = messages[conversationId.toString()] || []
            setMessages((prev) => {
              const conversationKey = conversationId.toString()
              const conversationMessages = prev[conversationKey] || []

              const existingIndex = conversationMessages.findIndex(
                (m) => String(m.id) === String(newMessage.id),
              )

              if (existingIndex !== -1) {
                const nextMessages = [...conversationMessages]
                const existingMessage = nextMessages[existingIndex]
                nextMessages.splice(existingIndex, 1, {
                  ...existingMessage,
                  ...newMessage,
                  attachments:
                    newMessage.attachments && newMessage.attachments.length > 0
                      ? newMessage.attachments
                      : existingMessage.attachments,
                  is_read: (existingMessage.is_read ?? false) || (newMessage.is_read ?? false),
                })
                updatedList = nextMessages
                return {
                  ...prev,
                  [conversationKey]: nextMessages,
                }
              }

              if (data.sender_id === currentUserId) {
                const optimisticIndex = conversationMessages.findIndex((m) =>
                  String(m.id).startsWith("temp-"),
                )
                if (optimisticIndex !== -1) {
                  const nextMessages = [...conversationMessages]
                  const existingMessage = nextMessages[optimisticIndex]
                  nextMessages.splice(optimisticIndex, 1, {
                    ...existingMessage,
                    ...newMessage,
                    attachments:
                      newMessage.attachments && newMessage.attachments.length > 0
                        ? newMessage.attachments
                        : existingMessage.attachments,
                    is_read: (existingMessage.is_read ?? false) || (newMessage.is_read ?? false),
                  })
                  updatedList = nextMessages
                  return {
                    ...prev,
                    [conversationKey]: nextMessages,
                  }
                }
              }

              updatedList = [...conversationMessages, newMessage]
              return {
                ...prev,
                [conversationKey]: updatedList,
              }
            })

            // Update conversation last message
            setConversations((prev) =>
              prev.map((conv) => {
                if (conv.id.toString() !== conversationId.toString()) {
                  return conv
                }

                const preview = newMessage.attachments && newMessage.attachments.length > 0
                  ? newMessage.attachments[0].fileName
                  : newMessage.content
                const isMine = newMessage.sender === "me"

                return {
                  ...conv,
                  lastMessage: preview,
                  timestamp: isMine ? "Just now" : newMessage.timestamp,
                  unread: isMine ? conv.unread ?? 0 : (conv.unread ?? 0) + 1,
                  lastMessageRead: isMine ? newMessage.is_read ?? false : conv.lastMessageRead,
                  lastMessageSenderId: newMessage.sender_id,
                }
              }),
            )

            setSelectedConversation((prev) => {
              if (!prev || prev.id?.toString() !== conversationId.toString()) {
                return prev
              }

              const preview = newMessage.attachments && newMessage.attachments.length > 0
                ? newMessage.attachments[0].fileName
                : newMessage.content
              const isMine = newMessage.sender === "me"

              return {
                ...prev,
                lastMessage: preview,
                timestamp: isMine ? "Just now" : newMessage.timestamp,
                unread: isMine ? prev.unread ?? 0 : (prev.unread ?? 0) + 1,
                lastMessageRead: isMine ? newMessage.is_read ?? false : prev.lastMessageRead,
                lastMessageSenderId: newMessage.sender_id,
              }
            })

            if (data.sender_id !== currentUserId && selectedConversation?.id === conversationId) {
              markConversationAsRead(conversationId.toString(), updatedList).catch((error) => {
                logger.error("Failed to mark conversation as read from WS:", error)
              })
            }

            if (data.sender_id !== currentUserId && typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("notifications:refresh"))
              // Play sound only when tab is in background or message is from another conversation (not the one user is viewing)
              const isViewingThisChat = selectedConversation?.id?.toString() === conversationId.toString()
              const shouldPlaySound = document.hidden || !isViewingThisChat
              if (shouldPlaySound) {
                try {
                  const now = Date.now()
                  const last = (window as unknown as { __lastMessageSoundPlayed?: number }).__lastMessageSoundPlayed
                  if (!last || now - last >= 2500) {
                    (window as unknown as { __lastMessageSoundPlayed?: number }).__lastMessageSoundPlayed = now
                    const audio = new Audio("/sounds/delivered-message-sound.mp3")
                    audio.volume = 0.6
                    audio.play().catch(() => {})
                  }
                } catch {
                  // ignore
                }
              }
            }

            // If tab is hidden, show browser notification (permission required)
            try {
              if (
                typeof window !== "undefined" &&
                "Notification" in window &&
                Notification.permission === "granted" &&
                document.hidden &&
                data.sender_id !== currentUserId
              ) {
                const senderLabel = (selectedConversation?.id === conversationId
                  ? selectedConversation?.name
                  : conversations.find((c) => String(c.id) === String(conversationId))?.name) || "Jemand"
                new Notification("Neue Nachricht", {
                  body: `Neue Nachricht von ${senderLabel}`,
                })
              }
            } catch {
              // ignore
            }
          } else if (data.type === "read_receipt") {
            const targetConversationId = String(data.conversation_id)
            const readerId = data.reader_id
            const messageIds: string[] = Array.isArray(data.message_ids)
              ? data.message_ids.map((id: any) => String(id))
              : []

            if (!targetConversationId) {
              return
            }

            if (messageIds.length > 0) {
              const idSet = new Set(messageIds)
              let foundAny = false
              setMessages((prev) => {
                const conversationMessages = prev[targetConversationId]
                if (!conversationMessages) return prev
                const updatedMessages = conversationMessages.map((msg) => {
                  if (idSet.has(String(msg.id)) && (msg.sender === "me" || msg.sender_id === currentUserId)) {
                    foundAny = true
                    return { ...msg, is_read: true }
                  }
                  return msg
                })
                return {
                  ...prev,
                  [targetConversationId]: updatedMessages,
                }
              })
              if (!foundAny) {
                messageIds.forEach((id) => pendingReadReceiptsRef.current.add(String(id)))
              }
            } else if (readerId !== currentUserId) {
              setMessages((prev) => {
                const conversationMessages = prev[targetConversationId]
                if (!conversationMessages) return prev
                const updatedMessages = conversationMessages.map((msg) =>
                  msg.sender === "me" || msg.sender_id === currentUserId
                    ? { ...msg, is_read: true }
                    : msg,
                )
                return {
                  ...prev,
                  [targetConversationId]: updatedMessages,
                }
              })
              pendingReadReceiptsRef.current.clear()
            }

            setConversations((prev) =>
              prev.map((conv) => {
                const convIdString = conv.id?.toString()
                if (convIdString === targetConversationId) {
                  const isCurrentUserReader = readerId === currentUserId
                  return {
                    ...conv,
                    unread: isCurrentUserReader ? 0 : conv.unread ?? 0,
                    lastMessageRead:
                      !isCurrentUserReader && conv.lastMessageSenderId === currentUserId
                        ? true
                        : conv.lastMessageRead,
                  }
                }
                return conv
              }),
            )

            setSelectedConversation((prev) => {
              if (!prev || prev.id?.toString() !== targetConversationId) {
                return prev
              }

              const isCurrentUserReader = readerId === currentUserId

              return {
                ...prev,
                unread: isCurrentUserReader ? 0 : prev.unread ?? 0,
                lastMessageRead:
                  !isCurrentUserReader && prev.lastMessageSenderId === currentUserId
                    ? true
                    : prev.lastMessageRead,
              }
            })
          } else if (data.type === "user_status") {
            const targetConversationId = String(data.conversation_id)
            const participantId = data.user_id
            const isOnline = Boolean(data.online)

            if (!targetConversationId || participantId == null) {
              return
            }

            const isCurrentUser = participantId === currentUserId
            if (isCurrentUser) {
              return
            }

            setConversations((prev) =>
              prev.map((conv) =>
                conv.id.toString() === targetConversationId
                  ? {
                      ...conv,
                      online: isOnline,
                    }
                  : conv,
              ),
            )

            setSelectedConversation((prev) =>
              prev && prev.id?.toString() === targetConversationId
                ? {
                    ...prev,
                    online: isOnline,
                  }
                : prev,
            )
          } else if (data.type === "conversation_deleted") {
            const targetConversationId = String(data.conversation_id)
            if (!targetConversationId) {
              return
            }

            let fallback: Conversation | null = null
            let removed = false

            setConversations((prev) => {
              const exists = prev.some((conv) => conv.id?.toString() === targetConversationId)
              if (!exists) {
                return prev
              }
              removed = true
              const filtered = prev.filter((conv) => conv.id?.toString() !== targetConversationId)
              fallback = filtered.length > 0 ? filtered[0] : null
              return filtered
            })

            if (!removed) {
              return
            }

            setMessages((prev) => {
              const next = { ...prev }
              delete next[targetConversationId]
              return next
            })

            setSelectedConversation((prev) => {
              if (!prev || prev.id?.toString() !== targetConversationId) {
                return prev
              }
              return fallback ? { ...fallback, unread: 0 } : null
            })

            if (!fallback) {
              if (!selectedConversation || selectedConversation.id?.toString() === targetConversationId) {
                setShowMobileChat(false)
              }
            }

            toast.info("Unterhaltung gelöscht")
          }
        } catch (error) {
          logger.error("Error parsing WebSocket message:", error)
        }
      }
      
      ws.onerror = (error) => {
        logger.error("WebSocket error:", error)
      }
      
      ws.onclose = () => {
        logger.log("WebSocket disconnected")
        if (wsRef.current === ws) {
          wsRef.current = null
        }
      }
      
      wsRef.current = ws
    } catch (error) {
      logger.error("Failed to connect WebSocket:", error)
      // Continue without WebSocket - will use polling
    }
  }

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.profession.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const currentMessages = selectedConversation ? messages[selectedConversation.id.toString()] || [] : []

  const isConversationBlocked = selectedConversation?.isBlocked ?? false
  const isBlockedByMe = isConversationBlocked && selectedConversation?.blockedByUserId === currentUserId
  const isBlockedAgainstMe = isConversationBlocked && selectedConversation?.blockedByUserId !== null && selectedConversation?.blockedByUserId !== currentUserId
  const canSendMessages = !isBlockedByMe && !isBlockedAgainstMe

  // Format date for display (Today, Yesterday, or date)
  const formatDateHeader = (dateString: string | undefined): string => {
    if (!dateString) return "Messages"
    try {
      const messageDate = new Date(dateString)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      // Reset time to compare dates only
      const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate())
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())

      if (messageDateOnly.getTime() === todayOnly.getTime()) {
        return "Today"
      } else if (messageDateOnly.getTime() === yesterdayOnly.getTime()) {
        return "Yesterday"
      } else {
        // Format as "Month Day, Year" or "Month Day" if same year
        const options: Intl.DateTimeFormatOptions = {
          month: "long",
          day: "numeric",
          ...(messageDate.getFullYear() !== today.getFullYear() && { year: "numeric" }),
        }
        return messageDate.toLocaleDateString("en-US", options)
      }
    } catch (error) {
      return "Messages"
    }
  }

  // Get date key for grouping (YYYY-MM-DD)
  const getDateKey = (dateString: string | undefined): string => {
    if (!dateString) return ""
    try {
      const date = new Date(dateString)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    } catch (error) {
      return ""
    }
  }

  // Group messages by date
  const groupMessagesByDate = (messages: Message[]): Array<{ date: string; messages: Message[] }> => {
    const grouped: Record<string, Message[]> = {}
    
    messages.forEach((message) => {
      const dateKey = getDateKey(message.created_at) || "unknown"
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(message)
    })

    // Convert to array, filter out empty groups, and sort by date (oldest first)
    return Object.entries(grouped)
      .filter(([_, msgs]) => msgs.length > 0)
      .map(([date, msgs]) => ({
        date,
        messages: msgs.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateA - dateB
        }),
      }))
      .sort((a, b) => {
        // Put "unknown" at the end
        if (a.date === "unknown") return 1
        if (b.date === "unknown") return -1
        return a.date.localeCompare(b.date)
      })
  }

  // Auto-scroll to bottom when messages change or conversation is selected
  useEffect(() => {
    if (scrollAreaRef.current && currentMessages.length > 0) {
      // Use setTimeout to ensure DOM is updated and messages are rendered
      const timeoutId = setTimeout(() => {
        // Find the ScrollArea viewport element
        const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
        if (viewport) {
          // Scroll to bottom within the viewport only
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: "smooth"
          })
        }
      }, 200)
      return () => clearTimeout(timeoutId)
    }
  }, [currentMessages, selectedConversation])

  // Reset unread count when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id.toString() === selectedConversation.id.toString() ? { ...conv, unread: 0 } : conv,
        ),
      )
    }
  }, [selectedConversation])

  // Auto-resize textarea
  useEffect(() => {
    if (messageInputRef.current) {
      messageInputRef.current.style.height = "auto"
      const scrollHeight = messageInputRef.current.scrollHeight
      const maxHeight = 120 // max-h-[120px]
      messageInputRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`
    }
  }, [messageInput])

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sending || !canSendMessages) return

    const conversationId = parseInt(selectedConversation.id.toString())
    const conversationKey = conversationId.toString()
    const messageContent = messageInput.trim()
    
    // Optimistically add message
    const now = new Date()
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sender: "me",
      content: messageContent,
      timestamp: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      is_read: false,
      sender_id: currentUserId ?? undefined,
      created_at: now.toISOString(),
      attachments: [],
    }

    setMessages((prev) => ({
      ...prev,
      [conversationKey]: [...(prev[conversationKey] || []), tempMessage],
    }))

    setMessageInput("")
    // Reset textarea height and refocus
    if (messageInputRef.current) {
      messageInputRef.current.style.height = "auto"
      // Small delay to ensure state update completes
      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 0)
    }

    // Update conversation last message
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id.toString() === conversationId.toString()
          ? { 
              ...conv, 
              lastMessage: messageContent, 
              timestamp: "Just now", 
              unread: 0,
              lastMessageRead: false,
              lastMessageSenderId: currentUserId || undefined,
            }
          : conv,
      ),
    )

    try {
      setSending(true)
      const response = await sendMessageAPI(conversationId, { body: messageContent })

      const persistedMessage = mapMessageResponse({
        ...response,
        sender: "me",
        content: response.body || messageContent,
        conversation_id: conversationId,
      })

    setMessages((prev) => {
      const conversationKey = conversationId.toString()
      const existing = prev[conversationKey] || []
      const updated = existing.map((msg) => (msg.id === tempMessage.id ? persistedMessage : msg))

      const merged = [...updated, persistedMessage]

      const deduped = merged.filter((msg, index, arr) =>
        arr.findIndex((other) => String(other.id) === String(msg.id)) === index,
      )

      return {
        ...prev,
        [conversationKey]: deduped,
      }
    })

      setTimeout(() => {
        const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
        if (viewport) {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: "smooth",
          })
        }
        messageInputRef.current?.focus()
      }, 50)
    } catch (error) {
      logger.error("Failed to send message:", error)
      toast.error("Fehler beim Senden der Nachricht. Bitte versuchen Sie es erneut.")
      
      // Remove optimistic message
      setMessages((prev) => ({
        ...prev,
        [conversationKey]: (prev[conversationKey] || []).filter(
          (m) => m.id !== tempMessage.id,
        ),
      }))
    } finally {
      setSending(false)
    }
  }

  const handleAttachmentUpload = async (file: File) => {
    if (!file || !selectedConversation) {
      toast.error("Wählen Sie zuerst eine Unterhaltung aus, bevor Sie Anhänge senden")
      return
    }

    if (!currentUserId) {
      toast.error("Sie müssen angemeldet sein, um Anhänge zu senden")
      return
    }

    if (selectedConversation.isBlocked && selectedConversation.blockedByUserId !== null) {
      if (selectedConversation.blockedByUserId === currentUserId) {
        toast.error("Entsperren Sie diesen Benutzer, bevor Sie Anhänge senden")
      } else {
        toast.error("Sie können diesem Benutzer keine Nachrichten senden")
      }
      return
    }

    const conversationId = Number(selectedConversation.id)
    if (!conversationId) {
      toast.error("Ungültige Unterhaltung")
      return
    }

    try {
      setAttachmentUploading(true)
      pendingReadReceiptsRef.current.clear()
      const response = await uploadAttachmentAPI(conversationId, file)
      const message = mapMessageResponse({
        ...response,
        sender: "me",
        sender_id: response?.sender_id ?? currentUserId ?? undefined,
        conversation_id: conversationId,
      })

      const messageIdString = String(message.id)
      if (pendingReadReceiptsRef.current.has(messageIdString)) {
        message.is_read = true
        pendingReadReceiptsRef.current.delete(messageIdString)
      }

      setMessages((prev) => {
        const key = conversationId.toString()
        const existing = prev[key] || []
        const existingIndex = existing.findIndex((msg) => String(msg.id) === String(message.id))

        let nextMessages: Message[]
        if (existingIndex !== -1) {
          nextMessages = [...existing]
          nextMessages.splice(existingIndex, 1, message)
        } else {
          nextMessages = [...existing, message]
        }

        return {
          ...prev,
          [key]: nextMessages,
        }
      })

      const preview = message.attachments && message.attachments.length > 0
        ? message.attachments[0].fileName
        : message.content

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id.toString() === conversationId.toString()
            ? {
                ...conv,
                lastMessage: preview,
                timestamp: "Just now",
                unread: 0,
                lastMessageRead: false,
                lastMessageSenderId: message.sender_id,
              }
            : conv,
        ),
      )

      setSelectedConversation((prev) =>
        prev && prev.id.toString() === conversationId.toString()
          ? {
              ...prev,
              lastMessage: preview,
              timestamp: "Just now",
              lastMessageRead: false,
              lastMessageSenderId: message.sender_id,
            }
          : prev,
      )

      setTimeout(() => {
        const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
        if (viewport) {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: "smooth",
          })
        }
      }, 50)

      toast.success("Anhang gesendet")
    } catch (error: any) {
      logger.error("Failed to upload attachment:", error)
      toast.error(error?.message || "Failed to upload attachment")
    } finally {
      setAttachmentUploading(false)
    }
  }

  const handleAttachmentInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void handleAttachmentUpload(file)
    }
    event.target.value = ""
  }

  const handleAttachmentButtonClick = () => {
    if (selectedConversation?.isBlocked && selectedConversation.blockedByUserId !== null) {
      if (selectedConversation.blockedByUserId === currentUserId) {
        toast.error("Entsperren Sie diesen Benutzer, bevor Sie Anhänge senden")
      } else {
        toast.error("Sie können diesem Benutzer keine Nachrichten senden")
      }
      return
    }
    fileInputRef.current?.click()
  }

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation({ ...conversation, unread: 0 })
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id.toString() === conversation.id.toString()
          ? {
              ...conv,
              unread: 0,
            }
          : conv,
      ),
    )
    setShowMobileChat(true)
  }

  const initiateVideoCall = async () => {
    if (!selectedConversation) {
      toast.error("Wählen Sie zuerst eine Unterhaltung aus")
      return
    }

    if (selectedConversation.isBlocked && selectedConversation.blockedByUserId !== null) {
      if (selectedConversation.blockedByUserId === currentUserId) {
        toast.error("Entsperren Sie diesen Benutzer, bevor Sie einen Videoanruf starten")
      } else {
        toast.error("Sie können keinen Videoanruf mit diesem Benutzer starten")
      }
      return
    }

    const conversationId = Number(selectedConversation.id)
    if (!conversationId) {
      toast.error("Ungültige Unterhaltung")
      return
    }

    const baseUrl = (process.env.NEXT_PUBLIC_VIDEO_CALL_BASE_URL || "https://meet.jit.si/Allesinda").replace(/\/$/, "")
    const roomSlug = `allesinda-${conversationId}-${Date.now()}`
    const callUrl = `${baseUrl}/${roomSlug}`
    const messageBody = `Join my video call: ${callUrl}`

    try {
      setVideoCallLoading(true)
      const response = await sendMessageAPI(conversationId, { body: messageBody })
      const message = mapMessageResponse({
        ...response,
        sender: "me",
        content: response.body || messageBody,
      })

      setMessages((prev) => {
        const key = conversationId.toString()
        const existing = prev[key] || []
        const next = [...existing, message]
        const deduped = next.filter((msg, index, arr) => arr.findIndex((other) => other.id === msg.id) === index)
        return {
          ...prev,
          [key]: deduped,
        }
      })

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id.toString() === conversationId.toString()
            ? {
                ...conv,
                lastMessage: message.content,
                timestamp: "Just now",
                unread: 0,
                lastMessageRead: false,
                lastMessageSenderId: message.sender_id,
              }
            : conv,
        ),
      )

      setSelectedConversation((prev) =>
        prev && prev.id.toString() === conversationId.toString()
          ? {
              ...prev,
              lastMessage: message.content,
              timestamp: "Just now",
              lastMessageRead: false,
              lastMessageSenderId: message.sender_id,
            }
          : prev,
      )

      setTimeout(() => {
        const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
        if (viewport) {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: "smooth",
          })
        }
      }, 50)

      const opened = window.open(callUrl, "_blank", "noopener,noreferrer")
      if (!opened) {
        toast.warning("Popup blockiert. Bitte erlauben Sie Popups oder öffnen Sie den Link aus der Nachricht.")
      } else {
        toast.success("Videoanruf-Link gesendet")
      }
    } catch (error: any) {
      logger.error("Failed to start video call:", error)
      toast.error(error?.message || "Failed to start video call")
    } finally {
      setVideoCallLoading(false)
    }
  }

  const handleCall = async (type: "phone" | "video") => {
    if (!selectedConversation) {
      toast.error("Wählen Sie zuerst eine Unterhaltung aus")
      return
    }

    if (selectedConversation.isBlocked && selectedConversation.blockedByUserId !== null) {
      if (selectedConversation.blockedByUserId === currentUserId) {
        toast.error("Entsperren Sie diesen Benutzer, bevor Sie fortfahren")
      } else {
        toast.error("Dieser Benutzer hat Sie blockiert")
      }
      return
    }

    if (type === "phone") {
      const phone = selectedConversation.otherUserPhone || ""
      const sanitized = phone.replace(/[^+\d]/g, "")
      if (!sanitized) {
        toast.info("Dieser Benutzer hat keine Telefonnummer angegeben")
        return
      }
      window.open(`tel:${sanitized}`)
      return
    }

    if (!videoCallLoading) {
      await initiateVideoCall()
    }
  }

  const handleBlockUser = async () => {
    if (!selectedConversation) return
    const conversationId = selectedConversation.id.toString()
    try {
      const response = await blockConversationAPI(Number(conversationId))
      updateConversationBlockState(conversationId, response.blocked, response.blocked_by_user_id ?? currentUserId ?? null)
      toast.success("Benutzer gesperrt")
    } catch (error: any) {
      logger.error("Failed to block user:", error)
      toast.error(error?.message || "Fehler beim Sperren des Benutzers")
    }
  }

  const handleUnblockUser = async () => {
    if (!selectedConversation) return
    const conversationId = selectedConversation.id.toString()
    try {
      const response = await unblockConversationAPI(Number(conversationId))
      updateConversationBlockState(conversationId, response.blocked, response.blocked_by_user_id ?? null)
      toast.success("Benutzer entsperrt")
    } catch (error: any) {
      logger.error("Failed to unblock user:", error)
      toast.error(error?.message || "Fehler beim Entsperren des Benutzers")
    }
  }

  const handleDeleteChat = async () => {
    if (!selectedConversation) return
    const conversationIdStr = selectedConversation.id.toString()

    const confirmed = window.confirm("Diese Unterhaltung löschen? Diese Aktion kann nicht rückgängig gemacht werden.")
    if (!confirmed) {
      return
    }

    try {
      await deleteConversationAPI(Number(conversationIdStr))

      let fallbackConversation: Conversation | null = null
      setConversations((prev) => {
        const filtered = prev.filter((conv) => conv.id.toString() !== conversationIdStr)
        fallbackConversation = filtered.length > 0 ? filtered[0] : null
        return filtered
      })

      setMessages((prev) => {
        const next = { ...prev }
        delete next[conversationIdStr]
        return next
      })

      setSelectedConversation((prev) => {
        if (!prev || prev.id.toString() !== conversationIdStr) {
          return prev
        }
        if (fallbackConversation) {
          return { ...fallbackConversation, unread: 0 }
        }
        return null
      })

      if (!fallbackConversation) {
        setShowMobileChat(false)
      }

      toast.success("Unterhaltung gelöscht")
    } catch (error: any) {
      logger.error("Failed to delete conversation:", error)
      toast.error(error?.message || "Fehler beim Löschen der Unterhaltung")
    }
  }

  const getConversationProfileHref = (conv: Conversation): string | null => {
    const { otherUserRole, otherProfileId, otherUserId } = conv
    if (otherUserRole === "master" && otherProfileId) return `/detailed/master/${otherProfileId}`
    if ((otherUserRole === "seller" || otherUserRole === "client") && otherProfileId) return `/detailed/master/${otherProfileId}`
    if (otherUserId) return `/profile?user=${otherUserId}`
    return null
  }

  const handleViewProfile = () => {
    if (!selectedConversation) return
    const href = getConversationProfileHref(selectedConversation)
    if (href) {
      router.push(href)
      return
    }
    toast.info("Profilinformationen sind für diesen Benutzer noch nicht verfügbar")
  }

  const handleMoreMenuAction = (action: "view-profile" | "block-user" | "delete-chat") => {
    if (!selectedConversation) return

    switch (action) {
      case "view-profile":
        handleViewProfile()
        break
      case "block-user":
        if (isBlockedByMe) {
          void handleUnblockUser()
        } else {
          void handleBlockUser()
        }
        break
      case "delete-chat":
        void handleDeleteChat()
        break
      default:
        break
    }
  }

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.onopen = null
          wsRef.current.onmessage = null
          wsRef.current.onerror = null
          wsRef.current.onclose = null
          if (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close(1000, "Component unmounting")
          }
        } catch (error) {
          logger.error("Error closing WebSocket on unmount:", error)
        }
        wsRef.current = null
      }
    }
  }, [])

  // Preload notification sound so it plays without delay on mobile
  useEffect(() => {
    if (typeof window === "undefined") return
    const audio = new Audio("/sounds/delivered-message-sound.mp3")
    audio.preload = "auto"
    audio.load()
  }, [])

  if (loading && conversations.length === 0) {
    return (
      <div className="h-[calc(100dvh-3.5rem)] min-h-[200px] sm:h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-7rem)] bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Unterhaltungen werden geladen...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "bg-background flex flex-col overflow-hidden",
        "h-[calc(100dvh-3.5rem)] min-h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)]",
        "sm:h-[calc(100dvh-5.5rem)] sm:min-h-[calc(100dvh-5.5rem)] sm:max-h-[calc(100dvh-5.5rem)]",
        "md:h-[calc(100dvh-7rem)] md:min-h-[calc(100dvh-7rem)] md:max-h-[calc(100dvh-7rem)]",
      )}
    >
      {isMobile && !installBannerDismissed && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 bg-primary/10 border-b border-border/50 text-sm">
          <Download className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="text-foreground font-medium truncate flex-1 min-w-0">
            App auf den Startbildschirm
          </span>
          <Button
            size="sm"
            className="shrink-0 h-8 px-3 text-xs font-semibold"
            onClick={handleInstallClick}
            disabled={installPromptPending}
          >
            {installPromptPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hinzufügen"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={dismissInstallBanner}
            aria-label="Hinweis schließen"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <AddToHomeScreenSheet open={showInstallInstructions} onOpenChange={setShowInstallInstructions} />
      <div className="container mx-auto px-sides flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Conversations List */}
          <div
            className={cn(
              "w-full lg:w-80 xl:w-96 flex flex-col border-r border-border/50 bg-background",
              showMobileChat && "hidden lg:flex",
              !showMobileChat && "flex",
            )}
          >
            <div className="p-3 sm:p-4 border-b border-border/50 bg-background/95 backdrop-blur-sm shrink-0">
              <h2 className="text-lg sm:text-xl font-bold mb-3">Nachrichten</h2>
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Suchen..."
                  className="pl-8 h-9 text-sm bg-muted/50 border-border/50 focus:bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-1.5">
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                      <MessageCircle className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Keine Unterhaltungen</p>
                    <p className="text-xs text-muted-foreground">Beginnen Sie eine neue Unterhaltung</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredConversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        onClick={() => handleSelectConversation(conversation)}
                        className={cn(
                          "w-full p-2.5 rounded-lg transition-all duration-200 text-left group",
                          "hover:bg-muted/50 active:bg-muted",
                          selectedConversation?.id === conversation.id && "bg-primary/10 hover:bg-primary/15",
                          (conversation.unread ?? 0) > 0 && selectedConversation?.id !== conversation.id && "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary/70",
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          {getConversationProfileHref(conversation) ? (
                            <Link
                              href={getConversationProfileHref(conversation)!}
                              className="flex items-center gap-2.5 shrink-0 min-w-0 hover:opacity-80 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                              title="Profil anzeigen"
                            >
                              <div className="relative shrink-0">
                                <Avatar className="h-10 w-10 sm:h-11 sm:w-11">
                                  <AvatarImage src={getOptimizedImageUrl(conversation.avatar, 'thumbnail') || "/placeholder.svg"} />
                                  <AvatarFallback className="text-xs font-medium">
                                    {conversation.name[0]?.toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                {conversation.online && (
                                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{conversation.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{conversation.profession}</p>
                              </div>
                            </Link>
                          ) : (
                            <>
                              <div className="relative shrink-0">
                                <Avatar className="h-10 w-10 sm:h-11 sm:w-11">
                                  <AvatarImage src={getOptimizedImageUrl(conversation.avatar, 'thumbnail') || "/placeholder.svg"} />
                                  <AvatarFallback className="text-xs font-medium">
                                    {conversation.name[0]?.toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                {conversation.online && (
                                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                  <p className="font-semibold text-sm truncate">{conversation.name}</p>
                                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                                    {conversation.timestamp}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs text-muted-foreground truncate line-clamp-1 flex-1">
                                    {conversation.lastMessage}
                                  </p>
                                  {conversation.lastMessageSenderId === currentUserId && (
                                    <div className="flex items-center shrink-0">
                                    {conversation.lastMessageRead ? (
                                      <CheckCheck className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Check className="h-3 w-3 text-zinc-400" />
                                    )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                          {getConversationProfileHref(conversation) ? (
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                                  {conversation.timestamp}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs text-muted-foreground truncate line-clamp-1 flex-1">
                                  {conversation.lastMessage}
                                </p>
                                {conversation.lastMessageSenderId === currentUserId && (
                                  <div className="flex items-center shrink-0">
                                  {conversation.lastMessageRead ? (
                                    <CheckCheck className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Check className="h-3 w-3 text-zinc-400" />
                                  )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                          {(conversation.unread ?? 0) > 0 && (
                            <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold shrink-0 bg-primary text-black border-0 flex items-center justify-center rounded-full">
                              {(conversation.unread ?? 0) > 99 ? "99+" : String(conversation.unread ?? 0)}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div
            className={cn(
              "flex-1 min-h-0 flex flex-col bg-background",
              !showMobileChat && "hidden lg:flex",
              showMobileChat && "flex",
            )}
          >
            {selectedConversation ? (
              <>
                <div className="p-3 sm:p-4 border-b border-border/50 bg-background/95 backdrop-blur-sm flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden h-8 w-8 shrink-0"
                      onClick={() => setShowMobileChat(false)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    {getConversationProfileHref(selectedConversation) ? (
                      <Link
                        href={getConversationProfileHref(selectedConversation)!}
                        className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                        title="Profil anzeigen"
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                            <AvatarImage src={getOptimizedImageUrl(selectedConversation.avatar, 'thumbnail') || "/placeholder.svg"} />
                            <AvatarFallback className="text-xs font-medium">
                              {selectedConversation.name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {selectedConversation.online && (
                            <span className="absolute bottom-0 right-0 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-green-500 border-2 border-background" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{selectedConversation.name}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            {selectedConversation.profession && <span>{selectedConversation.profession}</span>}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <>
                        <div className="relative shrink-0">
                          <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                            <AvatarImage src={getOptimizedImageUrl(selectedConversation.avatar, 'thumbnail') || "/placeholder.svg"} />
                            <AvatarFallback className="text-xs font-medium">
                              {selectedConversation.name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {selectedConversation.online && (
                            <span className="absolute bottom-0 right-0 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-green-500 border-2 border-background" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{selectedConversation.name}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            {selectedConversation.profession && <span>{selectedConversation.profession}</span>}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleCall("phone")} disabled={!canSendMessages}>
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleCall("video")} disabled={!canSendMessages || videoCallLoading}> 
                      {videoCallLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => handleMoreMenuAction("view-profile")}>
                          Profil anzeigen
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleMoreMenuAction("block-user")}>
                          {isBlockedByMe ? "Benutzer entsperren" : "Benutzer sperren"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => handleMoreMenuAction("delete-chat")} className="text-destructive">
                          Chat löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
                  <div className="p-3 sm:p-4 pb-4">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {currentMessages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 space-y-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                              <MessageCircle className="h-8 w-8 text-primary" />
                            </div>
                            <div className="text-center space-y-2 max-w-sm">
                              <h3 className="text-lg font-bold text-foreground">Noch keine Nachrichten</h3>
                              <p className="text-sm text-muted-foreground">
                                Sagen Sie Hallo zu <span className="font-semibold text-foreground">{selectedConversation.name}</span> und beginnen Sie die Unterhaltung!
                              </p>
                            </div>
                            <Button
                              onClick={() => {
                                messageInputRef.current?.focus()
                              }}
                              size="default"
                              className="gap-2 h-10 px-6 font-medium"
                            >
                              <MessageCircle className="h-4 w-4" />
                              Unterhaltung beginnen
                            </Button>
                          </div>
                        ) : (
                          <>
                            {loadingMoreMessages && (
                              <div className="flex items-center justify-center py-3" ref={messagesTopRef}>
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              </div>
                            )}
                            {groupMessagesByDate(currentMessages).map((group) => (
                              <div key={group.date} className="space-y-3 sm:space-y-2">
                                <div className="flex items-center justify-center py-2">
                                  <div className="flex items-center gap-2 px-3 w-full">
                                    <div className="h-px flex-1 bg-border/50" />
                                    <span className="text-[10px] sm:text-xs font-medium text-muted-foreground px-2.5 py-1 rounded-full bg-muted/50 backdrop-blur-sm">
                                      {formatDateHeader(group.messages[0]?.created_at)}
                                    </span>
                                    <div className="h-px flex-1 bg-border/50" />
                                  </div>
                                </div>
                                {group.messages.map((message, messageIndex) => {
                                  const messageKeyParts = [
                                    message.id,
                                    message.created_at,
                                    message.timestamp,
                                    messageIndex,
                                  ]
                                  const messageKeyBase = messageKeyParts
                                    .filter((part) => part != null && part !== "")
                                    .map((part) => String(part))
                                    .join("-")
                                  const messageKey = messageKeyBase || `message-${group.date}-${messageIndex}`

                                  return (
                                    <div
                                      key={messageKey}
                                      className={cn(
                                        "flex",
                                        message.sender === "me" ? "justify-end" : "justify-start",
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "max-w-[85%] sm:max-w-[75%] md:max-w-[65%] min-w-[60px] rounded-2xl px-4 py-2.5 sm:px-3 sm:py-2 break-words",
                                          message.sender === "me"
                                            ? "bg-primary text-black font-bold rounded-br-sm"
                                            : "bg-muted text-foreground rounded-bl-sm",
                                        )}
                                      >
                                        {message.content?.trim() ? (
                                          <p className="text-[15px] sm:text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                        ) : !message.attachments?.length ? (
                                          <p className="text-[15px] sm:text-sm leading-relaxed invisible select-none">.</p>
                                        ) : null}
                                        {message.attachments && message.attachments.length > 0 && (
                                          <div className="mt-2 space-y-2">
                                            {message.attachments.map((attachment, attachmentIndex) => {
                                              const url = attachment.fileUrl || attachment.rawUrl || ""
                                              const isImage = attachment.fileType?.startsWith("image/")

                                              if (!url) {
                                                return null
                                              }

                                              return (
                                                <div key={`${message.id}-${attachment.id ?? `${attachment.fileUrl}-${attachmentIndex}`}`} className="group/attachment">
                                                  {isImage ? (
                                                    <a
                                                      href={url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="block"
                                                    >
                                                      <img
                                                        src={url}
                                                        alt={attachment.fileName}
                                                        className="max-h-48 rounded-lg border border-border/40 object-cover"
                                                      />
                                                    </a>
                                                  ) : (
                                                    <a
                                                      href={url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className={cn(
                                                        "flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 text-xs",
                                                        message.sender === "me"
                                                          ? "bg-primary/20 text-black font-medium"
                                                          : "bg-background/60 text-foreground"
                                                      )}
                                                    >
                                                      <Paperclip className="h-3.5 w-3.5" />
                                                      <span className="truncate max-w-[200px]">{attachment.fileName}</span>
                                                    </a>
                                                  )}
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                        <div className="flex items-center justify-end gap-1.5 mt-1.5">
                                          <p
                                            className={cn(
                                              "text-[11px] sm:text-[10px]",
                                              message.sender === "me"
                                                ? "text-primary-foreground/70"
                                                : "text-muted-foreground",
                                            )}
                                          >
                                            {message.timestamp}
                                          </p>
                                          {message.sender === "me" && (
                                            <div className="flex items-center shrink-0">
                                            {message.is_read ? (
                                              <CheckCheck className="h-3 w-3 text-emerald-400" />
                                            ) : (
                                              <Check className="h-3 w-3 text-zinc-400" />
                                            )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ))}
                          </>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {(() => {
                  const shouldShowInput = selectedConversation && (showMobileChat || !isMobile)
                  if (!shouldShowInput) return null
                  const inputBar = (
                    <div
                      className={cn(
                        "p-3 sm:p-4 border-t border-border/50 bg-background backdrop-blur-sm shrink-0",
                        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
                      )}
                    >
                      {isBlockedAgainstMe && (
                        <div className="text-xs text-destructive mb-2">
                          Sie können diesem Benutzer keine Nachrichten mehr senden.
                        </div>
                      )}
                      {isBlockedByMe && (
                        <div className="text-xs text-muted-foreground mb-2">
                          Sie haben diesen Benutzer gesperrt. Entsperren Sie ihn, um den Chat fortzusetzen.
                        </div>
                      )}
                      <div className="flex items-end gap-2 w-full min-w-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 sm:h-10 sm:w-10 shrink-0 hover:bg-muted touch-manipulation"
                          onClick={handleAttachmentButtonClick}
                          disabled={attachmentUploading || !canSendMessages}
                          aria-label="Anhang hinzufügen"
                        >
                          {attachmentUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleAttachmentInputChange}
                          className="hidden"
                        />
                        <Textarea
                          ref={messageInputRef}
                          placeholder="Nachricht eingeben..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleSendMessage()
                            }
                          }}
                          className="flex-1 min-w-0 min-h-[44px] max-h-[120px] text-base sm:text-sm rounded-2xl border-border/50 focus:border-primary bg-muted/50 focus:bg-background resize-none py-3 px-4 leading-5 overflow-y-auto scrollbar-hide touch-manipulation"
                          disabled={!canSendMessages || sending}
                          rows={1}
                          aria-label="Nachricht eingeben"
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={!messageInput.trim() || sending || !canSendMessages}
                          size="icon"
                          className="h-10 w-10 shrink-0 rounded-full touch-manipulation"
                          aria-label="Nachricht senden"
                        >
                          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )
                  return inputBar
                })()}
              </>
            ) : (
              <div className="flex items-center justify-center h-full p-8">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50">
                    <MessageCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">Keine Unterhaltung ausgewählt</p>
                  <p className="text-sm text-muted-foreground">Wählen Sie eine Unterhaltung aus, um mit dem Messaging zu beginnen</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <MessagesPageContent />
    </Suspense>
  )
}
