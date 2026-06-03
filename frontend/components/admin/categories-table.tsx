"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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
import { Search, Edit, Trash2, Plus, Loader2, Tag, Image as ImageIcon, X, Upload, AlertCircle } from "lucide-react"
import { getCategories, getCategory, createCategory, updateCategory, deleteCategory } from "@/lib/api/categories"
import { uploadMedia } from "@/lib/api/media"
import { toast } from "sonner"
import type { Category, CategoryInput, CategoryUpdate, CategoryType } from "@/lib/api/types"
import Image from "next/image"
import { getSameOriginOptimizedImageUrl, shouldUseUnoptimized, cn } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { useIsMobile } from "@/hooks/use-mobile"

const PLACEHOLDER_IMAGE = "/placeholder.jpg"

function buildCategoryImageSrc(
  imageUrl: string | undefined | null,
  cacheBust?: string | number
): { src: string; unoptimized: boolean } {
  const raw = imageUrl?.trim()
  if (!raw) {
    return { src: PLACEHOLDER_IMAGE, unoptimized: false }
  }
  let src = getSameOriginOptimizedImageUrl(raw, "thumbnail") || PLACEHOLDER_IMAGE
  const useSameOrigin = src.startsWith("/") && !src.startsWith("//")
  if (cacheBust != null && cacheBust !== "" && !src.startsWith("data:")) {
    const sep = src.includes("?") ? "&" : "?"
    src = `${src}${sep}t=${cacheBust}`
  }
  return {
    src,
    unoptimized: useSameOrigin || shouldUseUnoptimized(src),
  }
}

function buildFormCategoryImageSrc(
  imageUrl: string | undefined | null,
  options: { cacheBustTimestamp?: number; uploadCounter?: number }
): { src: string; unoptimized: boolean } {
  const raw = imageUrl?.trim()
  if (!raw) {
    return { src: PLACEHOLDER_IMAGE, unoptimized: false }
  }
  let src = getSameOriginOptimizedImageUrl(raw, "thumbnail") || PLACEHOLDER_IMAGE
  const useSameOrigin = src.startsWith("/") && !src.startsWith("//")
  if (!src.startsWith("data:")) {
    const params: string[] = []
    if (options.cacheBustTimestamp && options.cacheBustTimestamp > 0) {
      params.push(`t=${options.cacheBustTimestamp}`)
    }
    if (options.uploadCounter && options.uploadCounter > 0) {
      params.push(`c=${options.uploadCounter}`)
    }
    if (params.length > 0) {
      const sep = src.includes("?") ? "&" : "?"
      src = `${src}${sep}${params.join("&")}`
    }
  }
  return {
    src,
    unoptimized: useSameOrigin || shouldUseUnoptimized(src),
  }
}

