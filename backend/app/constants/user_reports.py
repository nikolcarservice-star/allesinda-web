"""Complaint moderation constants (aligned with trust process)."""

VIOLATION_TYPES = (
    "first_minor",
    "repeated",
    "fraud",
    "threats",
)

REPORT_ACTIONS = (
    "warning",
    "block_7d",
    "block_permanent",
    "block_immediate",
)

REPORT_STATUSES = ("in_review", "resolved", "rejected")

VIOLATION_LABELS = {
    "first_minor": "Erste Meldung, geringfügig",
    "repeated": "Wiederholte Meldung",
    "fraud": "Betrug / Täuschung",
    "threats": "Beleidigung / Drohungen",
}

ACTION_LABELS = {
    "warning": "Verwarnung an den Meister",
    "block_7d": "Vorübergehende Sperre (7 Tage)",
    "block_permanent": "Dauerhafte Sperre",
    "block_immediate": "Sofortige Sperre",
    "rejected": "Keine Maßnahme (abgelehnt)",
}

DEFAULT_ACTION_BY_VIOLATION = {
    "first_minor": "warning",
    "repeated": "block_7d",
    "fraud": "block_permanent",
    "threats": "block_immediate",
}
