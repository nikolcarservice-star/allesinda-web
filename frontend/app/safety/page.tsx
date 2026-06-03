import type { Metadata } from "next"
import Link from "next/link"
import { PageLayout } from "@/components/layout/page-layout"
import { TRUST_EMAIL } from "@/lib/constants/trust"
import { Shield, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Sicherheit & Vertrauen | Allesinda",
  description:
    "So behandeln wir Meldungen und Beschwerden auf Allesinda — transparent, fair und innerhalb von 24 Stunden.",
}

const ACTION_ROWS = [
  {
    violation: "Erste Meldung, geringfügig",
    action: "Verwarnung an den Meister",
  },
  {
    violation: "Wiederholte Meldung",
    action: "Vorübergehende Sperre (7 Tage)",
  },
  {
    violation: "Betrug / Täuschung",
    action: "Dauerhafte Sperre",
  },
  {
    violation: "Beleidigung / Drohungen",
    action: "Sofortige Sperre",
  },
] as const

export default function SafetyPage() {
  return (
    <PageLayout>
      <div className="container mx-auto max-w-3xl px-sides py-10 sm:py-14 md:py-16">
        <div className="mb-10 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <Shield className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Sicherheit & Vertrauen
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Auf Allesinda steht Ihre Sicherheit an erster Stelle. So bearbeiten wir Meldungen gegen
              Meister — fair, nachvollziehbar und mit klarer Kommunikation für alle Beteiligten.
            </p>
          </div>
        </div>

        <div className="space-y-10">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Schritt 1 — Meldung erhalten</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <li>Der Kunde tippt auf jedem Meisterprofil auf „Meldung“.</li>
              <li>Das Trust-Team erhält eine Benachrichtigung per E-Mail.</li>
              <li>Die Meldung wird im System gespeichert und im Admin-Bereich angezeigt.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Schritt 2 — Prüfung (24 Stunden)</h2>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Unser Team prüft innerhalb von 24 Stunden:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <li>Ist es die erste Meldung oder eine Wiederholung?</li>
              <li>Gibt es Nachweise (Fotos, Chat-Verlauf, Buchungsdetails)?</li>
              <li>Wie schwerwiegend ist der Verstoß?</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Schritt 3 — Maßnahme</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Je nach Schwere der Meldung leiten wir eine der folgenden Maßnahmen ein:
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 font-semibold text-foreground">Verstoß</th>
                    <th className="px-4 py-3 font-semibold text-foreground">Maßnahme</th>
                  </tr>
                </thead>
                <tbody>
                  {ACTION_ROWS.map((row) => (
                    <tr key={row.violation} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{row.violation}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Schritt 4 — Benachrichtigung</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <li>
                <strong className="font-medium text-foreground">Meister</strong> — wir informieren,
                was passiert ist und warum.
              </li>
              <li>
                <strong className="font-medium text-foreground">Kunde</strong> — wir bestätigen,
                dass die Meldung bearbeitet wurde.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Schritt 5 — Einspruch</h2>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Meister können eine Entscheidung innerhalb von{" "}
              <strong className="font-medium text-foreground">7 Tagen</strong> schriftlich an unser
              Trust-Team richten. Wir prüfen den Einspruch erneut und teilen das Ergebnis mit.
            </p>
          </section>

          <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Meldung einreichen</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Auf jedem Meisterprofil finden Sie die Schaltfläche „Meldung“. Alternativ können Sie uns
              direkt kontaktieren:
            </p>
            <a
              href={`mailto:${TRUST_EMAIL}`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
            >
              <Mail className="h-4 w-4" aria-hidden />
              {TRUST_EMAIL}
            </a>
            <p className="mt-4 text-xs text-muted-foreground">
              Weitere Informationen finden Sie auch im{" "}
              <Link href="/help" className="font-medium text-primary underline-offset-2 hover:underline">
                Hilfe-Center
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </PageLayout>
  )
}
