"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const HERO_HEADLINE = "Finde geprüfte Handwerker in ganz Deutschland"
const HERO_SUBHEADLINE =
  "Direkter Kontakt. Auswahl nach echten Fotos, Videos & Bewertungen. Ohne Vermittlungsgebühr."

const TYPING_WORDS = ["Autoreparatur", "Maler", "Schuhmacher"]
const TYPING_PREFIX = "z.B. "
const TYPING_CHAR_MS = 80
const TYPING_PAUSE_MS = 1800
const ERASING_CHAR_MS = 50
const ERASING_PAUSE_MS = 400

export function HeroBanner() {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [displayWord, setDisplayWord] = useState("")
  const [wordIndex, setWordIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showPlaceholder = !isFocused && searchValue.trim() === ""

  // Typing / erasing effect for placeholder
  useEffect(() => {
    if (!showPlaceholder) return

    const word = TYPING_WORDS[wordIndex]

    const schedule = () => {
      if (isTyping) {
        if (displayWord.length < word.length) {
          timeoutRef.current = setTimeout(() => {
            setDisplayWord(word.slice(0, displayWord.length + 1))
          }, TYPING_CHAR_MS)
        } else {
          timeoutRef.current = setTimeout(() => {
            setIsTyping(false)
          }, TYPING_PAUSE_MS)
        }
      } else {
        if (displayWord.length > 0) {
          timeoutRef.current = setTimeout(() => {
            setDisplayWord(displayWord.slice(0, -1))
          }, ERASING_CHAR_MS)
        } else {
          timeoutRef.current = setTimeout(() => {
            setWordIndex((i) => (i + 1) % TYPING_WORDS.length)
            setIsTyping(true)
          }, ERASING_PAUSE_MS)
        }
      }
    }

    schedule()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [showPlaceholder, wordIndex, isTyping, displayWord])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = searchValue.trim()
      const params = new URLSearchParams()
      params.set("types", "master")
      if (trimmed) params.set("q", trimmed)
      params.set("page", "1")
      params.set("page_size", "12")
      router.push(`/?${params.toString()}`)
    },
    [searchValue, router]
  )

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-muted/40 to-background">
      <div className="container mx-auto px-sides py-10 sm:py-14 md:py-18 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 lg:items-center">
          <div className="space-y-4 sm:space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-5xl">
              {HERO_HEADLINE}
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg max-w-xl">
              {HERO_SUBHEADLINE}
            </p>

            <form onSubmit={handleSubmit} className="pt-2">
              <div className="relative flex w-full max-w-xl">
                <div className="relative flex flex-1 items-center">
                  <Input
                    type="search"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    aria-label="Suchbegriff eingeben"
                    className={cn(
                      "h-12 sm:h-14 pr-14 text-base bg-background border-border/60 rounded-r-none rounded-l-md border-r-0",
                      showPlaceholder && "text-transparent caret-foreground"
                    )}
                    autoComplete="off"
                  />
                  {/* Animated placeholder overlay: only when empty and not focused */}
                  {showPlaceholder && (
                    <div
                      className="absolute left-3 right-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center text-muted-foreground text-base sm:text-base"
                      aria-hidden
                    >
                      <span className="text-muted-foreground">{TYPING_PREFIX}</span>
                      <span className="min-w-[2ch] border-r-2 border-primary animate-pulse">
                        {displayWord}
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  size="icon"
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-l-none rounded-r-md bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 border border-l-0 border-primary"
                  aria-label="Suchen"
                >
                  <Search className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
              </div>
            </form>
          </div>

          <div className="relative hidden lg:block aspect-[4/3] max-h-[320px] rounded-lg overflow-hidden bg-muted/50">
            {/* Placeholder for hero image - can be replaced with actual image */}
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50 text-sm">
              Handwerker-Bild
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
