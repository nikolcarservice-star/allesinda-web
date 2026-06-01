"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/lib/context/auth-context"
import { requestAccountDeletion } from "@/lib/api/auth"
import { ApiClientError } from "@/lib/api/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const DELETE_CONFIRMATION = "LÖSCHEN"

type AccountSessionSectionProps = {
  className?: string
}

export function AccountSessionSection({ className }: AccountSessionSectionProps) {
  const { logout } = useAuth()
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)

  const normalizedConfirm = deleteConfirm.trim().toUpperCase()
  const canConfirmDelete =
    deletePassword.trim().length > 0 && normalizedConfirm === DELETE_CONFIRMATION

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const handleRequestDeletion = async () => {
    if (!canConfirmDelete) {
      toast.error(`Bitte geben Sie Ihr Passwort ein und tippen Sie ${DELETE_CONFIRMATION}`)
      return
    }

    setDeleting(true)
    try {
      const result = await requestAccountDeletion(deletePassword, normalizedConfirm)
      setDeleteOpen(false)
      setDeletePassword("")
      setDeleteConfirm("")
      toast.success(result.message)
      const recoveryDate = new Date(result.recovery_until).toLocaleDateString("de-DE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
      toast.info(`Wiederherstellung möglich bis ${recoveryDate}`)
      logout()
      router.push("/login?account_deleted=1")
    } catch (err: unknown) {
      const message =
        err instanceof ApiClientError
          ? typeof err.errors === "string"
            ? err.errors
            : err.message
          : err instanceof Error
            ? err.message
            : "Konto konnte nicht gelöscht werden"
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className={cn("space-y-3 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm", className)}>
      <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Konto & Sitzung</h2>

      <Button
        type="button"
        variant="outline"
        onClick={handleLogout}
        className="h-12 w-full justify-center gap-2 rounded-xl border-neutral-200 text-base font-medium"
      >
        <LogOut className="h-4 w-4" />
        Abmelden
      </Button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-center gap-2 rounded-xl border-red-200 text-base font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Konto löschen
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-lg font-semibold">
              Konto wirklich löschen?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left text-sm leading-relaxed text-neutral-600">
                <p>
                  Ihr Konto wird deaktiviert. Sie haben 14 Tage Zeit, um es wiederherzustellen — melden Sie sich
                  einfach erneut an.
                </p>
                <p>Nach Ablauf der Frist werden Ihre Daten endgültig anonymisiert.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="delete-password">Passwort</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Ihr aktuelles Passwort"
                className="h-11 rounded-xl"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Zur Bestätigung LÖSCHEN eingeben</Label>
              <Input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="LÖSCHEN"
                className="h-11 rounded-xl"
                autoComplete="off"
              />
            </div>
          </div>

          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogCancel className="mt-0 h-11 w-full rounded-xl">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirmDelete || deleting}
              onClick={(e) => {
                e.preventDefault()
                void handleRequestDeletion()
              }}
              className="h-11 w-full rounded-xl bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Konto löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
