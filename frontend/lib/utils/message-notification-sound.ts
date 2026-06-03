const MESSAGE_SOUND_URL = "/sounds/delivered-message-sound.mp3"
const SOUND_THROTTLE_MS = 2500

/** Web Audio fallback when mp3 is missing (iOS/PWA). */
function playBeepFallback(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.value = 0.08
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    osc.onended = () => void ctx.close()
  } catch {
    // ignore
  }
}

export function playNewMessageNotificationSound(): void {
  if (typeof window === "undefined") return
  const now = Date.now()
  const last = (window as unknown as { __lastMessageSoundPlayed?: number }).__lastMessageSoundPlayed
  if (last != null && now - last < SOUND_THROTTLE_MS) return
  ;(window as unknown as { __lastMessageSoundPlayed?: number }).__lastMessageSoundPlayed = now

  const audio = new Audio(MESSAGE_SOUND_URL)
  audio.volume = 0.6
  audio.play().catch(() => playBeepFallback())
}

export function unlockMessageNotificationAudio(): void {
  if (typeof window === "undefined") return
  try {
    const a = new Audio(MESSAGE_SOUND_URL)
    a.volume = 0
    a.play().then(() => a.pause()).catch(playBeepFallback)
  } catch {
    playBeepFallback()
  }
}
