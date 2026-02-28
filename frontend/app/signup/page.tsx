"use client"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

import { useEffect, useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Mail, Lock, User, Phone, AlertCircle, UserPlus } from "lucide-react"
import { register, login, getCurrentUser } from "@/lib/api/auth"
import { useAuth } from "@/lib/context/auth-context"
import { toast } from "sonner"
import type { Role, Category } from "@/lib/api/types"
import { getCategoriesByType } from "@/lib/api/categories"

export default function SignupPage() {
  const router = useRouter()
  const { login: setUser } = useAuth()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    role: "client" as Role,
    category_id: "" as string, // master only
    keywords: "", // master only
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [masterCategories, setMasterCategories] = useState<Category[]>([])
  const [masterCategoriesLoading, setMasterCategoriesLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (formData.role !== "master") return
      try {
        setMasterCategoriesLoading(true)
        const cats = await getCategoriesByType("master", { activeOnly: true, rootOnly: true })
        if (!cancelled) setMasterCategories(cats || [])
      } catch {
        if (!cancelled) setMasterCategories([])
      } finally {
        if (!cancelled) setMasterCategoriesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [formData.role])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = "E-Mail ist erforderlich"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Ungültiges E-Mail-Format"
    }

    if (!formData.password) {
      newErrors.password = "Passwort ist erforderlich"
    } else if (formData.password.length < 8) {
      newErrors.password = "Passwort muss mindestens 8 Zeichen lang sein"
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwörter stimmen nicht überein"
    }

    if (!formData.name) {
      newErrors.name = "Name ist erforderlich"
    } else if (formData.name.length < 2) {
      newErrors.name = "Name muss mindestens 2 Zeichen lang sein"
    }

    if (formData.phone && !/^\+?[\d\s-()]+$/.test(formData.phone)) {
      newErrors.phone = "Ungültiges Telefonnummernformat"
    }

    if (formData.role === "master") {
      const parsedCategoryId = Number(formData.category_id)
      if (!Number.isFinite(parsedCategoryId) || parsedCategoryId <= 0) {
        newErrors.category_id = "Kategorie ist erforderlich"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setErrors({})

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const { confirmPassword, ...registerData } = formData
      // Normalize master-only fields
      const payload: any = { ...registerData }
      if (payload.role === "master") {
        const parsedCategoryId = Number(payload.category_id)
        payload.category_id = Number.isFinite(parsedCategoryId) && parsedCategoryId > 0 ? parsedCategoryId : undefined
        payload.keywords = typeof payload.keywords === "string" ? payload.keywords.trim() : undefined
      } else {
        delete payload.category_id
        delete payload.keywords
      }
      await register(payload)
      // Auto-login after registration
      await login({ email: formData.email, password: formData.password })
      const user = await getCurrentUser()
      setUser(user)
      toast.success("Konto erfolgreich erstellt!")
      router.push("/")
      router.refresh()
    } catch (err: any) {
      const errorMessage = err?.errors || err?.message || "Konto konnte nicht erstellt werden. Bitte versuchen Sie es erneut."
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
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
                  Konto erstellen
                </span>
              </CardTitle>
            </div>
            <CardDescription className="text-center text-xs sm:text-sm text-muted-foreground/90">
              Registrieren Sie sich, um mit Allesinda zu beginnen
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3 sm:space-y-4 p-5 sm:p-6 md:p-8 pt-3 sm:pt-4 max-h-[65vh] sm:max-h-[70vh] overflow-y-auto">
            {error && (
              <Alert variant="destructive" className="rounded-lg border-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="name" className="text-xs sm:text-sm font-semibold">Vollständiger Name</Label>
              <div className="relative">
                <User className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Max Mustermann"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    size="default"
                    className="pl-10 sm:pl-12 text-sm sm:text-base"
                    required
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
                {errors.name && (
                  <p className="text-[10px] sm:text-xs text-destructive font-medium">{errors.name}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="email" className="text-xs sm:text-sm font-semibold">E-Mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    size="default"
                    className="pl-10 sm:pl-12 text-sm sm:text-base"
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="text-[10px] sm:text-xs text-destructive font-medium">{errors.email}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="phone" className="text-xs sm:text-sm font-semibold">Telefon (Optional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+49 30 9834 2765"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    size="default"
                    className="pl-10 sm:pl-12 text-sm sm:text-base"
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>
                {errors.phone && (
                  <p className="text-[10px] sm:text-xs text-destructive font-medium">{errors.phone}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="role" className="text-xs sm:text-sm font-semibold">Ich bin ein</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleChange("role", value)}
                  disabled={loading}
                >
                  <SelectTrigger size="default" className="text-sm sm:text-base">
                    <SelectValue placeholder="Wählen Sie Ihre Rolle" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border">
                    <SelectItem value="client">Kunde (Suche nach Service)</SelectItem>
                    <SelectItem value="master">Meister (Biete Service an)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.role === "master" && (
                <>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="category_id" className="text-xs sm:text-sm font-semibold">
                      Kategorie <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => handleChange("category_id", value)}
                      disabled={loading || masterCategoriesLoading}
                    >
                      <SelectTrigger size="default" className="text-sm sm:text-base">
                        <SelectValue placeholder={masterCategoriesLoading ? "Lädt Kategorien..." : "Kategorie auswählen"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-md border">
                        {masterCategories.map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.category_id && (
                      <p className="text-[10px] sm:text-xs text-destructive font-medium">{errors.category_id}</p>
                    )}
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="keywords" className="text-xs sm:text-sm font-semibold">
                      Schlüsselwörter (Optional)
                    </Label>
                    <Input
                      id="keywords"
                      type="text"
                      placeholder="z.B. Elektriker, Notdienst, Renovierung"
                      value={formData.keywords}
                      onChange={(e) => handleChange("keywords", e.target.value)}
                      size="default"
                      className="text-sm sm:text-base"
                      disabled={loading}
                      autoComplete="off"
                    />
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      Durch Kommas trennen. Hilft Kunden, Sie besser zu finden.
                    </p>
                  </div>
                </>
              )}

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="password" className="text-xs sm:text-sm font-semibold">Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mindestens 8 Zeichen"
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    size="default"
                    className="pl-10 sm:pl-12 text-sm sm:text-base"
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
                {errors.password && (
                  <p className="text-[10px] sm:text-xs text-destructive font-medium">{errors.password}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs sm:text-sm font-semibold">Passwort bestätigen</Label>
                <div className="relative">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Bestätigen Sie Ihr Passwort"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange("confirmPassword", e.target.value)}
                    size="default"
                    className="pl-10 sm:pl-12 text-sm sm:text-base"
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-[10px] sm:text-xs text-destructive font-medium">{errors.confirmPassword}</p>
                )}
              </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:gap-4 p-5 sm:p-6 md:p-8 pt-0">
            <Button type="submit" size="xl" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Konto wird erstellt...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" />
                  Konto erstellen
                </>
              )}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Haben Sie bereits ein Konto?{" "}
              <Link href="/login" className="text-primary hover:underline font-semibold">
                Anmelden
              </Link>
            </div>
          </CardFooter>
        </form>
        </Card>
      </div>
    </div>
  )
}

