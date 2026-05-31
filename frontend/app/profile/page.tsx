"use client"

export const dynamic = "force-dynamic"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/context/auth-context"
import { MasterCabinet } from "@/components/master/master-cabinet"
import { AccountSettingsPage } from "@/components/profile/account-settings-page"

export default function ProfilePage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  if (!user) {
    return null
  }

  if (user.role === "master") {
    return <MasterCabinet />
  }

  return <AccountSettingsPage />
}
