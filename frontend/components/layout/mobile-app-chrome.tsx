"use client"

import { useMemo, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, Heart, PlusCircle, MessageSquare, User } from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: typeof Search
  match: (pathname: string) => boolean
}

function MobileBottomNav() {
  const pathname = usePathname() ?? ""
  const { user } = useAuth()

  const kontoHref = user ? "/profile" : "/login"

  const insertHref = useMemo(() => {
    if (!user) return "/signup"
    if (user.role === "seller") return "/dashboard/seller"
    if (user.role === "master") return "/dashboard/master"
    return "/signup"
  }, [user])

  const items: NavItem[] = useMemo(
    () => [
      {
        href: "/#hero-search",
        label: "Suchen",
        icon: Search,
        match: (p) => p === "/",
      },
      {
        href: "/favorites",
        label: "Favoriten",
        icon: Heart,
        match: (p) => p.startsWith("/favorites"),
      },
      {
        href: insertHref,
        label: "Inserieren",
        icon: PlusCircle,
        match: (p) =>
          p.startsWith("/signup") ||
          p.startsWith("/dashboard/seller") ||
          p.startsWith("/dashboard/master"),
      },
      {
        href: "/messages",
        label: "Nachrichten",
        icon: MessageSquare,
        match: (p) => p.startsWith("/messages"),
      },
      {
        href: kontoHref,
        label: "Konto",
        icon: User,
        match: (p) =>
          p.startsWith("/profile") ||
          (!user && (p.startsWith("/login") || p.startsWith("/signup"))),
      },
    ],
    [insertHref, kontoHref, user],
  )

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 flex border-t border-neutral-200 bg-white/95 backdrop-blur-md",
        "pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]",
        "lg:hidden",
      )}
      aria-label="Untere Navigation"
    >
      {items.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname)
        const isHeroSearch = label === "Suchen"
        return (
          <Link
            key={`${label}-${href}`}
            href={href}
            onClick={(e) => {
              if (!isHeroSearch || pathname !== "/") return
              e.preventDefault()
              document.getElementById("hero-search")?.scrollIntoView({ behavior: "smooth", block: "start" })
              window.setTimeout(() => {
                document.getElementById("hero-search-input")?.focus({ preventScroll: true })
              }, 420)
            }}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[10px] font-semibold leading-tight transition-colors sm:text-[11px]",
              active ? "text-black" : "text-neutral-500 hover:text-neutral-800",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className={cn("h-5 w-5 shrink-0", active ? "text-black" : "text-neutral-500")} aria-hidden />
            <span className="line-clamp-2 w-full text-center">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function MobileAppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ""
  const hideBottomChrome = pathname.startsWith("/messages")

  return (
    <>
      <div
        className={cn(
          !hideBottomChrome && "pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0",
        )}
      >
        {children}
      </div>
      {!hideBottomChrome && <MobileBottomNav />}
    </>
  )
}
