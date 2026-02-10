"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, AlertCircle, LogIn } from "lucide-react"
import { login, getCurrentUser } from "@/lib/api/auth"
import { useAuth } from "@/lib/context/auth-context"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const { login: setUser } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await login({ email, password })
      // Get current user and update auth context
      const user = await getCurrentUser()
      setUser(user)
      toast.success("Anmeldung erfolgreich!")
      router.push("/")
      router.refresh()
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Anmeldedaten."
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-sides py-8 sm:py-12 bg-gradient-to-br from-primary/8 via-primary/3 to-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_70%)]"></div>
      
      <div className="w-full max-w-md relative z-10">
        <Card className="border border-border/50 shadow-2xl rounded-lg overflow-hidden bg-background/95 backdrop-blur-xl">
          <div className="bg-gradient-to-r from-primary via-primary to-accent h-0.5 sm:h-1" />
          <CardHeader className="space-y-2 sm:space-y-3 p-5 sm:p-6 md:p-8 pb-3 sm:pb-4">
            <div className="space-y-1.5 sm:space-y-2">
              <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Hallo
                </span>
              </CardTitle>
            </div>
            <CardDescription className="text-center text-xs sm:text-sm text-muted-foreground/90">
              Melden Sie sich in Ihrem Konto an, um fortzufahren
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3 sm:space-y-4 p-5 sm:p-6 md:p-8 pt-3 sm:pt-4">
              {error && (
                <Alert variant="destructive" className="rounded-lg border-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
                </Alert>
              )}

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

              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs sm:text-sm font-semibold">Passwort</Label>
                  <Link
                    href="/forgot-password"
                    className="rounded-full border border-transparent px-2 py-0.5 text-[11px] text-primary hover:underline hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-0 sm:py-0 sm:text-xs sm:border-0"
                  >
                    Passwort vergessen?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Geben Sie Ihr Passwort ein"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    size="default"
                    className="pl-10 sm:pl-12 text-sm sm:text-base"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    minLength={8}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:gap-4 p-5 sm:p-6 md:p-8 pt-0">
              <Button type="submit" size="xl" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Anmeldung läuft...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 sm:h-5 sm:w-5" />
                    Anmelden
                  </>
                )}
              </Button>
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-3 text-muted-foreground font-medium">Oder fortfahren mit</span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 w-full sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 sm:h-12 text-sm sm:text-base rounded-md font-semibold border border-border hover:border-[#4285F4] hover:bg-[#4285F4]/5 hover:text-[#4285F4] shadow-none hover:shadow-none transition-all duration-200 group"
                  onClick={() => {
                    // Google OAuth - redirect to Google OAuth URL
                    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/callback/google')}&response_type=code&scope=email profile`
                    window.location.href = googleAuthUrl
                  }}
                >
                  <svg className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform duration-200" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                      className="group-hover:brightness-110 transition-all duration-200"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                      className="group-hover:brightness-110 transition-all duration-200"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                      className="group-hover:brightness-110 transition-all duration-200"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                      className="group-hover:brightness-110 transition-all duration-200"
                    />
                  </svg>
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 sm:h-12 text-sm sm:text-base rounded-md font-semibold border border-border hover:border-[#1877F2] hover:bg-[#1877F2]/5 hover:text-[#1877F2] shadow-none hover:shadow-none transition-all duration-200 group"
                  onClick={() => {
                    // Facebook OAuth - redirect to Facebook OAuth URL
                    const facebookAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/callback/facebook')}&scope=email`
                    window.location.href = facebookAuthUrl
                  }}
                >
                  <svg className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform duration-200" fill="#1877F2" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" className="group-hover:brightness-110 transition-all duration-200" />
                  </svg>
                  Facebook
                </Button>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                Noch kein Konto?{" "}
                <Link href="/signup" className="text-primary hover:underline font-semibold">
                  Registrieren
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

