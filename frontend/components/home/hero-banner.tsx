"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, ChevronRight, ChevronLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CityCombobox } from "@/components/shared/city-combobox"
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
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState("")
  const [cityId, setCityId] = useState<number | undefined>(() => {
    const raw = searchParams?.get("city_id")
    if (!raw) return undefined
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : undefined
  })
  const [isFocused, setIsFocused] = useState(false)
  const [displayWord, setDisplayWord] = useState("")

  useEffect(() => {
    const raw = searchParams?.get("city_id")
    if (raw) {
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) setCityId(n)
    } else {
      setCityId(undefined)
    }
  }, [searchParams])
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
      if (typeof cityId === "number" && cityId > 0) params.set("city_id", String(cityId))
      params.set("page", "1")
      params.set("page_size", "12")
      const url = `/?${params.toString()}`
      router.push(url, { scroll: false })
      setTimeout(() => {
        document.getElementById("search-results")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 100)
    },
    [searchValue, cityId, router]
  )

  const scrollStrip = (direction: "left" | "right") => {
    const el = scrollStripRef.current
    if (!el) return
    const step = el.clientWidth * 0.6
    el.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" })
  }

  // Раньше здесь был нативный обработчик wheel, который перехватывал вертикальное колёсико
  // и прокручивал горизонтальную ленту категорий, блокируя скролл страницы.
  // Убрано, чтобы страница всегда прокручивалась колёсиком даже над лентой.

  return (
    <section className="relative w-full overflow-hidden">
      {/* Banner: на мобиле компактно — меньше высота и текст, чтобы карточки были видны */}
      <div className="relative min-h-[28vh] sm:min-h-[50vh] md:min-h-[58vh] lg:min-h-[65vh] w-full">
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-handwerker.png"
            alt=""
            fill
            className="object-cover object-right brightness-[0.88]"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-black/15" aria-hidden />
          <div
            className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--background))_0%,hsl(var(--background))_40%,transparent_65%)]"
            aria-hidden
          />
        </div>

        <div className="relative z-10 container mx-auto h-full min-h-[28vh] sm:min-h-[50vh] md:min-h-[58vh] lg:min-h-[65vh] flex flex-col justify-center py-3 sm:py-10 md:py-14 lg:py-20 px-3 sm:px-8 md:px-12 lg:px-16">
          <div className="max-w-2xl w-full">
            <div className="max-w-md sm:max-w-lg">
              <h1 className="text-lg font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
                {HERO_HEADLINE}
              </h1>
              <p className="mt-1.5 sm:mt-4 text-xs text-white/90 sm:text-lg max-w-md">
                {HERO_SUBHEADLINE}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-3 sm:mt-6 max-w-2xl w-full">
              <div className="flex w-full min-w-0 rounded-md border border-border/60 bg-background overflow-hidden">
                <div className="flex items-center border-r border-border/60 bg-muted/30 shrink-0">
                  <CityCombobox
                    value={cityId}
                    onChange={setCityId}
                    placeholder="Stadt"
                    size="md"
                    variant="form"
                    className="h-10 sm:h-14 min-w-[120px] sm:min-w-[160px] rounded-none border-0 bg-transparent px-2 sm:px-3"
                  />
                </div>
                <div className="relative flex flex-1 items-center min-w-0">
                  <Input
                    type="search"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    aria-label="Suchbegriff eingeben"
                    className={cn(
                      "h-10 sm:h-14 pr-12 sm:pr-14 text-sm sm:text-base bg-background border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0",
                      showPlaceholder && "text-transparent caret-foreground"
                    )}
                    autoComplete="off"
                  />
                  {showPlaceholder && (
                    <div
                      className="absolute left-2.5 sm:left-3 right-12 sm:right-14 top-1/2 -translate-y-1/2 pointer-events-none flex items-center text-muted-foreground text-sm sm:text-base"
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
                  className="h-10 w-10 sm:h-14 sm:w-14 rounded-none shrink-0 border-0 border-l border-border/60 bg-primary hover:bg-primary/90 text-primary-foreground [&_svg]:text-black"
                  aria-label="Suchen"
                >
                  <Search className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Categories: ровно под баннером, те же отступы что и контент для выравнивания на мобиле и десктопе */}
      {(categoriesLoading || categories.length > 0) && (
        <div className="w-full border-t border-border/40 bg-muted/40">
          <div className="container mx-auto py-2.5 sm:py-4 w-full max-w-[1920px] px-3 sm:px-8 md:px-12 lg:px-16">
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
                  "flex gap-2 overflow-x-auto overflow-y-hidden pb-1",
                  "pl-11 pr-11",
                  "scrollbar-hide lg:scrollbar-show-lg"
                )}
                style={{
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
                      const urlCategorySlug = searchParams?.get("category")
                      const matchesUrlCategory =
                        Boolean(urlCategorySlug) &&
                        (category.slug === urlCategorySlug ||
                          category.children?.some((ch) => ch.slug === urlCategorySlug))
                      const isActive = selectedCategory
                        ? selectedCategory.id === category.id
                        : matchesUrlCategory
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
