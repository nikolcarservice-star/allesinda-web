import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

/** Pages that already include their own mobile back control. */
export function shouldShowMobileBackBar(pathname: string): boolean {
  if (!pathname) return false
  if (pathname === "/") return false
  if (/^\/detailed\/master\/[^/]+/.test(pathname)) return false
  if (pathname.startsWith("/messages")) return false
  return true
}

export function getMobileBackFallback(pathname: string): string {
  const detailedMatch = pathname.match(/^\/detailed\/(master|product|rental)/)
  if (detailedMatch) {
    return `/?types=${detailedMatch[1]}`
  }
  if (pathname.startsWith("/booking")) return "/"
  if (pathname.startsWith("/messages")) return "/messages"
  if (pathname.startsWith("/admin")) return "/admin"
  return "/"
}

export function navigateMobileBack(router: AppRouterInstance, fallbackHref: string) {
  if (typeof window !== "undefined") {
    try {
      const ref = document.referrer
      if (ref && new URL(ref).origin === window.location.origin) {
        router.back()
        return
      }
    } catch {
      // ignore invalid referrer
    }
    if (window.history.length > 1) {
      router.back()
      return
    }
  }
  router.push(fallbackHref)
}
