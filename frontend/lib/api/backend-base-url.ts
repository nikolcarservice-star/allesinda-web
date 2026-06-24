/** Backend base URLs for /api-proxy upstream. Prefer internal Docker URL first. */
export function getBackendBaseUrlCandidates(): string[] {
  const seen = new Set<string>()
  const candidates: string[] = []

  const add = (value?: string | null) => {
    const trimmed = value?.trim().replace(/\/$/, "")
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    candidates.push(trimmed)
  }

  // Internal API_URL first — avoids hairpin NAT / TLS hangs to the public API from inside the container.
  add(process.env.API_URL)
  add(process.env.NEXT_PUBLIC_API_URL)

  return candidates
}
