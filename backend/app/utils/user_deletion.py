"""Safe access to users.deletion_requested_at on legacy databases."""

from datetime import datetime

from sqlalchemy.exc import SQLAlchemyError

from ..models import User


def get_deletion_requested_at(user: User | None) -> datetime | None:
    """Return deletion timestamp, or None if column is missing or unset."""
    if user is None:
        return None
    try:
        return user.deletion_requested_at
    except SQLAlchemyError:
        return None


def set_deletion_requested_at(user: User, value: datetime | None) -> None:
    """Set deletion timestamp; runs schema repair when the column is missing."""
    from ..database import ensure_schema

    ensure_schema()
    user.deletion_requested_at = value
