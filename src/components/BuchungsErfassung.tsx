import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { KONTEN, KONTEN_BY_KATEGORIE, formatEuro, type Kategorie } from "@/lib/konten";
import { Loader2, AlertTriangle, ChevronRight, FileText, Save, History, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PdfViewer } from "./PdfViewer";

interface OcrData {
  betrag?: number;
  netto_betrag?: number;
  mwst_betrag?: number;
  buchungsdatum?: string;
  lieferant?: string;
  mwst_satz?: number;
  kategorie?: Kategorie;
  beschreibung?: string;
  konto?: string;
  konfidenz?: "hoch" | "mittel" | "niedrig";
}

type AiFields = Partial<Record<"betrag" | "netto" | "mwst_betrag" | "buchungsdatum" | "lieferant" | "mwst_satz" | "kategorie" | "beschreibung" | "konto", true>>;

interface Dokument {
  id: string;
  dateiname: string;
  dateipfad: string;
}

interface ExistingBuchung {
  id: string;
  betrag: number;
  buchungsdatum: string;
  kategorie: Kategorie;
  konto: string;
  beschreibung: string;
  lieferant: string | null;
  mwst_satz: number;
  erstellt_am: string;
  geaendert_am: string | null;
  ersteller: { name: string } | null;
  aenderer: { name: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buchhaltungId: string;
  mandantId: string;
  dokumente: Dokument[];
  startDokumentId: string | null;
  /** Optional: edit an existing booking directly (e.g. manual booking without document) */
  editBuchungId?: string | null;
  onSaved: (info?: { dokumentId: string | null; deleted?: boolean }) => void;
  /** Render only the form (no Dialog wrapper, no PDF preview) — for embedding in BelegeVollansicht */
  embedded?: boolean;
  /** When embedded: external doc index controlled by parent */
  embeddedDocIndex?: number;
  /** When embedded: notify parent to navigate to a specific doc index after Save & Next */
  onRequestDocIndex?: (index: number) => void;
  /** Enable AI document recognition (OCR). Default: false (manual mode) */
  automationEnabled?: boolean;
}

export function BuchungsErfassung({
  open,
  onOpenChange,
  buchhaltungId,
  mandantId,
  dokumente,
  startDokumentId,
  editBuchungId = null,
  onSaved,
  embedded = false,
  embeddedDocIndex,
  onRequestDocIndex,
  automationEnabled = false,
}: Props) {
  const { benutzerId } = useAuth();
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [existingBuchung, setExistingBuchung] = useState<ExistingBuchung | null>(null);
  const [saving, setSaving] = useState(false);
  const [totals, setTotals] = useState<{ einnahmen: number; ausgaben: number; saldo: number; count: number }>({ einnahmen: 0, ausgaben: 0, saldo: 0, count: 0 });
  const blobUrlRef = useRef<string | null>(null);

  // Form state
  const [netto, setNetto] = useState("");
  const [mwstBetrag, setMwstBetrag] = useState("");
  const [buchungsdatum, setBuchungsdatum] = useState(new Date().toISOString().slice(0, 10));
  const [kategorie, setKategorie] = useState<Kategorie>("Ausgabe");
  const [konto, setKonto] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [lieferant, setLieferant] = useState("");
  const [mwstSatz, setMwstSatz] = useState("19");

  // Derived: brutto = netto + mwstBetrag (read-only display)
  const nettoNum = parseFloat(netto);
  const mwstNum = parseFloat(mwstBetrag);
  const bruttoNum = (isNaN(nettoNum) ? 0 : nettoNum) + (isNaN(mwstNum) ? 0 : mwstNum);

  // Round helper to 2 decimals
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // When netto changes manually → recompute mwstBetrag from current rate
  const handleNettoChange = (val: string) => {
    setNetto(val);
    clearAiField("netto");
    const n = parseFloat(val);
    const s = parseFloat(mwstSatz);
    if (!isNaN(n) && !isNaN(s)) {
      setMwstBetrag(s === 0 ? "0" : String(round2(n * s / 100)));
      clearAiField("mwst_betrag");
    }
  };

  // When user types mwstBetrag manually → derive matching satz from netto (snap to 0/7/19)
  const handleMwstBetragChange = (val: string) => {
    setMwstBetrag(val);
    clearAiField("mwst_betrag");
    const m = parseFloat(val);
    const n = parseFloat(netto);
    if (!isNaN(m) && !isNaN(n) && n > 0) {
      const ratio = (m / n) * 100;
      const allowed = [0, 7, 19];
      const closest = allowed.reduce((p, c) => Math.abs(c - ratio) < Math.abs(p - ratio) ? c : p);
      setMwstSatz(String(closest));
      clearAiField("mwst_satz");
    } else if (!isNaN(m) && m === 0) {
      setMwstSatz("0");
    }
  };

  // When satz changes → recompute mwstBetrag from netto
  const handleMwstSatzChange = (newSatz: string) => {
    setMwstSatz(newSatz);
    clearAiField("mwst_satz");
    const n = parseFloat(netto);
    const s = parseFloat(newSatz);
    if (!isNaN(n) && !isNaN(s)) {
      setMwstBetrag(s === 0 ? "0" : String(round2(n * s / 100)));
    }
  };

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrKonfidenz, setOcrKonfidenz] = useState<"hoch" | "mittel" | "niedrig" | null>(null);
  const [aiFields, setAiFields] = useState<AiFields>({});

