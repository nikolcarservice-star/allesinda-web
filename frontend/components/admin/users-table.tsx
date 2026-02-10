"use client"

import { useState, useEffect, useMemo } from "react"
import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Search, Loader2, AlertCircle, Mail, Phone, Shield, UserCheck, UserX, Edit, KeyRound, CheckCircle2, XCircle, X } from "lucide-react"
import { getAllUsers, updateUser, resetUserPassword } from "@/lib/api/admin"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale/de"
import { AvatarImage } from "@/components/ui/avatar"
import { getOptimizedImageUrl } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  email_verified: boolean;
  image_url?: string;
  created_at: string;
  updated_at?: string;
}

export function UsersTable() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "client" | "master" | "seller" | "admin">("all")
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [editDialog, setEditDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null })
  const [editForm, setEditForm] = useState<{ role: string; is_active: boolean; phone: string }>({ role: "", is_active: true, phone: "" })
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ open: boolean; userId: number | null; userName: string }>({ open: false, userId: null, userName: "" })

  useEffect(() => {
    loadUsers()
  }, [page, roleFilter, activeFilter, searchQuery])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        page_size: 20,
      }
      if (roleFilter !== "all") {
        params.role = roleFilter
      }
      if (activeFilter === "active") {
        params.is_active = true
      } else if (activeFilter === "inactive") {
        params.is_active = false
      }
      if (searchQuery && searchQuery.trim()) {
        params.q = searchQuery.trim()
      }
      
      const response = await getAllUsers(params)
      setUsers(response.items || [])
      setTotalPages(response.total_pages || 1)
    } catch (error: any) {
      console.error("Failed to load users:", error)
      toast.error("Benutzer konnten nicht geladen werden")
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    loadUsers()
  }

  const getRoleBadgeClassName = (role: string) => {
    const baseClasses = "text-[10px] px-2 py-0.5 capitalize font-medium whitespace-nowrap"
    switch (role) {
      case "admin":
        return `${baseClasses} border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300`
      case "master":
        return `${baseClasses} border-blue-500/50 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300`
      case "seller":
        return `${baseClasses} border-purple-500/50 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300`
      case "client":
        return `${baseClasses} border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300`
      default:
        return `${baseClasses} border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300`
    }
  }

  const openEditDialog = (user: User) => {
    setEditDialog({ open: true, user })
    setEditForm({
      role: user.role,
      is_active: user.is_active,
      phone: user.phone || "",
    })
  }

  const handleUpdateUser = async () => {
    if (!editDialog.user) return
    
    try {
      const updateData: any = {}
      if (editForm.role !== editDialog.user.role) {
        updateData.role = editForm.role
      }
      if (editForm.is_active !== editDialog.user.is_active) {
        updateData.is_active = editForm.is_active
      }
      if (editForm.phone !== (editDialog.user.phone || "")) {
        updateData.phone = editForm.phone || null
      }
      
      if (Object.keys(updateData).length === 0) {
        toast.info("Keine Änderungen zum Speichern")
        setEditDialog({ open: false, user: null })
        return
      }
      
      await updateUser(editDialog.user.id, updateData)
      toast.success("Benutzer erfolgreich aktualisiert")
      setEditDialog({ open: false, user: null })
      loadUsers()
    } catch (error: any) {
      toast.error(error.message || "Benutzer konnte nicht aktualisiert werden")
    }
  }

  const handleResetPassword = async () => {
    if (!resetPasswordDialog.userId) return
    
    try {
      await resetUserPassword(resetPasswordDialog.userId)
      toast.success(`Passwort für ${resetPasswordDialog.userName} auf 'password123' zurückgesetzt`)
      setResetPasswordDialog({ open: false, userId: null, userName: "" })
    } catch (error: any) {
      toast.error(error.message || "Passwort konnte nicht zurückgesetzt werden")
    }
  }

  const toggleActiveStatus = async (user: User) => {
    try {
      await updateUser(user.id, { is_active: !user.is_active })
      toast.success(`Benutzer erfolgreich ${!user.is_active ? "aktiviert" : "deaktiviert"}`)
      loadUsers()
    } catch (error: any) {
      toast.error(error.message || "Benutzerstatus konnte nicht aktualisiert werden")
    }
  }

  const clearFilters = () => {
    setRoleFilter("all")
    setActiveFilter("all")
    setSearchQuery("")
    setPage(1)
  }

  const hasActiveFilters = useMemo(() => {
    return (
      roleFilter !== "all" ||
      activeFilter !== "all" ||
      searchQuery.trim() !== ""
    )
  }, [roleFilter, activeFilter, searchQuery])

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base sm:text-lg font-semibold">Benutzerverwaltung</CardTitle>
            <p className="text-xs text-muted-foreground">Benutzerkonten, Rollen und Berechtigungen verwalten</p>
          </div>
        </div>
        {/* Filters */}
        {/* Mobile: Accordion */}
        <div className="block lg:hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="filters" className="border border-border/40 rounded-sm">
              <AccordionTrigger className="py-2 px-2 hover:no-underline">
                <h4 className="text-xs font-medium">Filter</h4>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-3 px-2">
                <div className="space-y-3">
                  {/* Role and Status in one row */}
                  <div className="flex flex-row gap-2">
                  <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs text-muted-foreground font-medium">Status</label>
                      <Select
                        value={activeFilter}
                        onValueChange={(v) => { setActiveFilter(v as typeof activeFilter); setPage(1) }}
                      >
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="active">Aktiv</SelectItem>
                          <SelectItem value="inactive">Inaktiv</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs text-muted-foreground font-medium">Rolle</label>
                      <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as typeof roleFilter); setPage(1) }}>
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Rolle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="client">Kunden</SelectItem>
                          <SelectItem value="master">Meister</SelectItem>
                          <SelectItem value="seller">Verkäufer</SelectItem>
                          <SelectItem value="admin">Admins</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Search */}
                  <div className="relative flex flex-col gap-1.5">
                      <label className="text-xs text-muted-foreground font-medium">Suchen</label>
                      <div className="relative">
                        <div className="flex items-center justify-center w-7 h-7 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                          <Search className="h-3.5 w-3.5" />
                        </div>
                        <Input
                          type="text"
                          placeholder="Benutzer suchen..."
                          className="pl-11 h-8 text-xs rounded-sm border border-border/40 focus:border-primary shadow-none"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        />
                      </div>
                  </div>
                  
                  {/* Clear Button */}
                  {hasActiveFilters && (
                    <div className="flex flex-col gap-1.5 justify-end items-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-8 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Zurücksetzen
                      </Button>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        
        {/* Desktop: All filters in one row */}
        <div className="hidden lg:flex flex-row gap-2 items-end">
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Rolle</label>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as typeof roleFilter); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Rolle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="client">Kunden</SelectItem>
                <SelectItem value="master">Meister</SelectItem>
                <SelectItem value="seller">Verkäufer</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Status</label>
            <Select
              value={activeFilter}
              onValueChange={(v) => { setActiveFilter(v as typeof activeFilter); setPage(1) }}
            >
              <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="inactive">Inaktiv</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Suchen</label>
            <div className="relative">
              <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-sm bg-primary/10 text-primary shrink-0 absolute left-1.5 top-1/2 -translate-y-1/2 border border-primary/20 z-10">
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <Input
                type="text"
                placeholder="Benutzer suchen..."
                className="pl-11 sm:pl-12 h-8 sm:h-9 text-xs sm:text-sm rounded-sm border border-border/40 focus:border-primary shadow-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex flex-col gap-1.5 justify-end items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 sm:h-9 text-xs sm:text-sm"
              >
                <X className="h-3 w-3 mr-1" />
                Zurücksetzen
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-3 sm:pt-0 sm:pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 sm:py-10 px-3 sm:px-4">
            <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 sm:py-10 text-muted-foreground px-3 sm:px-4">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className="text-xs sm:text-sm">Keine Benutzer gefunden</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-2 px-3">
              {users.map((user) => (
                <Card key={user.id} className="border border-border/40 p-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <Avatar className="h-12 w-12 shrink-0 rounded-full">
                        {user.image_url && (
                          <AvatarImage src={getOptimizedImageUrl(user.image_url, 'thumbnail')} alt={user.name} className="rounded-full" />
                        )}
                        <AvatarFallback className="text-xs rounded-full">{user.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h4 className="font-medium text-xs leading-tight truncate">{user.name}</h4>
                          {user.email_verified && (
                            <Shield className="h-3 w-3 text-green-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <Mail className="h-2.5 w-2.5" />
                          {user.email}
                        </p>
                        {user.phone && (
                          <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                            <Phone className="h-2.5 w-2.5" />
                            {user.phone}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge
                            variant="outline"
                            className={getRoleBadgeClassName(user.role)}
                          >
                            {user.role === "master" ? "Meister" : 
                           user.role === "seller" ? "Verkäufer" : 
                           user.role === "client" ? "Kunde" : 
                           user.role === "admin" ? "Admin" : 
                           user.role}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0.5 font-medium ${
                              user.is_active
                                ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {user.is_active ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => openEditDialog(user)}
                        title="Benutzer bearbeiten"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => toggleActiveStatus(user)}
                        title={user.is_active ? "Deaktivieren" : "Aktivieren"}
                      >
                        {user.is_active ? (
                          <UserX className="h-3.5 w-3.5 text-orange-600" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5 text-green-600" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setResetPasswordDialog({ open: true, userId: user.id, userName: user.name })}
                        title="Passwort zurücksetzen"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block px-3 sm:px-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs sm:text-sm h-9 min-w-[150px]">Benutzer</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell h-9 min-w-[180px]">Kontakt</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 w-24">Rolle</TableHead>
                    <TableHead className="text-xs sm:text-sm h-9 w-20">Status</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden lg:table-cell h-9 w-24">Verifiziert</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden 2xl:table-cell h-9 w-32">Beigetreten</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm h-9 w-32">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="h-auto">
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-8 w-8 rounded-full shrink-0">
                            {user.image_url && (
                              <AvatarImage src={getOptimizedImageUrl(user.image_url, 'thumbnail')} alt={user.name} className="rounded-full" />
                            )}
                            <AvatarFallback className="text-xs rounded-full">{user.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs sm:text-sm truncate">{user.name}</p>
                            {user.email_verified && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Shield className="h-3 w-3 shrink-0 text-green-600" />
                                <span className="truncate">Verifiziert</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden md:table-cell">
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 min-w-0">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </p>
                          {user.phone && (
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 min-w-0">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate">{user.phone}</span>
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={getRoleBadgeClassName(user.role)}
                        >
                          {user.role === "master" ? "Meister" : 
                           user.role === "seller" ? "Verkäufer" : 
                           user.role === "client" ? "Kunde" : 
                           user.role === "admin" ? "Admin" : 
                           user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 font-medium whitespace-nowrap ${
                            user.is_active
                              ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }`}
                        >
                          {user.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 hidden lg:table-cell">
                        {user.email_verified ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-2 py-0.5 font-medium whitespace-nowrap border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                          >
                            Verifiziert
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-2 py-0.5 font-medium whitespace-nowrap border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                          >
                            Unverifiziert
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2 hidden 2xl:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(user.created_at), { addSuffix: true, locale: de })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => openEditDialog(user)}
                            title="Benutzer bearbeiten"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => toggleActiveStatus(user)}
                            title={user.is_active ? "Deaktivieren" : "Aktivieren"}
                          >
                            {user.is_active ? (
                              <UserX className="h-3.5 w-3.5 text-orange-600" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5 text-green-600" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => setResetPasswordDialog({ open: true, userId: user.id, userName: user.name })}
                            title="Passwort zurücksetzen"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 sm:mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 text-xs"
            >
              Zurück
            </Button>
            <span className="text-xs sm:text-sm text-muted-foreground">
              Seite {page} von {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 text-xs"
            >
              Weiter
            </Button>
          </div>
        )}
      </CardContent>

      {/* Edit User Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, user: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader className="text-left">
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Rolle</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm(prev => ({ ...prev, role: v }))}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Kunde</SelectItem>
                  <SelectItem value="master">Meister</SelectItem>
                  <SelectItem value="seller">Verkäufer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Telefonnummer</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Telefonnummer eingeben"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={editForm.is_active}
                onChange={(e) => setEditForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="edit-active" className="cursor-pointer">Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, user: null })}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdateUser}>
              Änderungen speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <AlertDialog open={resetPasswordDialog.open} onOpenChange={(open) => setResetPasswordDialog({ open, userId: null, userName: "" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Passwort zurücksetzen</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie das Passwort für <strong>{resetPasswordDialog.userName}</strong> zurücksetzen möchten? 
              Das Passwort wird auf den Standardwert gesetzt: <strong>password123</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} className="bg-destructive hover:bg-destructive/90">
              Passwort zurücksetzen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

