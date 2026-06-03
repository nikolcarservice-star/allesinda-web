"use client"

import { useMemo, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Heart, PlusCircle, MessageSquare, User } from "lucide-react"
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
        "fixed inset-x-0 bottom-0 z-50 flex border-t border-neutral-200 bg-white/95 backdrop-blur-md",
        "pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]",
        "lg:hidden",
      )}
      aria-label="Untere Navigation"
    >
      {items.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname)
        const isHome = href === "/"
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
              "touch-target flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[10px] font-semibold leading-tight transition-colors sm:text-[11px]",
              active ? "text-black" : "text-neutral-500 hover:text-neutral-800",
            )}
            aria-current={active ? "page" : undefined}
          >
            <span className="relative inline-flex shrink-0">
              <Icon className={cn("h-5 w-5", active ? "text-black" : "text-neutral-500")} aria-hidden />
              {label === "Nachrichten" && unreadMessages > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1.5 -right-2 h-4 min-w-4 px-0.5 text-[9px] font-bold leading-none flex items-center justify-center"
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

  return (
    <>
      <div
        className={cn(
          !hideBottomChrome && "pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0",
        )}
      >
        <MobileBackBar />
        {children}
      </div>
      {!hideBottomChrome && <MobileBottomNav />}
    </>
  )
}
