/** Max upload size for images (photos). */
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_IMAGE_UPLOAD_MB = 10

/** Max upload size for videos (~1 min at 1080p). */
export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024
export const MAX_VIDEO_UPLOAD_MB = 100

export function maxUploadSizeLabel(isVideo: boolean): string {
  return isVideo ? `${MAX_VIDEO_UPLOAD_MB}MB` : `${MAX_IMAGE_UPLOAD_MB}MB`
}
