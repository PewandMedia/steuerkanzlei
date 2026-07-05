import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Lock,
  Loader2,
  FileText,
  Receipt,
  Building2,
  AlertCircle,
  Eye,
  RefreshCw,
} from "lucide-react";
import { downloadFromStorage, openFromStorage } from "@/lib/pdf-download";
import {
  berechneSteuer,
  formatEuro,
  type BuchungInput,
} from "@/lib/steuer-berechnung";
import {
  erstelleSuSa,
  erstelleUStVA,
  elsterCsvExport,
  type BuchungInput as BuchungVoll,
} from "@/lib/buchhaltung-erstellung";
import { ElsterUebergabe } from "@/components/ElsterUebergabe";
import { useBuchungsFortschritt } from "@/hooks/use-buchungs-fortschritt";
import { DokumenteUpload } from "@/components/DokumenteUpload";
import { PdfVorschauTabs, type PdfVorschauItem } from "@/components/PdfVorschauTabs";
import { SteuerberaterPruefung } from "@/components/SteuerberaterPruefung";
import { Info } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type BuchhaltungStatus = Database["public"]["Enums"]["buchhaltung_status"];

interface Props {
  buchhaltungId: string;
  status: BuchhaltungStatus;
  monat: string;
  mandantName: string;
  refreshKey?: number;
  onChanged?: () => void;
}

interface AbschlussRow {
  id: string;
  erstellt_am: string;
  journal_pdf_pfad: string | null;
  susa_pdf_pfad: string | null;
  ustva_pdf_pfad: string | null;
  paket_pdf_pfad: string | null;
  ustva_kennziffern: Record<string, number>;
  freigegeben_am: string | null;
  finanzamt_eingereicht_am: string | null;
  finanzamt_referenz: string | null;
  steuerberater_geprueft_am: string | null;
  steuerberater_geprueft_von: string | null;
  steuerberater_notiz: string | null;
  steuerberater?: { name: string } | null;
}

