import type { Metadata } from "next"
import { PageLayout } from "@/components/layout/page-layout"

export const metadata: Metadata = {
  title: "Datenschutzerklärung | Allesinda",
  description: "Informationen zur Verarbeitung personenbezogener Daten auf Allesinda.",
}

const dataRows = [
  {
    category: "Registrierungsdaten (Name, E-Mail, Telefon)",
    purpose: "Erstellung und Verwaltung des Nutzerkontos",
    legalBasis: "Art. 6 Abs. 1 lit. b DSGVO",
  },
  {
    category: "Profildaten (Beschreibung, Kategorie, Standort, Preise, Fotos)",
    purpose: "Darstellung des Angebots auf der Plattform",
    legalBasis: "Art. 6 Abs. 1 lit. b DSGVO",
  },
  {
    category: "Bewertungen und Kommentare",
    purpose: "Vertrauensbildung zwischen Nutzern",
    legalBasis: "Art. 6 Abs. 1 lit. f DSGVO",
  },
  {
    category: "Kontaktanfragen über die Plattform",
    purpose: "Vermittlung zwischen Auftraggeber und Profi",
    legalBasis: "Art. 6 Abs. 1 lit. b DSGVO",
  },
  {
    category: "Technische Daten (IP-Adresse, Browser, Zugriffszeit)",
    purpose: "Bereitstellung und Sicherheit der Website",
    legalBasis: "Art. 6 Abs. 1 lit. f DSGVO",
  },
  {
    category: "Analyse-Daten (Google Analytics)",
    purpose: "Verbesserung der Plattform, Nutzungsstatistiken",
    legalBasis: "Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)",
  },
  {
    category: "Cookies",
    purpose: "Funktionalität, Statistik",
    legalBasis: "Art. 6 Abs. 1 lit. a / f DSGVO, § 25 TTDSG",
  },
] as const

