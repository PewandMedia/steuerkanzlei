import { usePageMeta } from "@/hooks/use-page-meta";
import { ArrowLeft, Mail, Phone } from "lucide-react";

export default function Impressum() {
  usePageMeta(
    "Impressum",
    "Impressum und rechtliche Hinweise von Pewand Media."
  );

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Linke Seite — Branding */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden bg-gradient-to-br from-brand-deep via-brand-dark to-brand">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.06] motion-reduce:opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-white/5 blur-3xl" aria-hidden />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/30 bg-white/10 text-sm font-semibold tracking-widest backdrop-blur">
            PM
          </div>
          <span className="text-lg font-semibold tracking-[0.3em]">PEWAND MEDIA</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Impressum
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            Rechtliche Angaben und Pflichtinformationen nach dem deutschen Telemediengesetz (TMG).
          </p>
        </div>

        <p className="relative text-xs text-white/50">© 2026 Pewand Media · Kanzlei-Software</p>
      </aside>

      {/* Rechte Seite — Impressum-Inhalt */}
      <main className="flex items-start justify-center px-6 py-12 lg:py-16 bg-background">
        <div className="w-full max-w-2xl space-y-8">
          <div className="lg:hidden flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-brand-foreground text-xs font-semibold tracking-widest">
                PM
              </div>
              <span className="text-base font-semibold tracking-[0.3em] text-foreground">PEWAND MEDIA</span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Impressum
            </h2>
            <p className="text-sm text-muted-foreground">
              Pflichtangaben nach § 5 DDG und § 55 RStV.
            </p>
          </div>

          <div className="card-elevated rounded-xl p-6 lg:p-8 space-y-8">
            <section>
              <h3 className="section-label mb-3">Diensteanbieter</h3>
              <div className="text-sm text-foreground space-y-1">
                <p className="font-semibold">Pewand Media</p>
                <p>Inhaber: Pewand Ali</p>
                <p>Girondelle 105</p>
                <p>44799 Bochum</p>
                <p>Deutschland</p>
              </div>
            </section>

            <section>
              <h3 className="section-label mb-3">Kontakt</h3>
              <div className="text-sm text-foreground space-y-2">
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href="tel:+491621361494" className="text-brand hover:underline">
                    +49 162 136 1494
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href="mailto:info@pewandmedia.de" className="text-brand hover:underline">
                    info@pewandmedia.de
                  </a>
                </p>
              </div>
            </section>

            <section>
              <h3 className="section-label mb-3">Rechtliche Hinweise</h3>
              <div className="text-sm text-foreground space-y-1">
                <p>Rechtsform: Einzelunternehmen</p>
                <p>USt-IdNr.: Nicht vorhanden</p>
              </div>
            </section>

            <section>
              <h3 className="section-label mb-3">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h3>
              <div className="text-sm text-foreground space-y-1">
                <p>Pewand Ali</p>
                <p>Girondelle 105</p>
                <p>44799 Bochum</p>
                <p>Deutschland</p>
              </div>
            </section>

            <section>
              <h3 className="section-label mb-3">Haftung für Inhalte</h3>
              <p className="text-sm text-foreground leading-relaxed">
                Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
              </p>
            </section>

            <section>
              <h3 className="section-label mb-3">Haftung für Links</h3>
              <p className="text-sm text-foreground leading-relaxed">
                Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
              </p>
            </section>

            <section>
              <h3 className="section-label mb-3">Urheberrecht</h3>
              <p className="text-sm text-foreground leading-relaxed">
                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
              </p>
            </section>

            <section>
              <h3 className="section-label mb-3">EU-Streitschlichtung</h3>
              <p className="text-sm text-foreground leading-relaxed">
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
                <a
                  href="https://ec.europa.eu/consumers/odr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline break-all"
                >
                  https://ec.europa.eu/consumers/odr/
                </a>
                . Wir sind weder verpflichtet noch bereit, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </section>
          </div>

          <a
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Demo
          </a>
        </div>
      </main>
    </div>
  );
}
