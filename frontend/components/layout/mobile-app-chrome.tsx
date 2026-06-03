"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Heart, Plus, MessageSquare, User } from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { useUnreadMessagesCount } from "@/hooks/use-unread-messages-count"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { MobileBackBar } from "@/components/layout/mobile-back-bar"

type NavItem = {
  href: string
  label: string
  icon: typeof Home
  match: (pathname: string) => boolean
  center?: boolean
}

function MobileBottomNav() {
  const pathname = usePathname() ?? ""
  const { user } = useAuth()
  const { count: unreadMessages } = useUnreadMessagesCount(Boolean(user))

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
        href: "/",
        label: "Start",
        icon: Home,
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
        icon: Plus,
        center: true,
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
        "mobile-bottom-nav fixed inset-x-0 bottom-0 z-[60] flex items-end justify-around border-t border-neutral-200 bg-white/95 px-1 backdrop-blur-md",
        "pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]",
        "lg:hidden",
      )}
      aria-label="Untere Navigation"
    >
      {items.map(({ href, label, icon: Icon, match, center }) => {
        const active = match(pathname)
        const isHome = href === "/"

        if (center) {
          return (
            <Link
              key={`${label}-${href}`}
              href={href}
              className="touch-target flex min-w-0 flex-1 flex-col items-center justify-end gap-1 pb-0.5 -mt-5"
              aria-current={active ? "page" : undefined}
              aria-label={label}
            >
              <span
                className={cn(
                  "brand-icon-btn flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-[0_4px_14px_rgba(60,220,213,0.45)]",
                  active && "ring-2 ring-primary/35 ring-offset-2 ring-offset-white",
                )}
              >
                <Plus className="h-7 w-7 text-black" strokeWidth={2.5} aria-hidden />
              </span>
              <span className="line-clamp-2 w-full text-center text-[10px] font-semibold leading-tight text-neutral-500 sm:text-[11px]">
                {label}
              </span>
            </Link>
          )
        }

        return (
          <Link
            key={`${label}-${href}`}
            href={href}
            onClick={(e) => {
              if (!isHome || pathname !== "/") return
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            className={cn(
              "touch-target flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 px-0.5 pb-0.5 text-[10px] font-semibold leading-tight transition-colors sm:text-[11px]",
              active ? "text-primary" : "text-neutral-500 hover:text-neutral-700",
            )}
            aria-current={active ? "page" : undefined}
          >
            <span className="relative inline-flex shrink-0">
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  active ? "text-primary fill-primary/15" : "text-neutral-500",
                  label === "Favoriten" && active && "fill-primary",
                )}
                aria-hidden
              />
              {label === "Nachrichten" && unreadMessages > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center p-0.5 text-[9px] font-bold leading-none"
                >
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </Badge>
              )}
            </span>
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const bottomNav =
    mounted && !hideBottomChrome
      ? createPortal(<MobileBottomNav />, document.body)
      : null

  return (
    <>
      <div
        className={cn(
          !hideBottomChrome && "pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0",
        )}
      >
        <MobileBackBar />
        {children}
      </div>
      {bottomNav}
    </>
  )
}
