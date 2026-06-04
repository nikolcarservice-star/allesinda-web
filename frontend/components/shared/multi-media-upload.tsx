"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Upload, Image as ImageIcon, Video, X, Loader2, CheckCircle2 } from "lucide-react"
import { uploadMediaBatch, uploadMedia } from "@/lib/api/media"
import { toast } from "sonner"
import Image from "next/image"
import type { Media } from "@/lib/api/types"
import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_MB,
  maxUploadSizeLabel,
} from "@/lib/upload-limits"

interface MultiMediaUploadProps {
  productId?: number
  rentalId?: number
  profileId?: number
  onUploadComplete?: (media: Media[]) => void
  maxFiles?: number
  mediaType?: "photo" | "video"
  className?: string
}

interface FilePreview {
  file: File
  preview: string | null
  uploading: boolean
  uploaded?: Media
  error?: string
}

export function MultiMediaUpload({
  productId,
  rentalId,
  profileId,
  onUploadComplete,
  maxFiles = 20,
  mediaType = "photo",
  className = "",
}: MultiMediaUploadProps) {
  const [files, setFiles] = useState<FilePreview[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    // Check total file count
    if (files.length + selectedFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`)
      return
    }

    const newFiles: FilePreview[] = selectedFiles.map((file) => {
      // Validate file type
      const fileType = file.type
      const isImage = fileType.startsWith("image/")
      const isVideo = fileType.startsWith("video/")

      if (!isImage && !isVideo) {
        toast.error(`${file.name}: Invalid file type. Please select an image or video`)
        return null
      }

      // Validate file size
      const maxSize = mediaType === "video" ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES
      if (file.size > maxSize) {
        toast.error(`${file.name}: File too large. Maximum size: ${maxUploadSizeLabel(mediaType === "video")}`)
        return null
      }

      // Validate video format
      if (isVideo) {
        const ext = file.name.split(".").pop()?.toLowerCase()
        const validFormats = ["mp4", "mov", "avi", "webm", "mkv"]
        if (!ext || !validFormats.includes(ext)) {
          toast.error(`${file.name}: Invalid video format. Supported: ${validFormats.join(", ").toUpperCase()}`)
          return null
        }
      }

      // Create preview
      let preview: string | null = null
      if (isImage) {
        preview = URL.createObjectURL(file)
      }

      return {
        file,
        preview,
        uploading: false,
      }
    }).filter((f): f is FilePreview => f !== null)

    setFiles([...files, ...newFiles])
  }

  const removeFile = (index: number) => {
    const file = files[index]
    if (file.preview) {
      URL.revokeObjectURL(file.preview)
    }
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file")
      return
    }

    setUploading(true)

    try {
      // For products and rentals, use batch upload
      if (productId || rentalId) {
        const fileList = files.map((f) => f.file)
        const uploaded = await uploadMediaBatch(fileList, {
          media_type: mediaType,
          product_id: productId,
          rental_id: rentalId,
        })
        
        // Update files with uploaded media
        const updatedFiles = files.map((f, idx) => ({
          ...f,
          uploaded: uploaded[idx],
          uploading: false,
        }))
        setFiles(updatedFiles)
        
        onUploadComplete?.(uploaded)
        toast.success(`Successfully uploaded ${uploaded.length} file(s)`)
      } else if (profileId) {
        // For work gallery, upload individually
        const uploaded: Media[] = []
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, uploading: true } : f)))
          
          try {
            const media = await uploadMedia(file.file, {
              media_type: mediaType,
              profile_id: profileId,
              sort_order: i,
            })
            uploaded.push(media)
            setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, uploaded: media, uploading: false } : f)))
          } catch (error: any) {
            setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, uploading: false, error: error.message } : f)))
            toast.error(`Failed to upload ${file.file.name}`)
          }
        }
        
        if (uploaded.length > 0) {
          onUploadComplete?.(uploaded)
          toast.success(`Successfully uploaded ${uploaded.length} file(s)`)
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to upload files")
    } finally {
      setUploading(false)
    }
  }

  const handleClear = () => {
    files.forEach((f) => {
      if (f.preview) {
        URL.revokeObjectURL(f.preview)
      }
    })
    setFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className={`space-y-3 sm:space-y-4 ${className}`}>
      <div className="space-y-2">
        <Label className="text-sm sm:text-base font-medium">
          {mediaType === "video" ? "Videos" : "Images"} ({files.length}/{maxFiles})
        </Label>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || files.length >= maxFiles}
            className="flex-1 sm:flex-initial gap-2 h-10 sm:h-11 text-sm sm:text-base"
          >
            <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Select {mediaType === "video" ? "Videos" : "Images"}</span>
            <span className="sm:hidden">Select Files</span>
          </Button>
          {files.length > 0 && (
            <>
              <Button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 sm:flex-initial gap-2 h-10 sm:h-11 text-sm sm:text-base"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    <span className="hidden sm:inline">Uploading...</span>
                    <span className="sm:hidden">Uploading</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline">Upload {files.length} File(s)</span>
                    <span className="sm:hidden">Upload</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
                disabled={uploading}
                className="flex-1 sm:flex-initial gap-2 h-10 sm:h-11 text-sm sm:text-base"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Clear</span>
                <span className="sm:hidden">Clear</span>
              </Button>
            </>
          )}
        </div>
        <Input
          ref={fileInputRef}
          type="file"
          accept={mediaType === "video" ? "video/*" : "image/*"}
          multiple
          onChange={handleFileSelect}
          disabled={uploading || files.length >= maxFiles}
          className="hidden"
        />
        <p className="text-xs sm:text-sm text-muted-foreground">
          {mediaType === "video" 
            ? `Supported: MP4, MOV, AVI, WebM, MKV (max ${MAX_VIDEO_UPLOAD_MB}MB each)`
            : "Supported: JPG, PNG, GIF, WebP (max 10MB each)"
          }
        </p>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          {files.map((filePreview, index) => (
            <div
              key={index}
              className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted"
            >
              {filePreview.preview ? (
                <Image
                  src={filePreview.preview}
                  alt={filePreview.file.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Video className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                </div>
              )}
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {filePreview.uploading ? (
                  <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-white animate-spin" />
                ) : filePreview.uploaded ? (
                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => removeFile(index)}
                    className="h-8 w-8 sm:h-9 sm:w-9"
                  >
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                )}
              </div>

              {/* File info */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1.5 sm:p-2">
                <p className="text-[10px] sm:text-xs text-white truncate">{filePreview.file.name}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                  {(filePreview.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {/* Status badge */}
              {filePreview.uploaded && (
                <Badge className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 bg-green-600 text-white text-[10px] sm:text-xs">
                  Uploaded
                </Badge>
              )}
              {filePreview.error && (
                <Badge className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 bg-red-600 text-white text-[10px] sm:text-xs">
                  Error
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

