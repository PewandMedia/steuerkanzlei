import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, CheckCircle2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { berechneSteuer, formatEuro, type BuchungInput, type SatzGruppe } from "@/lib/steuer-berechnung";
import { useBuchungsFortschritt } from "@/hooks/use-buchungs-fortschritt";
import type { Database } from "@/integrations/supabase/types";

type BuchhaltungStatus = Database["public"]["Enums"]["buchhaltung_status"];

interface Props {
  buchhaltungId: string;
  status: BuchhaltungStatus;
  refreshKey?: number;
}

function GruppenZeile({ g }: { g: SatzGruppe }) {
  if (g.count === 0) {
    return (
      <div className="flex items-baseline justify-between text-sm py-1 text-muted-foreground">
        <span className="font-medium w-12">{g.satz}%</span>
        <span className="italic">—</span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between text-sm py-1">
      <span className="font-medium text-foreground w-12">{g.satz}%</span>
      <div className="flex items-baseline gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">Netto {formatEuro(g.netto)}</span>
        <span className="text-foreground tabular-nums font-medium min-w-[100px] text-right">{formatEuro(g.brutto)}</span>
      </div>
    </div>
  );
}

export function SteuerUebersicht({ buchhaltungId, status, refreshKey }: Props) {
  const [buchungen, setBuchungen] = useState<BuchungInput[]>([]);
  const [loading, setLoading] = useState(true);
  const fortschritt = useBuchungsFortschritt(buchhaltungId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("buchungen")
        .select("betrag, mwst_satz, kategorie")
        .eq("buchhaltung_id", buchhaltungId);
      if (cancelled) return;
      setBuchungen((data ?? []) as BuchungInput[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [buchhaltungId, refreshKey]);

  const u = berechneSteuer(buchungen);
  const zuZahlen = u.zahllast > 0.005;
  const erstattung = u.zahllast < -0.005;
  const bereitZurAbgabe =
    fortschritt.allBooked && (status === "In Prüfung" || status === "Buchhaltung erledigt");

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Calculator className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Umsatzsteuer-Übersicht</h3>
          </div>
          {bereitZurAbgabe && (
            <Badge variant="default" className="bg-green-600 hover:bg-green-600/90 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Bereit zur Abgabe
            </Badge>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Lade …</p>
        ) : u.buchungenAnzahl === 0 ? (
          <p className="text-sm text-muted-foreground italic">Noch keine Buchungen erfasst.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Einnahmen */}
            <div className="rounded-md border bg-card p-3 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Einnahmen</p>
              </div>
              {u.einnahmen.gruppen.map((g) => <GruppenZeile key={`e-${g.satz}`} g={g} />)}
              <div className="border-t mt-2 pt-2 flex items-baseline justify-between">
                <span className="text-xs font-medium text-muted-foreground">Umsatzsteuer</span>
                <span className="text-sm font-bold text-foreground tabular-nums">{formatEuro(u.einnahmen.umsatzsteuerGesamt)}</span>
              </div>
            </div>

            {/* Ausgaben */}
            <div className="rounded-md border bg-card p-3 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-3.5 w-3.5 text-orange-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ausgaben</p>
              </div>
              {u.ausgaben.gruppen.map((g) => <GruppenZeile key={`a-${g.satz}`} g={g} />)}
              <div className="border-t mt-2 pt-2 flex items-baseline justify-between">
                <span className="text-xs font-medium text-muted-foreground">Vorsteuer</span>
                <span className="text-sm font-bold text-foreground tabular-nums">{formatEuro(u.ausgaben.vorsteuerGesamt)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Zahllast */}
        {u.buchungenAnzahl > 0 && (
          <div
            className={cn(
              "rounded-md border-2 p-4 flex items-center justify-between",
              zuZahlen && "border-destructive/40 bg-destructive/5",
              erstattung && "border-green-600/40 bg-green-600/5",
              !zuZahlen && !erstattung && "border-muted bg-muted/30",
            )}
          >
            <div className="flex items-center gap-2">
              {zuZahlen && <TrendingUp className="h-5 w-5 text-destructive" />}
              {erstattung && <TrendingDown className="h-5 w-5 text-green-600" />}
              {!zuZahlen && !erstattung && <Minus className="h-5 w-5 text-muted-foreground" />}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {zuZahlen ? "Zahllast (zu zahlen)" : erstattung ? "Erstattung" : "Zahllast"}
                </p>
                <p className="text-[11px] text-muted-foreground">USt − Vorsteuer</p>
              </div>
            </div>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                zuZahlen && "text-destructive",
                erstattung && "text-green-600",
                !zuZahlen && !erstattung && "text-muted-foreground",
              )}
            >
              {erstattung ? "−" : zuZahlen ? "+" : ""}
              {formatEuro(Math.abs(u.zahllast))}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
