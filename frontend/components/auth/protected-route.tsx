"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/context/auth-context"
import { Loader2 } from "lucide-react"

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireRole?: "client" | "master" | "seller" | "admin"
}

export function ProtectedRoute({ 
  children, 
  requireAuth = true,
  requireRole 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !user) {
        router.push("/login")
        return
      }

      if (requireRole && user && user.role !== requireRole) {
        router.push("/")
        return
      }
    }
  }, [user, loading, requireAuth, requireRole, router])

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (requireAuth && !user) {
    return null
  }

  if (requireRole && user && user.role !== requireRole) {
    return null
  }

  return <>{children}</>
}

