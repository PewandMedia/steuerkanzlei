import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowRight, Eye, EyeOff, FileCheck2, Lock, Mail, ShieldCheck } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function Login() {
  usePageMeta("TAXOM – Anmelden", "Internes Backoffice der Kanzlei TAXOM. Anmeldung für Mitarbeiter.");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
    setLoading(false);
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

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/30 bg-white/10 text-sm font-semibold tracking-widest backdrop-blur">
            TX
          </div>
          <span className="text-lg font-semibold tracking-[0.3em]">TAXOM</span>
        </div>

        <div className="relative max-w-md space-y-6">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Steuerberatung,<br />neu gedacht.
          </h1>
          <p className="text-base leading-relaxed text-white/75">
            Das interne Backoffice der Kanzlei TAXOM. Entwickelt für unser Team,
            nach unseren Abläufen, mit unseren Standards.
          </p>

          <div className="h-px w-24 bg-white/20" />

          <ul className="space-y-5">
            <li className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Mandantendaten geschützt</p>
                <p className="text-sm text-white/65">Berufsverschwiegenheit nach §203 StGB</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Hosting in Deutschland</p>
                <p className="text-sm text-white/65">DSGVO-konform, verschlüsselt</p>
              </div>
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© 2026 TAXOM Steuerkanzlei</p>
      </aside>

      {/* Rechte Seite — Login-Formular */}
      <main className="flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-brand-foreground text-xs font-semibold tracking-widest">
              TX
            </div>
            <span className="text-base font-semibold tracking-[0.3em] text-foreground">TAXOM</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Willkommen im Backoffice
            </h2>
            <p className="text-sm text-muted-foreground">
              Bitte melden Sie sich an, um fortzufahren.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="deine@email.de"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••••••"
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-brand-foreground hover:bg-brand/90 group"
            >
              {loading ? "Anmeldung läuft..." : (
                <>
                  Anmelden
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            Kein Zugang? Wenden Sie sich an die Kanzleileitung.
          </p>
        </div>
      </main>
    </div>
  );
}
