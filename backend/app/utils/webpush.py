"""Web Push utility – send push notifications to PWA clients (e.g. when app is on home screen)."""
import json
import logging
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)


def send_web_push(
    endpoint: str,
    p256dh: str,
    auth: str,
    title: str,
    body: str,
    url: str = "/messages",
    tag: str = "message",
) -> bool:
    """Send a web push notification. Returns True if sent successfully."""
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        return False
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed. Install with: pip install pywebpush")
        return False

    payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})
    subscription_info = {
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
    }
    vapid_claims = {"sub": "mailto:support@allesinda.com"}
    try:
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims=vapid_claims,
        )
        return True
    except WebPushException as e:
        if e.response and e.response.status_code in (404, 410):
            logger.info("Push subscription expired or invalid: %s", endpoint[:80])
        else:
            logger.warning("Web push failed: %s", e)
        return False
    except Exception as e:
        logger.warning("Web push error: %s", e)
        return False