export function CategoriesTable() {
  const isMobile = useIsMobile()
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<CategoryType | "all">("all")
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all")
  
  // Pagination for categories
  const [categoriesPage, setCategoriesPage] = useState(1)
  const [categoriesTotalPages, setCategoriesTotalPages] = useState(1)
  
  // Pagination for subcategories
  const [subcategoriesPage, setSubcategoriesPage] = useState(1)
  const [subcategoriesTotalPages, setSubcategoriesTotalPages] = useState(1)
  
  const [dialogOpen, setDialogOpen] = useState(false)
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingSubcategory, setEditingSubcategory] = useState<Category | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; category: Category | null; isSubcategory: boolean }>({
    open: false,
    category: null,
    isSubcategory: false,
  })
  const [formData, setFormData] = useState<CategoryInput>({
    name: "",
    slug: "",
    type: "master",
    description: "",
    image_url: "",
    parent_id: null,
    sort_order: 0,
    is_active: true,
  })
  const [subcategoryFormData, setSubcategoryFormData] = useState<CategoryInput>({
    name: "",
    slug: "",
    type: "master",
    description: "",
    image_url: "", // Will be auto-generated by backend or use uploaded image
    parent_id: null,
    sort_order: 0,
    is_active: true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUploadTimestamp, setImageUploadTimestamp] = useState<number>(0)
  const [imageUploadCounter, setImageUploadCounter] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)
  const [slugDuplicateWarning, setSlugDuplicateWarning] = useState<string | null>(null)
  const [subcategorySlugDuplicateWarning, setSubcategorySlugDuplicateWarning] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCategories()
  }, [categoriesPage, typeFilter, activeFilter])

  useEffect(() => {
    if (selectedCategory) {
      loadSubcategories()
    } else {
      setSubcategories([])
    }
  }, [selectedCategory, subcategoriesPage])

  // Create data URL for image preview (to avoid CSP blob: issues)
  const createImagePreview = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to create image preview - invalid data URL'))
        }
      }
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      try {
        reader.readAsDataURL(file)
      } catch (error) {
        reject(error)
      }
    })
  }, [])

  // Create data URL when imageFile changes
  useEffect(() => {
    if (imageFile) {
      createImagePreview(imageFile)
        .then((dataUrl) => {
          setImagePreviewUrl(dataUrl)
        })
        .catch((error) => {
          console.error('Failed to create image preview:', error)
          setImagePreviewUrl(null)
        })
    } else {
      setImagePreviewUrl(null)
    }
  }, [imageFile, createImagePreview])


  const loadCategories = async () => {
    try {
      setLoading(true)
      const params: any = {
        page: categoriesPage,
        page_size: 20,
        root_only: true,
      }
      if (typeFilter !== "all") {
        params.type = typeFilter
      }
      if (activeFilter === "active") {
        params.active_only = true
      } else if (activeFilter === "inactive") {
        params.active_only = false
      }
      const response = await getCategories(params)
      setCategories(response.items || [])
      setCategoriesTotalPages(response.total_pages || 1)
    } catch (error: any) {
      console.error("Failed to load categories:", error)
      toast.error("Kategorien konnten nicht geladen werden")
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const loadSubcategories = async () => {
    if (!selectedCategory) return
    
    try {
      setSubcategoriesLoading(true)
      const params: any = {
        page: subcategoriesPage,
        page_size: 20,
        parent_id: selectedCategory.id,
      }
      if (typeFilter !== "all") {
        params.type = typeFilter
      }
      if (activeFilter === "active") {
        params.active_only = true
      } else if (activeFilter === "inactive") {
        params.active_only = false
      }
      const response = await getCategories(params)
      setSubcategories(response.items || [])
      setSubcategoriesTotalPages(response.total_pages || 1)
    } catch (error: any) {
      console.error("Failed to load subcategories:", error)
      toast.error("Unterkategorien konnten nicht geladen werden")
      setSubcategories([])
    } finally {
      setSubcategoriesLoading(false)
    }
  }

  const handleOpenDialog = async (category?: Category) => {
    if (category) {
      // Reload the category to get the latest data including image_url
      try {
        const freshCategory = await getCategory(category.id)
        setEditingCategory(freshCategory)
        setFormData({
          name: freshCategory.name,
          slug: freshCategory.slug,
          type: freshCategory.type,
          description: freshCategory.description || "",
          image_url: freshCategory.image_url || "",
          parent_id: null,
          sort_order: freshCategory.sort_order,
          is_active: freshCategory.is_active,
        })
      } catch (error) {
        // If reload fails, use the category from the list
        console.error("Failed to reload category:", error)
        setEditingCategory(category)
        setFormData({
          name: category.name,
          slug: category.slug,
          type: category.type,
          description: category.description || "",
          image_url: category.image_url || "",
          parent_id: null,
          sort_order: category.sort_order,
          is_active: category.is_active,
        })
      }
    } else {
      setEditingCategory(null)
      setFormData({
        name: "",
        slug: "",
        type: typeFilter !== "all" ? typeFilter : "master",
        description: "",
        image_url: "",
        parent_id: null,
        sort_order: 0,
        is_active: true,
      })
    }
    // Reset image upload timestamp and counter when opening dialog
    setImageUploadTimestamp(0)
    setImageUploadCounter(0)
    setImageFile(null)
    setImagePreviewUrl(null)
    setDialogOpen(true)
  }

  const handleOpenSubcategoryDialog = async (subcategory?: Category) => {
    if (subcategory) {
      // Reload the subcategory to get the latest data including image_url
      try {
        const freshSubcategory = await getCategory(subcategory.id)
        setEditingSubcategory(freshSubcategory)
        setSubcategoryFormData({
          name: freshSubcategory.name,
          slug: freshSubcategory.slug,
          type: freshSubcategory.type,
          description: freshSubcategory.description || "",
          image_url: freshSubcategory.image_url || "",
          parent_id: freshSubcategory.parent_id || null,
          sort_order: freshSubcategory.sort_order,
          is_active: freshSubcategory.is_active,
        })
      } catch (error) {
        // If reload fails, use the subcategory from the list
        console.error("Failed to reload subcategory:", error)
        setEditingSubcategory(subcategory)
        setSubcategoryFormData({
          name: subcategory.name,
          slug: subcategory.slug,
          type: subcategory.type,
          description: subcategory.description || "",
          image_url: subcategory.image_url || "",
          parent_id: subcategory.parent_id || null,
          sort_order: subcategory.sort_order,
          is_active: subcategory.is_active,
        })
      }
    } else {
      if (!selectedCategory) {
        toast.error("Bitte wählen Sie zuerst eine Kategorie aus")
        return
      }
      setEditingSubcategory(null)
      setSubcategoryFormData({
        name: "",
        slug: "",
        type: selectedCategory.type,
        description: "",
        image_url: "",
        parent_id: selectedCategory.id,
        sort_order: 0,
        is_active: true,
      })
    }
    setSubcategoryDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingCategory(null)
    setImageFile(null)
    setImagePreviewUrl(null)
    setIsDragging(false)
    setSlugDuplicateWarning(null)
    setImageUploadTimestamp(0)
    setImageUploadCounter(0)
    setFormData({
      name: "",
      slug: "",
      type: "master",
      description: "",
      image_url: "",
      parent_id: null,
      sort_order: 0,
      is_active: true,
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Bitte wählen Sie eine Bilddatei aus")
        return
      }
      setImageFile(file)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please drop an image file")
        return
      }
      setImageFile(file)
    }
  }, [])


  const handleCloseSubcategoryDialog = () => {
    setSubcategoryDialogOpen(false)
    setEditingSubcategory(null)
    setSubcategorySlugDuplicateWarning(null)
    setSubcategoryFormData({
      name: "",
      slug: "",
      type: "master",
      description: "",
      image_url: "",
      parent_id: null,
      sort_order: 0,
      is_active: true,
    })
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }

  const checkSlugDuplicate = (slug: string, currentId?: number): boolean => {
    if (!slug) return false
    // Check against all categories and subcategories
    const allCategories = [...categories, ...subcategories]
    return allCategories.some(
      (cat) => cat.slug === slug && cat.id !== currentId && cat.type === formData.type
    )
  }

  const checkSubcategorySlugDuplicate = (slug: string, currentId?: number): boolean => {
    if (!slug) return false
    // Check against all categories and subcategories
    const allCategories = [...categories, ...subcategories]
    return allCategories.some(
      (cat) => cat.slug === slug && cat.id !== currentId && cat.type === subcategoryFormData.type
    )
  }

  const handleNameChange = (name: string) => {
    const newSlug = generateSlug(name)
    const isDuplicate = checkSlugDuplicate(newSlug, editingCategory?.id)
    
    setFormData((prev) => ({
      ...prev,
      name,
      slug: newSlug, // Always auto-generate slug from name
    }))
    
    if (isDuplicate) {
      setSlugDuplicateWarning(`Slug "${newSlug}" existiert bereits. Bitte verwenden Sie einen anderen Namen.`)
    } else {
      setSlugDuplicateWarning(null)
    }
  }

  const handleSubcategoryNameChange = (name: string) => {
    const newSlug = generateSlug(name)
    const isDuplicate = checkSubcategorySlugDuplicate(newSlug, editingSubcategory?.id)
    
    setSubcategoryFormData((prev) => ({
      ...prev,
      name,
      slug: newSlug, // Always auto-generate slug from name
    }))
    
    if (isDuplicate) {
      setSubcategorySlugDuplicateWarning(`Slug "${newSlug}" existiert bereits. Bitte verwenden Sie einen anderen Namen.`)
    } else {
      setSubcategorySlugDuplicateWarning(null)
    }
  }

  const uploadCategoryImageFile = async (): Promise<string | null> => {
    if (!imageFile) {
      return formData.image_url?.trim() || null
    }
    if (!formData.name?.trim() || !formData.slug?.trim()) {
      throw new Error("Bitte geben Sie zuerst einen Kategorienamen ein")
    }

    const uploadedMedia = await uploadMedia(imageFile, {
      media_type: "photo",
      title: formData.name || editingCategory?.name || "Category Image",
      category_id: editingCategory?.id,
      category: editingCategory?.slug || formData.slug,
    })

    let finalImageUrl: string | null = uploadedMedia.url || null
    let updatedCategoryData: Category | null = null

    if (editingCategory?.id) {
      updatedCategoryData = await getCategory(editingCategory.id)
      finalImageUrl = updatedCategoryData.image_url || finalImageUrl
      setEditingCategory(updatedCategoryData)
    }

    setImagePreviewUrl(null)
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    await new Promise((resolve) => setTimeout(resolve, 50))

    const timestamp = updatedCategoryData?.updated_at
      ? new Date(updatedCategoryData.updated_at).getTime()
      : Date.now()
    setImageUploadTimestamp(timestamp + Math.random())
    setImageUploadCounter((prev) => prev + 1)

    if (finalImageUrl) {
      setFormData((prev) => ({ ...prev, image_url: finalImageUrl }))
    }

    return finalImageUrl
  }

  const handleImageUpload = async () => {
    if (!imageFile) {
      toast.error("Bitte wählen Sie zuerst ein Bild aus")
      return
    }

    try {
      setUploadingImage(true)
      setFormData((prev) => ({ ...prev, image_url: "" }))
      await uploadCategoryImageFile()
      toast.success("Bild erfolgreich hochgeladen")
    } catch (error: any) {
      toast.error(error.message || "Bild konnte nicht hochgeladen werden")
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDeleteImage = async () => {
    if (!editingCategory) {
      // If not editing, just clear the form data
      setFormData((prev) => ({ ...prev, image_url: "" }))
      return
    }

    try {
      setUploadingImage(true)
      // Update category with empty image_url to delete the image
      await updateCategory(editingCategory.id, { image_url: "" })
      
      // Update formData to reflect the deletion
      setFormData((prev) => ({ ...prev, image_url: "" }))
      
      // Reload categories to reflect the change
      loadCategories()
      toast.success("Bild erfolgreich gelöscht")
    } catch (error: any) {
      toast.error(error.message || "Bild konnte nicht gelöscht werden")
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.slug) {
      toast.error("Name und Slug sind erforderlich")
      return
    }

    // Check for duplicate slug before submitting
    if (slugDuplicateWarning) {
      toast.error("Bitte beheben Sie das Problem mit dem doppelten Slug, bevor Sie speichern")
      return
    }

    try {
      setSubmitting(true)

      const pendingImageFile = imageFile
      let imageUrlToSave = formData.image_url?.trim() || ""

      // Existing category: upload before PATCH so image_url is stored on the API
      if (pendingImageFile && editingCategory) {
        setUploadingImage(true)
        try {
          const uploadedUrl = await uploadCategoryImageFile()
          if (uploadedUrl) {
            imageUrlToSave = uploadedUrl
          }
        } finally {
          setUploadingImage(false)
        }
      }

      if (editingCategory) {
        const updateData: CategoryUpdate = {
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
          ...(imageUrlToSave === ""
            ? { image_url: "" }
            : imageUrlToSave
            ? { image_url: imageUrlToSave }
            : {}),
          sort_order: formData.sort_order,
          is_active: formData.is_active,
        }
        logger.log("Updating category:", editingCategory.id, updateData)
        const updatedCategory = await updateCategory(editingCategory.id, updateData)
        
        // Update the category in the local list with fresh data
        setCategories((prev) =>
          prev.map((cat) => (cat.id === updatedCategory.id ? updatedCategory : cat))
        )
        
        // If this category is selected, update it too
        if (selectedCategory && selectedCategory.id === updatedCategory.id) {
          setSelectedCategory(updatedCategory)
        }
        
        toast.success("Kategorie erfolgreich aktualisiert")
      } else {
        const createData: CategoryInput = {
          name: formData.name,
          slug: formData.slug,
          type: formData.type,
          description: formData.description || undefined,
          parent_id: formData.parent_id || undefined,
          sort_order: formData.sort_order,
          is_active: formData.is_active,
          image_url: pendingImageFile ? undefined : imageUrlToSave || undefined,
        }
        const created = await createCategory(createData)
        if (pendingImageFile) {
          setUploadingImage(true)
          try {
            await uploadMedia(pendingImageFile, {
              media_type: "photo",
              title: formData.name || "Category Image",
              category_id: created.id,
              category: created.slug,
            })
          } finally {
            setUploadingImage(false)
          }
        }
        toast.success("Kategorie erfolgreich erstellt")
      }
      handleCloseDialog()
      loadCategories()
      if (selectedCategory && editingCategory?.id === selectedCategory.id) {
        setSelectedCategory(null)
      }
    } catch (error: any) {
      toast.error(error.message || "Kategorie konnte nicht gespeichert werden")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubcategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subcategoryFormData.name || !subcategoryFormData.slug) {
      toast.error("Name und Slug sind erforderlich")
      return
    }
    if (!subcategoryFormData.parent_id) {
      toast.error("Parent category is required")
      return
    }

    // Check for duplicate slug before submitting
    if (subcategorySlugDuplicateWarning) {
      toast.error("Bitte beheben Sie das Problem mit dem doppelten Slug, bevor Sie speichern")
      return
    }

    try {
      setSubmitting(true)
      if (editingSubcategory) {
        const updateData: CategoryUpdate = {
          name: subcategoryFormData.name,
          slug: subcategoryFormData.slug,
          description: subcategoryFormData.description || undefined,
          parent_id: subcategoryFormData.parent_id || undefined,
          sort_order: subcategoryFormData.sort_order,
          is_active: subcategoryFormData.is_active,
        }
        logger.log("Updating subcategory:", editingSubcategory.id, updateData)
        const updatedSubcategory = await updateCategory(editingSubcategory.id, updateData)
        
        // Update the subcategory in the local list with fresh data
        setSubcategories((prev) =>
          prev.map((subcat) => (subcat.id === updatedSubcategory.id ? updatedSubcategory : subcat))
        )
        
        toast.success("Unterkategorie erfolgreich aktualisiert")
      } else {
        const createData: CategoryInput = {
          name: subcategoryFormData.name,
          slug: subcategoryFormData.slug,
          type: subcategoryFormData.type,
          description: subcategoryFormData.description || undefined,
          parent_id: subcategoryFormData.parent_id || undefined,
          sort_order: subcategoryFormData.sort_order,
          is_active: subcategoryFormData.is_active,
        }
        await createCategory(createData)
        toast.success("Unterkategorie erfolgreich erstellt")
      }
      handleCloseSubcategoryDialog()
      loadSubcategories()
    } catch (error: any) {
      toast.error(error.message || "Unterkategorie konnte nicht gespeichert werden")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.category) return

    try {
      await deleteCategory(deleteDialog.category.id)
      toast.success(deleteDialog.isSubcategory ? "Unterkategorie erfolgreich gelöscht" : "Kategorie erfolgreich gelöscht")
      setDeleteDialog({ open: false, category: null, isSubcategory: false })
      if (deleteDialog.isSubcategory) {
        loadSubcategories()
      } else {
        loadCategories()
        if (selectedCategory?.id === deleteDialog.category.id) {
          setSelectedCategory(null)
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Kategorie konnte nicht gelöscht werden")
    }
  }

  const filteredCategories = categories.filter((category) => {
    const matchesSearch =
      !searchQuery ||
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (category.description &&
        category.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
  })

  const filteredSubcategories = subcategories.filter((subcategory) => {
    const matchesSearch =
      !searchQuery ||
      subcategory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subcategory.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (subcategory.description &&
        subcategory.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
  })

  const clearFilters = () => {
    setTypeFilter("all")
    setActiveFilter("all")
    setSearchQuery("")
    setCategoriesPage(1)
  }

  const hasActiveFilters = useMemo(() => {
    return (
      typeFilter !== "all" ||
      activeFilter !== "all" ||
      searchQuery.trim() !== ""
    )
  }, [typeFilter, activeFilter, searchQuery])

  return (
    <>
      <Card className="border border-border/40 shadow-sm">
        <CardHeader className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base sm:text-lg font-semibold">Kategorien-Verwaltung</CardTitle>
              <p className="text-xs text-muted-foreground">Inhalte mit Kategorien und Unterkategorien organisieren</p>
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
                    {/* Type and Status in one row */}
                    <div className="flex flex-row gap-2">
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs text-muted-foreground font-medium">Typ</label>
                        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as CategoryType | "all"); setCategoriesPage(1) }}>
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue placeholder="Typ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle</SelectItem>
                            <SelectItem value="master">Meister</SelectItem>
                            <SelectItem value="product">Produkte</SelectItem>
                            <SelectItem value="rental">Mieten</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs text-muted-foreground font-medium">Status</label>
                        <Select
                          value={activeFilter}
                          onValueChange={(v) => { setActiveFilter(v as "all" | "active" | "inactive"); setCategoriesPage(1) }}
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
                          placeholder="Kategorien suchen..."
                          className="pl-11 h-8 text-xs rounded-sm border border-border/40 focus:border-primary shadow-none"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
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
              <label className="text-xs text-muted-foreground font-medium">Typ</label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as CategoryType | "all"); setCategoriesPage(1) }}>
                <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="master">Meister</SelectItem>
                  <SelectItem value="product">Produkte</SelectItem>
                  <SelectItem value="rental">Mieten</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 sm:flex-none min-w-[140px]">
              <label className="text-xs text-muted-foreground font-medium">Status</label>
              <Select
                value={activeFilter}
                onValueChange={(v) => { setActiveFilter(v as "all" | "active" | "inactive"); setCategoriesPage(1) }}
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
                  placeholder="Kategorien suchen..."
                  className="pl-11 sm:pl-12 h-8 sm:h-9 text-xs sm:text-sm rounded-sm border border-border/40 focus:border-primary shadow-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Categories Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-3 sm:px-4">
                <h3 className="text-sm font-semibold">Kategorien</h3>
                <div className="flex items-center gap-1.5">
                  {selectedCategory && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCategory(null)}
                      className="h-7 px-2.5 text-xs border-border/40 hover:bg-muted"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Zurücksetzen
                    </Button>
                  )}
                  <Button
                    onClick={() => handleOpenDialog()}
                    className="gap-1.5 h-7 px-2.5 text-xs"
                    size="sm"
                  >
                    <Plus className="h-3 w-3" />
                    Hinzufügen
                  </Button>
                </div>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8 sm:py-10 px-3 sm:px-4">
                  <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="text-center py-8 sm:py-10 text-muted-foreground px-3 sm:px-4">
                  <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
                  <p className="text-xs sm:text-sm">Keine Kategorien gefunden</p>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block sm:hidden space-y-2 px-3">
                    {filteredCategories.map((category) => (
                      <Card
                        key={category.id}
                        className={`border border-border/40 p-3 cursor-pointer transition-colors ${
                          selectedCategory?.id === category.id ? "bg-muted border-primary" : "hover:bg-muted/50"
                        }`}
                        onClick={() => {
                          setSelectedCategory(category)
                          // On mobile, the sidebar will be controlled by selectedCategory state
                        }}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start gap-3">
                            <div className="shrink-0">
                              {(() => {
                                const hasImageUrl = category.image_url && category.image_url.trim()
                                
                                if (!hasImageUrl) {
                                  return (
                                    <div className="w-14 h-14 rounded-full border border-dashed flex items-center justify-center bg-muted">
                                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )
                                }
                                
                                const { src: imageSrc, unoptimized } = buildCategoryImageSrc(
                                  category.image_url,
                                  category.updated_at ? new Date(category.updated_at).getTime() : undefined
                                )
                                
                                return (
                                  <div className="relative w-14 h-14 rounded-full overflow-hidden border bg-muted">
                                    <Image
                                      key={`${category.id}-${category.updated_at || category.image_url}`}
                                      src={imageSrc}
                                      alt={category.name}
                                      fill
                                      className="object-cover"
                                      sizes="56px"
                                      unoptimized={unoptimized}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                        const parent = target.parentElement
                                        if (parent && !parent.querySelector('.error-placeholder')) {
                                          const placeholder = document.createElement('div')
                                          placeholder.className = 'error-placeholder w-full h-full flex items-center justify-center bg-muted rounded-full'
                                          placeholder.innerHTML = `
                                            <svg class="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                          `
                                          parent.appendChild(placeholder)
                                        }
                                      }}
                                    />
                                  </div>
                                )
                              })()}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div>
                                <h4 className="font-medium text-sm leading-tight">{category.name}</h4>
                                {category.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {category.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 py-0.5 capitalize font-medium ${
                                    category.type === "master"
                                      ? "border-blue-500/50 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                      : category.type === "product"
                                      ? "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                                      : category.type === "rental"
                                      ? "border-teal-500/50 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                                      : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                                  }`}
                                >
                                  {category.type === "master" ? "Meister" : 
                                 category.type === "product" ? "Produkt" : 
                                 category.type === "rental" ? "Mieten" : 
                                 category.type}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 py-0.5 font-medium ${
                                    category.is_active
                                      ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                      : "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                                  }`}
                                >
                                  {category.is_active ? "Aktiv" : "Inaktiv"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenDialog(category)}
                              title="Kategorie bearbeiten"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteDialog({ open: true, category, isSubcategory: false })}
                              title="Kategorie löschen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto border rounded-sm px-3 sm:px-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-16">Bild</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden md:table-cell">Typ</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Aktionen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCategories.map((category) => (
                          <TableRow
                            key={category.id}
                            className={`cursor-pointer hover:bg-muted/50 h-auto ${selectedCategory?.id === category.id ? "bg-muted" : ""}`}
                            onClick={() => setSelectedCategory(category)}
                          >
                            <TableCell>
                              {(() => {
                                const hasImageUrl = category.image_url && category.image_url.trim()
                                
                                if (!hasImageUrl) {
                                  return (
                                    <div className="w-10 h-10 rounded border border-dashed flex items-center justify-center bg-muted">
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )
                                }
                                
                                const { src: imageSrc, unoptimized } = buildCategoryImageSrc(
                                  category.image_url,
                                  category.updated_at ? new Date(category.updated_at).getTime() : undefined
                                )
                                
                                return (
                                  <div className="relative w-10 h-10 rounded overflow-hidden border bg-muted">
                                    <Image
                                      key={`${category.id}-${category.updated_at || category.image_url}`}
                                      src={imageSrc}
                                      alt={category.name}
                                      fill
                                      className="object-cover"
                                      sizes="40px"
                                      unoptimized={unoptimized}
                                      onError={(e) => {
                                        // Log error for debugging
                                        console.error(`Failed to load image for category "${category.name}":`, {
                                          imageSrc,
                                          originalUrl: category.image_url,
                                        })
                                        // If image fails to load, show placeholder icon
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                        const parent = target.parentElement
                                        if (parent && !parent.querySelector('.error-placeholder')) {
                                          const placeholder = document.createElement('div')
                                          placeholder.className = 'error-placeholder w-full h-full flex items-center justify-center bg-muted'
                                          placeholder.innerHTML = `
                                            <svg class="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                          `
                                          parent.appendChild(placeholder)
                                        }
                                      }}
                                    />
                                  </div>
                                )
                              })()}
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium text-xs sm:text-sm">{category.name}</span>
                                {category.description && (
                                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                                    {category.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell py-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0.5 capitalize font-medium whitespace-nowrap ${
                                  category.type === "master"
                                    ? "border-blue-500/50 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                    : category.type === "product"
                                    ? "border-orange-500/50 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                                    : category.type === "rental"
                                    ? "border-teal-500/50 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                                    : "border-gray-500/50 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300"
                                }`}
                              >
                                {category.type === "master" ? "Meister" : 
                                 category.type === "product" ? "Produkt" : 
                                 category.type === "rental" ? "Mieten" : 
                                 category.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0.5 font-medium whitespace-nowrap ${
                                  category.is_active
                                    ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                    : "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                                }`}
                              >
                                {category.is_active ? "Aktiv" : "Inaktiv"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleOpenDialog(category)}
                                  title="Kategorie bearbeiten"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteDialog({ open: true, category, isSubcategory: false })}
                                  title="Kategorie löschen"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {categoriesTotalPages > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCategoriesPage(p => Math.max(1, p - 1))}
                        disabled={categoriesPage === 1}
                        className="h-7 text-xs"
                      >
                        Zurück
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Seite {categoriesPage} von {categoriesTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCategoriesPage(p => Math.min(categoriesTotalPages, p + 1))}
                        disabled={categoriesPage === categoriesTotalPages}
                        className="h-7 text-xs"
                      >
                        Weiter
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right: Subcategories Table - Desktop Only */}
            <div className="hidden lg:block space-y-3">
              <div className="flex items-center justify-between px-3 sm:px-4">
                <h3 className="text-sm font-semibold">
                  Unterkategorien
                  {selectedCategory && (
                    <span className="text-muted-foreground ml-2">({selectedCategory.name})</span>
                  )}
                </h3>
                {selectedCategory && (
                  <Button
                    onClick={() => handleOpenSubcategoryDialog()}
                    className="gap-1.5 h-7 px-2.5 text-xs"
                    size="sm"
                  >
                    <Plus className="h-3 w-3" />
                    Hinzufügen
                  </Button>
                )}
              </div>
              {!selectedCategory ? (
                <div className="text-center py-8 sm:py-10 border rounded-sm border-dashed text-muted-foreground px-3 sm:px-4">
                  <Tag className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
                  <p className="text-xs sm:text-sm">
                    Wählen Sie eine Kategorie aus, um ihre Unterkategorien anzuzeigen
                  </p>
                </div>
              ) : subcategoriesLoading ? (
                <div className="flex items-center justify-center py-8 sm:py-10 px-3 sm:px-4">
                  <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSubcategories.length === 0 ? (
                <div className="text-center py-8 sm:py-10 text-muted-foreground border rounded-sm px-3 sm:px-4">
                  <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
                  <p className="text-xs sm:text-sm">Keine Unterkategorien gefunden</p>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block sm:hidden space-y-2 px-3">
                    {filteredSubcategories.map((subcategory) => (
                      <Card key={subcategory.id} className="border border-border/40 p-3">
                        <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0 space-y-1.5">
                              <div>
                                <h4 className="font-medium text-sm leading-tight">{subcategory.name}</h4>
                                {subcategory.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {subcategory.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-muted-foreground">Reihenfolge: {subcategory.sort_order}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 py-0.5 font-medium ${
                                    subcategory.is_active
                                      ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                      : "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                                  }`}
                                >
                                  {subcategory.is_active ? "Aktiv" : "Inaktiv"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenSubcategoryDialog(subcategory)}
                              title="Unterkategorie bearbeiten"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteDialog({ open: true, category: subcategory, isSubcategory: true })}
                              title="Unterkategorie löschen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto border rounded-sm px-3 sm:px-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden md:table-cell">Reihenfolge</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Aktionen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSubcategories.map((subcategory) => (
                          <TableRow key={subcategory.id} className="h-auto">
                            <TableCell className="py-2">
                              <div className="space-y-1 min-w-0">
                                <span className="font-medium text-xs sm:text-sm truncate block">{subcategory.name}</span>
                                {subcategory.description && (
                                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                                    {subcategory.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs hidden md:table-cell py-2 whitespace-nowrap">{subcategory.sort_order}</TableCell>
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0.5 font-medium whitespace-nowrap ${
                                  subcategory.is_active
                                    ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                    : "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                                }`}
                              >
                                {subcategory.is_active ? "Aktiv" : "Inaktiv"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right py-2">
                              <div className="flex items-center justify-end gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  onClick={() => handleOpenSubcategoryDialog(subcategory)}
                                  title="Unterkategorie bearbeiten"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteDialog({ open: true, category: subcategory, isSubcategory: true })}
                                  title="Unterkategorie löschen"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {subcategoriesTotalPages > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubcategoriesPage(p => Math.max(1, p - 1))}
                        disabled={subcategoriesPage === 1}
                        className="h-7 text-xs"
                      >
                        Zurück
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Seite {subcategoriesPage} von {subcategoriesTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubcategoriesPage(p => Math.min(subcategoriesTotalPages, p + 1))}
                        disabled={subcategoriesPage === subcategoriesTotalPages}
                        className="h-7 text-xs"
                      >
                        Weiter
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Subcategories Sidebar */}
      <div className="sm:hidden">
        <Sheet open={isMobile && !!selectedCategory && !dialogOpen && !subcategoryDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setSelectedCategory(null)
          }
        }}>
          <SheetContent side="right" className="w-full sm:w-[400px] overflow-y-auto p-0">
          <SheetHeader className="pb-3 border-b px-4 pt-4 pr-12">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold">
                Unterkategorien
              </SheetTitle>
              {selectedCategory && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedCategory.name}
                </p>
              )}
            </div>
          </SheetHeader>
          
          <div className="mt-4 space-y-3 overflow-y-auto flex-1">
            {!selectedCategory ? (
              <div className="text-center py-8 border rounded-sm border-dashed text-muted-foreground px-3 mx-4">
                <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">
                  Select a category to view its subcategories
                </p>
              </div>
            ) : subcategoriesLoading ? (
              <div className="flex items-center justify-center py-8 px-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSubcategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-sm px-3 mx-4">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Keine Unterkategorien gefunden</p>
              </div>
            ) : (
              <>
                {/* Add Button and Mobile Card View */}
                <div className="px-4 pb-2">
                  <Button
                    onClick={() => handleOpenSubcategoryDialog()}
                    className="gap-1.5 h-7 px-2.5 text-xs w-full sm:w-auto"
                    size="sm"
                  >
                    <Plus className="h-3 w-3" />
                    Unterkategorie hinzufügen
                  </Button>
                </div>
                <div className="space-y-2 px-4 pb-4">
                  {filteredSubcategories.map((subcategory) => (
                    <Card key={subcategory.id} className="border border-border/40 p-3">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div>
                              <h4 className="font-medium text-sm leading-tight">{subcategory.name}</h4>
                              {subcategory.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {subcategory.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">Order: {subcategory.sort_order}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0.5 font-medium ${
                                  subcategory.is_active
                                    ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                    : "border-red-500/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                                }`}
                              >
                                {subcategory.is_active ? "Aktiv" : "Inaktiv"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenSubcategoryDialog(subcategory)}
                            title="Unterkategorie bearbeiten"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteDialog({ open: true, category: subcategory, isSubcategory: true })}
                            title="Unterkategorie löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                {subcategoriesTotalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 px-4 pb-4 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSubcategoriesPage(p => Math.max(1, p - 1))}
                      disabled={subcategoriesPage === 1}
                      className="h-7 text-xs"
                    >
                      Zurück
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Seite {subcategoriesPage} von {subcategoriesTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSubcategoriesPage(p => Math.min(subcategoriesTotalPages, p + 1))}
                      disabled={subcategoriesPage === subcategoriesTotalPages}
                      className="h-7 text-xs"
                    >
                      Weiter
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      </div>

      {/* Create/Edit Category Dialog - Desktop */}
      <div className="hidden lg:block">
        <div className="hidden sm:block">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="w-full sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6 gap-4 sm:gap-6 m-0 sm:m-4 rounded-none sm:rounded-sm">
              <DialogHeader className="pb-2 sm:pb-4 text-left">
                <DialogTitle className="text-base sm:text-xl">
                {editingCategory ? "Kategorie bearbeiten" : "Kategorie erstellen"}
              </DialogTitle>
            </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="type" className="text-xs sm:text-sm font-medium">
                Typ <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as CategoryType })}
                disabled={submitting || !!editingCategory}
              >
                <SelectTrigger id="type" className="h-9 sm:h-11 text-xs sm:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="master">Meister</SelectItem>
                  <SelectItem value="product">Produkt</SelectItem>
                  <SelectItem value="rental">Mieten</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="name" className="text-xs sm:text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Allesinda Essentials"
                disabled={submitting}
                className={cn(
                  "h-9 sm:h-11 text-xs sm:text-base",
                  slugDuplicateWarning && "border-destructive focus-visible:border-destructive"
                )}
                required
              />
              {slugDuplicateWarning && (
                <p className="text-[10px] sm:text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {slugDuplicateWarning}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="description" className="text-xs sm:text-sm font-medium">
                Description
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optionale Beschreibung"
                disabled={submitting}
                className="h-9 sm:h-11 text-xs sm:text-base"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="image_url" className="text-xs sm:text-sm font-medium">
                Category Image
              </Label>
              
              {/* Drag and Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative border-2 border-dashed rounded-sm p-4 sm:p-6 cursor-pointer transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50",
                  uploadingImage && "opacity-50 cursor-not-allowed"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={submitting || uploadingImage}
                />
                
                {uploadingImage ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                    <p className="text-xs sm:text-sm text-muted-foreground">Bild wird hochgeladen...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2">
                    {imageFile && imagePreviewUrl ? (
                      <>
                        <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded border overflow-hidden bg-muted">
                          <img
                            src={imagePreviewUrl}
                            alt="Vorschau"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Neues Bild — wird beim Speichern hochgeladen</p>
                        <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation()
                              await handleImageUpload()
                            }}
                            disabled={uploadingImage}
                            className="h-7 sm:h-8 text-[10px] sm:text-xs"
                          >
                            {uploadingImage ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Wird hochgeladen...
                              </>
                            ) : (
                              <>
                                <Upload className="h-3 w-3 mr-1" />
                                Bild hochladen
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setImageFile(null)
                              if (fileInputRef.current) {
                                fileInputRef.current.value = ""
                              }
                            }}
                            className="h-7 sm:h-8 text-[10px] sm:text-xs"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </>
                    ) : formData.image_url ? (
                      <>
                        <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded border overflow-hidden bg-muted">
                          {(() => {
                            let cacheBustTimestamp = imageUploadTimestamp
                            if (cacheBustTimestamp === 0 && editingCategory?.updated_at) {
                              cacheBustTimestamp = new Date(editingCategory.updated_at).getTime()
                            }
                            const { src: imageSrc, unoptimized } = buildFormCategoryImageSrc(
                              formData.image_url,
                              { cacheBustTimestamp, uploadCounter: imageUploadCounter }
                            )
                            
                            return (
                              <Image
                                key={`${formData.image_url}-${cacheBustTimestamp}-${editingCategory?.updated_at || ''}-${imageUploadCounter}`}
                                src={imageSrc}
                                alt="Vorschau"
                                fill
                                className="object-cover"
                                sizes="128px"
                                unoptimized={unoptimized}
                                onError={() => {
                                  console.error('Failed to load image:', imageSrc, formData.image_url)
                                }}
                              />
                            )
                          })()}
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Klicken Sie, um das Bild zu ändern</p>
                        <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              fileInputRef.current?.click()
                            }}
                            className="h-7 sm:h-8 text-[10px] sm:text-xs"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Upload Image
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation()
                              await handleDeleteImage()
                            }}
                            disabled={uploadingImage}
                            className="h-7 sm:h-8 text-[10px] sm:text-xs text-destructive hover:text-destructive"
                          >
                            {uploadingImage ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Wird gelöscht...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-3 w-3 mr-1" />
                                Bild löschen
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-xs sm:text-sm font-medium">Bild hierher ziehen & ablegen</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">oder klicken Sie, um auszuwählen</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="sort_order" className="text-xs sm:text-sm font-medium">
                  Sort Order
                </Label>
                <Input
                  id="sort_order"
                  type="number"
                  min="0"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
                  }
                  disabled={submitting}
                  className="h-9 sm:h-11 text-xs sm:text-base"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="is_active" className="text-xs sm:text-sm font-medium">
                  Status
                </Label>
                <Select
                  value={formData.is_active ? "active" : "inactive"}
                  onValueChange={(v) => setFormData({ ...formData, is_active: v === "active" })}
                  disabled={submitting}
                >
                  <SelectTrigger id="is_active" className="h-9 sm:h-11 text-xs sm:text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={submitting}
                className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-base order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-base order-1 sm:order-2">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird gespeichert...
                  </>
                ) : editingCategory ? (
                  "Aktualisieren"
                ) : (
                  "Erstellen"
                )}
              </Button>
            </DialogFooter>
          </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Create/Edit Category Sheet - Mobile */}
      <div className="lg:hidden">
        {isMobile && (
          <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
            <SheetContent side="right" className="w-full sm:w-[500px] overflow-y-auto p-0">
              <SheetHeader className="pb-3 border-b px-4 pt-4 pr-12">
                <SheetTitle className="text-base font-semibold">
                  {editingCategory ? "Kategorie bearbeiten" : "Kategorie erstellen"}
                </SheetTitle>
              </SheetHeader>

            <div className="px-4 py-4 overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sheet-type" className="text-xs font-medium">
                    Typ <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as CategoryType })}
                    disabled={submitting || !!editingCategory}
                  >
                    <SelectTrigger id="sheet-type" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="master">Master</SelectItem>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="rental">Rental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sheet-name" className="text-xs font-medium">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sheet-name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g., Allesinda Essentials"
                    disabled={submitting}
                    className={cn(
                      "h-9 text-xs",
                      slugDuplicateWarning && "border-destructive focus-visible:border-destructive"
                    )}
                    required
                  />
                  {slugDuplicateWarning && (
                    <p className="text-[10px] text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {slugDuplicateWarning}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sheet-description" className="text-xs font-medium">
                    Description
                  </Label>
                  <Input
                    id="sheet-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optionale Beschreibung"
                    disabled={submitting}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sheet-image_url" className="text-xs font-medium">
                    Category Image
                  </Label>
                  
                  {/* Drag and Drop Area */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "relative border-2 border-dashed rounded-sm p-4 cursor-pointer transition-colors",
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50",
                      uploadingImage && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={submitting || uploadingImage}
                    />
                    
                    {uploadingImage ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-xs text-muted-foreground">Bild wird hochgeladen...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        {imageFile && imagePreviewUrl ? (
                          <>
                            <div className="relative w-24 h-24 rounded border overflow-hidden bg-muted">
                              <img
                                src={imagePreviewUrl}
                                alt="Vorschau"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">New image — uploads on save</p>
                            <div className="flex gap-1.5 flex-wrap justify-center">
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await handleImageUpload()
                                }}
                                disabled={uploadingImage}
                                className="h-7 text-[10px]"
                              >
                                {uploadingImage ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-3 w-3 mr-1" />
                                    Upload Image
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setImageFile(null)
                                  if (fileInputRef.current) {
                                    fileInputRef.current.value = ""
                                  }
                                }}
                                className="h-7 text-[10px]"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </>
                        ) : formData.image_url ? (
                          <>
                            <div className="relative w-24 h-24 rounded border overflow-hidden bg-muted">
                              {(() => {
                                let cacheBustTimestamp = imageUploadTimestamp
                                if (cacheBustTimestamp === 0 && editingCategory?.updated_at) {
                                  cacheBustTimestamp = new Date(editingCategory.updated_at).getTime()
                                }
                                const { src: imageSrc, unoptimized } = buildFormCategoryImageSrc(
                                  formData.image_url,
                                  { cacheBustTimestamp, uploadCounter: imageUploadCounter }
                                )
                                
                                return (
                                  <Image
                                    key={`${formData.image_url}-${cacheBustTimestamp}-${editingCategory?.updated_at || ''}-${imageUploadCounter}`}
                                    src={imageSrc}
                                    alt="Vorschau"
                                    fill
                                    className="object-cover"
                                    sizes="96px"
                                    unoptimized={unoptimized}
                                    onError={() => {
                                      console.error('Failed to load image:', imageSrc, formData.image_url)
                                    }}
                                  />
                                )
                              })()}
                            </div>
                            <p className="text-[10px] text-muted-foreground">Click to change image</p>
                            <div className="flex gap-1.5 flex-wrap justify-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  fileInputRef.current?.click()
                                }}
                                className="h-7 text-[10px]"
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Upload Image
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await handleDeleteImage()
                                }}
                                disabled={uploadingImage}
                                className="h-7 text-[10px] text-destructive hover:text-destructive"
                              >
                                {uploadingImage ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Bild löschen
                                  </>
                                )}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-muted-foreground" />
                            <div className="text-center">
                              <p className="text-xs font-medium">Drag & drop an image here</p>
                              <p className="text-[10px] text-muted-foreground mt-1">or click to select</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sheet-sort_order" className="text-xs font-medium">
                      Sort Order
                    </Label>
                    <Input
                      id="sheet-sort_order"
                      type="number"
                      min="0"
                      value={formData.sort_order}
                      onChange={(e) =>
                        setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
                      }
                      disabled={submitting}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sheet-is_active" className="text-xs font-medium">
                      Status
                    </Label>
                    <Select
                      value={formData.is_active ? "active" : "inactive"}
                      onValueChange={(v) => setFormData({ ...formData, is_active: v === "active" })}
                      disabled={submitting}
                    >
                      <SelectTrigger id="sheet-is_active" className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-3 border-t">
                  <Button type="submit" disabled={submitting} className="w-full h-9 text-xs order-1">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Wird gespeichert...
                      </>
                    ) : editingCategory ? (
                      "Aktualisieren"
                    ) : (
                      "Erstellen"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    disabled={submitting}
                    className="w-full h-9 text-xs order-2"
                  >
                    Abbrechen
                  </Button>
                </div>
              </form>
            </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Create/Edit Subcategory Dialog - Desktop */}
      <div className="hidden lg:block">
        <div className="hidden sm:block">
          <Dialog open={subcategoryDialogOpen} onOpenChange={setSubcategoryDialogOpen}>
          <DialogContent className="w-full sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6 gap-4 sm:gap-6 m-0 sm:m-4 rounded-none sm:rounded-sm">
            <DialogHeader className="pb-2 sm:pb-4 text-left">
              <DialogTitle className="text-base sm:text-xl">
              {editingSubcategory ? "Unterkategorie bearbeiten" : "Unterkategorie erstellen"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubcategorySubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="subcategory_name" className="text-xs sm:text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="subcategory_name"
                value={subcategoryFormData.name}
                onChange={(e) => handleSubcategoryNameChange(e.target.value)}
                placeholder="e.g., Allesinda Essentials"
                disabled={submitting}
                className={cn(
                  "h-9 sm:h-11 text-xs sm:text-base",
                  subcategorySlugDuplicateWarning && "border-destructive focus-visible:border-destructive"
                )}
                required
              />
              {subcategorySlugDuplicateWarning && (
                <p className="text-[10px] sm:text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {subcategorySlugDuplicateWarning}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="subcategory_description" className="text-xs sm:text-sm font-medium">
                Description
              </Label>
              <Input
                id="subcategory_description"
                value={subcategoryFormData.description}
                onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, description: e.target.value })}
                placeholder="Optionale Beschreibung"
                disabled={submitting}
                className="h-9 sm:h-11 text-xs sm:text-base"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="subcategory_sort_order" className="text-xs sm:text-sm font-medium">
                  Sort Order
                </Label>
                <Input
                  id="subcategory_sort_order"
                  type="number"
                  min="0"
                  value={subcategoryFormData.sort_order}
                  onChange={(e) =>
                    setSubcategoryFormData({ ...subcategoryFormData, sort_order: parseInt(e.target.value) || 0 })
                  }
                  disabled={submitting}
                  className="h-9 sm:h-11 text-xs sm:text-base"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="subcategory_is_active" className="text-xs sm:text-sm font-medium">
                  Status
                </Label>
                <Select
                  value={subcategoryFormData.is_active ? "active" : "inactive"}
                  onValueChange={(v) => setSubcategoryFormData({ ...subcategoryFormData, is_active: v === "active" })}
                  disabled={submitting}
                >
                  <SelectTrigger id="subcategory_is_active" className="h-9 sm:h-11 text-xs sm:text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseSubcategoryDialog}
                disabled={submitting}
                className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-base order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-base order-1 sm:order-2">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingSubcategory ? (
                  "Aktualisieren"
                ) : (
                  "Erstellen"
                )}
              </Button>
            </DialogFooter>
          </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Create/Edit Subcategory Sheet - Mobile */}
      <div className="lg:hidden">
        {isMobile && (
          <Sheet open={subcategoryDialogOpen} onOpenChange={setSubcategoryDialogOpen}>
            <SheetContent side="right" className="w-full sm:w-[500px] overflow-y-auto p-0">
              <SheetHeader className="pb-3 border-b px-4 pt-4 pr-12">
                <SheetTitle className="text-base font-semibold">
                  {editingSubcategory ? "Unterkategorie bearbeiten" : "Unterkategorie erstellen"}
                </SheetTitle>
              </SheetHeader>

            <div className="px-4 py-4 overflow-y-auto flex-1">
              <form onSubmit={handleSubcategorySubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sheet-subcategory_name" className="text-xs font-medium">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sheet-subcategory_name"
                    value={subcategoryFormData.name}
                    onChange={(e) => handleSubcategoryNameChange(e.target.value)}
                    placeholder="e.g., Allesinda Essentials"
                    disabled={submitting}
                    className={cn(
                      "h-9 text-xs",
                      subcategorySlugDuplicateWarning && "border-destructive focus-visible:border-destructive"
                    )}
                    required
                  />
                  {subcategorySlugDuplicateWarning && (
                    <p className="text-[10px] text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {subcategorySlugDuplicateWarning}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sheet-subcategory_description" className="text-xs font-medium">
                    Description
                  </Label>
                  <Input
                    id="sheet-subcategory_description"
                    value={subcategoryFormData.description}
                    onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, description: e.target.value })}
                    placeholder="Optionale Beschreibung"
                    disabled={submitting}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sheet-subcategory_sort_order" className="text-xs font-medium">
                      Sort Order
                    </Label>
                    <Input
                      id="sheet-subcategory_sort_order"
                      type="number"
                      min="0"
                      value={subcategoryFormData.sort_order}
                      onChange={(e) =>
                        setSubcategoryFormData({ ...subcategoryFormData, sort_order: parseInt(e.target.value) || 0 })
                      }
                      disabled={submitting}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sheet-subcategory_is_active" className="text-xs font-medium">
                      Status
                    </Label>
                    <Select
                      value={subcategoryFormData.is_active ? "active" : "inactive"}
                      onValueChange={(v) => setSubcategoryFormData({ ...subcategoryFormData, is_active: v === "active" })}
                      disabled={submitting}
                    >
                      <SelectTrigger id="sheet-subcategory_is_active" className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-3 border-t">
                  <Button type="submit" disabled={submitting} className="w-full h-9 text-xs order-1">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : editingSubcategory ? (
                      "Update"
                    ) : (
                      "Create"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseSubcategoryDialog}
                    disabled={submitting}
                    className="w-full h-9 text-xs order-2"
                  >
                    Abbrechen
                  </Button>
                </div>
              </form>
            </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, category: null, isSubcategory: false })}
      >
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">
              {deleteDialog.isSubcategory ? "Unterkategorie" : "Kategorie"} löschen
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              Sind Sie sicher, dass Sie "{deleteDialog.category?.name}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden. {!deleteDialog.isSubcategory && "Wenn diese Kategorie Unterkategorien hat oder von Produkten, Verleihen oder Medien verwendet wird, wird die Löschung verhindert."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-3">
            <AlertDialogCancel className="h-9 sm:h-10 text-sm sm:text-base">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-9 sm:h-10 text-sm sm:text-base bg-destructive hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
