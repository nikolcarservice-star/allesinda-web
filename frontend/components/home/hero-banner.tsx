"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
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

const HERO_SEARCH_INPUT_ID = "hero-search-input"
const HERO_IMAGE = "/hero-team.png"

export type HeroBannerProps = {
  categories?: CategoryTree[]
  selectedCategory?: CategoryTree | null
  onCategoryClick?: (category: CategoryTree) => void
  categoriesLoading?: boolean
}

export function HeroBanner({ categories = [], selectedCategory = null, onCategoryClick, categoriesLoading = false }: HeroBannerProps) {
  const router = useRouter()
  const pathname = usePathname()
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
    const q = searchParams?.get("q") ?? searchParams?.get("search") ?? ""
    setSearchValue(q)
  }, [searchParams])

  useEffect(() => {
    if (pathname !== "/") return
    if (typeof window === "undefined") return
    if (window.location.hash !== "#hero-search") return
    const timer = window.setTimeout(() => {
      const input =
        document.getElementById(`${HERO_SEARCH_INPUT_ID}-mobile`) ??
        document.getElementById(HERO_SEARCH_INPUT_ID)
      input?.focus({ preventScroll: true })
    }, 480)
    return () => window.clearTimeout(timer)
  }, [pathname])

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

  const desktopSearchForm = (
    <form onSubmit={handleSubmit} className="mt-5 w-full max-w-2xl sm:mt-6 shadow-lg shadow-black/5">
      <div className="flex w-full min-w-0 flex-col gap-2 overflow-hidden rounded-xl border border-border/60 bg-background p-0 sm:flex-row sm:gap-0 sm:rounded-md">
        <div className="flex shrink-0 items-center sm:border-r sm:border-border/60 sm:bg-muted/30">
          <CityCombobox
            value={cityId}
            onChange={setCityId}
            placeholder="Stadt"
            size="md"
            variant="form"
            className="h-11 w-full min-w-0 rounded-lg border border-border/50 bg-background px-3 sm:h-14 sm:min-w-[160px] sm:rounded-none sm:border-0 sm:bg-transparent sm:px-3"
          />
        </div>
        <div className="relative flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-border/50 bg-background sm:rounded-none sm:border-0">
          <Input
            id={HERO_SEARCH_INPUT_ID}
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            aria-label="Suchbegriff eingeben"
            className={cn(
              "h-11 pr-12 text-sm sm:h-14 sm:pr-14 sm:text-base border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
              showPlaceholder && "text-transparent caret-foreground",
            )}
            autoComplete="off"
          />
          {showPlaceholder && (
            <div
              className="pointer-events-none absolute left-3 right-12 top-1/2 flex -translate-y-1/2 items-center text-sm text-muted-foreground sm:left-3 sm:right-14 sm:text-base"
              aria-hidden
            >
              <span>{TYPING_PREFIX}</span>
              <span className="min-w-[2ch] border-r-2 border-primary animate-pulse">{displayWord}</span>
            </div>
          )}
          <Button
            type="submit"
            size="icon"
            className="brand-icon-btn h-11 w-11 shrink-0 rounded-none border-0 border-l border-border/60 sm:h-14 sm:w-14"
            aria-label="Suchen"
          >
            <Search className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>
    </form>
  )

  return (
    <section id="hero-search" className="relative w-full overflow-hidden scroll-mt-16 sm:scroll-mt-[72px]">
      {/* Мобиле: баннер — фото + текст, под ним поиск (без наложения) */}
      <div className="sm:hidden px-sides pt-1">
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_10px_40px_-16px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.05]">
          <div className="relative h-[8.5rem] w-full">
            <Image
              src={HERO_IMAGE}
              alt=""
              fill
              className="object-cover object-[50%_22%] brightness-[0.92]"
              sizes="100vw"
              priority
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/5 to-black/70"
              aria-hidden
            />
            <div className="relative z-10 flex h-full flex-col justify-end p-4 pt-14">
              <h1 className="text-[17px] font-bold leading-snug tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                {HERO_HEADLINE}
              </h1>
              <p className="mt-1 text-[11px] leading-snug text-white/90 line-clamp-2 drop-shadow-sm">
                {HERO_SUBHEADLINE}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-neutral-100 bg-white">
            <div className="border-b border-neutral-100 px-2 py-1.5">
              <CityCombobox
                value={cityId}
                onChange={setCityId}
                placeholder="Alle Städte"
                size="md"
                variant="form"
                className="h-10 min-h-10 w-full min-w-0 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0 [&_svg]:text-primary [&_svg]:brand-glyph-stroke"
              />
            </div>
            <div className="flex items-center gap-2 p-2.5">
              <div className="relative min-w-0 flex-1">
                <Input
                  id={`${HERO_SEARCH_INPUT_ID}-mobile`}
                  type="search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  aria-label="Suchbegriff eingeben"
                  className={cn(
                    "h-11 rounded-xl border-neutral-200 bg-neutral-50 pl-3.5 pr-3 text-sm focus-visible:border-primary/60 focus-visible:ring-primary/25",
                    showPlaceholder && "text-transparent caret-foreground",
                  )}
                  autoComplete="off"
                />
                {showPlaceholder && (
                  <div
                    className="pointer-events-none absolute left-3.5 right-3 top-1/2 flex -translate-y-1/2 items-center text-sm text-muted-foreground"
                    aria-hidden
                  >
                    <span>{TYPING_PREFIX}</span>
                    <span className="min-w-[2ch] border-r-2 border-primary animate-pulse">{displayWord}</span>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                size="icon"
                className="brand-icon-btn h-11 w-11 shrink-0 rounded-xl"
                aria-label="Suchen"
              >
                <Search className="h-5 w-5" aria-hidden />
              </Button>
            </div>
          </form>
        </div>
        <p className="mt-2 text-center text-[10px] font-medium text-neutral-500">
          Geprüft · Echte Bewertungen · Ohne Vermittlungsgebühr
        </p>
      </div>

      {/* Десктоп: полноразмерный баннер */}
      <div className="relative hidden w-full sm:block sm:min-h-[50vh] md:min-h-[58vh] lg:min-h-[65vh]">
        <div className="absolute inset-0">
          <Image
            src={HERO_IMAGE}
            alt="Team aus geprüften Handwerkern und Dienstleistern"
            fill
            className="object-cover object-[72%_center] md:object-[78%_center] brightness-[0.9]"
            sizes="100vw"
            priority
          />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-r from-white/96 from-15% via-white/70 via-38% to-transparent to-72%"
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/10" aria-hidden />

        <div className="relative z-10 container mx-auto flex min-h-[inherit] flex-col justify-center px-8 py-14 md:px-12 lg:px-16 lg:py-20">
          <div className="w-full max-w-2xl min-w-0">
            <h1 className="text-4xl font-bold leading-[1.2] tracking-tight text-neutral-900 text-balance md:text-5xl md:leading-tight">
              {HERO_HEADLINE}
            </h1>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-neutral-700 text-pretty">
              {HERO_SUBHEADLINE}
            </p>
            {desktopSearchForm}
          </div>
        </div>
      </div>

      {/* Categories: ровно под баннером, те же отступы что и контент для выравнивания на мобиле и десктопе */}
      {(categoriesLoading || categories.length > 0) && (
        <div className="w-full border-t border-border/40 bg-muted/40">
          <div className="container mx-auto py-1.5 sm:py-4 w-full max-w-[1920px] px-3 sm:px-8 md:px-12 lg:px-16">
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
                            "flex shrink-0 flex-col items-center gap-1 rounded-md bg-muted/70 hover:bg-muted px-2 py-2 min-w-[84px] sm:gap-2 sm:px-3 sm:py-3 sm:min-w-[120px]",
                            "text-center text-xs sm:text-sm font-medium text-foreground",
                            "hover:text-primary transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                            "border-b-2 border-transparent",
                            isActive && "border-primary text-primary"
                          )}
                        >
                          <span className="relative flex h-8 w-8 sm:h-12 sm:w-12 shrink-0 overflow-hidden rounded-md bg-muted border border-border/40">
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
