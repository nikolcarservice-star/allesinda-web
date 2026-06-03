export const REPORT_VIOLATION_TYPES = [
  { value: "first_minor", label: "Erste Meldung, geringfügig" },
  { value: "repeated", label: "Wiederholte Meldung" },
  { value: "fraud", label: "Betrug / Täuschung" },
  { value: "threats", label: "Beleidigung / Drohungen" },
] as const

export const REPORT_ACTIONS = [
  { value: "warning", label: "Verwarnung an den Meister" },
  { value: "block_7d", label: "Vorübergehende Sperre (7 Tage)" },
  { value: "block_permanent", label: "Dauerhafte Sperre" },
  { value: "block_immediate", label: "Sofortige Sperre" },
  { value: "rejected", label: "Abgelehnt (keine Maßnahme)" },
] as const

export const DEFAULT_ACTION_BY_VIOLATION: Record<
  (typeof REPORT_VIOLATION_TYPES)[number]["value"],
  (typeof REPORT_ACTIONS)[number]["value"]
> = {
  first_minor: "warning",
  repeated: "block_7d",
  fraud: "block_permanent",
  threats: "block_immediate",
}

export type ReportViolationType = (typeof REPORT_VIOLATION_TYPES)[number]["value"]
export type ReportModerationAction = (typeof REPORT_ACTIONS)[number]["value"]

export function getViolationLabel(value?: string | null): string {
  return REPORT_VIOLATION_TYPES.find((v) => v.value === value)?.label ?? value ?? "—"
}

export function getActionLabel(value?: string | null): string {
  return REPORT_ACTIONS.find((a) => a.value === value)?.label ?? value ?? "—"
}

export function getReportStatusLabel(status: string): string {
  if (status === "in_review") return "In Prüfung"
  if (status === "resolved") return "Bearbeitet"
  if (status === "rejected") return "Abgelehnt"
  return status
}
