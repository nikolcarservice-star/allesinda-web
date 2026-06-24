import https from "node:https"
import { NextRequest, NextResponse } from "next/server"
import { getBackendBaseUrlCandidates } from "@/lib/api/backend-base-url"

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

function buildTargetUrl(base: string, pathSegments: string[], search: string): string {
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
  const candidates = getBackendBaseUrlCandidates()
  if (candidates.length === 0) {
    return NextResponse.json(
      {
        detail: "API_URL or NEXT_PUBLIC_API_URL is not configured",
      },
      { status: 503 }
    )
  }

  const method = request.method.toUpperCase()
  const hasBody = !["GET", "HEAD"].includes(method)
  const init: RequestInit = {
    method,
    headers: forwardRequestHeaders(request),
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "follow",
    cache: "no-store",
  }

  const search = request.nextUrl.search
  let lastTarget = ""

  for (const base of candidates) {
    lastTarget = buildTargetUrl(base, pathSegments, search)
    try {
      const upstream = await upstreamFetch(lastTarget, init)
      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: forwardResponseHeaders(upstream),
      })
    } catch (error) {
      console.error("[api-proxy] upstream failed:", lastTarget, error)
    }
  }

  return NextResponse.json(
    {
      detail: "Unable to reach backend API from frontend proxy",
      target: lastTarget.replace(/\/\/[^@]+@/, "//***@"),
      tried: candidates,
    },
    { status: 502 }
  )
}

async function upstreamFetch(
  targetUrl: string,
  init: RequestInit
): Promise<Response> {
  if (shouldUseInsecureTls(targetUrl)) {
    return insecureHttpsFetch(targetUrl, init)
  }
  return fetch(targetUrl, init)
}

function shouldUseInsecureTls(targetUrl: string): boolean {
  if (new URL(targetUrl).protocol !== "https:") {
    return false
  }
  if (process.env.API_TLS_INSECURE === "true") {
    return true
  }
  // Coolify may serve a self-signed cert on api.* until Let's Encrypt is ready.
  const publicUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "")
  return Boolean(
    process.env.NODE_ENV === "production" &&
      publicUrl &&
      targetUrl.startsWith(publicUrl)
  )
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  const record: Record<string, string> = {}
  if (!headers) return record
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      record[key] = value
    })
    return record
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      record[key] = value
    }
    return record
  }
  return { ...headers }
}

async function readRequestBody(body: BodyInit | null | undefined): Promise<Buffer | undefined> {
  if (body == null) return undefined
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  if (Buffer.isBuffer(body)) return body
  return Buffer.from(await new Response(body).arrayBuffer())
}

function insecureHttpsFetch(targetUrl: string, init: RequestInit): Promise<Response> {
  const parsed = new URL(targetUrl)
  const method = (init.method ?? "GET").toUpperCase()

  return readRequestBody(init.body).then(
    (body) =>
      new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: `${parsed.pathname}${parsed.search}`,
            method,
            headers: headersToRecord(init.headers),
            rejectUnauthorized: false,
          },
          (res) => {
            const chunks: Buffer[] = []
            res.on("data", (chunk) => chunks.push(chunk))
            res.on("end", () => {
              const responseHeaders = new Headers()
              for (const [key, value] of Object.entries(res.headers)) {
                if (value == null) continue
                if (Array.isArray(value)) {
                  value.forEach((entry) => responseHeaders.append(key, entry))
                } else {
                  responseHeaders.set(key, value)
                }
              }
              resolve(
                new Response(Buffer.concat(chunks), {
                  status: res.statusCode ?? 502,
                  headers: responseHeaders,
                })
              )
            })
          }
        )
        req.on("error", reject)
        if (body && body.length > 0) req.write(body)
        req.end()
      })
  )
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
