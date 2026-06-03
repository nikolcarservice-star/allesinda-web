"use client"

import { useEffect, useState } from "react"
import { getUserReports } from "@/lib/api/admin"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { format } from "date-fns"
import { de } from "date-fns/locale/de"

type UserReportRow = {
  id: number
  reporter_name?: string | null
  reported_user_name?: string | null
  conversation_id?: number | null
  reason: string
  details?: string | null
  status: string
  created_at?: string | null
}

export function UserReportsTable() {
  const [items, setItems] = useState<UserReportRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await getUserReports({ page: 1, page_size: 50, status: "in_review" })
        if (!cancelled) setItems((res.items as UserReportRow[]) ?? [])
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Keine offenen Meldungen.</p>
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Melder</TableHead>
            <TableHead>Gemeldet</TableHead>
            <TableHead>Grund</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Chat</TableHead>
            <TableHead>Status</TableHead>
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
              <TableCell className="text-sm max-w-[12rem] truncate">{row.reason}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.details || "—"}
              </TableCell>
              <TableCell className="text-xs">
                {row.conversation_id ? `#${row.conversation_id}` : "—"}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{row.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
