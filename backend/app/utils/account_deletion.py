"""Account deletion with 14-day recovery window."""

from datetime import datetime, timedelta, timezone
import secrets

from sqlalchemy.orm import Session

from ..models import User
from .user_deletion import get_deletion_requested_at, set_deletion_requested_at

ACCOUNT_DELETION_GRACE_DAYS = 14


def get_recovery_until(user: User) -> datetime | None:
    requested = get_deletion_requested_at(user)
    if not requested:
        return None
    if requested.tzinfo is None:
        requested = requested.replace(tzinfo=timezone.utc)
    return requested + timedelta(days=ACCOUNT_DELETION_GRACE_DAYS)


def is_within_recovery_period(user: User) -> bool:
    recovery_until = get_recovery_until(user)
    if not recovery_until:
        return False
    return datetime.now(timezone.utc) < recovery_until


def permanently_delete_user(db: Session, user: User) -> None:
    """Anonymize account after the recovery period expires."""
    user.email = f"deleted_{user.id}_{secrets.token_hex(6)}@deleted.invalid"
    user.name = "Gelöschter Benutzer"
    user.phone = None
    user.hashed_password = None
    user.is_active = False
    set_deletion_requested_at(user, None)
    user.verification_token = None
    user.reset_token = None
    user.two_factor_enabled = False
    user.two_factor_secret = None
    user.backup_codes = None


def finalize_expired_deletion(db: Session, user: User) -> bool:
    """Permanently delete if grace period ended. Returns True if finalized."""
    if not get_deletion_requested_at(user):
        return False
    if is_within_recovery_period(user):
        return False
    permanently_delete_user(db, user)
    return True
