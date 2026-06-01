"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { getCurrentUser, logout as logoutAPI, isAuthenticated } from "@/lib/api/auth"
import { ApiClientError } from "@/lib/api/client"
import type { User } from "@/lib/api/types"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (user: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const loadUser = async () => {
    if (!isAuthenticated()) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error("Failed to load user:", error)
      if (error instanceof ApiClientError && error.statusCode === 401) {
        setUser(null)
        logoutAPI()
      } else if (isAuthenticated()) {
        // Transient error — retry once before giving up (keeps session on refresh)
        try {
          await new Promise((resolve) => setTimeout(resolve, 400))
          const currentUser = await getCurrentUser()
          setUser(currentUser)
        } catch (retryError) {
          console.error("Failed to load user after retry:", retryError)
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()
  }, [])

  const login = (userData: User) => {
    setUser(userData)
  }

  const logout = () => {
    logoutAPI()
    setUser(null)
    toast.success("Logged out successfully")
    router.push("/")
  }

  const refreshUser = async () => {
    await loadUser()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

