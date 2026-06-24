/** Backend base URLs for /api-proxy upstream (public URL first for Coolify). */
export function getBackendBaseUrlCandidates(): string[] {
  const seen = new Set<string>()
  const candidates: string[] = []

  const add = (value?: string | null) => {
    const trimmed = value?.trim().replace(/\/$/, "")
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    candidates.push(trimmed)
  }

  add(process.env.NEXT_PUBLIC_API_URL)
  add(process.env.API_URL)

  return candidates
}
