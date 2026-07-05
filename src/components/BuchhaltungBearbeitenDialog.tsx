import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { X, UserPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BelegeingaengeEditor, type BelegeingangEntry } from "@/components/BelegeingaengeEditor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buchhaltung: {
    id: string;
    monat: string;
    faellig_am: string | null;
    notizen: string | null;
    belegeingang_datum: string | null;
    bearbeiter_id?: string;
    mandant_id?: string;
    dauerfristverlaengerung?: boolean;
    faellig_am_manuell?: boolean;
    
  };
  onSaved: () => void;
}

export function BuchhaltungBearbeitenDialog({ open, onOpenChange, buchhaltung, onSaved }: Props) {
  const { rolle, benutzerId } = useAuth();
  const [monat, setMonat] = useState(buchhaltung.monat);
  const [faelligAm, setFaelligAm] = useState(buchhaltung.faellig_am ?? "");
  const [notizen, setNotizen] = useState(buchhaltung.notizen ?? "");
  const [saving, setSaving] = useState(false);
  const [bearbeiterId, setBearbeiterId] = useState<string>(buchhaltung.bearbeiter_id ?? "");
  const [alsStammUebernehmen, setAlsStammUebernehmen] = useState(false);
  const [alsCoBehalten, setAlsCoBehalten] = useState(true);
  const [sachbearbeiter, setSachbearbeiter] = useState<{ id: string; name: string }[]>([]);
  const [dfv, setDfv] = useState<boolean>(buchhaltung.dauerfristverlaengerung ?? false);
  const [automatisierungAktiv, setAutomatisierungAktiv] = useState<boolean>(buchhaltung.automatisierung_aktiv ?? false);
  const [coBearbeiter, setCoBearbeiter] = useState<{ id: string; name: string }[]>([]);
  const [neuerCoId, setNeuerCoId] = useState<string>("");
  const [belegeingaenge, setBelegeingaenge] = useState<BelegeingangEntry[]>([]);
  const [initialBelegeingaenge, setInitialBelegeingaenge] = useState<BelegeingangEntry[]>([]);
  const initialFaelligAm = buchhaltung.faellig_am ?? "";

  const isChef = rolle === "Chef";
  const darfModusAendern = isChef || rolle === "Sekretariat";
  const istHauptbearbeiter = !!benutzerId && benutzerId === buchhaltung.bearbeiter_id;
  const darfCoVerwalten = isChef || rolle === "Sekretariat" || istHauptbearbeiter;

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
      }
    })();
  }, [open]);

  // Co-Bearbeiter laden
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("buchhaltung_co_bearbeiter")
        .select("bearbeiter_id, bearbeiter:benutzer!buchhaltung_co_bearbeiter_bearbeiter_id_fkey(id, name)")
        .eq("buchhaltung_id", buchhaltung.id);
      const list = (data ?? [])
        .map((d: any) => d.bearbeiter)
        .filter(Boolean);
      setCoBearbeiter(list);
    })();
  }, [open, buchhaltung.id]);

  // Belegeingänge laden
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("belegeingaenge")
        .select("id, datum, notiz")
        .eq("buchhaltung_id", buchhaltung.id)
        .order("datum", { ascending: true });
      const list: BelegeingangEntry[] = (data ?? []).map((d: any) => ({
        id: d.id,
        datum: d.datum,
        notiz: d.notiz ?? "",
      }));
      setBelegeingaenge(list);
      setInitialBelegeingaenge(list);
    })();
  }, [open, buchhaltung.id]);

  const handleSave = async () => {
    setSaving(true);
    const updateData: Record<string, unknown> = {
      monat,
      faellig_am: faelligAm || null,
      notizen: notizen || null,
      dauerfristverlaengerung: dfv,
      automatisierung_aktiv: automatisierungAktiv,
    };
    // Wurde die Frist manuell verändert? Dann Manuell-Flag setzen.
    if (faelligAm && faelligAm !== initialFaelligAm) {
      updateData.faellig_am_manuell = true;
    }
    const alterBearbeiterId = buchhaltung.bearbeiter_id;
    if (isChef && bearbeiterId && bearbeiterId !== buchhaltung.bearbeiter_id) {
      updateData.bearbeiter_id = bearbeiterId;
    }

    const { error } = await supabase
      .from("buchhaltungen")
      .update(updateData as any)
      .eq("id", buchhaltung.id);

    // Belegeingänge synchronisieren (Diff gegenüber Initialstand)
    if (!error) {
      const initialIds = new Set(initialBelegeingaenge.map((e) => e.id).filter(Boolean) as string[]);
      const currentIds = new Set(belegeingaenge.map((e) => e.id).filter(Boolean) as string[]);
      const toDelete = [...initialIds].filter((id) => !currentIds.has(id));
      const toInsert = belegeingaenge.filter((e) => !e.id && e.datum);
      const toUpdate = belegeingaenge.filter((e) => {
        if (!e.id) return false;
        const orig = initialBelegeingaenge.find((x) => x.id === e.id);
        return orig && (orig.datum !== e.datum || (orig.notiz ?? "") !== (e.notiz ?? ""));
      });

      if (toDelete.length) {
        await supabase.from("belegeingaenge").delete().in("id", toDelete);
      }
      if (toInsert.length) {
        await supabase.from("belegeingaenge").insert(
          toInsert.map((e) => ({
            buchhaltung_id: buchhaltung.id,
            datum: e.datum,
            notiz: e.notiz?.trim() || null,
            erstellt_von: benutzerId,
          })) as any
        );
      }
      for (const e of toUpdate) {
        await supabase
          .from("belegeingaenge")
          .update({ datum: e.datum, notiz: e.notiz?.trim() || null })
          .eq("id", e.id!);
      }
    }

    // Optional: Stamm-Sachbearbeiter am Mandanten aktualisieren
    if (!error && isChef && alsStammUebernehmen && bearbeiterId && buchhaltung.mandant_id) {
      await supabase
        .from("mandanten")
        .update({ zugewiesener_bearbeiter_id: bearbeiterId })
        .eq("id", buchhaltung.mandant_id);
    }

    // Bisherigen Bearbeiter als Co behalten?
    if (!error && isChef && bearbeiterId && alterBearbeiterId && bearbeiterId !== alterBearbeiterId && alsCoBehalten) {
      await supabase
        .from("buchhaltung_co_bearbeiter")
        .insert({
          buchhaltung_id: buchhaltung.id,
          bearbeiter_id: alterBearbeiterId,
          zugewiesen_von: benutzerId,
        } as any);
    }

    setSaving(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Gespeichert" });
      onOpenChange(false);
      onSaved();
    }
  };

  const addCoBearbeiter = async () => {
    if (!neuerCoId) return;
    if (neuerCoId === bearbeiterId) {
      toast({ title: "Bereits Hauptbearbeiter", variant: "destructive" });
      return;
    }
    if (coBearbeiter.some((c) => c.id === neuerCoId)) return;
    const { error } = await supabase
      .from("buchhaltung_co_bearbeiter")
      .insert({
        buchhaltung_id: buchhaltung.id,
        bearbeiter_id: neuerCoId,
        zugewiesen_von: benutzerId,
      } as any);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    const user = sachbearbeiter.find((s) => s.id === neuerCoId);
    if (user) setCoBearbeiter((prev) => [...prev, user]);
    setNeuerCoId("");
    toast({ title: "Vertretung zugewiesen" });
  };

  const removeCoBearbeiter = async (coId: string) => {
    const { error } = await supabase
      .from("buchhaltung_co_bearbeiter")
      .delete()
      .eq("buchhaltung_id", buchhaltung.id)
      .eq("bearbeiter_id", coId);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setCoBearbeiter((prev) => prev.filter((c) => c.id !== coId));
  };

  const verfuegbareCo = sachbearbeiter.filter(
    (s) => s.id !== bearbeiterId && !coBearbeiter.some((c) => c.id === s.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buchhaltung bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Monat (MM-YYYY)</Label>
            <Input value={monat} onChange={(e) => setMonat(e.target.value)} placeholder="01-2026" />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="cursor-pointer">Dauerfristverlängerung</Label>
              <p className="text-xs text-muted-foreground">Frist wird automatisch um 1 Monat verlängert</p>
            </div>
            <Switch checked={dfv} onCheckedChange={setDfv} />
          </div>
          <div className="space-y-1">
            <Label>Fällig am</Label>
            <Input type="date" value={faelligAm} onChange={(e) => setFaelligAm(e.target.value)} />
            {faelligAm && faelligAm !== initialFaelligAm && (
              <p className="text-xs text-orange-600">Wird als manuelle Frist gespeichert</p>
            )}
            {buchhaltung.faellig_am_manuell && faelligAm === initialFaelligAm && (
              <p className="text-xs text-orange-600">Diese Frist wurde manuell gesetzt</p>
            )}
          </div>
          <BelegeingaengeEditor
            value={belegeingaenge}
            onChange={setBelegeingaenge}
            helper="Mehrere Eingangsdaten möglich. Werden nachträglich gespeichert."
          />
          <div className="space-y-1">
            <Label>Notizen</Label>
            <Textarea value={notizen} onChange={(e) => setNotizen(e.target.value)} rows={3} />
          </div>

          {isChef && (
            <div className="space-y-2 pt-2 border-t">
              <Label>Hauptbearbeiter</Label>
              <Select value={bearbeiterId} onValueChange={setBearbeiterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sachbearbeiter wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {sachbearbeiter.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bearbeiterId && bearbeiterId !== buchhaltung.bearbeiter_id && buchhaltung.mandant_id && (
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={alsStammUebernehmen}
                      onCheckedChange={(v) => setAlsStammUebernehmen(v === true)}
                    />
                    <span>Auch als neuen Stamm-Sachbearbeiter für diesen Mandanten übernehmen</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={alsCoBehalten}
                      onCheckedChange={(v) => setAlsCoBehalten(v === true)}
                    />
                    <span>Bisherigen Bearbeiter als Vertretung behalten</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Co-Bearbeiter / Vertretung */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label>Vertretung / Co-Bearbeiter</Label>
              <span className="text-xs text-muted-foreground">{coBearbeiter.length} zugewiesen</span>
            </div>
            {coBearbeiter.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {coBearbeiter.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                    {c.name}
                    {darfCoVerwalten && (
                      <button
                        type="button"
                        onClick={() => removeCoBearbeiter(c.id)}
                        className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5"
                        aria-label={`${c.name} entfernen`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            )}
            {darfCoVerwalten && verfuegbareCo.length > 0 && (
              <div className="flex gap-2">
                <Select value={neuerCoId} onValueChange={setNeuerCoId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Vertretung hinzufügen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {verfuegbareCo.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={addCoBearbeiter} disabled={!neuerCoId}>
                  <UserPlus className="h-4 w-4 mr-1" /> Hinzufügen
                </Button>
              </div>
            )}
            {!darfCoVerwalten && coBearbeiter.length === 0 && (
              <p className="text-xs text-muted-foreground">Keine Vertretungen zugewiesen.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Vertretungen erhalten vollen Zugriff auf diese Buchhaltung (z. B. bei Urlaub).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving || !monat}>
            {saving ? "Speichert…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
