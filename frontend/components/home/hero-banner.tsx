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
  selectedCategory?: CategoryTree | null
  onCategoryClick?: (category: CategoryTree) => void
  categoriesLoading?: boolean
}

export function HeroBanner({ categories = [], selectedCategory = null, onCategoryClick, categoriesLoading = false }: HeroBannerProps) {
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
    <section className="relative w-full overflow-hidden">
      {/* Banner: image on entire hero area, full width and height */}
      <div className="relative min-h-[55vh] sm:min-h-[60vh] md:min-h-[65vh] w-full">
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-handwerker.png"
            alt=""
            fill
            className="object-cover object-right"
            sizes="100vw"
            priority
          />
          {/* Gradient overlay left so text is readable */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-transparent"
            aria-hidden
          />
        </div>

        <div className="relative z-10 container mx-auto h-full min-h-[55vh] sm:min-h-[60vh] md:min-h-[65vh] flex flex-col justify-center px-sides py-10 sm:py-14 md:py-16 lg:py-20">
          <div className="max-w-xl">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {HERO_HEADLINE}
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              {HERO_SUBHEADLINE}
            </p>

            <form onSubmit={handleSubmit} className="mt-6">
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
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-l-none rounded-r-md bg-primary hover:bg-primary/90 shrink-0 border border-l-0 border-primary [&_svg]:text-black"
                  aria-label="Suchen"
                >
                  <Search className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Categories: ровно под баннером, в том же container для выравнивания */}
      {(categoriesLoading || categories.length > 0) && (
        <div className="w-full border-t border-border/40 bg-muted/40">
          <div className="container mx-auto px-sides py-4 w-full max-w-[1920px]">
            <div className="relative flex items-center gap-1 w-full">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "absolute left-0 top-1/2 z-10 h-9 w-9 -translate-y-1/2 shrink-0 rounded-md border border-border/60 bg-muted/80 hover:bg-muted",
                  !canScrollLeft && "opacity-40 pointer-events-none"
                )}
                onClick={() => scrollStrip("left")}
                aria-label="Nach links scrollen"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </Button>
              <div
                ref={scrollStripRef}
                className={cn(
                  "flex gap-2 overflow-x-auto overflow-y-hidden pb-1 scrollbar-hide",
                  "pl-11 pr-11"
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
                    .map((category, index) => {
                      const rawImageUrl = category.image_url?.trim() ? category.image_url : null
                      const relativePath = rawImageUrl ? toMediaRelativePath(rawImageUrl) : ""
                      const imageSrc = rawImageUrl
                        ? relativePath.startsWith("/")
                          ? relativePath
                          : getOptimizedImageUrl(rawImageUrl, "thumbnail")
                        : PLACEHOLDER_IMAGE
                      const isLocal = imageSrc.startsWith("/") && !imageSrc.startsWith("//")
                      const isActive = selectedCategory ? selectedCategory.id === category.id : index === 0
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => onCategoryClick?.(category)}
                          className={cn(
                            "flex shrink-0 flex-col items-center gap-2 rounded-md bg-muted/70 hover:bg-muted px-3 py-3 min-w-[100px] sm:min-w-[120px]",
                            "text-center text-xs sm:text-sm font-medium text-foreground",
                            "hover:text-primary transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                            "border-b-2 border-transparent",
                            isActive && "border-primary text-primary"
                          )}
                        >
                          <span className="relative flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 overflow-hidden rounded-md bg-muted border border-border/40">
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
                  "absolute right-0 top-1/2 z-10 h-9 w-9 -translate-y-1/2 shrink-0 rounded-md border border-border/60 bg-muted/80 hover:bg-muted",
                  !canScrollRight && "opacity-40 pointer-events-none"
                )}
                onClick={() => scrollStrip("right")}
                aria-label="Nach rechts scrollen"
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
