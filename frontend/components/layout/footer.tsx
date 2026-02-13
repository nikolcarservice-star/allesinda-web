"use client"

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Facebook, Twitter, Instagram, Linkedin, Phone, MapPin } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative border-t-2 border-border/50 bg-slate-900 dark:bg-black overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/95 via-slate-800/95 to-slate-900/95 dark:from-black/95 dark:via-slate-950/95 dark:to-black/95"></div>
      
      <div className="container mx-auto px-sides relative z-10">
        {/* Main Footer Content */}
        <div className="py-8 sm:py-10 md:py-12 lg:py-16 xl:py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 md:gap-10 lg:gap-12">
            {/* Company Info */}
            <div className="space-y-4 sm:space-y-5 sm:col-span-2 lg:col-span-1 text-center sm:text-left">
              <Link href="/" className="inline-block group transition-all hover:scale-105">
                <div className="relative h-9 w-auto sm:h-10 md:h-12 lg:h-14 mx-auto sm:mx-0">
                  <Image
                    src="/logo_white.webp"
                    alt="Allesinda Logo"
                    width={200}
                    height={50}
                    className="object-contain h-full w-auto"
                    quality={100}
                    priority
                  />
                </div>
              </Link>
              <p className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400 leading-relaxed max-w-xs mx-auto sm:mx-0">
                Ihr vertrauenswürdiger Marktplatz für ReparaturService, Geräteverleih und Qualitätsprodukte.
              </p>
              <div className="flex items-center gap-1.5 sm:gap-2 pt-2 justify-center sm:justify-start">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/20 transition-all p-2 sm:p-2.5 rounded-md hover:shadow-none"
                  aria-label="Facebook"
                >
                  <Facebook className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/20 transition-all p-2 sm:p-2.5 rounded-md hover:shadow-none"
                  aria-label="Twitter"
                >
                  <Twitter className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/20 transition-all p-2 sm:p-2.5 rounded-md hover:shadow-none"
                  aria-label="Instagram"
                >
                  <Instagram className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/20 transition-all p-2 sm:p-2.5 rounded-md hover:shadow-none"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                </a>
              </div>
            </div>

            {/* Quick Links and Support - Side by side on mobile */}
            <div className="grid grid-cols-2 gap-6 sm:gap-8 sm:contents">
              {/* Quick Links */}
              <div className="space-y-3 sm:space-y-4 md:space-y-5 text-center sm:text-left">
                <h3 className="font-bold text-sm sm:text-base md:text-lg tracking-tight text-slate-100 dark:text-slate-200">Schnellzugriff</h3>
                <ul className="space-y-2 sm:space-y-2.5 md:space-y-3">
                  <li>
                    <Link href="/masters" className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400 hover:text-primary transition-all inline-block hover:translate-x-1 font-medium">
                      Meister finden
                    </Link>
                  </li>
                  {/* Раздел «Продукты» отключён
                  <li>
                    <Link href="/products" className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400 hover:text-primary transition-all inline-block hover:translate-x-1 font-medium">
                      Produkt einkaufen
                    </Link>
                  </li>
                  */}
                  <li>
                    <Link href="/rentals" className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400 hover:text-primary transition-all inline-block hover:translate-x-1 font-medium">
                      Geräteverleih
                    </Link>
                  </li>
                  <li>
                    <Link href="/bookings" className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400 hover:text-primary transition-all inline-block hover:translate-x-1 font-medium">
                      Meine Buchungen
                    </Link>
                  </li>
                  <li>
                    <Link href="/messages" className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400 hover:text-primary transition-all inline-block hover:translate-x-1 font-medium">
                      Nachrichten
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Support */}
              <div className="space-y-3 sm:space-y-4 md:space-y-5 text-center sm:text-left">
                <h3 className="font-bold text-sm sm:text-base md:text-lg tracking-tight text-slate-100 dark:text-slate-200">Unterstützung</h3>
                <ul className="space-y-2 sm:space-y-2.5 md:space-y-3">
                  <li>
                    <Link href="/help" className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400 hover:text-primary transition-all inline-block hover:translate-x-1 font-medium">
                      Hilfe-Center
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400 hover:text-primary transition-all inline-block hover:translate-x-1 font-medium">
                      Kontaktieren Sie uns
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400 hover:text-primary transition-all inline-block hover:translate-x-1 font-medium">
                      Über uns
                    </Link>
                  </li>
                  <li>
                    <Link href="/faq" className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400 hover:text-primary transition-all inline-block hover:translate-x-1 font-medium">
                      FAQ
                    </Link>
                  </li>
                  <li>
                    <Link href="/safety" className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400 hover:text-primary transition-all inline-block hover:translate-x-1 font-medium">
                      Sicherheit & Vertrauen
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Newsletter & Contact */}
            <div className="space-y-4 sm:space-y-5 md:space-y-6 sm:col-span-2 lg:col-span-1 text-center sm:text-left">
              <div className="space-y-1.5 sm:space-y-2">
                <h3 className="font-bold text-sm sm:text-base md:text-lg tracking-tight text-slate-100 dark:text-slate-200">Bleiben Sie informiert</h3>
                <p className="text-xs sm:text-sm md:text-base text-slate-300 dark:text-slate-400">
                  Erhalten Sie die neuesten Updates und exklusive Angebote.
                </p>
              </div>
              <div className="space-y-2.5 pt-2">
                <a 
                  href="tel:+493098342765" 
                  className="relative flex items-center gap-3 text-base text-slate-200 dark:text-slate-300 justify-center sm:justify-start group transition-colors duration-200 hover:text-primary"
                >
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    <div className="relative w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 group-hover:border-primary/30 transition-all duration-200">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <span className="font-medium text-sm sm:text-base">
                    +49 30 9834 2765
                  </span>
                </a>
                <div className="relative flex items-center gap-3 text-base text-slate-200 dark:text-slate-300 justify-center sm:justify-start group transition-colors duration-200 hover:text-primary">
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    <div className="relative w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 group-hover:border-primary/30 transition-all duration-200">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <span className="font-medium text-sm sm:text-base">
                    Berlin, Deutschland
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-700/50 dark:border-slate-800/50 py-4 sm:py-6 md:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-[10px] sm:text-xs md:text-sm text-slate-400 dark:text-slate-500">
            <p className="text-center sm:text-left order-2 sm:order-1 font-medium">
              © {currentYear} Allesinda. Alle Rechte vorbehalten.
            </p>
            <div className="flex items-center gap-3 sm:gap-4 md:gap-6 flex-wrap justify-center order-1 sm:order-2">
              <Link href="/privacy" className="hover:text-primary transition-colors whitespace-nowrap font-medium hover:underline underline-offset-2">
                Datenschutzerklärung
              </Link>
              <Link href="/terms" className="hover:text-primary transition-colors whitespace-nowrap font-medium hover:underline underline-offset-2">
                Nutzungsbedingungen
              </Link>
              <Link href="/cookies" className="hover:text-primary transition-colors whitespace-nowrap font-medium hover:underline underline-offset-2">
                Cookie-Richtlinie
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
