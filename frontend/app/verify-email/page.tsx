"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, AlertCircle, Mail } from "lucide-react"
import { verifyEmail, resendVerification } from "@/lib/api/auth"
import { toast } from "sonner"

function VerifyEmailPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  
  const [loading, setLoading] = useState(!!token)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (token) {
      handleVerify()
    }
  }, [token])

  const handleVerify = async () => {
    if (!token) return

    setLoading(true)
    setError("")

    try {
      await verifyEmail({ token })
      setSuccess(true)
      toast.success("E-Mail erfolgreich verifiziert!")
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Fehler bei der E-Mail-Verifizierung"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      // Get email from query params or prompt user
      const email = searchParams.get("email") || prompt("Geben Sie Ihre E-Mail-Adresse ein:")
      if (!email) {
        toast.error("E-Mail ist erforderlich")
        return
      }
      
      await resendVerification({ email })
      toast.success("Verifizierungs-E-Mail gesendet! Bitte überprüfen Sie Ihren Posteingang.")
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Fehler beim erneuten Senden der Verifizierungs-E-Mail"
      toast.error(errorMessage)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-sides py-8 sm:py-12 bg-muted/30">
      <Card className="w-full max-w-md border border-border/50 shadow-xl rounded-lg">
        <CardHeader className="space-y-1.5 sm:space-y-2 p-5 sm:p-6 md:p-8 pb-3 sm:pb-4">
          <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold text-center leading-tight">E-Mail-Verifizierung</CardTitle>
          <CardDescription className="text-center text-xs sm:text-sm text-muted-foreground/90">
            {loading
              ? "Ihre E-Mail wird verifiziert..."
              : success
              ? "E-Mail erfolgreich verifiziert!"
              : "Bitte verifizieren Sie Ihre E-Mail-Adresse"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 p-5 sm:p-6 md:p-8 pt-3 sm:pt-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-6 sm:py-8">
              <Loader2 className="h-7 w-7 sm:h-8 sm:w-8 animate-spin text-primary mb-3 sm:mb-4" />
              <p className="text-xs sm:text-sm text-muted-foreground">Ihre E-Mail wird verifiziert...</p>
            </div>
          ) : success ? (
            <Alert className="rounded-lg">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Ihre E-Mail wurde erfolgreich verifiziert! Weiterleitung zur Anmeldung...
              </AlertDescription>
            </Alert>
          ) : error ? (
            <Alert variant="destructive" className="rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          ) : (
            <Alert className="rounded-lg">
              <Mail className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {!token
                  ? "Kein Verifizierungs-Token gefunden. Bitte überprüfen Sie Ihre E-Mail für den Verifizierungslink."
                  : "Verifizierung fehlgeschlagen. Der Link ist möglicherweise abgelaufen."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:gap-4 p-5 sm:p-6 md:p-8 pt-0">
          {success ? (
            <Button asChild size="default" className="w-full">
              <Link href="/login">Zur Anmeldung</Link>
            </Button>
          ) : (
            <>
              {!token && (
                <Button onClick={handleResend} size="default" className="w-full" disabled={resending}>
                    {resending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Wird gesendet...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Verifizierungs-E-Mail erneut senden
                      </>
                    )}
                </Button>
              )}
              <Button variant="outline" asChild size="default" className="w-full">
                <Link href="/login">Zurück zur Anmeldung</Link>
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <VerifyEmailPageContent />
    </Suspense>
  )
}

