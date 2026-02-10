"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

function LegacySearchRedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const queryString = searchParams?.toString()
    router.replace(queryString ? `/?${queryString}` : "/")
  }, [router, searchParams])

  return null
}

export default function LegacySearchRedirect() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LegacySearchRedirectContent />
    </Suspense>
  )
}

