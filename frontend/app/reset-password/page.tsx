"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, FormEvent, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Lock, AlertCircle, CheckCircle } from "lucide-react"
import { resetPassword } from "@/lib/api/auth"
import { toast } from "sonner"

function ResetPasswordPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) {
      setError("Ungültiges oder fehlendes Zurücksetzen-Token")
    }
  }, [token])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein")
      return
    }

    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein")
      return
    }

    if (!token) {
      setError("Ungültiges Zurücksetzen-Token")
      return
    }

    setLoading(true)

    try {
      await resetPassword({ token, new_password: password })
      setSuccess(true)
      toast.success("Passwort erfolgreich zurückgesetzt!")
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Fehler beim Zurücksetzen des Passworts"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-sides py-8 sm:py-12 bg-muted/30">
        <Card className="w-full max-w-md border border-border/50 shadow-xl rounded-lg">
          <CardContent className="p-5 sm:p-6 md:p-8">
            <Alert variant="destructive" className="rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">Ungültiges oder fehlendes Zurücksetzen-Token</AlertDescription>
            </Alert>
            <Button asChild size="default" className="w-full mt-3 sm:mt-4">
              <Link href="/forgot-password">Neuen Link zum Zurücksetzen anfordern</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-sides py-8 sm:py-12 bg-muted/30">
      <Card className="w-full max-w-md border border-border/50 shadow-xl rounded-lg">
        <CardHeader className="space-y-1.5 sm:space-y-2 p-5 sm:p-6 md:p-8 pb-3 sm:pb-4">
          <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold text-center leading-tight">Passwort zurücksetzen</CardTitle>
          <CardDescription className="text-center text-xs sm:text-sm text-muted-foreground/90">
            {success
              ? "Passwort erfolgreich zurückgesetzt! Weiterleitung zur Anmeldung..."
              : "Geben Sie Ihr neues Passwort ein"}
          </CardDescription>
        </CardHeader>
        {success ? (
          <CardContent className="space-y-3 sm:space-y-4 p-5 sm:p-6 md:p-8 pt-3 sm:pt-4">
            <Alert className="rounded-lg">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">Ihr Passwort wurde erfolgreich zurückgesetzt.</AlertDescription>
            </Alert>
            <Button asChild size="default" className="w-full">
              <Link href="/login">Zur Anmeldung</Link>
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3 sm:space-y-4 p-5 sm:p-6 md:p-8 pt-3 sm:pt-4">
              {error && (
                <Alert variant="destructive" className="rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="password" className="text-xs sm:text-sm font-semibold">Neues Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mindestens 8 Zeichen"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    size="default"
                    className="pl-10 sm:pl-12 text-sm sm:text-base"
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs sm:text-sm font-semibold">Passwort bestätigen</Label>
                <div className="relative">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Bestätigen Sie Ihr Passwort"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    size="default"
                    className="pl-10 sm:pl-12 text-sm sm:text-base"
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:gap-4 p-5 sm:p-6 md:p-8 pt-0">
              <Button type="submit" size="default" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Wird zurückgesetzt...
                  </>
                ) : (
                  "Passwort zurücksetzen"
                )}
              </Button>
              <div className="text-center text-xs sm:text-sm text-muted-foreground">
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Zurück zur Anmeldung
                </Link>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ResetPasswordPageContent />
    </Suspense>
  )
}

