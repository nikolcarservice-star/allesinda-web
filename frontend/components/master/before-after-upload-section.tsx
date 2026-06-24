"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BeforeAfterCard } from "@/components/gallery/before-after-card"
import type { Media } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_MB } from "@/lib/upload-limits"

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"])

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  return IMAGE_EXTENSIONS.has(ext)
}

function validateImageFile(file: File): string | null {
  if (!isImageFile(file)) {
    return "Bitte wählen Sie ein Bild (JPG, PNG, WebP …)"
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return `Datei ist größer als ${MAX_IMAGE_UPLOAD_MB} MB`
  }
  return null
}

interface BeforeAfterUploadSectionProps {
  items: Media[]
  uploading: boolean
  canAdd: boolean
  limit: number
  deletingId: number | null
  onUpload: (beforeFile: File, afterFile: File, title?: string) => Promise<void>
  onDelete: (id: number) => void
  className?: string
}

export function BeforeAfterUploadSection({
  items,
  uploading,
  canAdd,
  limit,
  deletingId,
  onUpload,
  onDelete,
  className,
}: BeforeAfterUploadSectionProps) {
  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef = useRef<HTMLInputElement>(null)
  const [beforeFile, setBeforeFile] = useState<File | null>(null)
  const [afterFile, setAfterFile] = useState<File | null>(null)
  const [beforePreview, setBeforePreview] = useState<string | null>(null)
  const [afterPreview, setAfterPreview] = useState<string | null>(null)
  const [title, setTitle] = useState("")

  useEffect(() => {
    if (!beforeFile) {
      setBeforePreview(null)
      return
    }
    const url = URL.createObjectURL(beforeFile)
    setBeforePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [beforeFile])

  useEffect(() => {
    if (!afterFile) {
      setAfterPreview(null)
      return
    }
    const url = URL.createObjectURL(afterFile)
    setAfterPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [afterFile])

  const resetDraft = () => {
    setBeforeFile(null)
    setAfterFile(null)
    setTitle("")
    if (beforeInputRef.current) beforeInputRef.current.value = ""
    if (afterInputRef.current) afterInputRef.current.value = ""
  }

  const handlePickBefore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const error = validateImageFile(file)
    if (error) {
      toastError(error)
      event.target.value = ""
      return
    }
    setBeforeFile(file)
  }

  const handlePickAfter = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const error = validateImageFile(file)
    if (error) {
      toastError(error)
      event.target.value = ""
      return
    }
    setAfterFile(file)
  }

  const toastError = (message: string) => {
    void import("sonner").then(({ toast }) => toast.error(message))
  }

  const handleSubmit = async () => {
    if (!beforeFile || !afterFile) {
      toastError("Bitte wählen Sie ein Vorher- und ein Nachher-Foto")
      return
    }
    await onUpload(beforeFile, afterFile, title.trim() || undefined)
    resetDraft()
  }

  const readyToUpload = Boolean(beforeFile && afterFile && !uploading)

  return (
    <section className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">Vorher & Nachher</h3>
        <p className="text-xs text-neutral-500">
          Zwei Fotos hochladen — werden in Ihrer Galerie und im Profil als Vergleich angezeigt.
        </p>
      </div>

      {canAdd && (
        <div className="space-y-3 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] lg:rounded-lg lg:border-border lg:shadow-sm">
          <input
            ref={beforeInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickBefore}
            disabled={uploading}
          />
          <input
            ref={afterInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickAfter}
            disabled={uploading}
          />

          <div className="grid grid-cols-2 gap-2">
            <PhotoSlot
              label="Vorher"
              preview={beforePreview}
              selected={!!beforeFile}
              onClick={() => beforeInputRef.current?.click()}
              disabled={uploading}
              onClear={() => {
                setBeforeFile(null)
                if (beforeInputRef.current) beforeInputRef.current.value = ""
              }}
            />
            <PhotoSlot
              label="Nachher"
              preview={afterPreview}
              selected={!!afterFile}
              onClick={() => afterInputRef.current?.click()}
              disabled={uploading}
              onClear={() => {
                setAfterFile(null)
                if (afterInputRef.current) afterInputRef.current.value = ""
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="before-after-title" className="text-xs text-neutral-600">
              Titel (optional)
            </Label>
            <Input
              id="before-after-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Badezimmer-Renovierung"
              className="h-10 rounded-xl border-neutral-200 bg-neutral-50 text-sm"
              disabled={uploading}
            />
          </div>

          <Button
            type="button"
            className="h-11 w-full rounded-xl font-semibold"
            disabled={!readyToUpload}
            onClick={() => void handleSubmit()}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird hochgeladen…
              </>
            ) : (
              "Vorher/Nachher hochladen"
            )}
          </Button>
        </div>
      )}

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => {
            const isDeleting = deletingId === item.id
            return (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
              >
                <BeforeAfterCard
                  beforeUrl={item.before_url!}
                  afterUrl={item.after_url!}
                  className="pointer-events-none rounded-none"
                />
                {item.title?.trim() && (
                  <p className="border-t border-neutral-100 px-3 py-2 text-sm font-medium text-neutral-800">
                    {item.title.trim()}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  disabled={isDeleting || uploading}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-60"
                  aria-label="Vorher/Nachher löschen"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 py-6 text-center text-sm text-neutral-500">
          Noch keine Vorher/Nachher-Fotos
        </p>
      )}

      <p className="text-xs font-medium text-neutral-500">
        {items.length}/{limit} Vorher/Nachher-Paare
      </p>
    </section>
  )
}

function PhotoSlot({
  label,
  preview,
  selected,
  onClick,
  onClear,
  disabled,
}: {
  label: string
  preview: string | null
  selected: boolean
  onClick: () => void
  onClear: () => void
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition active:scale-[0.98]",
          selected
            ? "border-emerald-400 bg-emerald-50/50"
            : "border-neutral-200 bg-neutral-50 hover:border-emerald-300",
          disabled && "opacity-50",
        )}
      >
        {preview ? (
          <Image src={preview} alt={label} fill className="object-cover" unoptimized />
        ) : (
          <>
            <Plus className="mb-1 h-6 w-6 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">{label}</span>
            <span className="mt-0.5 text-[10px] text-neutral-500">Antippen</span>
          </>
        )}
        {preview && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">
            {label}
          </span>
        )}
      </button>
      {selected && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClear()
          }}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
          aria-label={`${label} entfernen`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
