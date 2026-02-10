"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, Image as ImageIcon, Video, Loader2, X, Play, Trash2, CheckCircle2, AlertCircle } from "lucide-react"
import { uploadMedia, uploadMediaBatch, deleteMedia } from "@/lib/api/media"
import { toast } from "sonner"
import Image from "next/image"
import type { Media } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface ProductRentalMediaUploadProps {
  productId?: number
  rentalId?: number
  existingMedia?: Media[]
  onUploadComplete?: () => void
  onMediaChange?: (media: Media[]) => void
}

interface FilePreview {
  file: File
  preview: string | null
  mediaType: "photo" | "video"
  uploadStatus?: "pending" | "uploading" | "success" | "error"
  uploadedMedia?: Media
  error?: string
}

export function ProductRentalMediaUpload({
  productId,
  rentalId,
  existingMedia = [],
  onUploadComplete,
  onMediaChange,
}: ProductRentalMediaUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<FilePreview[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [deletingMediaIds, setDeletingMediaIds] = useState<Set<number>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentMedia, setCurrentMedia] = useState<Media[]>(existingMedia)

  // Sync existingMedia prop with currentMedia state
  useEffect(() => {
    setCurrentMedia(existingMedia)
  }, [existingMedia])

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

      newFiles.push({ file, preview, mediaType, uploadStatus: "pending" })
    }

    setFiles((prev) => [...prev, ...newFiles])
    
    // Auto-upload files immediately if product/rental ID exists
    if (newFiles.length > 0 && (productId || rentalId)) {
      handleAutoUpload(newFiles)
    }
  }

  // Expose method to upload queued files after product/rental creation
  const uploadQueuedFiles = useCallback(async () => {
    const pendingFiles = files.filter(f => f.uploadStatus === "pending")
    if (pendingFiles.length > 0 && (productId || rentalId)) {
      await handleAutoUpload(pendingFiles)
    }
  }, [files, productId, rentalId])

  const handleAutoUpload = async (filesToUpload: FilePreview[]) => {
    if (!productId && !rentalId) {
      toast.error("Product or rental ID is required")
      return
    }

    // Update file statuses to uploading
    setFiles((prev) =>
      prev.map((f) => {
        const found = filesToUpload.find((nf) => nf.file === f.file)
        return found ? { ...f, uploadStatus: "uploading" } : f
      })
    )

    try {
      setUploading(true)

      // Group files by media type
      const photoFiles = filesToUpload.filter((f) => f.mediaType === "photo").map((f) => f.file)
      const videoFiles = filesToUpload.filter((f) => f.mediaType === "video").map((f) => f.file)

      const uploadedMedia: Media[] = []

      // Upload photos in batch
      if (photoFiles.length > 0) {
        try {
          const photos = await uploadMediaBatch(photoFiles, {
            media_type: "photo",
            product_id: productId,
            rental_id: rentalId,
          })
          uploadedMedia.push(...photos)
          
          // Update file statuses for photos
          setFiles((prev) =>
            prev.map((f) => {
              if (f.mediaType === "photo" && filesToUpload.some((nf) => nf.file === f.file)) {
                const uploaded = photos.find((p) => p.url)
                return uploaded ? { ...f, uploadStatus: "success", uploadedMedia: uploaded } : f
              }
              return f
            })
          )
        } catch (error: any) {
          // Update file statuses for failed photos
          setFiles((prev) =>
            prev.map((f) => {
              if (f.mediaType === "photo" && filesToUpload.some((nf) => nf.file === f.file)) {
                return { ...f, uploadStatus: "error", error: error.message || "Upload failed" }
              }
              return f
            })
          )
        }
      }

      // Upload videos in batch
      if (videoFiles.length > 0) {
        try {
          const videos = await uploadMediaBatch(videoFiles, {
            media_type: "video",
            product_id: productId,
            rental_id: rentalId,
          })
          uploadedMedia.push(...videos)
          
          // Update file statuses for videos
          setFiles((prev) =>
            prev.map((f) => {
              if (f.mediaType === "video" && filesToUpload.some((nf) => nf.file === f.file)) {
                const uploaded = videos.find((v) => v.url)
                return uploaded ? { ...f, uploadStatus: "success", uploadedMedia: uploaded } : f
              }
              return f
            })
          )
        } catch (error: any) {
          // Update file statuses for failed videos
          setFiles((prev) =>
            prev.map((f) => {
              if (f.mediaType === "video" && filesToUpload.some((nf) => nf.file === f.file)) {
                return { ...f, uploadStatus: "error", error: error.message || "Upload failed" }
              }
              return f
            })
          )
        }
      }

      if (uploadedMedia.length > 0) {
        const newMediaList = [...currentMedia, ...uploadedMedia]
        setCurrentMedia(newMediaList)
        onMediaChange?.(newMediaList)
        toast.success(
          `Successfully uploaded ${uploadedMedia.length} file${uploadedMedia.length > 1 ? "s" : ""}`
        )
        
        // Remove successfully uploaded files from preview after a delay
        setTimeout(() => {
          setFiles((prev) => prev.filter((f) => f.uploadStatus !== "success"))
        }, 2000)
      }
      
      onUploadComplete?.()
    } catch (error: any) {
      toast.error(error.message || "Failed to upload some files")
    } finally {
      setUploading(false)
    }
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

  const handleDeleteMedia = async (mediaId: number) => {
    if (!confirm("Are you sure you want to delete this media?")) {
      return
    }

    try {
      setDeletingMediaIds((prev) => new Set(prev).add(mediaId))
      await deleteMedia(mediaId)
      
      const updatedMedia = currentMedia.filter((m) => m.id !== mediaId)
      setCurrentMedia(updatedMedia)
      onMediaChange?.(updatedMedia)
      toast.success("Media deleted successfully")
      onUploadComplete?.()
    } catch (error: any) {
      toast.error(error.message || "Failed to delete media")
    } finally {
      setDeletingMediaIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(mediaId)
        return newSet
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Drag and Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 sm:p-8 transition-all duration-200",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          uploading && "opacity-60 pointer-events-none",
          !productId && !rentalId && "min-h-[200px]"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/mov,video/avi,video/webm,video/mkv"
          multiple
          onChange={handleFileChange}
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="flex flex-col items-center justify-center text-center space-y-2 sm:space-y-3">
          <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10">
            <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-medium">
              {isDragging ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              or click to browse • Files upload automatically
            </p>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground max-w-md">
            Supported: Images (JPG, PNG, WebP) or Videos (MP4, MOV, AVI, WebM, MKV).
            Max size: 10MB for images, 50MB for videos.
          </p>
        </div>
      </div>

      {/* Uploading Files Preview */}
      {files.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Uploading Files ({files.length})
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {files.map((filePreview, index) => (
              <Card key={index} className="relative overflow-hidden border border-border/40 shadow-sm">
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
                    {/* Upload Status Overlay */}
                    {filePreview.uploadStatus === "uploading" && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      </div>
                    )}
                    {filePreview.uploadStatus === "success" && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      </div>
                    )}
                    {filePreview.uploadStatus === "error" && (
                      <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-red-500" />
                      </div>
                    )}
                    {filePreview.uploadStatus !== "success" && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 bg-black/70 hover:bg-black/90"
                        onClick={() => removeFile(index)}
                        disabled={filePreview.uploadStatus === "uploading"}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium truncate" title={filePreview.file.name}>
                      {filePreview.file.name}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          filePreview.uploadStatus === "success" && "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400",
                          filePreview.uploadStatus === "error" && "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
                        )}
                      >
                        {filePreview.uploadStatus === "uploading" && "Wird hochgeladen..."}
                        {filePreview.uploadStatus === "success" && "Hochgeladen"}
                        {filePreview.uploadStatus === "error" && "Fehlgeschlagen"}
                        {filePreview.uploadStatus === "pending" && `${(filePreview.file.size / 1024 / 1024).toFixed(2)} MB`}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {filePreview.mediaType === "video" ? "Video" : "Foto"}
                      </Badge>
                    </div>
                    {filePreview.error && (
                      <p className="text-[10px] text-red-600 dark:text-red-400 truncate" title={filePreview.error}>
                        {filePreview.error}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Existing Media */}
      {currentMedia.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Current Media ({currentMedia.length})
            </Label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
            {currentMedia
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
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 100vw, 50vw"
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
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 33vw, 25vw"
                        />
                      )}
                      {/* Status badges removed - all media is automatically approved */}
                    </div>
                    <div className="space-y-1.5">
                      {media.title && (
                        <p className="text-xs font-medium truncate" title={media.title}>
                          {media.title}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-xs px-2 py-0.5 font-medium">
                          {media.media_type === "video" ? "Video" : "Foto"}
                        </Badge>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-6 w-6 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 hover:border-red-500/40"
                          onClick={() => handleDeleteMedia(media.id)}
                          disabled={deletingMediaIds.has(media.id)}
                        >
                          {deletingMediaIds.has(media.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
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

