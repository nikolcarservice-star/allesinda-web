"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { getCurrentUser, logout as logoutAPI, isAuthenticated } from "@/lib/api/auth"
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
      setUser(null)
      // Clear invalid token
      logoutAPI()
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