  // Mandant context for OCR (to detect Einnahme vs Ausgabe based on whether Mandant is issuer or recipient)
  const [mandantInfo, setMandantInfo] = useState<{ name: string | null; firma: string | null }>({ name: null, firma: null });

  useEffect(() => {
    if (!mandantId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("mandanten")
        .select("name, firma")
        .eq("id", mandantId)
        .maybeSingle();
      if (!cancelled && data) {
        setMandantInfo({ name: data.name ?? null, firma: data.firma ?? null });
      }
    })();
    return () => { cancelled = true; };
  }, [mandantId]);

  const currentDoc = dokumente[currentDocIndex] ?? null;
  const isManualMode = !currentDoc && (editBuchungId !== null || dokumente.length === 0);

  const cleanupBlob = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  const clearAiField = (field: keyof AiFields) => {
    setAiFields((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const applyOcrData = (ocr: OcrData) => {
    const used: AiFields = {};
    // Determine MwSt rate first (needed for derivations)
    const satz = typeof ocr.mwst_satz === "number" ? ocr.mwst_satz : 19;
    if (typeof ocr.mwst_satz === "number") {
      setMwstSatz(String(ocr.mwst_satz));
      used.mwst_satz = true;
    }
    // Prefer explicit netto + mwst from receipt (no drift)
    const hasNetto = typeof ocr.netto_betrag === "number" && ocr.netto_betrag > 0;
    const hasMwst = typeof ocr.mwst_betrag === "number" && ocr.mwst_betrag >= 0;
    if (hasNetto && hasMwst) {
      setNetto(String(ocr.netto_betrag));
      setMwstBetrag(String(ocr.mwst_betrag));
      used.netto = true;
      used.mwst_betrag = true;
    } else if (hasNetto) {
      setNetto(String(ocr.netto_betrag));
      const m = satz === 0 ? 0 : round2((ocr.netto_betrag as number) * satz / 100);
      setMwstBetrag(String(m));
      used.netto = true;
    } else if (typeof ocr.betrag === "number" && ocr.betrag > 0) {
      // Fallback: derive netto from brutto + satz
      const n = satz === 0 ? ocr.betrag : round2(ocr.betrag / (1 + satz / 100));
      const m = round2(ocr.betrag - n);
      setNetto(String(n));
      setMwstBetrag(String(m));
      used.betrag = true;
    }
    if (ocr.buchungsdatum) {
      setBuchungsdatum(ocr.buchungsdatum);
      used.buchungsdatum = true;
    }
    if (ocr.lieferant) {
      setLieferant(ocr.lieferant);
      used.lieferant = true;
    }
    const effektiveKategorie: Kategorie = ocr.kategorie ?? "Ausgabe";
    if (ocr.kategorie) {
      setKategorie(ocr.kategorie);
      used.kategorie = true;
    }
    if (ocr.beschreibung) {
      setBeschreibung(ocr.beschreibung);
      used.beschreibung = true;
    }
    // Konto nur setzen wenn in der Liste der gültigen Konten für die Kategorie
    if (ocr.konto) {
      const validKonten = KONTEN_BY_KATEGORIE(effektiveKategorie);
      if (validKonten.find((k) => k.name === ocr.konto)) {
        setKonto(ocr.konto);
        used.konto = true;
      }
    }
    setAiFields(used);
    setOcrKonfidenz(ocr.konfidenz ?? null);
  };

  const runOcr = async (force: boolean) => {
    if (!currentDoc) return;
    setOcrLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("beleg-ocr", {
        body: {
          dokument_id: currentDoc.id,
          force,
          mandant_name: mandantInfo.name,
          mandant_firma: mandantInfo.firma,
        },
      });
      if (error) {
        const ctx = (error as { context?: { body?: string } }).context;
        let serverMsg: string | undefined;
        try {
          if (ctx?.body) serverMsg = JSON.parse(ctx.body)?.error;
        } catch { /* noop */ }
        toast({
          title: "Belegerkennung fehlgeschlagen",
          description: serverMsg ?? error.message,
          variant: "destructive",
        });
        return;
      }
      if (data?.data) {
        applyOcrData(data.data as OcrData);
        if (!data.cached) toast({ title: "Beleg automatisch ausgelesen ✨" });
      }
    } catch (e) {
      toast({
        title: "Belegerkennung fehlgeschlagen",
        description: e instanceof Error ? e.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setOcrLoading(false);
    }
  };

  // Init start index when opening
  useEffect(() => {
    if (embedded) return; // parent controls index in embedded mode
    if (open && startDokumentId) {
      const idx = dokumente.findIndex((d) => d.id === startDokumentId);
      setCurrentDocIndex(idx >= 0 ? idx : 0);
    } else if (open) {
      setCurrentDocIndex(0);
    }
    if (!open) {
      cleanupBlob();
      setPreviewBlobUrl(null);
    }
  }, [open, startDokumentId, dokumente, embedded]);

  // Embedded mode: sync from parent-controlled index
  useEffect(() => {
    if (!embedded) return;
    if (typeof embeddedDocIndex === "number") {
      setCurrentDocIndex(embeddedDocIndex);
    }
  }, [embedded, embeddedDocIndex]);

  // Cleanup on unmount
  useEffect(() => () => cleanupBlob(), []);

  // Load totals for this Buchhaltung (refresh after each save)
  const loadTotals = async () => {
    const { data } = await supabase
      .from("buchungen")
      .select("betrag, kategorie")
      .eq("buchhaltung_id", buchhaltungId);
    const rows = (data ?? []) as { betrag: number; kategorie: string }[];
    const einnahmen = rows.filter((r) => r.kategorie === "Einnahme").reduce((a, r) => a + Number(r.betrag), 0);
    const ausgaben = rows.filter((r) => r.kategorie === "Ausgabe").reduce((a, r) => a + Number(r.betrag), 0);
    setTotals({ einnahmen, ausgaben, saldo: einnahmen - ausgaben, count: rows.length });
  };

  useEffect(() => {
    if (open || embedded) loadTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, buchhaltungId, embedded]);

  // Load preview + existing buchung when doc changes OR editBuchungId set
  useEffect(() => {
    if (!open && !embedded) return;
    let cancelled = false;

    const resetForm = () => {
      setNetto("");
      setMwstBetrag("");
      setBuchungsdatum(new Date().toISOString().slice(0, 10));
      setKategorie("Ausgabe");
      setKonto("");
      setBeschreibung("");
      setLieferant("");
      setMwstSatz("19");
    };

    const applyExisting = (e: ExistingBuchung) => {
      setExistingBuchung(e);
      // DB stores brutto + satz; derive netto + mwst for the UI
      const brutto = Number(e.betrag);
      const s = Number(e.mwst_satz);
      const n = s === 0 ? brutto : round2(brutto / (1 + s / 100));
      const m = round2(brutto - n);
      setNetto(String(n));
      setMwstBetrag(String(m));
      setBuchungsdatum(e.buchungsdatum);
      setKategorie(e.kategorie);
      setKonto(e.konto);
      setBeschreibung(e.beschreibung);
      setLieferant(e.lieferant ?? "");
      setMwstSatz(String(e.mwst_satz));
    };

    const load = async () => {
      cleanupBlob();
      setPreviewBlobUrl(null);
      setOcrKonfidenz(null);
      setAiFields({});

      // Mode A: edit existing booking by ID (manual or via list)
      if (editBuchungId) {
        const { data: existing } = await supabase
          .from("buchungen")
          .select("id, betrag, buchungsdatum, kategorie, konto, beschreibung, lieferant, mwst_satz, erstellt_am, geaendert_am, ersteller:benutzer!buchungen_erstellt_von_fkey(name), aenderer:benutzer!buchungen_geaendert_von_fkey(name)")
          .eq("id", editBuchungId)
          .maybeSingle();
        if (cancelled) return;
        if (existing) applyExisting(existing as unknown as ExistingBuchung);
        return;
      }

      // Mode B: manual new booking (no document)
      if (!currentDoc) {
        setExistingBuchung(null);
        resetForm();
        return;
      }

      // Mode C: document-based — load PDF + existing booking + OCR cache for this doc
      setLoadingPreview(true);
      try {
        const { data } = await supabase.storage.from("belege").createSignedUrl(currentDoc.dateipfad, 300);
        if (data?.signedUrl) {
          const res = await fetch(data.signedUrl);
          const blob = await res.blob();
          const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
          const url = URL.createObjectURL(pdfBlob);
          if (!cancelled) {
            blobUrlRef.current = url;
            setPreviewBlobUrl(url);
          }
        }
      } catch {
        /* noop */
      }
      if (!cancelled) setLoadingPreview(false);

      const [{ data: existing }, { data: docMeta }] = await Promise.all([
        supabase
          .from("buchungen")
          .select("id, betrag, buchungsdatum, kategorie, konto, beschreibung, lieferant, mwst_satz, erstellt_am, geaendert_am, ersteller:benutzer!buchungen_erstellt_von_fkey(name), aenderer:benutzer!buchungen_geaendert_von_fkey(name)")
          .eq("dokument_id", currentDoc.id)
          .maybeSingle(),
        supabase
          .from("buchhaltung_dokumente")
          .select("ocr_data, ocr_status")
          .eq("id", currentDoc.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (existing) {
        applyExisting(existing as unknown as ExistingBuchung);
        return;
      }

      setExistingBuchung(null);
      resetForm();

      // OCR: use cache if available, else auto-trigger in background
      const cached = (docMeta?.ocr_data ?? null) as OcrData | null;
      if (automationEnabled) {
        if (cached && docMeta?.ocr_status === "done") {
          applyOcrData(cached);
        } else {
          runOcr(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentDoc, editBuchungId]);

  // Auto-suggest based on lieferant when user types
  const handleLieferantBlur = async () => {
    if (!lieferant.trim() || existingBuchung) return;
    if (konto && netto) return; // user already filled
    const { data } = await supabase
      .from("buchungen")
      .select("kategorie, konto, beschreibung, mwst_satz")
      .eq("mandant_id", mandantId)
      .ilike("lieferant", lieferant.trim())
      .order("erstellt_am", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      if (!konto) setKonto(data.konto);
      setKategorie(data.kategorie as Kategorie);
      setMwstSatz(String(data.mwst_satz));
      if (!beschreibung) setBeschreibung(data.beschreibung);
      toast({ title: "Vorschlag übernommen", description: `Basierend auf vorheriger Buchung für ${lieferant}.` });
    }
  };

  // Plausibility warnings
  const warnings = useMemo(() => {
    const w: string[] = [];
    if (!isNaN(bruttoNum) && bruttoNum > 10000) {
      w.push("Ungewöhnlich hoher Betrag — bitte prüfen.");
    }
    if (buchungsdatum) {
      const bd = new Date(buchungsdatum);
      const now = new Date();
      if (bd > now) w.push("Buchungsdatum liegt in der Zukunft.");
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (bd < oneYearAgo) w.push("Buchungsdatum ist mehr als ein Jahr alt.");
    }
    if (kategorie === "Ausgabe" && !lieferant.trim()) {
      w.push("Kein Lieferant angegeben.");
    }
    return w;
  }, [bruttoNum, buchungsdatum, kategorie, lieferant]);

  const kontoOptions = KONTEN_BY_KATEGORIE(kategorie);

  const handleKategorieChange = (k: Kategorie) => {
    setKategorie(k);
    // Reset konto if not in new category
    if (konto && !KONTEN_BY_KATEGORIE(k).find((kk) => kk.name === konto)) {
      setKonto("");
    }
  };

  const handleKontoChange = (k: string) => {
    setKonto(k);
    const kontoObj = KONTEN.find((kk) => kk.name === k);
    if (kontoObj && !existingBuchung) {
      setMwstSatz(String(kontoObj.defaultMwst));
    }
  };

  const validate = (): string | null => {
    const n = parseFloat(netto);
    if (isNaN(n) || n <= 0) return "Bitte einen gültigen Netto-Betrag eingeben.";
    const m = parseFloat(mwstBetrag);
    if (isNaN(m) || m < 0) return "Bitte einen gültigen MwSt-Betrag eingeben.";
    if (!buchungsdatum) return "Bitte ein Buchungsdatum eingeben.";
    if (!konto) return "Bitte ein Konto auswählen.";
    return null;
  };

  const save = async (gotoNext: boolean) => {
    // Saving-Lock: prevent double/triple clicks (e.g. "Save & next") from inserting duplicates
    if (saving) return;
    const err = validate();
    if (err) {
      toast({ title: "Eingabe unvollständig", description: err, variant: "destructive" });
      return;
    }
    if (!benutzerId) return;
    setSaving(true);

    const payload = {
      buchhaltung_id: buchhaltungId,
      dokument_id: currentDoc?.id ?? null,
      mandant_id: mandantId,
      // brutto = netto + mwst (rounded)
      betrag: round2(parseFloat(netto) + parseFloat(mwstBetrag || "0")),
      buchungsdatum,
      kategorie,
      konto,
      beschreibung,
      lieferant: lieferant.trim() || null,
      mwst_satz: parseFloat(mwstSatz),
    };

    let saveError;
    // Re-check for an existing Buchung for this document (catches races where
    // another save finished after the form was opened, e.g. rapid double-click)
    let effectiveExisting = existingBuchung;
    if (!effectiveExisting && payload.dokument_id) {
      const { data: existing } = await supabase
        .from("buchungen")
        .select("id")
        .eq("buchhaltung_id", buchhaltungId)
        .eq("dokument_id", payload.dokument_id)
        .maybeSingle();
      if (existing?.id) {
        effectiveExisting = { id: existing.id } as any;
      }
    }

    if (effectiveExisting) {
      const { error } = await supabase
        .from("buchungen")
        .update({ ...payload, geaendert_von: benutzerId })
        .eq("id", effectiveExisting.id);
      saveError = error;
    } else {
      const { error } = await supabase
        .from("buchungen")
        .insert({ ...payload, erstellt_von: benutzerId });
      saveError = error;
    }

    setSaving(false);

    if (saveError) {
      toast({ title: "Fehler", description: saveError.message, variant: "destructive" });
      return;
    }

    toast({
      title: effectiveExisting
        ? existingBuchung
          ? "Buchung aktualisiert"
          : "Buchung aktualisiert (bereits vorhanden)"
        : "Buchung gespeichert",
    });
    onSaved({ dokumentId: payload.dokument_id });
    loadTotals();

    if (gotoNext) {
      if (isManualMode) {
        // Reset for next manual booking
        setExistingBuchung(null);
        setNetto("");
        setMwstBetrag("");
        setBeschreibung("");
        setLieferant("");
        toast({ title: "Bereit für nächste Buchung" });
        return;
      }
      // Find next un-booked document
      const next = await findNextUnbooked();
      if (next !== -1) {
        if (embedded && onRequestDocIndex) {
          onRequestDocIndex(next);
        } else {
          setCurrentDocIndex(next);
        }
      } else {
        if (automationEnabled) {
          toast({ title: "Alle Belege gebucht 🎉", description: "Buchhaltungs-Paket (UStVA) wird automatisch erstellt …" });
          try {
            const { data: abRes, error: abErr } = await supabase.functions.invoke("buchhaltung-abschliessen", {
              body: { buchhaltungId },
            });
            if (abErr) throw abErr;
            if ((abRes as any)?.error) throw new Error((abRes as any).error);
            toast({
              title: "✓ Buchhaltungs-Paket erstellt",
              description: "Journal · SuSa · UStVA liegen zur Freigabe beim Chef.",
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            toast({ title: "Auto-Abschluss fehlgeschlagen", description: msg, variant: "destructive" });
          }
        } else {
          toast({ title: "Alle Belege gebucht 🎉", description: "Diese Buchhaltung ist bereit zur Prüfung." });
        }
        if (!embedded) onOpenChange(false);
      }
    } else if (editBuchungId && !embedded) {
      // After saving an edit, close
      onOpenChange(false);
    }
  };

  const findNextUnbooked = async (): Promise<number> => {
    const { data } = await supabase
      .from("buchungen")
      .select("dokument_id")
      .eq("buchhaltung_id", buchhaltungId);
    const bookedIds = new Set((data ?? []).map((d) => d.dokument_id));
    // Look forward first
    for (let i = currentDocIndex + 1; i < dokumente.length; i++) {
      if (!bookedIds.has(dokumente[i].id)) return i;
    }
    // Wrap around
    for (let i = 0; i < currentDocIndex; i++) {
      if (!bookedIds.has(dokumente[i].id)) return i;
    }
    return -1;
  };

  // Allow manual mode (no document) to render
  if (!currentDoc && !isManualMode && !embedded) return null;
  if (embedded && !currentDoc) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
        Wählen Sie links einen Beleg aus, um ihn zu buchen.
      </div>
    );
  }

  const headerTitle = existingBuchung
    ? "Buchung bearbeiten"
    : isManualMode
      ? "Buchung ohne Beleg erfassen"
      : "Buchung erfassen";
  const headerSubject = lieferant.trim() || currentDoc?.dateiname || "manuelle Buchung";

  const formColumn = (
    <div className={cn(
      "flex flex-col min-h-0",
      embedded ? "h-full" : isManualMode ? "flex-1" : "col-span-2",
    )}>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {existingBuchung && (
                <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary flex items-center gap-2">
                  <Save className="h-3.5 w-3.5" /> Bereits gebucht — Änderungen werden gespeichert.
                </div>
              )}

              {/* OCR status banner */}
              {automationEnabled && !existingBuchung && !isManualMode && currentDoc && (() => {
                const aiFieldCount = Object.keys(aiFields).length;
                const ocrSucceeded = aiFieldCount > 0;
                return (
                  <div className={cn(
                    "rounded-md border px-3 py-2 flex items-center justify-between gap-2",
                    !ocrLoading && ocrKonfidenz && !ocrSucceeded && "border-destructive/40 bg-destructive/5",
                    !ocrLoading && ocrSucceeded && "border-primary/30 bg-primary/5",
                    (ocrLoading || (!ocrKonfidenz && !ocrSucceeded)) && "bg-muted/40",
                  )}>
                    <div className="flex items-center gap-2 text-xs">
                      {ocrLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          <span>Beleg wird analysiert…</span>
                        </>
                      ) : ocrSucceeded ? (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span>{aiFieldCount} Feld{aiFieldCount === 1 ? "" : "er"} automatisch ausgelesen</span>
                          {ocrKonfidenz && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] py-0 px-1.5",
                                ocrKonfidenz === "hoch" && "border-green-500/50 text-green-700 dark:text-green-400",
                                ocrKonfidenz === "mittel" && "border-yellow-500/50 text-yellow-700 dark:text-yellow-400",
                                ocrKonfidenz === "niedrig" && "border-destructive/50 text-destructive",
                              )}
                            >
                              {ocrKonfidenz}
                            </Badge>
                          )}
                        </>
                      ) : ocrKonfidenz ? (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                          <span className="text-destructive">Auslesen fehlgeschlagen — bitte manuell ausfüllen</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Beleg automatisch auslesen</span>
                        </>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={ocrLoading}
                      onClick={() => runOcr(true)}
                    >
                      <RefreshCw className={cn("h-3 w-3 mr-1", ocrLoading && "animate-spin")} />
                      {ocrSucceeded ? "Erneut analysieren" : "Jetzt auslesen"}
                    </Button>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="kategorie" className="flex items-center gap-1">
                    Kategorie
                    {aiFields.kategorie && <Sparkles className="h-3 w-3 text-primary" />}
                  </Label>
                  <Select value={kategorie} onValueChange={(v) => { handleKategorieChange(v as Kategorie); clearAiField("kategorie"); }}>
                    <SelectTrigger id="kategorie"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Einnahme">Einnahme</SelectItem>
                      <SelectItem value="Ausgabe">Ausgabe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="datum" className="flex items-center gap-1">
                    Buchungsdatum *
                    {aiFields.buchungsdatum && <Sparkles className="h-3 w-3 text-primary" />}
                  </Label>
                  <Input
                    id="datum"
                    type="date"
                    value={buchungsdatum}
                    onChange={(e) => { setBuchungsdatum(e.target.value); clearAiField("buchungsdatum"); }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lieferant" className="flex items-center gap-1">
                  {kategorie === "Einnahme" ? "Kunde" : "Lieferant"}
                  {aiFields.lieferant && <Sparkles className="h-3 w-3 text-primary" />}
                </Label>
                <Input
                  id="lieferant"
                  value={lieferant}
                  onChange={(e) => { setLieferant(e.target.value); clearAiField("lieferant"); }}
                  onBlur={handleLieferantBlur}
                  placeholder={kategorie === "Einnahme" ? "z.B. Mustermann GmbH" : "z.B. Telekom AG"}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="konto" className="flex items-center gap-1">
                  Konto *
                  {aiFields.konto && <Sparkles className="h-3 w-3 text-primary" />}
                </Label>
                <Select value={konto} onValueChange={(v) => { handleKontoChange(v); clearAiField("konto"); }}>
                  <SelectTrigger id="konto"><SelectValue placeholder="Konto wählen..." /></SelectTrigger>
                  <SelectContent>
                    {kontoOptions.map((k) => (
                      <SelectItem key={k.name} value={k.name}>{k.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Netto / MwSt / Brutto — separate Felder, live synchronisiert */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="netto" className="flex items-center gap-1">
                      Netto (€) *
                      {(aiFields.netto || aiFields.betrag) && <Sparkles className="h-3 w-3 text-primary" />}
                    </Label>
                    <Input
                      id="netto"
                      type="number"
                      step="0.01"
                      min="0"
                      value={netto}
                      onChange={(e) => handleNettoChange(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mwst-betrag" className="flex items-center gap-1">
                      MwSt (€)
                      {aiFields.mwst_betrag && <Sparkles className="h-3 w-3 text-primary" />}
                    </Label>
                    <Input
                      id="mwst-betrag"
                      type="number"
                      step="0.01"
                      min="0"
                      value={mwstBetrag}
                      onChange={(e) => handleMwstBetragChange(e.target.value)}
                      disabled={mwstSatz === "0"}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="brutto" className="flex items-center gap-1 text-muted-foreground">
                      Brutto (€) 🔒
                    </Label>
                    <Input
                      id="brutto"
                      type="text"
                      readOnly
                      value={bruttoNum > 0 ? bruttoNum.toFixed(2) : ""}
                      placeholder="0,00"
                      className="bg-muted/50 font-medium"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs pt-1">
                  <span className="text-muted-foreground">Satz:</span>
                  {[
                    { value: "19", label: "19%" },
                    { value: "7", label: "7%" },
                    { value: "0", label: "0%" },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="mwst-satz"
                        value={opt.value}
                        checked={mwstSatz === opt.value}
                        onChange={() => handleMwstSatzChange(opt.value)}
                        className="cursor-pointer"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                  {aiFields.mwst_satz && <Sparkles className="h-3 w-3 text-primary" />}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="beschreibung" className="flex items-center gap-1">
                  Beschreibung
                  {aiFields.beschreibung && <Sparkles className="h-3 w-3 text-primary" />}
                </Label>
                <Textarea
                  id="beschreibung"
                  value={beschreibung}
                  onChange={(e) => { setBeschreibung(e.target.value); clearAiField("beschreibung"); }}
                  rows={3}
                  placeholder="Optionaler Buchungstext..."
                />
              </div>

              {warnings.length > 0 && (
                <Alert className="border-yellow-500/50 bg-yellow-500/5">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    <ul className="text-xs list-disc list-inside space-y-0.5">
                      {warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {bruttoNum > 0 && (
                <div className="rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Buchungsbetrag: </span>
                  <span className={cn(
                    "font-semibold",
                    kategorie === "Einnahme" ? "text-green-600" : "text-foreground"
                  )}>
                    {kategorie === "Einnahme" ? "+" : "−"}{formatEuro(bruttoNum)}
                  </span>
                </div>
              )}

              {existingBuchung && (
                <div className="border-t pt-3 mt-3 text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <History className="h-3 w-3" /> Verlauf
                  </p>
                  <p>Erstellt: {new Date(existingBuchung.erstellt_am).toLocaleString("de-DE")} {existingBuchung.ersteller && `· ${existingBuchung.ersteller.name}`}</p>
                  {existingBuchung.geaendert_am && (
                    <p>Geändert: {new Date(existingBuchung.geaendert_am).toLocaleString("de-DE")} {existingBuchung.aenderer && `· ${existingBuchung.aenderer.name}`}</p>
                  )}
                </div>
              )}

              {/* Live-Finanzübersicht dieser Buchhaltung */}
              <div className="border-t pt-3 mt-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Diese Buchhaltung gesamt ({totals.count} {totals.count === 1 ? "Buchung" : "Buchungen"})
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-muted-foreground">Einnahmen</p>
                    <p className="font-semibold text-green-600">+{formatEuro(totals.einnahmen)}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-muted-foreground">Ausgaben</p>
                    <p className="font-semibold text-destructive">−{formatEuro(totals.ausgaben)}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-muted-foreground">Saldo</p>
                    <p className={cn("font-bold", totals.saldo >= 0 ? "text-green-600" : "text-destructive")}>
                      {totals.saldo >= 0 ? "+" : ""}{formatEuro(totals.saldo)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t p-4 flex gap-2">
              {!embedded && (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                    Schließen
                  </Button>
                  <div className="flex-1" />
                </>
              )}
              {embedded && <div className="flex-1" />}
              <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Speichern
              </Button>
              {((dokumente.length > 1 || isManualMode) && !editBuchungId) && (
                <Button onClick={() => save(true)} disabled={saving}>
                  {isManualMode ? "Speichern & weitere Buchung" : "Speichern & nächster"} <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
    </div>
  );

  if (embedded) {
    return formColumn;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "h-[90vh] flex flex-col p-0 gap-0",
        isManualMode ? "max-w-2xl" : "max-w-7xl",
      )}>
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {headerTitle} — {headerSubject}
            </span>
            {!isManualMode && dokumente.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                Beleg {currentDocIndex + 1} von {dokumente.length}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className={cn("flex-1 min-h-0", isManualMode ? "flex" : "grid grid-cols-5")}>
          {!isManualMode && (
            <div className="col-span-3 border-r min-h-0">
              <PdfViewer blobUrl={previewBlobUrl} loading={loadingPreview} />
            </div>
          )}
          {formColumn}
        </div>
      </DialogContent>
    </Dialog>
  );
}
