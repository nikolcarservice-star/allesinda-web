"use client"

import { useState, FormEvent, useEffect } from "react"
import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SearchSectionProps {
  searchQuery?: string
  onSearch: (query: string) => void
  isSearching?: boolean
}

export function SearchSection({ searchQuery: initialQuery = "", onSearch, isSearching = false }: SearchSectionProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [isSmallScreen, setIsSmallScreen] = useState(false)

  useEffect(() => {
    setSearchQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 640)
    }
    
    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)
    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmedQuery = searchQuery.trim()
    // Always call onSearch, even with empty query, to reset to default behavior
    onSearch(trimmedQuery)
  }

  return (
    <section className="relative min-h-[55vh] sm:min-h-[65vh] md:min-h-[70vh] flex items-center bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 overflow-hidden">
      <div className="container mx-auto px-sides relative z-10 py-16 sm:py-20 md:py-24 lg:py-28">
        <div className="mx-auto max-w-3xl sm:max-w-4xl text-center space-y-5 sm:space-y-6 md:space-y-7">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm shadow-sm">
            <span className="text-xs sm:text-sm font-semibold text-primary tracking-wide">Vertrauenswürdig</span>
          </div>
          
          {/* Hero Title */}
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-balance leading-[1.05] px-4 sm:px-0">
              <span className="bg-gradient-to-r from-white via-white to-white/90 bg-clip-text text-transparent">
                Finden Sie den Richtigen
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent">
                Profi
              </span>
            </h1>
            <p className="text-sm sm:text-lg md:text-xl text-white/90 text-balance max-w-2xl mx-auto leading-relaxed px-4 sm:px-0 font-medium">
              Experten buchen, Geräte mieten, Produkt kaufen — alles an einem Ort
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="relative max-w-2xl sm:max-w-3xl mx-auto pt-4 sm:pt-6">
            <div className="relative group">
              {/* Search Input Container */}
              <div className="relative bg-background rounded-lg border border-border/40 shadow-none group-hover:border-border/60 transition-all duration-200">
                <div className="flex items-center gap-1.5 px-2.5 sm:px-3 md:px-4 lg:px-2 py-1.5 sm:py-2 md:py-2 lg:py-1.5">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-primary shrink-0" />
                  <Input
                    type="text"
                    placeholder={isSmallScreen ? "Was benötigen Sie?" : "Was benötigen Sie? Klempner, Maler, Aufzug..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 h-10 sm:h-12 md:h-14 text-xs sm:text-sm md:text-base border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 px-0"
                  />
                  <div className="w-px h-8 sm:h-10 md:h-12 bg-border/50 shrink-0 self-center hidden sm:block"></div>
                  <Button 
                    type="submit"
                    size="lg" 
                    disabled={isSearching}
                    className="h-10 sm:h-12 md:h-14 px-3 sm:px-4 md:px-6 rounded-md font-semibold text-xs sm:text-sm md:text-base shadow-none hover:shadow-none transition-all duration-200 shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mr-2" />
                        Suche...
                      </>
                    ) : (
                      "Suchen"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
