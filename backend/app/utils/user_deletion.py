"""Safe access to users.deletion_requested_at on legacy databases."""

from datetime import datetime

from sqlalchemy.exc import SQLAlchemyError

from ..models import User

_deletion_column_checked = False


def _ensure_deletion_column() -> None:
    """Add users.deletion_requested_at on legacy DBs without full schema repair."""
    global _deletion_column_checked
    if _deletion_column_checked:
        return

    from ..database import _ensure_column, users_schema_ready

    ready, _ = users_schema_ready()
    if not ready:
        _ensure_column("users", "deletion_requested_at", "TIMESTAMPTZ")
    _deletion_column_checked = True


def get_deletion_requested_at(user: User | None) -> datetime | None:
    """Return deletion timestamp, or None if column is missing or unset."""
    if user is None:
        return None
    try:
        return user.deletion_requested_at
    except SQLAlchemyError:
        return None


def set_deletion_requested_at(user: User, value: datetime | None) -> None:
    """Set deletion timestamp; ensures column exists on legacy databases only."""
    _ensure_deletion_column()
    user.deletion_requested_at = value
