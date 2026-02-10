"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, Image as ImageIcon, Video, Loader2 } from "lucide-react"
import { uploadMedia } from "@/lib/api/media"
import { getCategoriesByType } from "@/lib/api/categories"
import { toast } from "sonner"
import Image from "next/image"
import type { Category } from "@/lib/api/types"

interface MediaUploadProps {
  onUploadComplete?: () => void
}

export function MediaUpload({ onUploadComplete }: MediaUploadProps) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<"photo" | "video">("photo")
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_id: undefined as number | undefined,
    is_before_after: false,
    before_url: "",
    after_url: "",
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setCategoriesLoading(true)
      const data = await getCategoriesByType("master", { activeOnly: true, rootOnly: false })
      setCategories(data.filter((category) => category.parent_id))
    } catch (error: any) {
      console.error("Failed to load categories:", error)
      setCategories([])
    } finally {
      setCategoriesLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    const fileType = selectedFile.type
    const isImage = fileType.startsWith("image/")
    const isVideo = fileType.startsWith("video/")

    if (!isImage && !isVideo) {
      toast.error("Please select an image or video file")
      return
    }

    // Validate file size
    const maxSize = mediaType === "video" ? 50 * 1024 * 1024 : 10 * 1024 * 1024 // 50MB for video, 10MB for image
    if (selectedFile.size > maxSize) {
      toast.error(
        `File too large. Maximum size: ${mediaType === "video" ? "50MB" : "10MB"}`
      )
      return
    }

    // Validate video format
    if (isVideo) {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase()
      const validFormats = ["mp4", "mov", "avi", "webm", "mkv"]
      if (!ext || !validFormats.includes(ext)) {
        toast.error(
          `Invalid video format. Supported: ${validFormats.join(", ").toUpperCase()}`
        )
        return
      }
    }

    setFile(selectedFile)
    setMediaType(isVideo ? "video" : "photo")

    // Create preview
    if (isImage) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    } else {
      // For videos, show a placeholder
      setPreview(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file")
      return
    }

    // Validate before/after pair
    if (formData.is_before_after) {
      if (!formData.before_url || !formData.after_url) {
        toast.error("Both before and after URLs are required for before/after pairs")
        return
      }
    }

    try {
      setUploading(true)
      await uploadMedia(file, {
        media_type: mediaType,
        title: formData.title || undefined,
        description: formData.description || undefined,
        category_id: formData.category_id,
        is_before_after: formData.is_before_after,
        before_url: formData.before_url || undefined,
        after_url: formData.after_url || undefined,
      })
      toast.success("Media uploaded successfully! It will be reviewed before appearing in your gallery.")
      setOpen(false)
      resetForm()
      onUploadComplete?.()
    } catch (error: any) {
      toast.error(error.message || "Failed to upload media")
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setPreview(null)
    setFormData({
      title: "",
      description: "",
      category_id: undefined,
      is_before_after: false,
      before_url: "",
      after_url: "",
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleClose = () => {
    if (!uploading) {
      setOpen(false)
      resetForm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Work
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 sm:pb-4">
          <DialogTitle className="text-lg sm:text-xl">Upload Work Gallery Item</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Upload photos or videos of your work. For best results, use vertical format (9:16) for videos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Media File</Label>
            <div className="flex items-center gap-4">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/mov,video/avi,video/webm,video/mkv"
                onChange={handleFileChange}
                disabled={uploading}
                className="flex-1"
              />
            </div>
            {file && (
              <div className="mt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {mediaType === "video" ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  <span>{file.name}</span>
                  <Badge variant="outline">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Badge>
                </div>
                {preview && (
                  <div className="mt-2 relative aspect-video max-w-md rounded-lg overflow-hidden border">
                    <Image
                      src={preview}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Supported formats: Images (JPG, PNG, WebP) or Videos (MP4, MOV, AVI, WebM, MKV). Max size: 10MB for images, 50MB for videos.
            </p>
          </div>

          {/* Media Type */}
          <div className="space-y-2">
            <Label>Media Type</Label>
            <Select
              value={mediaType}
              onValueChange={(v) => {
                setMediaType(v as "photo" | "video")
                setFile(null)
                setPreview(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ""
                }
              }}
              disabled={uploading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="photo">Foto</SelectItem>
                <SelectItem value="video">Video (Hochformat empfohlen)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Titel (Optional)</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="z.B. Küchenrenovierung"
              disabled={uploading}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Beschreibung (Optional)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Beschreiben Sie Ihre Arbeit..."
              rows={3}
              disabled={uploading}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Kategorie (Optional)</Label>
            <Select
              value={formData.category_id?.toString() || ""}
              onValueChange={(v) => setFormData({ ...formData, category_id: v ? parseInt(v) : undefined })}
              disabled={uploading || categoriesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={categoriesLoading ? "Lädt..." : "Kategorie auswählen"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Keine</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Before/After Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="before-after"
              checked={formData.is_before_after}
              onChange={(e) => setFormData({ ...formData, is_before_after: e.target.checked })}
              disabled={uploading}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="before-after" className="text-sm font-normal cursor-pointer">
              Dies ist ein Vorher/Nachher-Paar
            </Label>
          </div>

          {/* Before/After URLs */}
          {formData.is_before_after && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-sm">Vorher/Nachher-URLs</CardTitle>
                <CardDescription className="text-xs">
                  Geben Sie URLs für Vorher- und Nachher-Bilder an
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Vorher-Bild-URL</Label>
                  <Input
                    value={formData.before_url}
                    onChange={(e) => setFormData({ ...formData, before_url: e.target.value })}
                    placeholder="https://..."
                    disabled={uploading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nachher-Bild-URL</Label>
                  <Input
                    value={formData.after_url}
                    onChange={(e) => setFormData({ ...formData, after_url: e.target.value })}
                    placeholder="https://..."
                    disabled={uploading}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

