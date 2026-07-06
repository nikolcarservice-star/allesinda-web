import type { Metadata } from "next"
import { PageLayout } from "@/components/layout/page-layout"

export const metadata: Metadata = {
  title: "AGB | Allesinda",
  description: "Allgemeine Geschäftsbedingungen für die Nutzung der Plattform Allesinda.",
}

export default function TermsPage() {
  return (
    <PageLayout>
      <main className="container mx-auto max-w-3xl px-sides py-10 sm:py-14 md:py-16">
        <article className="space-y-8">
          <header className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Rechtliches</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Allgemeine Geschäftsbedingungen (AGB)
            </h1>
            <p className="text-sm text-muted-foreground">Stand: 01.07.2026</p>
            <p className="leading-relaxed text-muted-foreground">
              Die Nutzung der Plattform Allesinda ist derzeit für alle Nutzer kostenlos. Dieser Status gilt
              für einen Einführungszeitraum von 6 Monaten ab 01.07.2026 (bis 01.01.2027) und kann sich
              danach ändern (siehe § 4).
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">§ 1 Geltungsbereich</h2>
            <p className="leading-relaxed text-muted-foreground">
              Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Online-Plattform Allesinda
              (erreichbar unter allesinda.de), betrieben von Ruslan Yusifov, Neubrandenburger Str. 34, 13059
              Berlin (im Folgenden „Allesinda" oder „wir"). Sie gelten für alle Nutzer der Plattform,
              unabhängig davon, ob diese als Auftraggeber oder als Anbieter handwerklicher Tätigkeiten
              („Profis") auftreten.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">§ 2 Leistungsbeschreibung</h2>
            <p className="leading-relaxed text-muted-foreground">
              Allesinda stellt eine digitale Plattform zur Verfügung, über die Auftraggeber und Profis in
              Deutschland zueinander finden können. Allesinda vermittelt lediglich den Kontakt zwischen den
              Parteien und wird selbst nicht Vertragspartei eines zwischen Auftraggeber und Profi geschlossenen
              Vertrags. Allesinda übernimmt keine Gewähr für die Qualität, Verfügbarkeit oder Ausführung der
              von Profis angebotenen Leistungen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">§ 3 Registrierung und Nutzerkonto</h2>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>Die Registrierung ist Voraussetzung für bestimmte Funktionen der Plattform.</li>
              <li>Nutzer sind verpflichtet, bei der Registrierung wahrheitsgemäße Angaben zu machen.</li>
              <li>Ein Nutzerkonto ist nicht übertragbar.</li>
              <li>Nutzer sind für die Geheimhaltung ihrer Zugangsdaten selbst verantwortlich.</li>
              <li>Die Registrierung ist Personen ab 18 Jahren vorbehalten.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">§ 4 Kostenlose Nutzung und zukünftige Preisänderungen</h2>
            <p className="leading-relaxed text-muted-foreground">
              Die Nutzung von Allesinda ist für einen Zeitraum von 6 Monaten ab 01.07.2026 vollständig
              kostenlos für alle Nutzergruppen. Nach Ablauf dieses Zeitraums (ab 01.01.2027) behalten wir uns
              vor, kostenpflichtige Funktionen einzuführen. Über die Einführung kostenpflichtiger Leistungen
              werden bestehende Nutzer mindestens 14 Tage im Voraus per E-Mail informiert. Nutzer können ihr
              Konto jederzeit kostenfrei löschen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">§ 5 Pflichten der Profis</h2>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>Profis sichern zu, dass alle Profilangaben wahrheitsgemäß sind.</li>
              <li>
                Sofern eine Tätigkeit einer gesetzlichen Erlaubnis bedarf (z. B. Handwerksrolle), liegt es in
                der Verantwortung des Profis, diese einzuholen.
              </li>
              <li>Hochgeladene Bilder dürfen keine Rechte Dritter verletzen.</li>
              <li>Es ist untersagt, rechtswidrige oder irreführende Inhalte zu veröffentlichen.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">§ 6 Bewertungen</h2>
            <p className="leading-relaxed text-muted-foreground">
              Bewertungen müssen wahrheitsgemäß und sachlich sein. Wir behalten uns vor, Bewertungen die gegen
              diese Grundsätze verstoßen zu prüfen und ggf. zu entfernen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">§ 7 Haftungsausschluss</h2>
            <p className="leading-relaxed text-muted-foreground">
              Allesinda haftet nicht für die Erfüllung oder Qualität der zwischen Auftraggebern und Profis
              geschlossenen Verträge. Wir haften nur für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung
              wesentlicher Vertragspflichten. Die Haftung für Schäden aus der Verletzung des Lebens, des
              Körpers oder der Gesundheit bleibt unberührt.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">§ 8 Sperrung und Kündigung</h2>
            <p className="leading-relaxed text-muted-foreground">
              Wir behalten uns vor, Nutzerkonten bei Verstößen gegen diese AGB oder geltendes Recht zu
              sperren. Nutzer können ihr Konto jederzeit ohne Angabe von Gründen löschen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">§ 9 Änderung der AGB</h2>
            <p className="leading-relaxed text-muted-foreground">
              Wir behalten uns vor, diese AGB mit Wirkung für die Zukunft zu ändern. Nutzer werden über
              wesentliche Änderungen rechtzeitig per E-Mail informiert.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">§ 10 Schlussbestimmungen</h2>
            <p className="leading-relaxed text-muted-foreground">
              Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen dieser AGB
              unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Kontakt:{" "}
              <a className="font-medium text-primary underline-offset-2 hover:underline" href="mailto:kontakt@allesinda.de">
                kontakt@allesinda.de
              </a>
            </p>
          </section>
        </article>
      </main>
    </PageLayout>
  )
}
