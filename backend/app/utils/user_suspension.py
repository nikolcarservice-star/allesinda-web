"""Account suspension helpers (temporary blocks from trust moderation)."""
from datetime import datetime, timezone
from typing import Optional

from ..models import User


def is_user_suspended(user: User, *, now: Optional[datetime] = None) -> bool:
    until = getattr(user, "suspended_until", None)
    if until is None:
        return False
    current = now or datetime.now(timezone.utc)
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    return until > current


def suspension_message(user: User) -> str:
    until = getattr(user, "suspended_until", None)
    if until is None:
        return "Ihr Konto ist vorübergehend gesperrt."
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    return (
        f"Ihr Konto ist bis {until.strftime('%d.%m.%Y %H:%M')} UTC vorübergehend gesperrt. "
        f"Einspruch innerhalb von 7 Tagen an trust@allesinda.de."
    )
