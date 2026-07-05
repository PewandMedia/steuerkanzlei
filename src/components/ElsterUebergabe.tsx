import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  ShieldCheck,
  Loader2,
  ListChecks,
  Info,
  ArrowDown,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatEuro } from "@/lib/steuer-berechnung";
import type { UStVAKennziffern, BuchungInput } from "@/lib/buchhaltung-erstellung";
import {
  validiereElster,
  formatElsterValue,
  type ElsterCheck,
} from "@/lib/elster-validierung";

interface FortschrittLike {
  total: number;
  gebucht: number;
  offen: number;
  allBooked: boolean;
}

interface Props {
  mandantName: string;
  monat: string;
  ustva: UStVAKennziffern;
  buchungen: BuchungInput[];
  fortschritt: FortschrittLike;

  istAbgeschlossen: boolean;
  istFreigegeben: boolean;
  istEingereicht: boolean;

  kannEingereichtMarkieren: boolean;

  finanzamtReferenz?: string | null;

  /**
   * True, wenn der Steuerberater die Buchhaltung fachlich vorgeprüft und
   * an den Chef weitergeleitet hat. Wenn undefined, wird das Gate ignoriert
   * (Backwards-Kompatibilität, z. B. im Archiv).
   */
  steuerberaterGeprueft?: boolean;
  steuerberaterInfo?: { am: string; notiz: string | null } | null;

  onEingereicht?: (referenz: string) => void | Promise<void>;
}

interface Feld {
  kz: string;
  label: string;
  wert: number;
  abschnitt: "umsatz" | "vorsteuer";
  sub?: boolean;
}

function monatLabel(monat: string): string {
  const m = monat.match(/^(\d{2})-(\d{4})$/);
  if (!m) return monat;
  const monate = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];
  const idx = parseInt(m[1], 10) - 1;
  return `${monate[idx] ?? m[1]} ${m[2]}`;
}

function CheckRow({ check }: { check: ElsterCheck }) {
  const Icon =
    check.level === "ok" ? CheckCircle2 : check.level === "warn" ? AlertTriangle : XCircle;
  const color =
    check.level === "ok"
      ? "text-green-600"
      : check.level === "warn"
        ? "text-yellow-600"
        : "text-destructive";
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", color)} />
      <div>
        <p className={cn("font-medium", color)}>{check.label}</p>
        {check.detail && <p className="text-xs text-muted-foreground">{check.detail}</p>}
      </div>
    </div>
  );
}