export default function PrivacyPage() {
  return (
    <PageLayout>
      <main className="container mx-auto max-w-4xl px-sides py-10 sm:py-14 md:py-16">
        <article className="space-y-8">
          <header className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Rechtliches</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Datenschutzerklärung</h1>
            <p className="text-sm text-muted-foreground">Stand: 01.07.2026 - gemäß Art. 13, 14 DSGVO</p>
          </header>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">1. Verantwortlicher</h2>
            <p className="leading-relaxed text-muted-foreground">
              Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne der DSGVO ist:
              <br />
              Ruslan Yusifov
              <br />
              Neubrandenburger Str. 34
              <br />
              13059 Berlin, Deutschland
              <br />
              E-Mail:{" "}
              <a className="font-medium text-primary underline-offset-2 hover:underline" href="mailto:kontakt@allesinda.de">
                kontakt@allesinda.de
              </a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">2. Allgemeines zur Datenverarbeitung</h2>
            <p className="leading-relaxed text-muted-foreground">
              Allesinda ist ein Marktplatz, der Auftraggeber und Handwerker („Profis") in Deutschland
              zusammenbringt. Im Rahmen des Betriebs der Plattform verarbeiten wir personenbezogene Daten
              unserer Nutzer, soweit dies zur Bereitstellung unserer Dienste erforderlich ist.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. Welche Daten wir verarbeiten</h2>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 font-semibold text-foreground">Datenkategorie</th>
                    <th className="px-4 py-3 font-semibold text-foreground">Zweck</th>
                    <th className="px-4 py-3 font-semibold text-foreground">Rechtsgrundlage</th>
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row) => (
                    <tr key={row.category} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 align-top text-muted-foreground">{row.category}</td>
                      <td className="px-4 py-3 align-top text-muted-foreground">{row.purpose}</td>
                      <td className="px-4 py-3 align-top text-muted-foreground">{row.legalBasis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">4. Google Analytics</h2>
            <p className="leading-relaxed text-muted-foreground">
              Diese Website nutzt Google Analytics 4, einen Webanalysedienst der Google Ireland Limited,
              Gordon House, Barrow Street, Dublin 4, Irland („Google").
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Google Analytics verwendet Cookies und ähnliche Technologien, um die Nutzung unserer Website zu
              analysieren. Die dabei erzeugten Informationen werden in der Regel an einen Server von Google in
              den USA übertragen und dort gespeichert. Wir haben die IP-Anonymisierung aktiviert (
              <code className="rounded bg-muted px-1 py-0.5 text-sm">anonymize_ip: true</code>), sodass Ihre
              IP-Adresse von Google innerhalb der EU/EWR vor der Übermittlung gekürzt wird.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Google Analytics wird auf dieser Website nur nach Ihrer ausdrücklichen Einwilligung über unser
              Cookie-Banner aktiviert. Sie können Ihre Einwilligung jederzeit widerrufen.
            </p>
            <p className="leading-relaxed text-muted-foreground">Mess-ID: G-69NP5395Z3</p>
            <p className="leading-relaxed text-muted-foreground">
              Mehr Informationen:{" "}
              <a
                className="font-medium text-primary underline-offset-2 hover:underline"
                href="https://policies.google.com/privacy"
                rel="noreferrer"
                target="_blank"
              >
                Google Datenschutzerklärung
              </a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">5. Cookies</h2>
            <p className="leading-relaxed text-muted-foreground">Wir unterscheiden zwischen:</p>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>
                Technisch notwendige Cookies - erforderlich für den Betrieb der Website (z. B. Login-Status).
                Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TTDSG.
              </li>
              <li>
                Statistik-Cookies (Google Analytics) - nur nach Ihrer Einwilligung. Rechtsgrundlage: Art. 6
                Abs. 1 lit. a DSGVO, § 25 Abs. 1 TTDSG.
              </li>
              <li>Marketing-Cookies - derzeit nicht im Einsatz.</li>
            </ul>
            <p className="leading-relaxed text-muted-foreground">
              Beim ersten Besuch erscheint ein Cookie-Banner. Eine erteilte Einwilligung können Sie jederzeit
              über die Cookie-Einstellungen im Footer widerrufen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">6. Veröffentlichung von Nutzerprofilen</h2>
            <p className="leading-relaxed text-muted-foreground">
              Wer sich als Profi registriert, willigt in die öffentliche Darstellung der selbst angegebenen
              Profildaten ein. Diese Einwilligung kann jederzeit durch Löschung des Profils oder Kontaktaufnahme
              unter kontakt@allesinda.de widerrufen werden.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">7. Weitergabe von Daten</h2>
            <p className="leading-relaxed text-muted-foreground">
              Eine Übermittlung Ihrer Daten an Dritte erfolgt nur soweit dies zur Vertragsabwicklung notwendig
              ist, gesetzlich vorgeschrieben ist, oder Sie ausdrücklich eingewilligt haben. Google Analytics
              überträgt Daten in die USA - dies erfolgt auf Basis der EU-Standardvertragsklauseln und nur nach
              Ihrer Einwilligung.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">8. Speicherdauer</h2>
            <p className="leading-relaxed text-muted-foreground">
              Wir speichern personenbezogene Daten nur so lange wie es für die jeweiligen Zwecke erforderlich
              ist. Nutzerkonten werden bei Löschung innerhalb von 30 Tagen gelöscht oder anonymisiert.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">9. Ihre Rechte</h2>
            <p className="leading-relaxed text-muted-foreground">Sie haben jederzeit das Recht auf:</p>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>Auskunft (Art. 15 DSGVO)</li>
              <li>Berichtigung (Art. 16 DSGVO)</li>
              <li>Löschung (Art. 17 DSGVO)</li>
              <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
              <li>Widerspruch (Art. 21 DSGVO)</li>
              <li>Widerruf einer Einwilligung (Art. 7 Abs. 3 DSGVO)</li>
            </ul>
            <p className="leading-relaxed text-muted-foreground">
              Kontakt:{" "}
              <a className="font-medium text-primary underline-offset-2 hover:underline" href="mailto:kontakt@allesinda.de">
                kontakt@allesinda.de
              </a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">10. Beschwerderecht</h2>
            <p className="leading-relaxed text-muted-foreground">
              Sie haben das Recht, sich bei der zuständigen Datenschutzaufsichtsbehörde zu beschweren. Zuständig
              für Berlin: Berliner Beauftragte für Datenschutz und Informationsfreiheit, Friedrichstr. 219,
              10969 Berlin.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">11. Datensicherheit</h2>
            <p className="leading-relaxed text-muted-foreground">
              Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten zu schützen. Die
              Übertragung erfolgt verschlüsselt via HTTPS.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">12. Änderungen dieser Datenschutzerklärung</h2>
            <p className="leading-relaxed text-muted-foreground">
              Wir behalten uns vor, diese Erklärung anzupassen, damit sie stets den aktuellen rechtlichen
              Anforderungen entspricht. Stand: 01.07.2026.
            </p>
          </section>
        </article>
      </main>
    </PageLayout>
  )
}
