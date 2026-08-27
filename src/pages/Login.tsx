import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowRight, Briefcase, Crown, FileCheck2, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";


const DEMO_PASSWORD = "demo-pewand-2026!";

const ROLES = [
  {
    key: "Sekretariat",
    email: "demo-sekretariat@pewand-demo.de",
    emailLeer: "leer-sekretariat@pewand-demo.de",
    title: "Sekretariat",
    subtitle: "Sabine — Empfang & Mandanten-Kontakt",
    description: "Mandanten kontaktieren, fehlende Belege anfordern, Fristen im Blick behalten.",
    Icon: Phone,
  },
  {
    key: "Sachbearbeiter",
    email: "demo-sachbearbeiter@pewand-demo.de",
    emailLeer: "leer-sachbearbeiter@pewand-demo.de",
    title: "Sachbearbeiter",
    subtitle: "Simon — Buchhaltung & Vorbereitung",
    description: "Belege erfassen, Buchhaltungen vorbereiten, zur Prüfung freigeben.",
    Icon: Briefcase,
  },
  {
    key: "Chef",
    email: "demo-chef@pewand-demo.de",
    emailLeer: "leer-chef@pewand-demo.de",
    title: "Chef / Steuerberater",
    subtitle: "Christina — Prüfung & Freigabe",
    description: "Buchhaltungen prüfen, freigeben oder zurückweisen, gesamte Kanzlei überblicken.",
    Icon: Crown,
  },
] as const;

type Modus = "demo" | "leer";

export default function Login() {
  usePageMeta(
    "Pewand Media Demo – Kanzlei-Backoffice testen",
    "Interaktive Demo des Pewand Media Backoffices für Steuerberater. Wählen Sie eine Rolle und testen Sie das System mit Beispieldaten.",
  );

  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [modus, setModus] = useState<Modus>("demo");

  const loginAs = async (email: string, roleKey: string) => {
    setLoadingRole(roleKey);
    const { error } = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    if (error) {
      toast({
        title: "Demo-Anmeldung fehlgeschlagen",
        description: error.message,
        variant: "destructive",
      });
      setLoadingRole(null);
    }
  };


  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Linke Seite — Brand & Trust */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden bg-gradient-to-br from-brand-deep via-brand-dark to-brand">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none animate-grid-pulse motion-reduce:animate-none motion-reduce:opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-white/5 blur-3xl" aria-hidden />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-10 w-10" />

            <span className="text-lg font-semibold tracking-[0.3em]">PEWAND MEDIA</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium tracking-wider uppercase backdrop-blur">
            <Sparkles className="h-3 w-3" /> Live-Demo
          </span>
        </div>

        <div className="relative max-w-md space-y-6">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Testen Sie das<br />Pewand Media Backoffice.
          </h1>
          <p className="text-base leading-relaxed text-white/75">
            Digitales Kanzlei-Backoffice für Steuerberater. Wählen Sie rechts eine Rolle
            und erleben Sie den kompletten Ablauf mit echten Beispiel-Mandanten.
          </p>

          <div className="h-px w-24 bg-white/20" />

          <ul className="space-y-5">
            <li className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">DSGVO-konformes Hosting</p>
                <p className="text-sm text-white/65">Rechenzentren in Deutschland</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Rollenbasierte Workflows</p>
                <p className="text-sm text-white/65">Sekretariat, Buchhaltung, Chef</p>
              </div>
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Pewand Media · Kanzlei-Software</p>
      </aside>

      {/* Rechte Seite — Rollen-Auswahl */}
      <main className="flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BrandLogo className="h-9 w-9 border border-border" />

              <span className="text-base font-semibold tracking-[0.3em] text-foreground">PEWAND MEDIA</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Demo
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Rolle auswählen
            </h2>
            <p className="text-sm text-muted-foreground">
              Melden Sie sich mit einem Klick als eine der drei Rollen an. Alle
              Daten werden nachts automatisch zurückgesetzt.
            </p>
          </div>

          {/* Umschalter: Beispieldaten vs. leeres System */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1">
              {([
                { value: "demo" as const, label: "Mit Beispieldaten" },
                { value: "leer" as const, label: "Ohne Beispieldaten" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setModus(opt.value)}
                  aria-pressed={modus === opt.value}
                  disabled={loadingRole !== null}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                    modus === opt.value
                      ? "bg-brand text-brand-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {modus === "leer" && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                Leeres System: Sie starten ohne Mandanten und ohne Buchhaltungen und können
                eigene Mandanten anlegen und den kompletten Workflow durchspielen.
                Alle Eingaben werden jede Nacht zurückgesetzt.
              </div>
            )}
          </div>

          <div className="space-y-3">
            {ROLES.map(({ key, email, emailLeer, title, subtitle, description, Icon }) => {
              const loginEmail = modus === "leer" ? emailLeer : email;
              const loading = loadingRole === key;
              const disabled = loadingRole !== null;
              return (
                <button
                  key={key}
                  onClick={() => loginAs(email, key)}
                  disabled={disabled}
                  className="group w-full text-left rounded-xl border border-border bg-card p-4 transition-all hover:border-brand hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">{title}</p>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
                      {loading && (
                        <p className="text-xs text-brand mt-2 font-medium">Anmeldung läuft…</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">
              Interessiert an Pewand Media für Ihre Kanzlei?
            </p>
            <p className="text-xs text-muted-foreground">
              Schreiben Sie uns an <a href="mailto:info@pewandmedia.de" className="text-brand hover:underline">info@pewandmedia.de</a> für ein persönliches Angebot.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <a href="/impressum" className="hover:text-foreground transition-colors">Impressum</a>
          </div>
        </div>
      </main>
    </div>
  );
}
