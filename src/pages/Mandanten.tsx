import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePageMeta } from "@/hooks/use-page-meta";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { PaginationFooter } from "@/components/PaginationFooter";
import { usePageSize } from "@/hooks/use-page-size";
import { fetchAll } from "@/lib/fetch-all";

const UNTERNEHMENSFORMEN = [
  "Einzelunternehmer",
  "Freiberufler",
  "GmbH",
  "UG (haftungsbeschränkt)",
  "GbR",
  "KG",
  "OHG",
  "AG",
  "e.K.",
  "Sonstige",
];

interface Mandant {
  id: string;
  mandanten_nummer: string;
  name: string;
  vorname: string | null;
  nachname: string | null;
  firma: string | null;
  unternehmensform: string | null;
  geburtsdatum: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  telefon: string | null;
  email: string | null;
  steuernummer: string | null;
  steuer_id: string | null;
  umsatzsteuer_id: string | null;
  notizen: string | null;
  dauerfristverlaengerung: boolean;
}

export default function Mandanten() {
  usePageMeta("Mandanten", "Mandantenstammdaten verwalten: anlegen, bearbeiten, suchen.");

  const { rolle } = useAuth();
  const navigate = useNavigate();
  const [mandanten, setMandanten] = useState<Mandant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMandant, setEditingMandant] = useState<Mandant | null>(null);

  // Form fields
  const [formNummerZahl, setFormNummerZahl] = useState("");
  const [formVorname, setFormVorname] = useState("");
  const [formNachname, setFormNachname] = useState("");
  const [formFirma, setFormFirma] = useState("");
  const [formUnternehmensform, setFormUnternehmensform] = useState("");
  const [formGeburtsdatum, setFormGeburtsdatum] = useState("");
  const [formStrasse, setFormStrasse] = useState("");
  const [formPlz, setFormPlz] = useState("");
  const [formOrt, setFormOrt] = useState("");
  const [formTelefon, setFormTelefon] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSteuernummer, setFormSteuernummer] = useState("");
  const [formSteuerId, setFormSteuerId] = useState("");
  const [formUmsatzsteuerId, setFormUmsatzsteuerId] = useState("");
  const [formNotizen, setFormNotizen] = useState("");
  const [formDfv, setFormDfv] = useState(false);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchMandanten = async () => {
    try {
      const data = await fetchAll<any>((from, to) =>
        supabase
          .from("mandanten")
          .select("id, mandanten_nummer, name, vorname, nachname, firma, unternehmensform, geburtsdatum, strasse, plz, ort, telefon, email, steuernummer, steuer_id, umsatzsteuer_id, notizen, dauerfristverlaengerung")
          .order("mandanten_nummer")
          .order("id", { ascending: true })
          .range(from, to) as any,
      );
      setMandanten(data.map((m: any) => ({ ...m, dauerfristverlaengerung: !!m.dauerfristverlaengerung })) as Mandant[]);
    } catch (error: any) {
      toast({ title: "Fehler beim Laden", description: error?.message ?? String(error), variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchMandanten();
  }, []);

  const filteredMandanten = mandanten.filter((m) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.name.toLowerCase().includes(term) ||
      (m.firma?.toLowerCase().includes(term) ?? false) ||
      (m.vorname?.toLowerCase().includes(term) ?? false) ||
      (m.nachname?.toLowerCase().includes(term) ?? false) ||
      (m.mandanten_nummer?.toLowerCase().includes(term) ?? false)
    );
  });

  const [pageSize, setPageSize] = usePageSize("pageSize:mandanten");
  const { visible: visibleMandanten, page, totalPages, goToPage, total: totalM, shown: shownM } =
    usePaginatedList(filteredMandanten, pageSize, searchTerm);

  const resetForm = () => {
    setFormNummerZahl("");
    setFormVorname("");
    setFormNachname("");
    setFormFirma("");
    setFormUnternehmensform("");
    setFormGeburtsdatum("");
    setFormStrasse("");
    setFormPlz("");
    setFormOrt("");
    setFormTelefon("");
    setFormEmail("");
    setFormSteuernummer("");
    setFormSteuerId("");
    setFormUmsatzsteuerId("");
    setFormNotizen("");
    setFormDfv(false);
  };

  const openCreate = () => {
    setEditingMandant(null);
    resetForm();
    // Vorschlag: nächste freie Nummer auf Basis der bestehenden M-XXXX Liste
    const maxNum = mandanten.reduce((max, m) => {
      const match = m.mandanten_nummer?.match(/^M-(\d+)$/);
      const n = match ? parseInt(match[1], 10) : 0;
      return n > max ? n : max;
    }, 0);
    setFormNummerZahl(String(maxNum + 1).padStart(4, "0"));
    setDialogOpen(true);
  };

  const openEdit = (m: Mandant) => {
    setEditingMandant(m);
    const match = m.mandanten_nummer?.match(/^M-(\d+)$/);
    setFormNummerZahl(match ? match[1] : (m.mandanten_nummer ?? ""));
    setFormVorname(m.vorname ?? "");
    setFormNachname(m.nachname ?? "");
    setFormFirma(m.firma ?? "");
    setFormUnternehmensform(m.unternehmensform ?? "");
    setFormGeburtsdatum(m.geburtsdatum ?? "");
    setFormStrasse(m.strasse ?? "");
    setFormPlz(m.plz ?? "");
    setFormOrt(m.ort ?? "");
    setFormTelefon(m.telefon ?? "");
    setFormEmail(m.email ?? "");
    setFormSteuernummer(m.steuernummer ?? "");
    setFormSteuerId(m.steuer_id ?? "");
    setFormUmsatzsteuerId(m.umsatzsteuer_id ?? "");
    setFormNotizen(m.notizen ?? "");
    setFormDfv(!!m.dauerfristverlaengerung);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formVorname.trim() && !formNachname.trim() && !formFirma.trim()) {
      toast({ title: "Fehler", description: "Bitte mindestens Vor-/Nachname oder Firma angeben.", variant: "destructive" });
      return;
    }
    const finaleNummer = `M-${formNummerZahl.trim().padStart(4, "0")}`;
    if (!formNummerZahl.trim()) {
      toast({ title: "Fehler", description: "Bitte eine Mandantennummer angeben.", variant: "destructive" });
      return;
    }
    if (mandanten.some((m) => m.mandanten_nummer === finaleNummer && m.id !== editingMandant?.id)) {
      toast({ title: "Fehler", description: "Diese Mandantennummer ist bereits vergeben.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const displayName = [formVorname.trim(), formNachname.trim()].filter(Boolean).join(" ") || formFirma.trim();

    // Normalize: empty strings → null (especially important for date columns)
    const norm = (v: string) => {
      const t = v.trim();
      return t === "" ? null : t;
    };

    const payload = {
      mandanten_nummer: finaleNummer,
      name: displayName,
      vorname: norm(formVorname),
      nachname: norm(formNachname),
      firma: norm(formFirma),
      unternehmensform: formUnternehmensform || null,
      geburtsdatum: norm(formGeburtsdatum),
      strasse: norm(formStrasse),
      plz: norm(formPlz),
      ort: norm(formOrt),
      telefon: norm(formTelefon),
      email: norm(formEmail),
      steuernummer: norm(formSteuernummer),
      steuer_id: norm(formSteuerId),
      umsatzsteuer_id: norm(formUmsatzsteuerId),
      notizen: norm(formNotizen),
      dauerfristverlaengerung: formDfv,
    };

    if (editingMandant) {
      const { error } = await supabase.from("mandanten").update(payload).eq("id", editingMandant.id);
      if (error) {
        console.error("Update mandant error:", error);
        const msg = error.message?.includes("mandanten_nummer") || error.code === "23505"
          ? "Diese Mandantennummer ist bereits vergeben."
          : error.message;
        toast({ title: "Fehler beim Speichern", description: msg, variant: "destructive" });
        setLoading(false);
        return;
      }
      toast({ title: "Mandant aktualisiert" });
    } else {
      const { error } = await supabase.from("mandanten").insert(payload as any);
      if (error) {
        console.error("Insert mandant error:", error);
        const msg = error.message?.includes("mandanten_nummer") || error.code === "23505"
          ? "Diese Mandantennummer ist bereits vergeben. Bitte eine andere wählen."
          : error.message;
        toast({ title: "Fehler beim Anlegen", description: msg, variant: "destructive" });
        setLoading(false);
        return;
      }
      toast({ title: "Mandant angelegt" });
    }
    setDialogOpen(false);
    setLoading(false);
    fetchMandanten();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("mandanten").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mandant gelöscht" });
      fetchMandanten();
    }
    setDeleteId(null);
  };

  if (rolle !== "Sekretariat" && rolle !== "Chef") {
    return (
      <div className="flex items-center justify-center p-12">
        <Card><CardContent className="p-8 text-center text-muted-foreground">Zugriff nur für Sekretariat und Chef.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-6 min-w-0">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="section-label">Verwaltung</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-1">Mandantenverwaltung</h1>
          <p className="text-sm text-muted-foreground mt-1">{mandanten.length.toLocaleString("de-DE")} Mandanten insgesamt.</p>
        </div>
        {(rolle === "Sekretariat" || rolle === "Chef") && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Neuer Mandant
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Mandant oder Nr. (M-0001) suchen…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="card-elevated border-0 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="table-modern">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[70px] sm:w-[110px]">Nr.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden lg:table-cell">Firma</TableHead>
                <TableHead className="hidden md:table-cell">Unternehmensform</TableHead>
                <TableHead className="hidden sm:table-cell">Kontakt</TableHead>
                <TableHead className="w-[120px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMandanten.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{searchTerm ? "Keine Treffer" : "Noch keine Mandanten"}</p>
                    <p className="text-sm">{searchTerm ? "Versuchen Sie einen anderen Suchbegriff." : "Legen Sie Ihren ersten Mandanten an."}</p>
                  </TableCell>
                </TableRow>
              ) : (
                visibleMandanten.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{m.mandanten_nummer}</TableCell>
                    <TableCell className="font-medium">
                      <button
                        className="text-primary hover:underline text-left"
                        onClick={() => navigate(`/mandanten/${m.id}`)}
                      >
                        {m.name}
                      </button>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{m.firma ?? "–"}</TableCell>
                    <TableCell className="hidden md:table-cell">{m.unternehmensform ?? "–"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {m.email ?? m.telefon ?? "–"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <WhatsAppButton telefon={m.telefon} mandantName={m.vorname ?? m.name} />
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="Bearbeiten">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {rolle === "Chef" && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)} title="Löschen" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          {totalM > 0 && (
            <PaginationFooter
              page={page}
              totalPages={totalPages}
              total={totalM}
              shown={shownM}
              onPageChange={goToPage}
              label="Mandanten"
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog — single page, all fields */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMandant ? "Mandant bearbeiten" : "Neuer Mandant"}</DialogTitle>
            <DialogDescription>
              {editingMandant ? "Ändern Sie die Stammdaten des Mandanten." : "Erfassen Sie die Stammdaten des neuen Mandanten."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Mandantennummer */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1">Mandantennummer</h3>
              <div className="space-y-1.5">
                <Label>Nummer *</Label>
                {(() => {
                  const finaleNummer = `M-${formNummerZahl.trim().padStart(4, "0")}`;
                  const nummerExistiert =
                    formNummerZahl.trim().length > 0 &&
                    mandanten.some((m) => m.mandanten_nummer === finaleNummer && m.id !== editingMandant?.id);
                  return (
                    <>
                      <div
                        className={`flex items-stretch rounded-md border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background ${nummerExistiert ? "border-destructive" : "border-input"}`}
                      >
                        <span className="flex items-center px-3 bg-muted text-muted-foreground font-mono text-sm border-r border-input select-none">
                          M-
                        </span>
                        <input
                          value={formNummerZahl}
                          onChange={(e) => setFormNummerZahl(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          onBlur={() => {
                            if (formNummerZahl.trim().length > 0) {
                              setFormNummerZahl(formNummerZahl.padStart(4, "0"));
                            }
                          }}
                          inputMode="numeric"
                          pattern="\d*"
                          maxLength={6}
                          placeholder="0001"
                          className="flex-1 px-3 py-2 text-sm font-mono bg-transparent outline-none placeholder:text-muted-foreground"
                        />
                      </div>
                      {nummerExistiert ? (
                        <p className="text-xs text-destructive">
                          Diese Mandantennummer ist bereits vergeben.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Nur Ziffern eingeben. Wird automatisch auf 4 Stellen ergänzt (z.&nbsp;B. {finaleNummer}).
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </section>

            {/* Persönliche Daten */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1">Persönliche Daten</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Vorname</Label>
                  <Input value={formVorname} onChange={(e) => setFormVorname(e.target.value)} placeholder="Max" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nachname</Label>
                  <Input value={formNachname} onChange={(e) => setFormNachname(e.target.value)} placeholder="Mustermann" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Geburtsdatum</Label>
                <Input type="date" value={formGeburtsdatum} onChange={(e) => setFormGeburtsdatum(e.target.value)} />
              </div>
            </section>

            {/* Firma */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1">Firma</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Firmenname</Label>
                  <Input value={formFirma} onChange={(e) => setFormFirma(e.target.value)} placeholder="Mustermann GmbH" />
                </div>
                <div className="space-y-1.5">
                  <Label>Unternehmensform</Label>
                  <Select value={formUnternehmensform} onValueChange={setFormUnternehmensform}>
                    <SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
                    <SelectContent>
                      {UNTERNEHMENSFORMEN.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Kontakt */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1">Kontakt</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>E-Mail</Label>
                  <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="max@beispiel.de" />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefon</Label>
                  <Input value={formTelefon} onChange={(e) => setFormTelefon(e.target.value)} placeholder="+49 123 456789" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Straße + Hausnummer</Label>
                <Input value={formStrasse} onChange={(e) => setFormStrasse(e.target.value)} placeholder="Musterstraße 1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>PLZ</Label>
                  <Input value={formPlz} onChange={(e) => setFormPlz(e.target.value)} placeholder="12345" />
                </div>
                <div className="space-y-1.5">
                  <Label>Ort</Label>
                  <Input value={formOrt} onChange={(e) => setFormOrt(e.target.value)} placeholder="Berlin" />
                </div>
              </div>
            </section>

            {/* Steuerlich */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1">Steuerliche Daten</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Steuernummer</Label>
                  <Input value={formSteuernummer} onChange={(e) => setFormSteuernummer(e.target.value)} placeholder="12/345/67890" />
                </div>
                <div className="space-y-1.5">
                  <Label>Steuerliche ID-Nr.</Label>
                  <Input value={formSteuerId} onChange={(e) => setFormSteuerId(e.target.value)} placeholder="12345678901" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>USt-IdNr.</Label>
                <Input value={formUmsatzsteuerId} onChange={(e) => setFormUmsatzsteuerId(e.target.value)} placeholder="DE123456789" />
              </div>
              <div className="flex items-start justify-between rounded-md border p-3 mt-2">
                <div className="pr-3">
                  <Label className="cursor-pointer">Dauerfristverlängerung (DFV)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Frist für UStVA wird automatisch um 1 Monat verlängert. Wird auf neue Buchhaltungen übernommen.
                  </p>
                </div>
                <Switch checked={formDfv} onCheckedChange={setFormDfv} />
              </div>
            </section>

            {/* Notizen */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1">Interne Notizen</h3>
              <Textarea value={formNotizen} onChange={(e) => setFormNotizen(e.target.value)} placeholder="Notizen zum Mandanten…" rows={3} />
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>Abbrechen</Button>
            <Button
              onClick={handleSave}
              disabled={
                loading ||
                !formNummerZahl.trim() ||
                (!formVorname.trim() && !formNachname.trim() && !formFirma.trim()) ||
                mandanten.some(
                  (m) =>
                    m.mandanten_nummer === `M-${formNummerZahl.trim().padStart(4, "0")}` &&
                    m.id !== editingMandant?.id,
                )
              }
            >
              {loading ? "Speichern…" : editingMandant ? "Speichern" : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mandant löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen Buchhaltungen bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
