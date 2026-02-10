"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, Image as ImageIcon, Video, Loader2, X, Play, FileText } from "lucide-react"
import { uploadMedia, uploadMediaBatch } from "@/lib/api/media"
import { toast } from "sonner"
import Image from "next/image"
import type { Media } from "@/lib/api/types"

interface ModernMediaUploadProps {
  profileId?: number
  productId?: number
  rentalId?: number
  existingMedia?: Media[]
  onUploadComplete?: () => void
  onMediaChange?: (media: Media[]) => void
  allowBeforeAfter?: boolean
  allowBatch?: boolean
  maxFiles?: number
}

interface FilePreview {
  file: File
  preview: string | null
  mediaType: "photo" | "video"
  title?: string
  description?: string
  category_id?: number // Category ID (preferred)
  category?: string // Category slug (deprecated, for backward compatibility - used for category image uploads)
  isBeforeAfter?: boolean
  beforeUrl?: string
  afterUrl?: string
}

export function ModernMediaUpload({
  profileId,
  productId,
  rentalId,
  existingMedia = [],
  onUploadComplete,
  onMediaChange,
  allowBeforeAfter = false,
  allowBatch = true,
  maxFiles = 10,
}: ModernMediaUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<FilePreview[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createImagePreview = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        if (result && result.startsWith("data:")) {
          resolve(result)
        } else {
          reject(new Error("Failed to create preview"))
        }
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  const handleFileSelect = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return

    const remainingSlots = maxFiles - files.length
    if (selectedFiles.length > remainingSlots) {
      toast.error(`You can only upload ${remainingSlots} more file${remainingSlots > 1 ? "s" : ""}`)
      selectedFiles = selectedFiles.slice(0, remainingSlots)
    }

    const newFiles: FilePreview[] = []

    for (const file of selectedFiles) {
      // Validate file type
      const fileType = file.type
      const isImage = fileType.startsWith("image/")
      const isVideo = fileType.startsWith("video/")

      if (!isImage && !isVideo) {
        toast.error(`${file.name} is not a valid image or video file`)
        continue
      }

      // Validate file size
      const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024 // 50MB for video, 10MB for image
      if (file.size > maxSize) {
        toast.error(
          `${file.name} is too large. Maximum size: ${isVideo ? "50MB" : "10MB"}`
        )
        continue
      }

      // Validate video format
      if (isVideo) {
        const ext = file.name.split(".").pop()?.toLowerCase()
        const validFormats = ["mp4", "mov", "avi", "webm", "mkv"]
        if (!ext || !validFormats.includes(ext)) {
          toast.error(
            `${file.name} has invalid video format. Supported: ${validFormats.join(", ").toUpperCase()}`
          )
          continue
        }
      }

      const mediaType = isVideo ? "video" : "photo"
      let preview: string | null = null

      // Create preview for images
      if (isImage) {
        try {
          preview = await createImagePreview(file)
        } catch (error) {
          console.error("Failed to create preview:", error)
        }
      }

      newFiles.push({
        file,
        preview,
        mediaType,
      })
    }

    setFiles((prev) => [...prev, ...newFiles])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    handleFileSelect(selectedFiles)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    await handleFileSelect(droppedFiles)
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const updateFileMetadata = (index: number, updates: Partial<FilePreview>) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    )
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file")
      return
    }

    if (!profileId && !productId && !rentalId) {
      toast.error("Profile, product, or rental ID is required")
      return
    }

    try {
      setUploading(true)

      if (allowBatch && files.length > 1) {
        // Batch upload for multiple files
        const photoFiles = files.filter((f) => f.mediaType === "photo").map((f) => f.file)
        const videoFiles = files.filter((f) => f.mediaType === "video").map((f) => f.file)

        const uploadedMedia: Media[] = []

        // Upload photos in batch
        if (photoFiles.length > 0 && (productId || rentalId)) {
          const photos = await uploadMediaBatch(photoFiles, {
            media_type: "photo",
            product_id: productId,
            rental_id: rentalId,
          })
          uploadedMedia.push(...photos)
        }

        // Upload videos in batch
        if (videoFiles.length > 0 && (productId || rentalId)) {
          const videos = await uploadMediaBatch(videoFiles, {
            media_type: "video",
            product_id: productId,
            rental_id: rentalId,
          })
          uploadedMedia.push(...videos)
        }

        // For profile media, upload individually with metadata
        if (profileId) {
          for (const filePreview of files) {
            const media = await uploadMedia(filePreview.file, {
              media_type: filePreview.mediaType,
              profile_id: profileId,
              title: filePreview.title || undefined,
              description: filePreview.description || undefined,
              category_id: filePreview.category_id,
              category: filePreview.category || undefined, // Keep for category image uploads
              is_before_after: filePreview.isBeforeAfter || false,
              before_url: filePreview.beforeUrl || undefined,
              after_url: filePreview.afterUrl || undefined,
            })
            uploadedMedia.push(media)
          }
        }

        toast.success(
          `Successfully uploaded ${uploadedMedia.length} file${uploadedMedia.length > 1 ? "s" : ""}`
        )
        setFiles([])
        onUploadComplete?.()
        onMediaChange?.([...existingMedia, ...uploadedMedia])
      } else {
        // Individual uploads with metadata
        const uploadedMedia: Media[] = []

        for (const filePreview of files) {
          const media = await uploadMedia(filePreview.file, {
            media_type: filePreview.mediaType,
            profile_id: profileId,
            product_id: productId,
            rental_id: rentalId,
            title: filePreview.title || undefined,
            description: filePreview.description || undefined,
            category_id: filePreview.category_id,
            category: filePreview.category || undefined, // Keep for category image uploads
            is_before_after: filePreview.isBeforeAfter || false,
            before_url: filePreview.beforeUrl || undefined,
            after_url: filePreview.afterUrl || undefined,
          })
          uploadedMedia.push(media)
        }

        toast.success(
          `Successfully uploaded ${uploadedMedia.length} file${uploadedMedia.length > 1 ? "s" : ""}`
        )
        setFiles([])
        onUploadComplete?.()
        onMediaChange?.([...existingMedia, ...uploadedMedia])
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to upload media")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Drag and Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 sm:p-8 transition-all duration-200
          ${isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/mov,video/avi,video/webm,video/mkv"
          multiple={allowBatch}
          onChange={handleFileChange}
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10">
            <Upload className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-medium">
              {isDragging ? "Dateien hier ablegen" : "Dateien hierher ziehen"}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              oder klicken zum Durchsuchen
            </p>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground max-w-md">
            Unterstützt: Bilder (JPG, PNG, WebP) oder Videos (MP4, MOV, AVI, WebM, MKV).
            Max. Größe: 10MB für Bilder, 50MB für Videos.
            {maxFiles && ` Max. ${maxFiles} Datei${maxFiles > 1 ? "en" : ""}.`}
          </p>
        </div>
      </div>

      {/* File Previews */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Ausgewählte Dateien ({files.length}{maxFiles ? ` / ${maxFiles}` : ""})
            </Label>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              size="sm"
              className="h-8 text-xs"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {files.length} Datei{files.length > 1 ? "en" : ""} hochladen
                </>
              )}
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {files.map((filePreview, index) => (
              <Card key={index} className="relative overflow-hidden border border-border/40 shadow-sm hover:shadow transition-all">
                <CardContent className="p-2 sm:p-3">
                  <div className="relative aspect-square rounded-md overflow-hidden bg-muted mb-2">
                    {filePreview.mediaType === "video" ? (
                      <div className="w-full h-full flex items-center justify-center bg-black/50">
                        <Video className="h-8 w-8 text-white" />
                      </div>
                    ) : filePreview.preview ? (
                      <img
                        src={filePreview.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {filePreview.mediaType === "video" && (
                      <div className="absolute top-1 left-1 bg-black/70 text-white px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                        <Play className="h-2.5 w-2.5" />
                        Video
                      </div>
                    )}
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 bg-black/70 hover:bg-black/90"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium truncate" title={filePreview.file.name}>
                      {filePreview.file.name}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {(filePreview.file.size / 1024 / 1024).toFixed(2)} MB
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {filePreview.mediaType === "video" ? "Video" : "Foto"}
                      </Badge>
                    </div>
                    {profileId && allowBeforeAfter && (
                      <div className="space-y-1.5 pt-1 border-t">
                        <Input
                          placeholder="Titel (optional)"
                          value={filePreview.title || ""}
                          onChange={(e) => updateFileMetadata(index, { title: e.target.value })}
                          className="h-7 text-xs"
                          disabled={uploading}
                        />
                        <Textarea
                          placeholder="Beschreibung (optional)"
                          value={filePreview.description || ""}
                          onChange={(e) => updateFileMetadata(index, { description: e.target.value })}
                          className="h-16 text-xs resize-none"
                          disabled={uploading}
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Existing Media */}
      {existingMedia.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Current Media ({existingMedia.length})
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {existingMedia
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
              .map((media) => (
                <Card key={media.id} className="relative overflow-hidden border border-border/40 shadow-sm hover:shadow transition-all">
                  <CardContent className="p-2 sm:p-3">
                    <div className="relative aspect-square rounded-md overflow-hidden bg-muted mb-2">
                      {media.media_type === "video" ? (
                        <>
                          <Image
                            src={media.thumbnail_url || media.url}
                            alt="Video-Vorschaubild"
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="h-6 w-6 text-white" />
                          </div>
                          <div className="absolute top-1 left-1 bg-black/70 text-white px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                            <Play className="h-2.5 w-2.5" />
                            Video
                          </div>
                        </>
                      ) : (
                        <Image
                          src={media.url}
                          alt={media.title || "Media"}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                      )}
                      {/* Status badges removed - all media is automatically approved */}
                    </div>
                    <div className="space-y-1">
                      {media.title && (
                        <p className="text-xs font-medium truncate" title={media.title}>
                          {media.title}
                        </p>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {media.media_type === "video" ? "Video" : "Foto"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

