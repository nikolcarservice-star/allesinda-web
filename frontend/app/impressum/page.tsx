import type { Metadata } from "next"
import { PageLayout } from "@/components/layout/page-layout"

export const metadata: Metadata = {
  title: "Impressum | Allesinda",
  description: "Anbieterkennzeichnung und rechtliche Hinweise von Allesinda.",
}

export default function ImpressumPage() {
  return (
    <PageLayout>
      <main className="container mx-auto max-w-3xl px-sides py-10 sm:py-14 md:py-16">
        <article className="space-y-8">
          <header className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Rechtliches</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Impressum</h1>
            <p className="text-sm text-muted-foreground">Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</p>
          </header>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Anbieter</h2>
            <p className="leading-relaxed text-muted-foreground">
              Ruslan Yusifov
              <br />
              Neubrandenburger Str. 34
              <br />
              13059 Berlin
              <br />
              Deutschland
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Unternehmensform</h2>
            <p className="leading-relaxed text-muted-foreground">Gewerbetreibender (Einzelunternehmer)</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Umsatzsteuer</h2>
            <p className="leading-relaxed text-muted-foreground">
              Kleinunternehmerstatus gemäß § 19 UStG - es wird keine Umsatzsteuer berechnet.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Kontakt</h2>
            <p className="leading-relaxed text-muted-foreground">
              E-Mail:{" "}
              <a className="font-medium text-primary underline-offset-2 hover:underline" href="mailto:kontakt@allesinda.de">
                kontakt@allesinda.de
              </a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Verantwortlich für den Inhalt</h2>
            <p className="leading-relaxed text-muted-foreground">Ruslan Yusifov, Anschrift wie oben</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Hinweis zur Plattform</h2>
            <p className="leading-relaxed text-muted-foreground">
              Allesinda ist ein digitaler Marktplatz zur Vermittlung von Kontakten zwischen Handwerkern
              und Auftraggebern in Deutschland. Die Plattform stellt Profile und Bewertungen zur Verfügung,
              schließt jedoch selbst keine Verträge zwischen den Nutzern ab.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Haftung für Inhalte</h2>
            <p className="leading-relaxed text-muted-foreground">
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach
              den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter
              jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.
              Eine Haftung ist erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich.
              Bei Bekanntwerden von Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Haftung für Links</h2>
            <p className="leading-relaxed text-muted-foreground">
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss
              haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter verantwortlich. Bei
              Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Urheberrecht</h2>
            <p className="leading-relaxed text-muted-foreground">
              Die durch die Seitenbetreiber erstellten Inhalte auf diesen Seiten unterliegen dem deutschen
              Urheberrecht. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen
              Gebrauch gestattet.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Verbraucherstreitbeilegung</h2>
            <p className="leading-relaxed text-muted-foreground">
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>
        </article>
      </main>
    </PageLayout>
  )
}
