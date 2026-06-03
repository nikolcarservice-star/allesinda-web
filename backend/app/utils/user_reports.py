"""Shared helpers for user complaints (chat and profile reports)."""
from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from ..config import settings
from ..constants.user_reports import ACTION_LABELS, VIOLATION_LABELS
from ..models import Role, User, UserReport
from ..utils.email import (
    send_report_resolved_reported_email,
    send_report_resolved_reporter_email,
    send_user_report_email,
)
from ..utils.notifications import create_notification

logger = logging.getLogger(__name__)


def notify_user_report(
    db: Session,
    report: UserReport,
    reporter: User,
    reported_user: Optional[User],
    *,
    source_label: str,
    profile_id: Optional[int] = None,
) -> None:
    """In-app admin alerts and email to the trust team."""
    reporter_name = (reporter.name or reporter.email or "Nutzer").strip()
    reported_name = (
        (reported_user.name if reported_user else None)
        or f"User #{report.reported_user_id}"
    )

    admins = db.query(User).filter(User.role == Role.admin, User.is_active == True).all()
    for admin in admins:
        try:
            create_notification(
                db=db,
                user_id=admin.id,
                type="user_report",
                title="Neue Meldung",
                message=f"{reporter_name} hat {reported_name} gemeldet: {report.reason}",
                related_id=report.id,
            )
        except Exception as e:
            logger.warning("Failed to notify admin %s about user report: %s", admin.id, e)

    details = (report.details or "").strip() or None
    profile_url = (
        f"{settings.FRONTEND_URL}/detailed/master/{profile_id}"
        if profile_id is not None
        else None
    )
    admin_url = f"{settings.FRONTEND_URL}/admin?tab=reports"

    def _send_email() -> None:
        try:
            send_user_report_email(
                to_email=settings.TRUST_EMAIL,
                reporter_name=reporter_name,
                reported_name=reported_name,
                reason=report.reason,
                details=details,
                source_label=source_label,
                profile_url=profile_url,
                admin_url=admin_url,
                report_id=report.id,
            )
        except Exception as e:
            logger.error("Failed to send user report email for report %s: %s", report.id, e)

    thread = threading.Thread(target=_send_email, daemon=True)
    thread.start()


def count_prior_resolved_reports(db: Session, reported_user_id: int, exclude_id: int) -> int:
    return (
        db.query(UserReport)
        .filter(
            UserReport.reported_user_id == reported_user_id,
            UserReport.id != exclude_id,
            UserReport.status == "resolved",
        )
        .count()
    )


def apply_report_action(db: Session, reported_user: User, action: str) -> None:
    """Apply account sanctions for a resolved complaint."""
    if action == "warning" or action == "rejected":
        return
    if action == "block_7d":
        reported_user.suspended_until = datetime.now(timezone.utc) + timedelta(days=7)
        return
    if action in ("block_permanent", "block_immediate"):
        reported_user.is_active = False
        reported_user.suspended_until = None


def notify_report_resolution(
    db: Session,
    report: UserReport,
    reporter: User,
    reported_user: User,
    *,
    action: str,
    violation_type: str,
) -> None:
    """In-app + email notifications after moderation (Step 4)."""
    action_label = ACTION_LABELS.get(action, action)
    violation_label = VIOLATION_LABELS.get(violation_type, violation_type)
    reporter_name = (reporter.name or reporter.email or "Nutzer").strip()
    reported_name = (reported_user.name or reported_user.email or "Nutzer").strip()

    try:
        create_notification(
            db=db,
            user_id=reporter.id,
            type="user_report",
            title="Meldung bearbeitet",
            message=f"Ihre Meldung zu {reported_name} wurde bearbeitet.",
            related_id=report.id,
        )
    except Exception as e:
        logger.warning("Failed to notify reporter %s: %s", reporter.id, e)

    if action != "rejected":
        try:
            create_notification(
                db=db,
                user_id=reported_user.id,
                type="user_report",
                title="Entscheidung zu Ihrer Meldung",
                message=f"Maßnahme: {action_label}",
                related_id=report.id,
            )
        except Exception as e:
            logger.warning("Failed to notify reported user %s: %s", reported_user.id, e)

    admin_note = (report.admin_note or "").strip() or None

    def _send_emails() -> None:
        try:
            send_report_resolved_reporter_email(
                reporter.email,
                reporter_name,
                reported_name,
                report.id,
            )
        except Exception as e:
            logger.error("Reporter resolution email failed for report %s: %s", report.id, e)

        if action != "rejected":
            try:
                send_report_resolved_reported_email(
                    reported_user.email,
                    reported_name,
                    action_label,
                    violation_label,
                    admin_note,
                )
            except Exception as e:
                logger.error("Reported user resolution email failed for report %s: %s", report.id, e)

    threading.Thread(target=_send_emails, daemon=True).start()