export function BuchhaltungsPaket({
  buchhaltungId,
  status,
  monat,
  mandantName,
  refreshKey,
  onChanged,
}: Props) {
  const { rolle } = useAuth();
  const [buchungen, setBuchungen] = useState<BuchungVoll[]>([]);
  const [abschluss, setAbschluss] = useState<AbschlussRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [abschliessen, setAbschliessen] = useState(false);
  const [confirmAbschluss, setConfirmAbschluss] = useState(false);
  const fortschritt = useBuchungsFortschritt(buchhaltungId);
  const [pdfsGeprueft, setPdfsGeprueft] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: buch }, { data: abs }] = await Promise.all([
      supabase
        .from("buchungen")
        .select("id, buchungsdatum, lieferant, konto, kategorie, betrag, beschreibung, mwst_satz, dokument_id")
        .eq("buchhaltung_id", buchhaltungId),
      supabase
        .from("buchhaltungs_abschluesse")
        .select("id, erstellt_am, journal_pdf_pfad, susa_pdf_pfad, ustva_pdf_pfad, paket_pdf_pfad, ustva_kennziffern, freigegeben_am, finanzamt_eingereicht_am, finanzamt_referenz, steuerberater_geprueft_am, steuerberater_geprueft_von, steuerberater_notiz")
        .eq("buchhaltung_id", buchhaltungId)
        .maybeSingle(),
    ]);
    setBuchungen((buch ?? []) as BuchungVoll[]);
    setAbschluss(abs as AbschlussRow | null);
    setLoading(false);
  }, [buchhaltungId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Reset Vorschau-Häkchen, wenn sich der Abschluss ändert (z. B. neu erzeugt)
  useEffect(() => {
    setPdfsGeprueft(new Set());
  }, [refreshKey, buchhaltungId]);

  // Live-Berechnung
  const bSimple: BuchungInput[] = buchungen.map((b) => ({
    betrag: b.betrag,
    mwst_satz: b.mwst_satz,
    kategorie: b.kategorie,
  }));
  const uebersicht = berechneSteuer(bSimple);
  const susa = erstelleSuSa(buchungen);
  const ustva = erstelleUStVA(buchungen);

  const istAbgeschlossen = !!abschluss;
  const istErledigt = status === "Buchhaltung erledigt";
  const istFreigegeben = !!abschluss?.freigegeben_am || istErledigt;
  const istEingereicht = !!abschluss?.finanzamt_eingereicht_am;
  const istSteuerberaterGeprueft = !!abschluss?.steuerberater_geprueft_am;

  // Karte A (Steuerberater-Prüfung) sichtbar im Status „In Prüfung", solange noch
  // keine Vorprüfung vorliegt und noch nicht freigegeben/eingereicht.
  const zeigeSteuerberaterKarte =
    rolle !== "Chef" &&
    istAbgeschlossen &&
    !istSteuerberaterGeprueft &&
    !istFreigegeben &&
    !istEingereicht;

  // Karte B (ELSTER-Übergabe): Sachbearbeiter erst NACH Steuerberater-Prüfung,
  // Chef sieht sie immer (er prüft & gibt direkt im ELSTER-Bereich frei).
  const zeigeElsterKarte =
    rolle === "Chef" ||
    !istAbgeschlossen ||
    istSteuerberaterGeprueft ||
    istFreigegeben ||
    istEingereicht;

  const kannAbschliessen =
    rolle && (rolle === "Sachbearbeiter" || rolle === "Chef") &&
    status === "In Bearbeitung" &&
    fortschritt.allBooked &&
    fortschritt.total > 0;

  const kannEingereichtMarkieren =
    (rolle === "Chef" || rolle === "Sekretariat") &&
    status === "Buchhaltung erledigt" &&
    istFreigegeben;

  const handleAbschliessen = async () => {
    setAbschliessen(true);
    try {
      const { data, error } = await supabase.functions.invoke("buchhaltung-abschliessen", {
        body: { buchhaltungId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: "✓ Buchhaltung erstellt",
        description: "Das Buchhaltungs-Paket (Journal · SuSa · UStVA) liegt zur Freigabe beim Chef und ist im Menü „Erstellte Buchhaltungen“ verfügbar.",
      });
      await load();
      onChanged?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Abschluss fehlgeschlagen", description: msg, variant: "destructive" });
    } finally {
      setAbschliessen(false);
      setConfirmAbschluss(false);
    }
  };

  // handleEingereicht wird inline an ElsterUebergabe übergeben


  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const fileNameFor = (label: string) =>
    `${label}_${mandantName}_${monat}.pdf`.replace(/[^\w.-]+/g, "_");

  const downloadPdf = async (pfad: string | null, label: string) => {
    if (!pfad) return;
    const key = `dl:${label}`;
    setPdfBusy(key);
    try {
      await downloadFromStorage("buchhaltungen", pfad, fileNameFor(label));
    } catch (e: any) {
      toast({ title: "Download fehlgeschlagen", description: e?.message, variant: "destructive" });
    } finally {
      setPdfBusy(null);
    }
  };

  const openPdf = async (pfad: string | null, label: string) => {
    if (!pfad) return;
    const key = `open:${label}`;
    setPdfBusy(key);
    try {
      await openFromStorage("buchhaltungen", pfad);
    } catch (e: any) {
      toast({ title: "Öffnen fehlgeschlagen", description: e?.message, variant: "destructive" });
    } finally {
      setPdfBusy(null);
    }
  };

  const downloadElsterCsv = () => {
    if (!abschluss) return;
    const csv = elsterCsvExport(abschluss.ustva_kennziffern as any, monat, mandantName);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `UStVA_ELSTER_${mandantName}_${monat}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade Buchhaltung …
        </CardContent>
      </Card>
    );
  }

  const zuZahlen = ustva["83"] > 0.005;
  const erstattung = ustva["83"] < -0.005;

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Buchhaltungs-Paket</h3>
            {istEingereicht && (
              <Badge variant="default" className="bg-blue-600 hover:bg-blue-600/90 gap-1">
                <Building2 className="h-3 w-3" /> Beim Finanzamt eingereicht
              </Badge>
            )}
            {!istEingereicht && istFreigegeben && (
              <Badge variant="default" className="bg-green-600 hover:bg-green-600/90 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Erledigt
              </Badge>
            )}
            {!istFreigegeben && istAbgeschlossen && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> Wartet auf Erledigt
              </Badge>
            )}
          </div>
        </div>

        {/* Beleg-Nachreichen für Sekretariat/Chef — auch bei laufenden/abgeschlossenen Buchhaltungen */}
        {(rolle === "Sekretariat" || rolle === "Chef") && (
          <div className="space-y-2 rounded-md border bg-card p-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Belege hochladen
              </p>
            </div>
            {status !== "Eingegangen" && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2.5 text-xs text-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-yellow-700 dark:text-yellow-500" />
                <span>
                  <strong>Beleg nachreichen</strong> — Der Sachbearbeiter wird benachrichtigt und kann den Beleg im Nachgang erfassen.
                </span>
              </div>
            )}
            <DokumenteUpload buchhaltungId={buchhaltungId} onUploaded={() => onChanged?.()} />
          </div>
        )}

        {buchungen.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Noch keine Buchungen erfasst.</p>
        ) : (
          <>
            {/* Karte A — Steuerberater-Vorprüfung (Status „In Prüfung") */}
            {zeigeSteuerberaterKarte && abschluss && (
              <SteuerberaterPruefung
                abschlussId={abschluss.id}
                buchhaltungId={buchhaltungId}
                pdfItems={[
                  { key: "paket", label: "Komplett-Paket", pfad: abschluss.paket_pdf_pfad, icon: "paket" },
                  { key: "ustva", label: "UStVA", pfad: abschluss.ustva_pdf_pfad, icon: "ustva" },
                  { key: "susa", label: "SuSa", pfad: abschluss.susa_pdf_pfad, icon: "susa" },
                  { key: "journal", label: "Journal", pfad: abschluss.journal_pdf_pfad, icon: "journal" },
                ] satisfies PdfVorschauItem[]}
                geprueft={pdfsGeprueft}
                onGeprueft={(k) =>
                  setPdfsGeprueft((prev) => {
                    if (prev.has(k)) return prev;
                    const next = new Set(prev);
                    next.add(k);
                    return next;
                  })
                }
                onChanged={() => {
                  load();
                  onChanged?.();
                }}
              />
            )}

            {/* Layout: SuSa links, ELSTER-Übergabe rechts (Karte B nur wenn freigeschaltet) */}
            {zeigeElsterKarte && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
              <div className="lg:col-span-2 rounded-md border bg-card p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Summen-Salden-Liste
                </p>
                <div className="space-y-2 max-h-56 overflow-auto">
                  {susa.konten.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Keine Daten</p>
                  )}
                  {susa.konten.map((k) => (
                    <div key={`${k.kategorie}-${k.konto}`} className="flex items-baseline justify-between text-xs">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full shrink-0",
                          k.kategorie === "Einnahme" ? "bg-green-600" : "bg-orange-500"
                        )} />
                        <span className="truncate text-foreground">{k.konto}</span>
                        <span className="text-muted-foreground">({k.buchungen_anzahl})</span>
                      </span>
                      <span className="tabular-nums font-medium">{formatEuro(k.netto)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t mt-2 pt-2 space-y-0.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Einnahmen netto</span><span className="tabular-nums font-medium text-green-600">{formatEuro(susa.summe_einnahmen_netto)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Ausgaben netto</span><span className="tabular-nums font-medium text-orange-600">{formatEuro(susa.summe_ausgaben_netto)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">EÜR-Ergebnis</span><span className={cn("tabular-nums font-bold", susa.ergebnis >= 0 ? "text-green-600" : "text-destructive")}>{formatEuro(susa.ergebnis)}</span></div>
                </div>
              </div>

              <div className="lg:col-span-3">
                <ElsterUebergabe
                  mandantName={mandantName}
                  monat={monat}
                  ustva={ustva}
                  buchungen={buchungen}
                  fortschritt={fortschritt}
                  istAbgeschlossen={istAbgeschlossen}
                  istFreigegeben={istFreigegeben}
                  istEingereicht={istEingereicht}
                  kannEingereichtMarkieren={kannEingereichtMarkieren}
                  finanzamtReferenz={abschluss?.finanzamt_referenz ?? null}
                  steuerberaterGeprueft={istSteuerberaterGeprueft}
                  steuerberaterInfo={
                    abschluss && abschluss.steuerberater_geprueft_am
                      ? {
                          am: abschluss.steuerberater_geprueft_am,
                          notiz: abschluss.steuerberater_notiz,
                        }
                      : null
                  }
                  onEingereicht={async (referenz) => {
                    if (!abschluss) return;
                    const today = new Date().toISOString().split("T")[0];
                    const { error: e1 } = await supabase
                      .from("buchhaltungs_abschluesse")
                      .update({
                        finanzamt_eingereicht_am: today,
                        finanzamt_referenz: referenz || null,
                      })
                      .eq("id", abschluss.id);
                    const { error: e2 } = await supabase
                      .from("buchhaltungen")
                      .update({ status: "Buchhaltung erledigt", abgabe_datum: today })
                      .eq("id", buchhaltungId);
                    if (e1 || e2) {
                      toast({ title: "Fehler", description: (e1 || e2)?.message, variant: "destructive" });
                    } else {
                      toast({ title: "Beim Finanzamt eingereicht" });
                      await load();
                      onChanged?.();
                    }
                  }}
                />
              </div>
            </div>
            )}

            {/* Aktionen */}
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              {/* Sachbearbeiter: Buchhaltung abschließen */}
              {!istAbgeschlossen && status === "In Bearbeitung" && (
                <>
                  {kannAbschliessen ? (
                    <Button
                      onClick={() => setConfirmAbschluss(true)}
                      disabled={abschliessen}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {abschliessen ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                      Buchhaltung abschließen & zur Freigabe einreichen
                    </Button>
                  ) : fortschritt.total === 0 ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Erst Belege hochladen und buchen.
                    </p>
                  ) : !fortschritt.allBooked ? (
                    <p className="text-xs text-orange-600 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Noch {fortschritt.offen} von {fortschritt.total} Belegen offen.
                    </p>
                  ) : null}
                </>
              )}

              {/* Wenn Abschluss existiert: Download-Buttons */}
              {istAbgeschlossen && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Komplett-Paket", pfad: abschluss?.paket_pdf_pfad ?? null, icon: Download },
                      { label: "UStVA", pfad: abschluss?.ustva_pdf_pfad ?? null, icon: Receipt },
                      { label: "SuSa", pfad: abschluss?.susa_pdf_pfad ?? null, icon: FileText },
                      { label: "Journal", pfad: abschluss?.journal_pdf_pfad ?? null, icon: FileText },
                    ].map(({ label, pfad, icon: Icon }) => {
                      const dlBusy = pdfBusy === `dl:${label}`;
                      const opBusy = pdfBusy === `open:${label}`;
                      return (
                        <div key={label} className="inline-flex rounded-md border bg-background overflow-hidden">
                          <button
                            type="button"
                            onClick={() => downloadPdf(pfad, label)}
                            disabled={!pfad || dlBusy || opBusy}
                            className="inline-flex items-center gap-1 px-2.5 h-9 text-sm hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {dlBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                            {label}
                          </button>
                          <button
                            type="button"
                            onClick={() => openPdf(pfad, label)}
                            disabled={!pfad || dlBusy || opBusy}
                            title="In neuem Tab öffnen"
                            aria-label={`${label} in neuem Tab öffnen`}
                            className="inline-flex items-center justify-center w-9 h-9 border-l hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {opBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                    {istFreigegeben && (
                      <Button size="sm" variant="outline" onClick={downloadElsterCsv}>
                        <Download className="h-3.5 w-3.5 mr-1" /> ELSTER-CSV
                      </Button>
                    )}
                    {!istFreigegeben && !istEingereicht && kannAbschliessen !== null && (rolle === "Sachbearbeiter" || rolle === "Chef") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmAbschluss(true)}
                        disabled={abschliessen}
                        title="Paket mit aktuellen Buchungen neu erzeugen (z. B. nach Duplikat-Bereinigung)"
                      >
                        {abschliessen ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                        Paket neu erzeugen
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>

            {abschluss && (
              <p className="text-[11px] text-muted-foreground">
                Abgeschlossen am {new Date(abschluss.erstellt_am).toLocaleString("de-DE")}
                {abschluss.freigegeben_am && ` · Erledigt am ${new Date(abschluss.freigegeben_am).toLocaleString("de-DE")}`}
                {abschluss.finanzamt_eingereicht_am && ` · Eingereicht am ${new Date(abschluss.finanzamt_eingereicht_am).toLocaleDateString("de-DE")}`}
              </p>
            )}
          </>
        )}
      </CardContent>

      {/* Bestätigungsdialoge */}
      <AlertDialog open={confirmAbschluss} onOpenChange={setConfirmAbschluss}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buchhaltung abschließen?</AlertDialogTitle>
            <AlertDialogDescription>
              Es wird ein <strong>finales Buchhaltungs-Paket</strong> erzeugt (Journal, SuSa, UStVA, Beleg-Verzeichnis als PDF) und an den Chef zur Freigabe übermittelt.
              <br /><br />
              Mandant: <strong>{mandantName}</strong> · Zeitraum: <strong>{monat}</strong>
              <br />
              Buchungen: <strong>{uebersicht.buchungenAnzahl}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={abschliessen}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleAbschliessen} disabled={abschliessen} className="bg-green-600 hover:bg-green-700">
              {abschliessen ? "Wird abgeschlossen…" : "Abschließen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
