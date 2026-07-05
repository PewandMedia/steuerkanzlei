import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Plus, Upload, FileUp, X, Send, Check, ChevronsUpDown, User, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPTED_BELEG_ACCEPT, getMimeFromName, validateBelegFile } from "@/lib/file-types";
import { BelegeingaengeEditor, type BelegeingangEntry } from "@/components/BelegeingaengeEditor";

interface Sachbearbeiter {
  id: string;
  name: string;
}

interface Mandant {
  id: string;
  mandanten_nummer?: string;
  name: string;
  firma: string | null;
  zugewiesener_bearbeiter_id?: string | null;
  dauerfristverlaengerung?: boolean;
}

interface Props {
  mandanten: Mandant[];
  onCreated: () => void;
  preselectedMandantId?: string;
  hideMandantSelect?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

const MAX_SIZE = 20 * 1024 * 1024;

export function NeueBuchhaltungDialog({ mandanten, onCreated, preselectedMandantId, hideMandantSelect, open: openProp, onOpenChange, hideTrigger }: Props) {
  const { benutzerId } = useAuth();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp !== undefined ? openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };
  const [mandantId, setMandantId] = useState(preselectedMandantId ?? "");
  const [mandantPopoverOpen, setMandantPopoverOpen] = useState(false);
  const [bearbeiterId, setBearbeiterId] = useState("");
  const [sachbearbeiter, setSachbearbeiter] = useState<Sachbearbeiter[]>([]);
  // Mehrere Monate möglich (YYYY-MM, sortiert aufsteigend)
  const [selectedMonths, setSelectedMonths] = useState<string[]>([defaultMonth]);
  const [yearView, setYearView] = useState<number>(now.getFullYear());
  const [existingMonths, setExistingMonths] = useState<Set<string>>(new Set());
  const [faelligAm, setFaelligAm] = useState("");
  const [lastAuto, setLastAuto] = useState("");
  const [dfvOverride, setDfvOverride] = useState<boolean | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const [belegeingaenge, setBelegeingaenge] = useState<BelegeingangEntry[]>([{ datum: today, notiz: "" }]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [notiz, setNotiz] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync preselected mandant when dialog opens
  useEffect(() => {
    if (open && preselectedMandantId) setMandantId(preselectedMandantId);
  }, [open, preselectedMandantId]);

  // Load Sachbearbeiter when dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "Sachbearbeiter");
      if (roles && roles.length > 0) {
        const { data: users } = await supabase
          .from("benutzer")
          .select("id, name")
          .in("user_id", roles.map((r) => r.user_id))
          .order("name");
        setSachbearbeiter(users ?? []);
      } else {
        setSachbearbeiter([]);
      }
    })();
  }, [open]);

  // DB-Format pro Monat: MM-YYYY
  const monateDb = useMemo(
    () => selectedMonths.map((s) => {
      const [y, m] = s.split("-");
      return `${m}-${y}`;
    }),
    [selectedMonths],
  );
  const isMulti = selectedMonths.length > 1;
  const singleMonth = selectedMonths.length === 1 ? selectedMonths[0] : "";

  const selectedMandant = useMemo(
    () => mandanten.find((m) => m.id === mandantId),
    [mandanten, mandantId]
  );

  // Stamm-Sachbearbeiter automatisch übernehmen
  const stammBearbeiterId = selectedMandant?.zugewiesener_bearbeiter_id ?? null;
  const hasStammBearbeiter = !!stammBearbeiterId;
  useEffect(() => {
    if (stammBearbeiterId) setBearbeiterId(stammBearbeiterId);
  }, [stammBearbeiterId]);

  // DFV vom Mandant übernehmen
  const mandantDfv = !!selectedMandant?.dauerfristverlaengerung;
  const dfvAktiv = dfvOverride ?? mandantDfv;

  // Vorschau: errechnete Standard-Frist (10. des Folgemonats, +1 bei DFV)
  const berechneFrist = useCallback((ymStr: string, dfv: boolean): string | null => {
    const [y, m] = ymStr.split("-").map((v) => parseInt(v, 10));
    if (!y || !m) return null;
    const offset = dfv ? 2 : 1;
    let zielMonat = m + offset;
    let zielJahr = y;
    while (zielMonat > 12) {
      zielMonat -= 12;
      zielJahr += 1;
    }
    return `${zielJahr}-${String(zielMonat).padStart(2, "0")}-10`;
  }, []);
  const errechneteFrist = useMemo(
    () => (singleMonth ? berechneFrist(singleMonth, dfvAktiv) : null),
    [singleMonth, dfvAktiv, berechneFrist],
  );

  // Frist automatisch befüllen (nur bei genau einem Monat)
  useEffect(() => {
    if (isMulti) {
      setFaelligAm("");
      setLastAuto("");
      return;
    }
    if (!errechneteFrist) return;
    setFaelligAm((prev) => (prev === "" || prev === lastAuto ? errechneteFrist : prev));
    setLastAuto(errechneteFrist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errechneteFrist, isMulti]);

  const fristIstManuell = !isMulti && !!faelligAm && !!errechneteFrist && faelligAm !== errechneteFrist;

  // Bereits vorhandene Monate für den gewählten Mandanten laden
  useEffect(() => {
    if (!open || !mandantId) {
      setExistingMonths(new Set());
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("buchhaltungen")
        .select("monat")
        .eq("mandant_id", mandantId);
      const set = new Set<string>();
      (data ?? []).forEach((d: any) => {
        const [mm, yyyy] = String(d.monat).split("-");
        if (mm && yyyy) set.add(`${yyyy}-${mm}`);
      });
      setExistingMonths(set);
    })();
  }, [open, mandantId]);

  const toggleMonth = (ym: string) => {
    if (existingMonths.has(ym)) return;
    setSelectedMonths((prev) =>
      prev.includes(ym)
        ? prev.filter((x) => x !== ym)
        : [...prev, ym].sort(),
    );
  };
  const removeMonth = (ym: string) => {
    setSelectedMonths((prev) => prev.filter((x) => x !== ym));
  };

  const MONATS_NAMEN = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  const formatYm = (ym: string) => {
    const [y, m] = ym.split("-");
    const idx = parseInt(m, 10) - 1;
    return `${MONATS_NAMEN[idx] ?? m} ${y}`;
  };

  const validateFile = (file: File): string | null => validateBelegFile(file, MAX_SIZE);

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const errors: string[] = [];
    const valid: File[] = [];
    arr.forEach((f) => {
      const err = validateFile(f);
      if (err) errors.push(err);
      else valid.push(f);
    });
    if (errors.length) {
      toast({ title: "Ungültige Dateien", description: errors.join("\n"), variant: "destructive" });
    }
    if (valid.length) setFiles((prev) => [...prev, ...valid]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setMandantId(preselectedMandantId ?? "");
    setBearbeiterId("");
    setSelectedMonths([defaultMonth]);
    setYearView(now.getFullYear());
    setFaelligAm("");
    setLastAuto("");
    setDfvOverride(null);
    setBelegeingaenge([{ datum: new Date().toISOString().split("T")[0], notiz: "" }]);
    setFiles([]);
    setProgress(0);
    setNotiz("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetMandantId = mandantId;

    if (!benutzerId || !targetMandantId || monateDb.length === 0) return;
    if (!bearbeiterId) {
      toast({ title: "Sachbearbeiter fehlt", description: "Bitte einen Sachbearbeiter zuweisen.", variant: "destructive" });
      return;
    }
    setUploading(true);
    setProgress(5);

    const validEingaenge = belegeingaenge.filter((e) => e.datum);
    const earliest = validEingaenge.length
      ? validEingaenge.map((e) => e.datum).sort()[0]
      : new Date().toISOString().split("T")[0];

    const gruppenId = monateDb.length > 1 ? crypto.randomUUID() : null;

    const createdIds: string[] = [];
    const stepTotal = monateDb.length + monateDb.length * files.length;
    let stepDone = 0;
    const bumpProgress = () => {
      stepDone += 1;
      setProgress(5 + Math.round((stepDone / Math.max(stepTotal, 1)) * 90));
    };

    for (const monat of monateDb) {
      const ym = `${monat.split("-")[1]}-${monat.split("-")[0]}`; // YYYY-MM
      const insertData: Record<string, unknown> = {
        mandant_id: targetMandantId,
        bearbeiter_id: bearbeiterId,
        monat,
        status: "Eingegangen",
        belegeingang_datum: earliest,
        dauerfristverlaengerung: dfvAktiv,
      };
      if (gruppenId) insertData.gruppen_id = gruppenId;
      // Manuelle Frist nur bei einzelnem Monat; sonst Auto-Frist pro Monat (Trigger füllt sie, aber wir setzen sie hier explizit für sofortige Anzeige).
      if (!isMulti) {
        const finaleFrist = faelligAm || errechneteFrist;
        if (finaleFrist) {
          insertData.faellig_am = finaleFrist;
          insertData.faellig_am_manuell = fristIstManuell;
        }
      } else {
        const autoFrist = berechneFrist(ym, dfvAktiv);
        if (autoFrist) {
          insertData.faellig_am = autoFrist;
          insertData.faellig_am_manuell = false;
        }
      }
      if (notiz.trim()) insertData.notizen = notiz.trim();

      const { data: buchData, error: buchError } = await supabase
        .from("buchhaltungen")
        .insert(insertData as any)
        .select("id")
        .single();

      if (buchError || !buchData) {
        toast({ title: "Fehler", description: `${monat}: ${buchError?.message ?? "konnte nicht erstellt werden."}`, variant: "destructive" });
        continue;
      }
      const buchhaltungId = buchData.id;
      createdIds.push(buchhaltungId);

      if (validEingaenge.length > 0) {
        await supabase.from("belegeingaenge").insert(
          validEingaenge.map((e) => ({
            buchhaltung_id: buchhaltungId,
            datum: e.datum,
            notiz: e.notiz?.trim() || null,
            erstellt_von: benutzerId,
          })) as any,
        );
      }
      bumpProgress();

      for (const file of files) {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${buchhaltungId}/${timestamp}_${safeName}`;
        const { error: storageError } = await supabase.storage
          .from("belege")
          .upload(path, file, { contentType: file.type || getMimeFromName(file.name) });
        if (storageError) {
          toast({ title: "Upload-Fehler", description: `${file.name} (${monat}): ${storageError.message}`, variant: "destructive" });
          bumpProgress();
          continue;
        }
        await supabase.from("buchhaltung_dokumente").insert({
          buchhaltung_id: buchhaltungId,
          dateiname: file.name,
          dateipfad: path,
          hochgeladen_von: benutzerId,
        });
        bumpProgress();
      }
    }

    setProgress(100);
    const mandant = mandanten.find((m) => m.id === targetMandantId);

    // Stamm-Sachbearbeiter dauerhaft speichern, falls noch nicht gesetzt
    let stammGespeichert = false;
    if (mandant && !mandant.zugewiesener_bearbeiter_id && bearbeiterId) {
      const { error: updErr } = await supabase
        .from("mandanten")
        .update({ zugewiesener_bearbeiter_id: bearbeiterId })
        .eq("id", targetMandantId);
      if (!updErr) stammGespeichert = true;
    }

    const anzahl = createdIds.length;
    const monateLabel = monateDb.join(", ");
    toast({
      title: anzahl > 1 ? `${anzahl} Buchhaltungen weitergeleitet` : "Buchhaltung weitergeleitet",
      description: stammGespeichert
        ? `${mandant?.name ?? "Mandant"} · ${monateLabel} · Stamm-Sachbearbeiter gespeichert.`
        : `${mandant?.name ?? "Mandant"} · ${monateLabel}.`,
    });

    resetForm();
    setOpen(false);
    setUploading(false);
    onCreated();
  };

  const isValid = !!mandantId && !!bearbeiterId && selectedMonths.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!uploading) { setOpen(v); if (!v) resetForm(); } }}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-1" /> Neue Buchhaltung
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Neue Buchhaltung einreichen</DialogTitle>
          <p className="text-sm text-muted-foreground">Belege scannen und an den Sachbearbeiter weiterleiten</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Section 1: Mandant */}
          {!hideMandantSelect && (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">1</span>
                  <Label className="text-sm font-semibold">Mandant auswählen</Label>
                </div>
                <div className="pl-8 space-y-2">
                  <Popover open={mandantPopoverOpen} onOpenChange={setMandantPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={mandantPopoverOpen}
                        className="w-full justify-between font-normal"
                        disabled={uploading}
                      >
                        {selectedMandant ? (
                          <span className="flex items-center gap-2 truncate">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {selectedMandant.mandanten_nummer && (
                              <span className="font-mono text-[11px] text-muted-foreground">{selectedMandant.mandanten_nummer}</span>
                            )}
                            {selectedMandant.name}
                            {selectedMandant.firma && <span className="text-muted-foreground">({selectedMandant.firma})</span>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Mandant suchen (Name oder Nr.)…</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Nr., Name oder Firma eingeben…" />
                        <CommandList>
                          <CommandEmpty>
                            <div className="py-2 text-center text-sm">
                              <p className="text-muted-foreground">Kein Mandant gefunden.</p>
                              <p className="text-xs text-muted-foreground mt-1">Mandant zuerst unter „Mandanten" anlegen.</p>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {mandanten.map((m) => (
                              <CommandItem
                                key={m.id}
                                value={`${m.mandanten_nummer ?? ""} ${m.name} ${m.firma ?? ""}`}
                                onSelect={() => {
                                  setMandantId(m.id);
                                  setMandantPopoverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", mandantId === m.id ? "opacity-100" : "opacity-0")} />
                                {m.mandanten_nummer && (
                                  <span className="font-mono text-[11px] text-muted-foreground mr-2">{m.mandanten_nummer}</span>
                                )}
                                <span>{m.name}</span>
                                {m.firma && <span className="ml-1 text-muted-foreground text-xs">({m.firma})</span>}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Separator />
            </>
          )}

          {hideMandantSelect && selectedMandant && (
            <div className="rounded-md bg-muted/50 px-3 py-2 flex items-center gap-2 text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium">{selectedMandant.name}</span>
              {selectedMandant.firma && <span className="text-muted-foreground">({selectedMandant.firma})</span>}
            </div>
          )}

          {/* Section 2: Sachbearbeiter zuweisen */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">2</span>
              <Label className="text-sm font-semibold">Sachbearbeiter zuweisen</Label>
              {hasStammBearbeiter && (
                <span className="text-xs text-muted-foreground">(Stamm-Sachbearbeiter)</span>
              )}
            </div>
            <div className="pl-8">
              <Select value={bearbeiterId} onValueChange={setBearbeiterId} disabled={uploading || hasStammBearbeiter}>
                <SelectTrigger>
                  <SelectValue placeholder="Sachbearbeiter wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {sachbearbeiter.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      Keine Sachbearbeiter verfügbar.
                    </div>
                  ) : (
                    sachbearbeiter.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {hasStammBearbeiter && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Dieser Mandant hat bereits einen festen Stamm-Sachbearbeiter. Nur der Chef kann diesen wechseln.
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Section 3: Zeitraum */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">3</span>
              <Label className="text-sm font-semibold">Zeitraum & Fälligkeit</Label>
            </div>
            <div className="pl-8 space-y-3">
             <div className="space-y-2">
               <div className="flex items-center justify-between">
                 <Label className="text-xs text-muted-foreground">
                   Buchungsmonat(e) {selectedMonths.length > 1 && (
                     <span className="ml-1 text-primary font-medium">· {selectedMonths.length} ausgewählt</span>
                   )}
                 </Label>
                 <div className="flex items-center gap-1">
                   <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYearView((y) => y - 1)} disabled={uploading} aria-label="Jahr zurück">
                     <ChevronLeft className="h-4 w-4" />
                   </Button>
                   <span className="text-sm font-semibold w-12 text-center">{yearView}</span>
                   <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYearView((y) => y + 1)} disabled={uploading} aria-label="Jahr vor">
                     <ChevronRight className="h-4 w-4" />
                   </Button>
                 </div>
               </div>
               <div className="grid grid-cols-4 gap-1.5">
                 {MONATS_NAMEN.map((name, i) => {
                   const ym = `${yearView}-${String(i + 1).padStart(2, "0")}`;
                   const isSelected = selectedMonths.includes(ym);
                   const isExisting = existingMonths.has(ym);
                   return (
                     <button
                       key={ym}
                       type="button"
                       onClick={() => toggleMonth(ym)}
                       disabled={uploading || isExisting}
                       title={isExisting ? "Bereits angelegt" : undefined}
                       className={cn(
                         "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                         isSelected && "bg-primary text-primary-foreground border-primary",
                         !isSelected && !isExisting && "hover:bg-muted/60 border-input",
                         isExisting && "opacity-40 line-through cursor-not-allowed border-dashed",
                       )}
                     >
                       {name}
                     </button>
                   );
                 })}
               </div>
               {selectedMonths.length > 0 && (
                 <div className="flex flex-wrap gap-1.5 pt-1">
                   {selectedMonths.map((ym) => (
                     <span key={ym} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                       {formatYm(ym)}
                       <button
                         type="button"
                         onClick={() => removeMonth(ym)}
                         disabled={uploading}
                         className="rounded-full hover:bg-primary/20 p-0.5"
                         aria-label={`${formatYm(ym)} entfernen`}
                       >
                         <X className="h-3 w-3" />
                       </button>
                     </span>
                   ))}
                 </div>
               )}
               {selectedMonths.length === 0 && (
                 <p className="text-[11px] text-destructive">Mindestens einen Monat auswählen.</p>
               )}
             </div>
             <div className="space-y-1">
               <Label className="text-xs text-muted-foreground">Abgabefrist</Label>
               {isMulti ? (
                 <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1">
                   <p className="text-[11px] text-muted-foreground">
                     Wird pro Monat automatisch berechnet (10. des Folgemonats{dfvAktiv && ", +1 bei DFV"}).
                   </p>
                   <ul className="text-xs space-y-0.5">
                     {selectedMonths.map((ym) => {
                       const frist = berechneFrist(ym, dfvAktiv);
                       const fristStr = frist ? new Date(frist).toLocaleDateString("de-DE") : "–";
                       return (
                         <li key={ym} className="flex justify-between">
                           <span className="text-muted-foreground">{formatYm(ym)}</span>
                           <span className="font-medium">{fristStr}</span>
                         </li>
                       );
                     })}
                   </ul>
                 </div>
               ) : (
                 <>
                   <Input
                     type="date"
                     value={faelligAm}
                     onChange={(e) => setFaelligAm(e.target.value)}
                     disabled={uploading}
                   />
                   {fristIstManuell ? (
                     <p className="text-[11px] text-orange-600">Manuell überschrieben</p>
                   ) : faelligAm ? (
                     <p className="text-[11px] text-muted-foreground">
                       Automatisch berechnet
                       {dfvAktiv && <span className="text-blue-600"> · DFV +1 Monat</span>}
                     </p>
                   ) : null}
                 </>
               )}
             </div>
             <BelegeingaengeEditor
               value={belegeingaenge}
               onChange={setBelegeingaenge}
               disabled={uploading}
               helper="Tatsächliche Daten, an denen Belege vom Mandanten eingegangen sind. Mehrere Eingänge möglich."
             />
             <label className="flex items-start gap-2 cursor-pointer rounded-md border p-2.5 hover:bg-muted/40 transition-colors">
               <Checkbox
                 checked={dfvAktiv}
                 onCheckedChange={(v) => setDfvOverride(v === true)}
                 disabled={uploading}
                 className="mt-0.5"
               />
               <div className="space-y-0.5">
                 <span className="text-sm font-medium leading-none">Dauerfristverlängerung (+1 Monat)</span>
                 <p className="text-[11px] text-muted-foreground">
                   Verschiebt die Abgabefrist automatisch um einen Monat nach hinten.
                   {mandantDfv && dfvOverride === null && " Voreingestellt aus den Mandantenstammdaten."}
                 </p>
               </div>
             </label>
            </div>
          </div>

          <Separator />

          {/* Section 4: Notiz */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">4</span>
              <Label className="text-sm font-semibold">Notiz an Sachbearbeiter</Label>
              <span className="text-xs text-muted-foreground">(optional)</span>
            </div>
            <div className="pl-8">
              <Textarea
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                placeholder="z.B. Bitte besonders auf die Reisekosten achten…"
                rows={2}
                disabled={uploading}
              />
            </div>
          </div>

          <Separator />


          {/* Section 6: Belege */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">6</span>
              <Label className="text-sm font-semibold">Belege hochladen</Label>
            </div>
            <div className="pl-8 space-y-2">
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                  uploading && "pointer-events-none opacity-50"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_BELEG_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
                />
                <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">PDFs oder Fotos hier ablegen oder klicken</p>
                <p className="text-xs text-muted-foreground mt-1">Optional · PDF, JPG, PNG · Max. 20 MB · können auch später nachgereicht werden</p>
              </div>

              {files.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <FileUp className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFile(i)} disabled={uploading}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {uploading && <Progress value={progress} className="h-2" />}

          <Button type="submit" className="w-full" disabled={uploading || !isValid}>
            <Send className="h-4 w-4 mr-2" />
            {uploading
              ? "Wird weitergeleitet…"
              : (() => {
                  const n = selectedMonths.length;
                  const monatLabel = n > 1 ? `${n} Monate` : "1 Monat";
                  const belegLabel = files.length === 0
                    ? "ohne Belege"
                    : `${files.length} Beleg${files.length !== 1 ? "e" : ""}`;
                  return `An Sachbearbeiter weiterleiten · ${monatLabel} · ${belegLabel}`;
                })()}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
