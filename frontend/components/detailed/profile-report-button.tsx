"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Flag, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { USER_REPORT_REASONS, type UserReportReason } from "@/lib/constants/user-report-reasons"
import { reportMasterProfile } from "@/lib/api/reports"
import { ApiClientError } from "@/lib/api/client"
import { useAuth } from "@/lib/context/auth-context"
import { isAuthenticated } from "@/lib/api/auth"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ProfileReportButtonProps {
  profileId: number
  masterName?: string
  variant?: "default" | "ghost" | "outline"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  showLabel?: boolean
}

export function ProfileReportButton({
  profileId,
  masterName,
  variant = "outline",
  size = "sm",
  className,
  showLabel = true,
}: ProfileReportButtonProps) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<UserReportReason>(USER_REPORT_REASONS[0])
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const openDialog = () => {
    if (authLoading) return
    if (!user && !isAuthenticated()) {
      toast.info("Bitte melden Sie sich an, um eine Meldung zu senden")
      router.push("/login")
      return
    }
    setOpen(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await reportMasterProfile(profileId, {
        reason,
        details: details.trim() || undefined,
      })
      toast.success("Meldung wurde an unser Trust-Team gesendet")
      setOpen(false)
      setDetails("")
    } catch (err: unknown) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Meldung konnte nicht gesendet werden"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(className)}
        onClick={openDialog}
        aria-label="Meldung"
      >
        <Flag className={cn("h-4 w-4", showLabel && "mr-1.5")} aria-hidden />
        {showLabel && <span>Meldung</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Meldung</DialogTitle>
            <DialogDescription>
              {masterName
                ? `Beschreiben Sie kurz Ihr Anliegen zu ${masterName}. Unser Team prüft jede Meldung innerhalb von 24 Stunden.`
                : "Beschreiben Sie kurz das Problem. Unser Team prüft jede Meldung innerhalb von 24 Stunden."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-report-reason">Grund</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as UserReportReason)}>
                <SelectTrigger id="profile-report-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_REPORT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-report-details">Details (optional)</Label>
              <Textarea
                id="profile-report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="z. B. Fotos, Chat-Verlauf, Datum des Vorfalls…"
                rows={4}
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Abbrechen
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Meldung senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
