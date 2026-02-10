"use client"

import { useAuth } from "@/lib/context/auth-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { ComponentProps } from "react"

interface ActionButtonProps extends Omit<ComponentProps<typeof Button>, "onClick"> {
  href: string
  actionLabel: string
  children: React.ReactNode
}

export function ActionButton({ href, actionLabel, children, ...props }: ActionButtonProps) {
  const { user } = useAuth()
  const router = useRouter()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!user) {
      e.preventDefault()
      e.stopPropagation()
      toast.error(`Please log in first to ${actionLabel}`, {
        action: {
          label: "Log in",
          onClick: () => router.push("/login"),
        },
      })
      return
    }
    router.push(href)
  }

  return (
    <Button {...props} onClick={handleClick}>
      {children}
    </Button>
  )
}

