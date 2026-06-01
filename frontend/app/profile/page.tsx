"use client"

export const dynamic = "force-dynamic"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { isAuthenticated } from "@/lib/api/auth"
import { MasterCabinet } from "@/components/master/master-cabinet"
import { AccountSettingsPage } from "@/components/profile/account-settings-page"

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user && !isAuthenticated()) {
      router.push("/login")
    }
  }, [user, loading, router])

  if (loading || (!user && isAuthenticated())) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (user.role === "master") {
    return <MasterCabinet />
  }

  return <AccountSettingsPage />
}
