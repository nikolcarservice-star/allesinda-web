/** Сброс «залипшего» зума Safari/iOS после фокуса в input (логин → главная). */
export function resetMobileViewportZoom(): void {
  if (typeof window === "undefined") return

  const active = document.activeElement
  if (active instanceof HTMLElement) {
    active.blur()
  }

  const meta = document.querySelector('meta[name="viewport"]')
  if (meta) {
    const base =
      "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, viewport-fit=cover"
    meta.setAttribute("content", `${base}, maximum-scale=1`)
    window.setTimeout(() => {
      meta.setAttribute("content", base)
    }, 50)
  }

  window.scrollTo(0, 0)
  if (document.documentElement) {
    document.documentElement.scrollTop = 0
  }
  if (document.body) {
    document.body.scrollTop = 0
  }
}