export function ElsterUebergabe({
  mandantName,
  monat,
  ustva,
  buchungen,
  fortschritt,
  istAbgeschlossen,
  istFreigegeben,
  istEingereicht,
  kannEingereichtMarkieren,
  finanzamtReferenz,
  steuerberaterGeprueft,
  steuerberaterInfo,
  onEingereicht,
}: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [submittingEingereicht, setSubmittingEingereicht] = useState(false);
  const [referenz, setReferenz] = useState(finanzamtReferenz ?? "");

  const validierung = useMemo(
    () => validiereElster(buchungen, ustva, fortschritt),
    [buchungen, ustva, fortschritt],
  );

  const felder: Feld[] = [
    { kz: "81", label: "Umsätze 19% (netto)", wert: ustva["81"], abschnitt: "umsatz" },
    { kz: "81", label: "davon USt", wert: ustva["81_steuer"], abschnitt: "umsatz", sub: true },
    { kz: "86", label: "Umsätze 7% (netto)", wert: ustva["86"], abschnitt: "umsatz" },
    { kz: "86", label: "davon USt", wert: ustva["86_steuer"], abschnitt: "umsatz", sub: true },
    { kz: "35", label: "Steuerfrei (0%)", wert: ustva["35"], abschnitt: "umsatz" },
    { kz: "66", label: "Abziehbare Vorsteuer", wert: ustva["66"], abschnitt: "vorsteuer" },
  ];

  const copyValue = async (key: string, value: number) => {
    try {
      await navigator.clipboard.writeText(formatElsterValue(value));
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      toast({ title: "Kopieren fehlgeschlagen", variant: "destructive" });
    }
  };

  const copyAll = async () => {
    const lines = [
      ["KZ 81  Umsätze 19% (netto)", ustva["81"]],
      ["KZ      USt 19%", ustva["81_steuer"]],
      ["KZ 86  Umsätze 7% (netto)", ustva["86"]],
      ["KZ      USt 7%", ustva["86_steuer"]],
      ["KZ 35  Steuerfrei (0%)", ustva["35"]],
      ["KZ 66  Vorsteuer", ustva["66"]],
      ["KZ 83  Zahllast/Erstattung", ustva["83"]],
    ]
      .map(([l, v]) => `${l}\t${formatElsterValue(v as number)}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      setCopiedKey("ALL");
      setTimeout(() => setCopiedKey((k) => (k === "ALL" ? null : k)), 1500);
      toast({ title: "Alle Werte kopiert", description: "Tabellarisch in ELSTER einfügbar." });
    } catch {
      toast({ title: "Kopieren fehlgeschlagen", variant: "destructive" });
    }
  };

  const zuZahlen = ustva["83"] > 0.005;
  const erstattung = ustva["83"] < -0.005;
  const ausgeglichen = !zuZahlen && !erstattung;

  // Strenge Bedingungen für „ELSTER bereit"-Badge
  const hatPflichtwerte =
    ustva["81"] > 0.005 ||
    ustva["86"] > 0.005 ||
    ustva["35"] > 0.005 ||
    ustva["66"] > 0.005;
  const darfBereitZeigen =
    validierung.status === "bereit" &&
    fortschritt.allBooked &&
    fortschritt.total > 0 &&
    istAbgeschlossen &&
    hatPflichtwerte;

  const handleEingereicht = async () => {
    if (!onEingereicht) return;
    setSubmittingEingereicht(true);
    try { await onEingereicht(referenz.trim()); } finally { setSubmittingEingereicht(false); }
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-start gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-foreground">ELSTER-Vorbereitung</h3>
              <p className="text-xs text-muted-foreground">{mandantName}</p>
              <p className="text-sm font-medium text-foreground">
                Zeitraum: <span className="font-semibold">{monatLabel(monat)}</span>
              </p>
            </div>
          </div>
          {darfBereitZeigen && !istEingereicht && (
            <Badge className="bg-green-600 hover:bg-green-600/90 gap-1">
              <CheckCircle2 className="h-3 w-3" /> ELSTER bereit
            </Badge>
          )}
          {validierung.status === "warnung" && !istEingereicht && (
            <Badge variant="outline" className="border-yellow-600 text-yellow-700 gap-1">
              <AlertTriangle className="h-3 w-3" /> Mit Hinweisen bereit
            </Badge>
          )}
          {validierung.status === "fehler" && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" /> Nicht bereit
            </Badge>
          )}
          {istEingereicht && (
            <Badge className="bg-blue-600 hover:bg-blue-600/90 gap-1">
              <Building2 className="h-3 w-3" /> Beim Finanzamt eingereicht
            </Badge>
          )}
        </div>

        {/* Validierung */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" /> Validierung
          </div>
          {validierung.checks.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Keine Prüfpunkte.</p>
          ) : (
            <div className="space-y-1.5">
              {validierung.checks.map((c) => <CheckRow key={c.id} check={c} />)}
            </div>
          )}
        </div>

        {/* Steuerberater-Bestätigung (Schritt 1 abgeschlossen) */}
        {steuerberaterGeprueft && steuerberaterInfo && (
          <div className="rounded-md border border-green-600/40 bg-green-50 dark:bg-green-950/20 p-3 space-y-1">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Schritt 1 ✓ — Vom Steuerberater fachlich geprüft
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  am {new Date(steuerberaterInfo.am).toLocaleString("de-DE")}
                </p>
                {steuerberaterInfo.notiz && (
                  <p className="text-xs text-foreground mt-1 italic">
                    „{steuerberaterInfo.notiz}"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top-Down-Hinweis */}
        <div className="rounded-md border bg-primary/5 px-3 py-2 flex items-center gap-2">
          <ArrowDown className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs text-foreground">
            Übertragen Sie die Werte von oben nach unten in ELSTER.
          </p>
        </div>

        {/* Werte-Liste: linear in ELSTER-Reihenfolge (KZ 81 → 81 USt → 86 → 86 USt → 35 → 66 → 83) */}
        <div className="rounded-md border divide-y overflow-hidden">
          {/* Section: Umsätze */}
          <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Umsätze
          </div>
          {felder.filter((f) => f.abschnitt === "umsatz").map((f, idx) => {
            const key = `umsatz-${idx}`;
            const copied = copiedKey === key;
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 hover:bg-accent/40 transition-colors",
                  f.sub && "bg-muted/20",
                )}
              >
                <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">
                  {f.sub ? "" : `KZ ${f.kz}`}
                </span>
                <span className={cn("text-sm flex-1 min-w-0 truncate", f.sub && "text-muted-foreground pl-2")}>
                  {f.label}
                </span>
                <span className="tabular-nums font-mono text-sm text-right">
                  {formatElsterValue(f.wert)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copyValue(key, f.wert)}
                  title="Wert kopieren"
                  aria-label={`${f.label} kopieren`}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            );
          })}

          {/* Section: Vorsteuer */}
          <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vorsteuer
          </div>
          {felder.filter((f) => f.abschnitt === "vorsteuer").map((f, idx) => {
            const key = `vor-${idx}`;
            const copied = copiedKey === key;
            return (
              <div key={key} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/40 transition-colors">
                <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">KZ {f.kz}</span>
                <span className="text-sm flex-1 min-w-0 truncate">{f.label}</span>
                <span className="tabular-nums font-mono text-sm text-right">{formatElsterValue(f.wert)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copyValue(key, f.wert)}
                  title="Wert kopieren"
                  aria-label={`${f.label} kopieren`}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            );
          })}

          {/* Section: Ergebnis */}
          <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ergebnis
          </div>
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 transition-colors",
              zuZahlen && "bg-destructive/5",
              erstattung && "bg-green-600/5",
            )}
          >
            <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">KZ 83</span>
            <span className="text-sm font-semibold flex-1 min-w-0 truncate">
              {zuZahlen
                ? "Zahllast (zu zahlen)"
                : erstattung
                  ? "Erstattung (vom Finanzamt)"
                  : "Keine Zahllast / Erstattung"}
            </span>
            <span
              className={cn(
                "tabular-nums font-mono text-sm font-bold text-right",
                zuZahlen && "text-destructive",
                erstattung && "text-green-600",
              )}
            >
              {formatElsterValue(ustva["83"])}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={() => copyValue("kz83", ustva["83"])}
              title="Wert kopieren"
              aria-label="Zahllast kopieren"
            >
              {copiedKey === "kz83" ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Alle Werte kopieren */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={copyAll} variant="default">
            {copiedKey === "ALL" ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copiedKey === "ALL" ? "Kopiert" : "Alle Werte kopieren"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Format: Punkt als Dezimaltrenner, ohne €. Direkt in ELSTER einfügbar.
          </p>
        </div>

        {/* Info-Hinweis ELSTER-Kennziffern */}
        <div className="rounded-md border bg-muted/40 p-3 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Die dargestellten Werte entsprechen den ELSTER-Kennziffern und können direkt in
            ELSTER übernommen werden.
          </p>
        </div>

        {/* Freigabe / Übermittlung */}
        {istAbgeschlossen && !istEingereicht && (
          <div className="border-t pt-4 space-y-3">
            {istFreigegeben && kannEingereichtMarkieren && (
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="elster-ref" className="text-xs">
                  Transferticket / ELSTER-Referenz (optional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="elster-ref"
                    value={referenz}
                    onChange={(e) => setReferenz(e.target.value)}
                    placeholder="z.B. et2026-xxxxxxxxxx"
                    className="max-w-sm"
                  />
                  <Button
                    onClick={handleEingereicht}
                    disabled={submittingEingereicht}
                    variant="default"
                  >
                    {submittingEingereicht ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Building2 className="h-4 w-4 mr-2" />
                    )}
                    Als beim Finanzamt eingereicht markieren
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {istEingereicht && (
          <div className="border-t pt-4 text-sm text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span>
              Beim Finanzamt eingereicht
              {finanzamtReferenz ? ` · Referenz: ${finanzamtReferenz}` : ""}.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
