"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, FormEvent } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, AlertCircle, CheckCircle } from "lucide-react"
import { forgotPassword } from "@/lib/api/auth"
import { toast } from "sonner"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      await forgotPassword({ email })
      setSuccess(true)
      toast.success("Falls die E-Mail existiert, wurde ein Link zum Zurücksetzen des Passworts gesendet")
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Fehler beim Senden der E-Mail zum Zurücksetzen"
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-sides py-8 sm:py-12 bg-muted/30">
      <Card className="w-full max-w-md border border-border/50 shadow-xl rounded-lg">
        <CardHeader className="space-y-1.5 sm:space-y-2 p-5 sm:p-6 md:p-8 pb-3 sm:pb-4">
          <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold text-center leading-tight">Passwort vergessen</CardTitle>
          <CardDescription className="text-center text-xs sm:text-sm text-muted-foreground/90">
            {success
              ? "Überprüfen Sie Ihre E-Mail für einen Link zum Zurücksetzen des Passworts"
              : "Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts"}
          </CardDescription>
        </CardHeader>
        {success ? (
          <CardContent className="space-y-3 sm:space-y-4 p-5 sm:p-6 md:p-8 pt-3 sm:pt-4">
            <Alert className="rounded-lg">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Falls ein Konto mit dieser E-Mail existiert, haben wir einen Link zum Zurücksetzen des Passworts gesendet. Bitte überprüfen Sie Ihren Posteingang.
              </AlertDescription>
            </Alert>
            <Button asChild size="default" className="w-full">
              <Link href="/login">Zurück zur Anmeldung</Link>
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3 sm:space-y-4 p-5 sm:p-6 md:p-8 pt-3 sm:pt-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="email" className="text-xs sm:text-sm font-semibold">E-Mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    size="default"
                    className="pl-10 sm:pl-12 text-sm sm:text-base"
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:gap-4 p-5 sm:p-6 md:p-8 pt-0">
              <Button type="submit" size="default" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Wird gesendet...
                  </>
                ) : (
                  "Link zum Zurücksetzen senden"
                )}
              </Button>
              <div className="text-center text-xs sm:text-sm text-muted-foreground">
                Passwort wieder eingefallen?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Anmelden
                </Link>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}

