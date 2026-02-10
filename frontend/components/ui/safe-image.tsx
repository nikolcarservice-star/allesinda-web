"use client"

import { useState } from "react"
import Image from "next/image"
import type { ImageProps } from "next/image"

interface SafeImageProps extends Omit<ImageProps, 'src'> {
  src: string | undefined | null
  fallback?: string
}

/**
 * SafeImage component that handles missing images gracefully
 * Uses unoptimized for local images that might fail to avoid server-side errors
 */
export function SafeImage({ src, fallback = "/placeholder.svg", ...props }: SafeImageProps) {
  const [imageError, setImageError] = useState(false)

  const imageSrc = imageError || !src ? fallback : src
  
  // Check if it's a local path (starts with /) that might fail
  // Use unoptimized for local images to avoid server-side optimization errors
  const isLocalPath = imageSrc.startsWith('/') && !imageSrc.startsWith('//')
  const shouldOptimize = !isLocalPath && !imageError

  return (
    <Image
      {...props}
      src={imageSrc}
      unoptimized={!shouldOptimize}
      onError={() => {
        if (!imageError) {
          setImageError(true)
        }
      }}
    />
  )
}

