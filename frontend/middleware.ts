import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const DEFAULT_CANONICAL_HOST = "allesinda.de"

function getCanonicalHost(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    return DEFAULT_CANONICAL_HOST
  }
  try {
    return new URL(siteUrl).hostname
  } catch {
    return DEFAULT_CANONICAL_HOST
  }
}

function isLocalOrPreviewHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.includes("vusercontent.net")
  )
}

export function middleware(request: NextRequest) {
  const hostHeader = request.headers.get("host") ?? ""
  const hostname = hostHeader.split(":")[0]?.toLowerCase() ?? ""

  if (!hostname || isLocalOrPreviewHost(hostname)) {
    return NextResponse.next()
  }

  const canonicalHost = getCanonicalHost().toLowerCase()
  const needsHostRedirect = hostname !== canonicalHost
  const needsHttpsRedirect =
    request.nextUrl.protocol === "http:" &&
    process.env.NODE_ENV === "production"

  if (!needsHostRedirect && !needsHttpsRedirect) {
    return NextResponse.next()
  }

  const destination = request.nextUrl.clone()
  destination.protocol = "https:"
  destination.hostname = canonicalHost
  destination.port = ""

  return NextResponse.redirect(destination, 308)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|woff2?|txt|xml)$).*)",
  ],
}
