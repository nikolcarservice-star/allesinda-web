"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Search, ChevronRight, ChevronLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, getOptimizedImageUrl, toMediaRelativePath } from "@/lib/utils"
import type { CategoryTree } from "@/lib/api"

const HERO_HEADLINE = "Finde geprüfte Handwerker in ganz Deutschland"
const HERO_SUBHEADLINE =
  "Direkter Kontakt. Auswahl nach echten Fotos, Videos & Bewertungen. Ohne Vermittlungsgebühr."

const TYPING_WORDS = ["Autoreparatur", "Maler", "Schuhmacher"]
const TYPING_PREFIX = "z.B. "
const TYPING_CHAR_MS = 80
const TYPING_PAUSE_MS = 1800
const ERASING_CHAR_MS = 50
const ERASING_PAUSE_MS = 400

const PLACEHOLDER_IMAGE = "/placeholder.jpg"

export type HeroBannerProps = {
  categories?: CategoryTree[]
  onCategoryClick?: (category: CategoryTree) => void
  categoriesLoading?: boolean
}

export function HeroBanner({ categories = [], onCategoryClick, categoriesLoading = false }: HeroBannerProps) {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [displayWord, setDisplayWord] = useState("")
  const [wordIndex, setWordIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollStripRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollButtons = useCallback(() => {
    const el = scrollStripRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const threshold = 4
    const maxScroll = Math.max(0, scrollWidth - clientWidth)
    setCanScrollLeft(scrollLeft > threshold)
    setCanScrollRight(maxScroll > threshold && maxScroll - scrollLeft > threshold)
  }, [])

  useEffect(() => {
    const el = scrollStripRef.current
    if (!el) return
    updateScrollButtons()
    el.addEventListener("scroll", updateScrollButtons, { passive: true })
    const ro = new ResizeObserver(updateScrollButtons)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", updateScrollButtons)
      ro.disconnect()
    }
  }, [updateScrollButtons, categories.length])

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
            setWordIndex((i: number) => (i + 1) % TYPING_WORDS.length)
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
      const url = `/?${params.toString()}`
      router.push(url, { scroll: false })
      // Scroll to results after navigation so the user sees the search outcome
      setTimeout(() => {
        document.getElementById("search-results")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 100)
    },
    [searchValue, router]
  )

  const scrollStrip = (direction: "left" | "right") => {
    const el = scrollStripRef.current
    if (!el) return
    const step = el.clientWidth * 0.6
    el.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" })
  }

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-muted/30 to-background">
      {/* Two-column layout: text + search left, handyman image right */}
      <div className="container mx-auto px-sides py-10 sm:py-14 md:py-16 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 lg:items-center">
          <div className="space-y-4 sm:space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
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
                  {showPlaceholder && (
                    <div
                      className="absolute left-3 right-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center text-muted-foreground text-base"
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

          {/* Handyman image — right column: sharp, no blur; align right so the person is visible */}
          <div className="relative hidden lg:block aspect-[4/3] max-h-[420px] overflow-hidden rounded-lg bg-muted/50">
            <Image
              src="/hero-handwerker.png"
              alt="Handwerker bei der Arbeit"
              fill
              className="object-cover object-right"
              sizes="(max-width: 1024px) 0px, 50vw"
              priority
            />
          </div>
        </div>
      </div>

      {/* Scrollable categories row: square cards with icon on top, label below + visible arrows */}
      {(categoriesLoading || categories.length > 0) && (
        <div className="border-t border-border/40 bg-muted/30">
          <div className="container mx-auto px-sides py-4">
            <div className="relative flex items-stretch gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "absolute left-0 top-1/2 z-10 h-10 w-10 -translate-y-1/2 shrink-0 rounded-full border border-border bg-background shadow-sm hover:bg-muted",
                  !canScrollLeft && "opacity-40 pointer-events-none"
                )}
                onClick={() => scrollStrip("left")}
                aria-label="Nach links scrollen"
              >
                <ChevronLeft className="h-5 w-5 text-foreground" />
              </Button>
              <div
                ref={scrollStripRef}
                className={cn(
                  "flex gap-3 overflow-x-auto overflow-y-hidden pb-1 scrollbar-hide",
                  "pl-12 pr-12"
                )}
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                }}
                role="region"
                aria-label="Kategorien"
              >
                {categoriesLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Kategorien werden geladen...</span>
                  </div>
                ) : (
                  categories
                    .filter((cat) => cat.id !== -1)
                    .map((category) => {
                      const rawImageUrl = category.image_url?.trim() ? category.image_url : null
                      const relativePath = rawImageUrl ? toMediaRelativePath(rawImageUrl) : ""
                      const imageSrc = rawImageUrl
                        ? relativePath.startsWith("/")
                          ? relativePath
                          : getOptimizedImageUrl(rawImageUrl, "thumbnail")
                        : PLACEHOLDER_IMAGE
                      const isLocal = imageSrc.startsWith("/") && !imageSrc.startsWith("//")
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => onCategoryClick?.(category)}
                          className={cn(
                            "flex shrink-0 flex-col items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-4 py-3 min-w-[120px] sm:min-w-[140px]",
                            "text-center text-sm font-medium text-foreground",
                            "hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                          )}
                        >
                          <span className="relative flex h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                            <Image
                              src={imageSrc}
                              alt=""
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                              unoptimized={isLocal}
                            />
                          </span>
                          <span className="line-clamp-2 leading-tight">
                            {category.name || "Kategorie"}
                          </span>
                        </button>
                      )
                    })
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "absolute right-0 top-1/2 z-10 h-10 w-10 -translate-y-1/2 shrink-0 rounded-full border border-border bg-background shadow-sm hover:bg-muted",
                  !canScrollRight && "opacity-40 pointer-events-none"
                )}
                onClick={() => scrollStrip("right")}
                aria-label="Nach rechts scrollen"
              >
                <ChevronRight className="h-5 w-5 text-foreground" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
