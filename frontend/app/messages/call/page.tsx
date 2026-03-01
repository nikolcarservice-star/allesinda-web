"use client"

export const dynamic = "force-dynamic"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

function CallPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const room = searchParams.get("room")
  const conversationId = searchParams.get("conversation_id")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const baseUrl = (typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_VIDEO_CALL_BASE_URL || "https://meet.jit.si/Allesinda").replace(/\/$/, "")
    : "https://meet.jit.si/Allesinda")
  const callUrl = room ? `${baseUrl}/${encodeURIComponent(room)}` : ""

  const handleBack = () => {
    const returnUrl = conversationId
      ? `/messages?conversation_id=${encodeURIComponent(conversationId)}`
      : "/messages"
    router.replace(returnUrl)
  }

  if (!mounted || !room) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-muted-foreground">
          {!room ? "Kein Raum angegeben." : "Laden…"}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            const returnUrl = conversationId
              ? `/messages?conversation_id=${encodeURIComponent(conversationId)}`
              : "/messages"
            router.replace(returnUrl)
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zu Nachrichten
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Back button - always visible so user can leave and return to app */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-2 p-3 safe-area-inset-top bg-background/90 backdrop-blur-sm border-b border-border/50">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleBack}
          className="shrink-0"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zu Nachrichten
        </Button>
      </div>

      {/* Full-height iframe for Jitsi; leave space for the bar */}
      <div className="flex-1 pt-14 w-full h-full min-h-0">
        <iframe
          src={callUrl}
          title="Videoanruf"
          className="w-full h-full min-h-[200px] border-0"
          allow="camera; microphone; fullscreen; display-capture"
          allowFullScreen
        />
      </div>
    </div>
  )
}

export default function CallPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Laden…</p>
        </div>
      }
    >
      <CallPageContent />
    </Suspense>
  )
}
