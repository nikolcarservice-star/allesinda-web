"""Shared helpers for user complaints (chat and profile reports)."""
from __future__ import annotations

import logging
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


def _normalized_email(user: User | None) -> str | None:
    if user is None:
        return None
    email = (user.email or "").strip()
    return email or None


def _send_resolution_emails(
    *,
    report_id: int,
    reporter_email: str | None,
    reporter_name: str,
    reported_email: str | None,
    reported_name: str,
    action: str,
    action_label: str,
    violation_label: str,
    admin_note: str | None,
) -> None:
    """Send resolution emails synchronously (ORM session must not be used here)."""
    if reporter_email:
        try:
            sent = send_report_resolved_reporter_email(
                reporter_email,
                reporter_name,
                reported_name,
                report_id,
                action_label=action_label,
                violation_label=violation_label,
                admin_note=admin_note,
            )
            if not sent:
                logger.warning(
                    "Reporter resolution email not sent for report %s (SMTP or delivery failed)",
                    report_id,
                )
        except Exception as e:
            logger.error("Reporter resolution email failed for report %s: %s", report_id, e)
    else:
        logger.warning("No reporter email for report %s — skipping resolution email", report_id)

    if action == "rejected":
        return

    if reported_email:
        try:
            sent = send_report_resolved_reported_email(
                reported_email,
                reported_name,
                action_label,
                violation_label,
                admin_note,
            )
            if not sent:
                logger.warning(
                    "Reported-user resolution email not sent for report %s (SMTP or delivery failed)",
                    report_id,
                )
        except Exception as e:
            logger.error("Reported user resolution email failed for report %s: %s", report_id, e)
    else:
        logger.warning("No reported-user email for report %s — skipping resolution email", report_id)


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
    report_id = report.id
    report_reason = report.reason
    details = (report.details or "").strip() or None
    profile_url = (
        f"{settings.FRONTEND_URL}/detailed/master/{profile_id}"
        if profile_id is not None
        else None
    )
    admin_url = f"{settings.FRONTEND_URL}/admin?tab=reports"

    admins = db.query(User).filter(User.role == Role.admin, User.is_active == True).all()
    for admin in admins:
        try:
            create_notification(
                db=db,
                user_id=admin.id,
                type="user_report",
                title="Neue Meldung",
                message=f"{reporter_name} hat {reported_name} gemeldet: {report_reason}",
                related_id=report_id,
            )
        except Exception as e:
            logger.warning("Failed to notify admin %s about user report: %s", admin.id, e)

    try:
        sent = send_user_report_email(
            to_email=settings.TRUST_EMAIL,
            reporter_name=reporter_name,
            reported_name=reported_name,
            reason=report_reason,
            details=details,
            source_label=source_label,
            profile_url=profile_url,
            admin_url=admin_url,
            report_id=report_id,
        )
        if not sent:
            logger.warning("Trust-team email not sent for new report %s", report_id)
    except Exception as e:
        logger.error("Failed to send user report email for report %s: %s", report_id, e)


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
    report_id = report.id
    admin_note = (report.admin_note or "").strip() or None

    # Capture emails before further commits expire ORM instances.
    reporter_email = _normalized_email(reporter)
    reported_email = _normalized_email(reported_user)

    try:
        create_notification(
            db=db,
            user_id=reporter.id,
            type="user_report",
            title="Meldung bearbeitet",
            message=f"Ihre Meldung zu {reported_name} wurde bearbeitet.",
            related_id=report_id,
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
                related_id=report_id,
            )
        except Exception as e:
            logger.warning("Failed to notify reported user %s: %s", reported_user.id, e)

    _send_resolution_emails(
        report_id=report_id,
        reporter_email=reporter_email,
        reporter_name=reporter_name,
        reported_email=reported_email,
        reported_name=reported_name,
        action=action,
        action_label=action_label,
        violation_label=violation_label,
        admin_note=admin_note,
    )
