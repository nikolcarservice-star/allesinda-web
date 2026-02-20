"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { toast } from "sonner"

const STORAGE_KEY = "install-prompt-dismissed-until"
const DISMISS_DAYS = 7
const SHOW_DELAY_MS = 2500

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<{ outcome: string }> }

export function InstallPrompt() {
  const isMobile = useIsMobile()
  const [showPrompt, setShowPrompt] = useState(false)
  const [installing, setInstalling] = useState(false)
  const installEventRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => {})
  }, [])

  useEffect(() => {
    if (!isMobile || typeof window === "undefined") return
    const handler = (e: Event) => {
      e.preventDefault()
      installEventRef.current = e as BeforeInstallPromptEvent
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [isMobile])

  useEffect(() => {
    if (!isMobile || typeof window === "undefined") return
    const timer = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        const until = raw ? Number(raw) : 0
        if (Date.now() >= until) setShowPrompt(true)
      } catch {
        setShowPrompt(true)
      }
    }, SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isMobile])

  const dismissForLater = () => {
    setShowPrompt(false)
    try {
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
      window.localStorage.setItem(STORAGE_KEY, String(until))
    } catch {
      // ignore
    }
  }

  const handleInstall = async () => {
    const ev = installEventRef.current
    if (ev) {
      setInstalling(true)
      try {
        await ev.prompt()
        setShowPrompt(false)
        try {
          window.localStorage.setItem(STORAGE_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000))
        } catch {
          // ignore
        }
      } catch {
        // user dismissed or error
      } finally {
        setInstalling(false)
      }
    } else {
      setShowPrompt(false)
      toast.info("iPhone: Unten auf Teilen tippen → „Zum Home-Bildschirm“ → Hinzufügen", {
        duration: 6000,
      })
    }
  }

  if (!isMobile) return null

  return (
    <>
      <Sheet open={showPrompt} onOpenChange={(open: boolean) => !open && dismissForLater()}>
        <SheetContent
          side="bottom"
          showClose={false}
          className="rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>Allesinda als App installieren?</SheetTitle>
            <SheetDescription className="text-left">
              App auf den Startbildschirm legen für schnelleren Zugriff – wie eine native App.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              className="w-full"
              size="lg"
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? "Wird installiert…" : "Jetzt installieren"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              size="lg"
              onClick={dismissForLater}
              disabled={installing}
            >
              Später
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
