import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
])

function getBackendBaseUrl(): string {
  const url = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL
  if (!url?.trim()) {
    throw new Error("API_URL or NEXT_PUBLIC_API_URL is not configured")
  }
  return url.trim().replace(/\/$/, "")
}

function buildTargetUrl(pathSegments: string[], search: string): string {
  const base = getBackendBaseUrl()
  const path = pathSegments.map(encodeURIComponent).join("/")
  return `${base}/${path}${search}`
}

function forwardRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    headers.set(key, value)
  })
  return headers
}

function forwardResponseHeaders(upstream: Response): Headers {
  const headers = new Headers()
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    headers.set(key, value)
  })
  return headers
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[]
): Promise<NextResponse> {
  let targetUrl: string
  try {
    targetUrl = buildTargetUrl(pathSegments, request.nextUrl.search)
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "API proxy is not configured",
      },
      { status: 503 }
    )
  }

  const method = request.method.toUpperCase()
  const hasBody = !["GET", "HEAD"].includes(method)

  try {
    const upstream = await upstreamFetch(targetUrl, {
      method,
      headers: forwardRequestHeaders(request),
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "follow",
      cache: "no-store",
    })

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: forwardResponseHeaders(upstream),
    })
  } catch (error) {
    console.error("[api-proxy] upstream failed:", targetUrl, error)
    return NextResponse.json(
      {
        detail: "Unable to reach backend API from frontend proxy",
        target: targetUrl.replace(/\/\/[^@]+@/, "//***@"),
        hint:
          "Set API_URL to Coolify Backend internal URL (eye icon on Backend page), or API_URL=https://api.allesinda.de with API_TLS_INSECURE=true until SSL is valid.",
      },
      { status: 502 }
    )
  }
}

async function upstreamFetch(
  targetUrl: string,
  init: RequestInit
): Promise<Response> {
  if (process.env.API_TLS_INSECURE === "true") {
    const { Agent, fetch: undiciFetch } = await import("undici")
    const dispatcher = new Agent({
      connect: { rejectUnauthorized: false },
    })
    return undiciFetch(targetUrl, {
      ...init,
      dispatcher,
    }) as unknown as Response
  }
  return fetch(targetUrl, init)
}

type RouteContext = { params: Promise<{ path: string[] }> }

async function handle(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { path } = await context.params
  return proxyRequest(request, path ?? [])
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
export const OPTIONS = handle
