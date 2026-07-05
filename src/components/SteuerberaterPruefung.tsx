import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  ClipboardCheck,
  Loader2,
  ArrowRight,
  Undo2,
  Info,
  Lock,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PdfVorschauTabs, type PdfVorschauItem } from "@/components/PdfVorschauTabs";

interface Props {
  abschlussId: string;
  buchhaltungId: string;
  pdfItems: PdfVorschauItem[];
  geprueft: Set<string>;
  onGeprueft: (key: string) => void;
  /** wird aufgerufen, sobald der Datenstand neu geladen werden soll */
  onChanged: () => void;
  /** Optional: direkte Freigabe durch Chef (überspringt Steuerberater-Schritt) */
  onDirectFreigabe?: () => Promise<void> | void;
}

export function SteuerberaterPruefung({
  abschlussId,
  buchhaltungId,
  pdfItems,
  geprueft,
  onGeprueft,
  onChanged,
  onDirectFreigabe,
}: Props) {
  const { rolle } = useAuth();
  const [bestaetigt, setBestaetigt] = useState(false);
  const [notiz, setNotiz] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rueckRueckOpen, setRueckOpen] = useState(false);
  const [rueckNotiz, setRueckNotiz] = useState("");
  const [rueckSubmitting, setRueckSubmitting] = useState(false);

  // Im Status „In Prüfung" hat heute praktisch der Chef die Prüf-Rolle.
  // Wir lassen Chef + Sachbearbeiter (anderer als der ursprüngliche Bearbeiter
  // wäre konzeptionell sauber, aktuell lassen wir beide zu) prüfen.
  const darfPruefen = rolle === "Chef" || rolle === "Sachbearbeiter";

  const allePdfsGesehen = geprueft.size >= pdfItems.length;
  const kannWeiterleiten = darfPruefen && allePdfsGesehen && bestaetigt;

  const aktuellerBenutzerId = async (): Promise<string | null> => {
    const userRes = await supabase.auth.getUser();
    const userId = userRes.data.user?.id;
    if (!userId) return null;
    const { data } = await supabase
      .from("benutzer")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.id ?? null;
  };

  const handleWeiterleiten = async () => {
    setSubmitting(true);
    try {
      const benutzerId = await aktuellerBenutzerId();
      const { error } = await supabase
        .from("buchhaltungs_abschluesse")
        .update({
          steuerberater_geprueft_am: new Date().toISOString(),
          steuerberater_geprueft_von: benutzerId,
          steuerberater_notiz: notiz.trim() || null,
        })
        .eq("id", abschlussId);
      if (error) throw error;
      // Chef: direkt im selben Schritt die Freigabe erteilen
      if (rolle === "Chef" && onDirectFreigabe) {
        await onDirectFreigabe();
      } else {
        toast({
          title: "✓ An Chef weitergeleitet",
          description: "Der Chef kann jetzt die finale ELSTER-Freigabe erteilen.",
        });
      }
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Aktion fehlgeschlagen", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleZurueck = async () => {
    if (!rueckNotiz.trim()) {
      toast({
        title: "Bitte Notiz eingeben",
        description: "Beschreiben Sie kurz, was korrigiert werden muss.",
        variant: "destructive",
      });
      return;
    }
    setRueckSubmitting(true);
    try {
      const { error } = await supabase
        .from("buchhaltungen")
        .update({
          status: "In Bearbeitung",
          notizen: `[Rückläufer Steuerberater] ${rueckNotiz.trim()}`,
        })
        .eq("id", buchhaltungId);
      if (error) throw error;
      toast({
        title: "An Sachbearbeiter zurückgegeben",
        description: 'Status wurde auf „In Bearbeitung“ gesetzt.',
      });
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Aktion fehlgeschlagen", description: msg, variant: "destructive" });
    } finally {
      setRueckSubmitting(false);
      setRueckOpen(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-start gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-foreground">
                {rolle === "Chef" ? "Finale Prüfung & ELSTER-Freigabe" : "Schritt 1 — Steuerberater-Prüfung"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {rolle === "Chef"
                  ? "Bitte prüfen Sie alle PDFs und geben Sie die Buchhaltung frei."
                  : "Fachliche Vorprüfung, bevor der Chef die ELSTER-Freigabe erteilt."}
              </p>
            </div>
          </div>
          {rolle !== "Chef" && (
            <Badge variant="outline" className="gap-1">
              <Info className="h-3 w-3" /> Vor Chef-Freigabe
            </Badge>
          )}
        </div>

        {/* Hinweisbox */}
        <div className="rounded-md border bg-card px-3 py-2 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p className="text-xs text-foreground">
            <strong>Bitte alle vier PDFs durchsehen</strong> — so wie sie an das Finanzamt
            übergeben werden. Kategorien, Beträge und USt-Werte fachlich prüfen.
          </p>
        </div>

        {/* PDF-Vorschau */}
        <PdfVorschauTabs
          items={pdfItems}
          geprueft={geprueft}
          onGeprueft={onGeprueft}
        />

        {darfPruefen ? (
          <>
            {/* Checkbox */}
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={bestaetigt}
                onCheckedChange={(v) => setBestaetigt(v === true)}
                className="mt-0.5"
                disabled={!allePdfsGesehen}
              />
              <span className="text-sm">
                {rolle === "Chef" ? "Ich habe alle PDFs geprüft und gebe die Buchhaltung zur ELSTER-Übermittlung frei." : "Ich habe alle PDFs fachlich geprüft — Buchungen, Kategorien und USt-Werte sind korrekt."}
              </span>
            </label>

            {/* Notiz – nur für Sachbearbeiter */}
            {rolle !== "Chef" && (
              <div className="space-y-1.5">
                <label htmlFor="sb-notiz" className="text-xs font-medium text-muted-foreground">
                  Anmerkungen für den Chef (optional)
                </label>
                <Textarea
                  id="sb-notiz"
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                  placeholder="z. B. Achtung: hohe Bewirtungskosten geprüft"
                  rows={2}
                />
              </div>
            )}

            {/* Aktionen */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!kannWeiterleiten || submitting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                {rolle === "Chef" ? "Geprüft & ELSTER-freigeben" : "An Chef zur Freigabe weiterleiten"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setRueckOpen(true)}
                disabled={submitting}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Zurück an Sachbearbeiter
              </Button>
            </div>

            {!allePdfsGesehen && (
              <p className="text-xs text-yellow-700 dark:text-yellow-500 flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                Bitte zuerst alle {pdfItems.length} PDFs in der Vorschau ansehen
                ({geprueft.size}/{pdfItems.length} geprüft).
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" />
            Diese Vorprüfung übernimmt der Steuerberater.
          </p>
        )}
      </CardContent>

      {/* Bestätigungsdialog Weiterleiten */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{rolle === "Chef" ? "Buchhaltung freigeben?" : "An Chef weiterleiten?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {rolle === "Chef"
                ? "Sie geben die Buchhaltung final frei — sie kann anschließend an ELSTER übermittelt werden."
                : "Sie bestätigen, dass die Buchhaltung fachlich korrekt ist. Der Chef erhält die Freigabe zur ELSTER-Übermittlung."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWeiterleiten}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? "Wird weitergeleitet…" : "Weiterleiten"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Zurück an Sachbearbeiter */}
      <AlertDialog open={rueckRueckOpen} onOpenChange={setRueckOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zurück an Sachbearbeiter?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Status wird auf „In Bearbeitung" zurückgesetzt. Bitte beschreiben Sie
              kurz, was korrigiert werden soll.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rueckNotiz}
            onChange={(e) => setRueckNotiz(e.target.value)}
            placeholder="z. B. KZ 81 zu hoch — Rechnung Weber Solutions doppelt erfasst"
            rows={3}
            className="my-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rueckSubmitting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleZurueck}
              disabled={rueckSubmitting || !rueckNotiz.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {rueckSubmitting ? "Wird zurückgegeben…" : "Zurückgeben"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
