"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Heart, MessageSquare, User } from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { cn } from "@/lib/utils"

function MobileBottomNav() {
  const pathname = usePathname() ?? ""
  const { user } = useAuth()

  const profileHref = user ? "/profile" : "/login"

  const items = [
    { href: "/", label: "Главная", icon: Home, match: (p: string) => p === "/" },
    {
      href: "/favorites",
      label: "Избранное",
      icon: Heart,
      match: (p: string) => p.startsWith("/favorites"),
    },
    {
      href: "/messages",
      label: "Сообщения",
      icon: MessageSquare,
      match: (p: string) => p.startsWith("/messages"),
    },
    {
      href: profileHref,
      label: "Профиль",
      icon: User,
      match: (p: string) =>
        p.startsWith("/profile") || (!user && (p.startsWith("/login") || p.startsWith("/signup"))),
    },
  ] as const

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 flex border-t border-neutral-200 bg-white/95 backdrop-blur-md",
        "pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]",
        "lg:hidden",
      )}
      aria-label="Основная навигация"
    >
      {items.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname)
        return (
          <Link
            key={href + label}
            href={href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-semibold transition-colors",
              active ? "text-black" : "text-neutral-500 hover:text-neutral-800",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className={cn("h-5 w-5 shrink-0", active ? "text-black" : "text-neutral-500")} aria-hidden />
            <span className="truncate">{label}</span>
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
