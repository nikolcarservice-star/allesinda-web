import Link from "next/link"

const linkClass =
  "text-slate-200 hover:text-primary transition-colors underline-offset-2 hover:underline"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-800 bg-slate-900 dark:bg-black">
      <div className="container mx-auto px-sides py-8 sm:py-10 text-center text-sm sm:text-base text-slate-300 space-y-3">
        <p>
          Allesinda — Ihr deutschlandweiter Marktplatz für Handwerk, Reparatur und
          Geräteverleih.
        </p>
        <p>
          Rechtliches:{" "}
          <Link href="/impressum" className={linkClass}>
            Impressum
          </Link>
          {" | "}
          <Link href="/privacy" className={linkClass}>
            Datenschutzerklärung
          </Link>
          {" | "}
          <Link href="/terms" className={linkClass}>
            AGB
          </Link>
        </p>
        <p>
          Kontakt:{" "}
          <a href="mailto:kontakt@allesinda.de" className={linkClass}>
            E-Mail
          </a>
          {" / "}
          <Link href="/contact" className={linkClass}>
            Kontaktformular
          </Link>
        </p>
        <p className="text-slate-400 text-xs sm:text-sm">
          © {currentYear} Allesinda. Alle Rechte vorbehalten.
        </p>
      </div>
    </footer>
  )
}
