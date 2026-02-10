"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, User, Mail, Phone, Shield, Key, CheckCircle, AlertCircle, Lock } from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { changePassword, setup2FA, verify2FA, disable2FA } from "@/lib/api/auth"
import { toast } from "sonner"
import { ProtectedRoute } from "@/components/auth/protected-route"

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  
  // Password change
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  
  // 2FA
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    secret: string
    qr_code_url: string
    backup_codes: string[]
  } | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [disable2FAData, setDisable2FAData] = useState({ password: "", code: "" })

  useEffect(() => {
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("Passwörter stimmen nicht überein")
      setLoading(false)
      return
    }

    if (passwordData.new_password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen lang sein")
      setLoading(false)
      return
    }

    try {
      await changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      })
      toast.success("Passwort erfolgreich geändert")
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" })
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Fehler beim Ändern des Passworts"
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleSetup2FA = async () => {
    setTwoFactorLoading(true)
    try {
      const setup = await setup2FA()
      setTwoFactorSetup(setup)
      toast.success("2FA-Einrichtung gestartet. Scannen Sie den QR-Code mit Ihrer Authenticator-App.")
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Fehler bei der 2FA-Einrichtung"
      toast.error(errorMessage)
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const handleVerify2FA = async () => {
    if (!twoFactorSetup) return

    setTwoFactorLoading(true)
    try {
      await verify2FA({ code: twoFactorCode })
      toast.success("2FA erfolgreich aktiviert!")
      setTwoFactorSetup(null)
      setTwoFactorCode("")
      await refreshUser()
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Ungültiger 2FA-Code"
      toast.error(errorMessage)
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const handleDisable2FA = async () => {
    setTwoFactorLoading(true)
    try {
      await disable2FA(disable2FAData)
      toast.success("2FA erfolgreich deaktiviert!")
      setDisable2FAData({ password: "", code: "" })
      await refreshUser()
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Fehler beim Deaktivieren von 2FA"
      toast.error(errorMessage)
    } finally {
      setTwoFactorLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <ProtectedRoute>
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background via-muted/10 to-background p-sides py-6 sm:py-8 md:py-10">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-5 sm:mb-6 md:mb-8">
            <div className="space-y-1.5 sm:space-y-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Profileinstellungen
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground/90">Verwalten Sie Ihre Kontoeinstellungen und Präferenzen</p>
            </div>
          </div>

          <Tabs defaultValue="account" className="space-y-4 sm:space-y-6">
            <TabsList variant="modern" className="grid w-full grid-cols-2 mb-6 sm:mb-8">
              <TabsTrigger variant="modern" value="account" className="flex items-center justify-center gap-1.5">
                <User className="shrink-0" />
                <span>Konto</span>
              </TabsTrigger>
              <TabsTrigger variant="modern" value="security" className="flex items-center justify-center gap-1.5">
                <Shield className="shrink-0" />
                <span>Sicherheit</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-4 sm:space-y-5 md:space-y-6">
              <Card className="border border-border shadow-sm bg-gradient-to-br from-card to-card/95 rounded-lg">
                <CardHeader className="p-4 sm:p-5 md:p-6">
                  <CardTitle className="text-base sm:text-lg md:text-xl font-bold">Kontoinformationen</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground/90">Ihre Kontodaten</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6 pt-0">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm sm:text-base">Name</Label>
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <Input value={user.name} disabled className="h-10 sm:h-11 text-sm sm:text-base" />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm sm:text-base">E-Mail</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 flex-1 w-full">
                        <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                        <Input value={user.email} disabled className="h-10 sm:h-11 text-sm sm:text-base flex-1" />
                      </div>
                      {user.email_verified ? (
                        <div className="flex items-center gap-1 text-green-600 text-xs sm:text-sm shrink-0">
                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Verifiziert
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-yellow-600 text-xs sm:text-sm shrink-0">
                          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Unverifiziert
                        </div>
                      )}
                    </div>
                  </div>
                  {user.phone && (
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label className="text-sm sm:text-base">Telefon</Label>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                        <Input value={user.phone} disabled className="h-10 sm:h-11 text-sm sm:text-base" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm sm:text-base">Rolle</Label>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <Input value={user.role} disabled className="capitalize h-10 sm:h-11 text-sm sm:text-base" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-5 sm:space-y-6">
              <Card className="border border-border shadow-none bg-gradient-to-br from-card to-card/95">
                <CardHeader className="p-5 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl font-bold">Passwort ändern</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground/90">Aktualisieren Sie Ihr Passwort, um Ihr Konto sicher zu halten</CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 pt-0">
                  <form onSubmit={handleChangePassword} className="space-y-4 sm:space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="current_password" className="text-sm sm:text-base font-semibold">Aktuelles Passwort</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                        <Input
                          id="current_password"
                          type="password"
                          value={passwordData.current_password}
                          onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                          required
                          disabled={loading}
                          size="medium"
                          className="pl-12"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new_password" className="text-sm sm:text-base font-semibold">Neues Passwort</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                        <Input
                          id="new_password"
                          type="password"
                          value={passwordData.new_password}
                          onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                          required
                          disabled={loading}
                          minLength={8}
                          size="medium"
                          className="pl-12"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm_password" className="text-sm sm:text-base font-semibold">Neues Passwort bestätigen</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                        <Input
                          id="confirm_password"
                          type="password"
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                          required
                          disabled={loading}
                          minLength={8}
                          size="medium"
                          className="pl-12"
                        />
                      </div>
                    </div>
                    <Button type="submit" size="large" disabled={loading} className="w-full sm:w-auto text-sm sm:text-base">
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Wird geändert...
                        </>
                      ) : (
                        <>
                          <Key className="h-4 w-4" />
                          Passwort ändern
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border border-border shadow-none bg-gradient-to-br from-card to-card/95">
                <CardHeader className="p-5 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl font-bold">Zwei-Faktor-Authentifizierung</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground/90">
                    {user.two_factor_enabled
                      ? "2FA ist aktiviert. Fügen Sie eine zusätzliche Sicherheitsebene zu Ihrem Konto hinzu."
                      : "Aktivieren Sie 2FA, um eine zusätzliche Sicherheitsebene zu Ihrem Konto hinzuzufügen."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-5 p-5 sm:p-6 pt-0">
                  {user.two_factor_enabled ? (
                    <div className="space-y-4">
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>Zwei-Faktor-Authentifizierung ist für Ihr Konto aktiviert.</AlertDescription>
                      </Alert>
                      <div className="space-y-2">
                        <Label htmlFor="disable_password">Passwort</Label>
                        <Input
                          id="disable_password"
                          type="password"
                          value={disable2FAData.password}
                          onChange={(e) => setDisable2FAData({ ...disable2FAData, password: e.target.value })}
                          placeholder="Geben Sie Ihr Passwort ein"
                          disabled={twoFactorLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="disable_code">2FA-Code oder Backup-Code</Label>
                        <Input
                          id="disable_code"
                          type="text"
                          value={disable2FAData.code}
                          onChange={(e) => setDisable2FAData({ ...disable2FAData, code: e.target.value })}
                          placeholder="Geben Sie den 2FA-Code oder Backup-Code ein"
                          disabled={twoFactorLoading}
                          maxLength={8}
                        />
                      </div>
                      <Button variant="destructive" onClick={handleDisable2FA} disabled={twoFactorLoading} size="large" className="w-full sm:w-auto text-sm sm:text-base">
                        {twoFactorLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Wird deaktiviert...
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            2FA deaktivieren
                          </>
                        )}
                      </Button>
                    </div>
                  ) : twoFactorSetup ? (
                    <div className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Scannen Sie diesen QR-Code mit Ihrer Authenticator-App (Google Authenticator, Authy, etc.)
                        </AlertDescription>
                      </Alert>
                      <div className="flex justify-center">
                        <img src={twoFactorSetup.qr_code_url} alt="2FA QR-Code" className="border rounded" />
                      </div>
                      <div className="space-y-2">
                        <Label>Backup-Codes</Label>
                        <Alert>
                          <AlertDescription>
                            Speichern Sie diese Backup-Codes an einem sicheren Ort. Sie können sie verwenden, wenn Sie den Zugriff auf Ihre Authenticator-App verlieren.
                          </AlertDescription>
                        </Alert>
                        <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded">
                          {twoFactorSetup.backup_codes.map((code, i) => (
                            <code key={i} className="text-sm font-mono">
                              {code}
                            </code>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="verify_code">2FA-Code eingeben</Label>
                        <Input
                          id="verify_code"
                          type="text"
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value)}
                          placeholder="Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein"
                          maxLength={6}
                          disabled={twoFactorLoading}
                        />
                      </div>
                      <Button onClick={handleVerify2FA} disabled={twoFactorLoading || !twoFactorCode} size="large" className="w-full sm:w-auto text-sm sm:text-base">
                        {twoFactorLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Wird verifiziert...
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            2FA verifizieren und aktivieren
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={handleSetup2FA} disabled={twoFactorLoading} size="large" className="w-full sm:w-auto text-sm sm:text-base">
                        {twoFactorLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Wird eingerichtet...
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            2FA aktivieren
                          </>
                        )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  )
}


