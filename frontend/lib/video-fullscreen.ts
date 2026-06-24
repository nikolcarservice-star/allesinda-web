type VideoWithWebkit = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
  webkitDisplayingFullscreen?: boolean
}

/** Enter native fullscreen when supported (iOS webkitEnterFullscreen, standard API elsewhere). */
export function tryEnterVideoFullscreen(video: HTMLVideoElement | null): void {
  if (!video) return

  const el = video as VideoWithWebkit
  if (typeof el.webkitEnterFullscreen === "function") {
    try {
      el.webkitEnterFullscreen()
    } catch {
      // iOS may require a direct user gesture
    }
    return
  }

  void video.requestFullscreen?.().catch(() => {})
}
