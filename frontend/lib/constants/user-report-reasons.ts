export const USER_REPORT_REASONS = [
  "Belästigung",
  "Betrug",
  "Spam",
  "Unangemessene Inhalte",
  "Sonstiges",
] as const

export type UserReportReason = (typeof USER_REPORT_REASONS)[number]
