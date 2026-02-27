"""Web Push: VAPID public key and subscription registration for PWA push notifications."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import PushSubscription, User
from ..security import get_current_user

router = APIRouter(prefix="/push", tags=["push"])


class SubscribeIn(BaseModel):
    endpoint: str
    keys: dict  # {"p256dh": str, "auth": str}
    expirationTime: int | None = None


@router.get("/vapid-public-key")
def get_vapid_public_key():
    """Return VAPID public key for the client to subscribe to push. Required for PWA push when app is on home screen."""
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=503,
            detail="Web Push is not configured (VAPID_PUBLIC_KEY not set)",
        )
    return {"publicKey": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
def subscribe(
    data: SubscribeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register or update push subscription for the current user."""
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=503,
            detail="Web Push is not configured",
        )
    keys = data.keys or {}
    p256dh = keys.get("p256dh") or keys.get("p256dh")
    auth = keys.get("auth")
    if not data.endpoint or not p256dh or not auth:
        raise HTTPException(status_code=400, detail="endpoint and keys.p256dh, keys.auth required")

    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == data.endpoint).first()
    if existing:
        if existing.user_id != user.id:
            existing.user_id = user.id
            existing.p256dh = p256dh
            existing.auth = auth
            db.commit()
        return {"ok": True}

    sub = PushSubscription(
        user_id=user.id,
        endpoint=data.endpoint,
        p256dh=p256dh,
        auth=auth,
    )
    db.add(sub)
    db.commit()
    return {"ok": True}
