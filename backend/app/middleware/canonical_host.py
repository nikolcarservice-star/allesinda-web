from urllib.parse import urlparse

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse

from ..config import settings

DEFAULT_CANONICAL_HOST = "api.allesinda.de"
LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1"})


def get_canonical_api_host() -> str:
    base_url = settings.BASE_URL
    if not base_url:
        return DEFAULT_CANONICAL_HOST
    try:
        return urlparse(base_url).hostname or DEFAULT_CANONICAL_HOST
    except Exception:
        return DEFAULT_CANONICAL_HOST


class CanonicalHostMiddleware(BaseHTTPMiddleware):
    """Redirect non-canonical API hosts to BASE_URL hostname in production."""

    async def dispatch(self, request: Request, call_next):
        if not settings.IS_PRODUCTION:
            return await call_next(request)

        host_header = request.headers.get("host") or ""
        hostname = host_header.split(":")[0].lower()
        if not hostname or hostname in LOCAL_HOSTS or hostname.endswith(".local"):
            return await call_next(request)

        canonical_host = get_canonical_api_host().lower()
        if hostname == canonical_host:
            return await call_next(request)

        destination = request.url.replace(
            scheme="https",
            hostname=canonical_host,
            port=None,
        )
        return RedirectResponse(url=str(destination), status_code=308)
