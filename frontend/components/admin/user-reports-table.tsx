"use client"

import { useCallback, useEffect, useState } from "react"
import { getUserReports, resolveUserReport, type UserReportAdminRow } from "@/lib/api/admin"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { format } from "date-fns"
import { de } from "date-fns/locale/de"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  DEFAULT_ACTION_BY_VIOLATION,
  REPORT_ACTIONS,
  REPORT_VIOLATION_TYPES,
  getActionLabel,
  getReportStatusLabel,
  getViolationLabel,
  type ReportModerationAction,
  type ReportViolationType,
} from "@/lib/constants/user-report-moderation"
import { TRUST_EMAIL } from "@/lib/constants/trust"
import { toast } from "sonner"
import { ApiClientError } from "@/lib/api/client"

type StatusFilter = "in_review" | "resolved" | "rejected" | "all"

export function UserReportsTable() {
  const [items, setItems] = useState<UserReportAdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("in_review")
  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeReport, setActiveReport] = useState<UserReportAdminRow | null>(null)
  const [violationType, setViolationType] = useState<ReportViolationType>("first_minor")
  const [action, setAction] = useState<ReportModerationAction>("warning")
  const [adminNote, setAdminNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadReports = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getUserReports({
        page: 1,
        page_size: 50,
        status: statusFilter === "all" ? undefined : statusFilter,
      })
      setItems(res.items ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const openResolveDialog = (row: UserReportAdminRow) => {
    const prior = row.prior_reports_count ?? 0
    const suggestedViolation: ReportViolationType =
      prior > 0 ? "repeated" : row.reason === "Betrug" ? "fraud" : "first_minor"
    setActiveReport(row)
    setViolationType(suggestedViolation)
    setAction(DEFAULT_ACTION_BY_VIOLATION[suggestedViolation])
    setAdminNote("")
    setDialogOpen(true)
  }

  const handleViolationChange = (value: ReportViolationType) => {
    setViolationType(value)
    setAction(DEFAULT_ACTION_BY_VIOLATION[value])
  }

  const handleResolve = async () => {
    if (!activeReport) return
    setSubmitting(true)
    try {
      await resolveUserReport(activeReport.id, {
        violation_type: violationType,
        action,
        admin_note: adminNote.trim() || undefined,
      })
      toast.success("Meldung bearbeitet — E-Mails wurden versendet")
      setDialogOpen(false)
      setActiveReport(null)
      await loadReports()
    } catch (err: unknown) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Bearbeitung fehlgeschlagen"
      toast.error(msg)
    } finally {
      setSubmitting(false)
      setResolvingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-4 sm:inline-flex">
            <TabsTrigger value="in_review">Offen</TabsTrigger>
            <TabsTrigger value="resolved">Bearbeitet</TabsTrigger>
            <TabsTrigger value="rejected">Abgelehnt</TabsTrigger>
            <TabsTrigger value="all">Alle</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">
          Trust-E-Mail:{" "}
          <a href={`mailto:${TRUST_EMAIL}`} className="font-medium text-primary hover:underline">
            {TRUST_EMAIL}
          </a>
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Keine Meldungen in dieser Ansicht.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Melder</TableHead>
                <TableHead>Gemeldet</TableHead>
                <TableHead>Grund</TableHead>
                <TableHead>Frühere</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Maßnahme</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {row.created_at
                      ? format(new Date(row.created_at), "dd.MM.yyyy HH:mm", { locale: de })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{row.reporter_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{row.reported_user_name ?? "—"}</TableCell>
                  <TableCell className="text-sm max-w-[8rem] truncate">{row.reason}</TableCell>
                  <TableCell className="text-xs text-center">
                    {(row.prior_reports_count ?? 0) > 0 ? (
                      <Badge variant="outline" className="text-amber-700 border-amber-300">
                        {row.prior_reports_count}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[14rem]">
                    <span className="line-clamp-2">{row.details || "—"}</span>
                    {row.conversation_id ? (
                      <span className="block text-[10px] mt-0.5">Chat #{row.conversation_id}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "in_review"
                          ? "secondary"
                          : row.status === "resolved"
                            ? "default"
                            : "outline"
                      }
                    >
                      {getReportStatusLabel(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-[10rem]">
                    {row.action_taken ? getActionLabel(row.action_taken) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.status === "in_review" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={resolvingId === row.id}
                        onClick={() => {
                          setResolvingId(row.id)
                          openResolveDialog(row)
                        }}
                      >
                        Bearbeiten
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {row.violation_type ? getViolationLabel(row.violation_type) : "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setActiveReport(null)
            setResolvingId(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Meldung bearbeiten</DialogTitle>
            <DialogDescription>
              Schritt 3: Verstoß und Maßnahme wählen. Schritt 4: Meister und Melder werden per E-Mail
              informiert.
            </DialogDescription>
          </DialogHeader>
          {activeReport && (
            <div className="space-y-4 py-1">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Gemeldet:</span>{" "}
                  {activeReport.reported_user_name}
                </p>
                <p>
                  <span className="text-muted-foreground">Grund:</span> {activeReport.reason}
                </p>
                <p>
                  <span className="text-muted-foreground">Frühere bearbeitete Meldungen:</span>{" "}
                  {activeReport.prior_reports_count ?? 0}
                </p>
                {activeReport.details && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap pt-1 border-t mt-2">
                    {activeReport.details}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Verstoß</Label>
                <Select value={violationType} onValueChange={(v) => handleViolationChange(v as ReportViolationType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_VIOLATION_TYPES.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Maßnahme</Label>
                <Select value={action} onValueChange={(v) => setAction(v as ReportModerationAction)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_ACTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-note">Interne Notiz (optional, in E-Mail an Meister)</Label>
                <Textarea
                  id="admin-note"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Begründung für den Meister…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Abbrechen
            </Button>
            <Button onClick={() => void handleResolve()} disabled={submitting || !activeReport}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Speichern & benachrichtigen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
