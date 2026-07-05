import { useEffect, useState, useMemo, Fragment } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { DeadlineIndicator } from "@/components/DeadlineIndicator";
import { BelegeVollansicht } from "@/components/BelegeVollansicht";
import { BuchhaltungsPaketDialog } from "@/components/BuchhaltungsPaketDialog";
import { BuchungenListe } from "@/components/BuchungenListe";
import { StatusTransitionWithFortschritt } from "@/components/StatusTransitionWithFortschritt";
import { BuchungsFortschritt } from "@/components/BuchungsFortschritt";
import { BuchhaltungsPaket } from "@/components/BuchhaltungsPaket";
import { BuchhaltungBearbeitenDialog } from "@/components/BuchhaltungBearbeitenDialog";
import { toast } from "@/hooks/use-toast";
import { getDeadlineStatus } from "@/lib/deadline-utils";
import { ArrowLeft, Building2, User, FileText, CheckCircle, Clock, AlertOctagon, MoreHorizontal, Pencil, Trash2, Mail, Phone, MapPin, Calendar, Hash, CreditCard, Briefcase, Plus, ChevronDown, ChevronRight, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { NeueBuchhaltungDialog } from "@/components/NeueBuchhaltungDialog";
import type { Database } from "@/integrations/supabase/types";
import { usePageMeta } from "@/hooks/use-page-meta";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { fetchAll as fetchAllRows } from "@/lib/fetch-all";
import { PaginationFooter } from "@/components/PaginationFooter";
import { usePageSize } from "@/hooks/use-page-size";

type BuchhaltungStatus = Database["public"]["Enums"]["buchhaltung_status"];

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
  erstellt_am: string;
  zugewiesener_bearbeiter_id: string | null;
  bearbeiter?: { name: string } | null;
}

interface BuchhaltungRow {
  id: string;
  monat: string;
  status: BuchhaltungStatus;
  belegeingang_datum: string | null;
  fertiggestellt_datum: string | null;
  abgabe_datum: string | null;
  faellig_am: string | null;
  notizen: string | null;
  bearbeiter_id: string;
  bearbeiter: { name: string } | null;
  dokumente_count: number;
  hat_abschluss: boolean;
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function MandantProfil() {
  usePageMeta("Mandantenprofil", "Stammdaten, Buchhaltungen und Dokumente eines Mandanten.");

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTarget =
    (location.state as { from?: string } | null)?.from === "/meine-mandanten"
      ? "/meine-mandanten"
      : "/mandanten";
  const { rolle } = useAuth();
  const [mandant, setMandant] = useState<Mandant | null>(null);
  const [buchhaltungen, setBuchhaltungen] = useState<BuchhaltungRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBuchhaltung, setEditingBuchhaltung] = useState<BuchhaltungRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [neueBuchhaltungOpen, setNeueBuchhaltungOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [steuerRefreshKey, setSteuerRefreshKey] = useState(0);

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);

    const [mandantRes, buchData] = await Promise.all([
      supabase
        .from("mandanten")
        .select("id, mandanten_nummer, name, vorname, nachname, firma, unternehmensform, geburtsdatum, strasse, plz, ort, telefon, email, steuernummer, steuer_id, umsatzsteuer_id, notizen, erstellt_am, zugewiesener_bearbeiter_id, bearbeiter:benutzer!mandanten_zugewiesener_bearbeiter_id_fkey(name)")
        .eq("id", id)
        .single(),
      fetchAllRows<any>((from, to) =>
        supabase
          .from("buchhaltungen")
          .select("id, monat, status, belegeingang_datum, fertiggestellt_datum, abgabe_datum, faellig_am, notizen, bearbeiter_id, bearbeiter:benutzer!buchhaltungen_bearbeiter_id_fkey(name), buchhaltung_dokumente(id), buchhaltungs_abschluesse(id)")
          .eq("mandant_id", id)
          .order("erstellt_am", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to) as any,
      ).catch(() => [] as any[]),
    ]);

    setMandant((mandantRes.data as unknown as Mandant) ?? null);
    setBuchhaltungen(
      buchData.map((d: any) => ({
        id: d.id,
        monat: d.monat,
        status: d.status,
        belegeingang_datum: d.belegeingang_datum,
        fertiggestellt_datum: d.fertiggestellt_datum,
        abgabe_datum: d.abgabe_datum,
        faellig_am: d.faellig_am,
        notizen: d.notizen,
        bearbeiter_id: d.bearbeiter_id,
        bearbeiter: d.bearbeiter,
        dokumente_count: Array.isArray(d.buchhaltung_dokumente) ? d.buchhaltung_dokumente.length : 0,
        hat_abschluss: Array.isArray(d.buchhaltungs_abschluesse) && d.buchhaltungs_abschluesse.length > 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  const stats = useMemo(() => {
    const total = buchhaltungen.length;
    const done = buchhaltungen.filter((b) => b.status === "Buchhaltung erledigt").length;
    const open = buchhaltungen.filter((b) => b.status !== "Buchhaltung erledigt").length;
    const overdue = buchhaltungen.filter((b) => getDeadlineStatus(b.faellig_am, b.status) === "red").length;
    return { total, done, open, overdue };
  }, [buchhaltungen]);

  const [pageSize, setPageSize] = usePageSize("pageSize:mandant-profil");
  const { visible: visibleBuchhaltungen, page: bhPage, totalPages: bhTotalPages, goToPage: bhGoTo, total: bhTotal, shown: bhShown } =
    usePaginatedList(buchhaltungen, pageSize);

  if (loading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground">Laden...</div>;
  }

  if (!mandant) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <p className="text-muted-foreground">Mandant nicht gefunden.</p>
        <Button variant="outline" onClick={() => navigate(backTarget)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
        </Button>
      </div>
    );
  }

  const adresse = [mandant.strasse, [mandant.plz, mandant.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const geburtsdatumFormatted = mandant.geburtsdatum
    ? new Date(mandant.geburtsdatum).toLocaleDateString("de-DE")
    : null;

  return (
    <div className="p-6 lg:p-10 space-y-6 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(backTarget)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{mandant.mandanten_nummer}</span>
            <h1 className="text-2xl font-bold text-foreground">{mandant.name}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            {mandant.firma && (
              <span className="flex items-center gap-1"><Building2 className="h-4 w-4" /> {mandant.firma}</span>
            )}
            {mandant.unternehmensform && (
              <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" /> {mandant.unternehmensform}</span>
            )}
          </div>
        </div>
        {(rolle === "Sekretariat" || rolle === "Chef") && (
          <Button onClick={() => setNeueBuchhaltungOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Neue Buchhaltung
          </Button>
        )}
      </div>

      <NeueBuchhaltungDialog
        mandanten={[{ id: mandant.id, name: mandant.name, firma: mandant.firma, zugewiesener_bearbeiter_id: mandant.zugewiesener_bearbeiter_id }]}
        preselectedMandantId={mandant.id}
        hideMandantSelect
        hideTrigger
        open={neueBuchhaltungOpen}
        onOpenChange={setNeueBuchhaltungOpen}
        onCreated={fetchAll}
      />

      {/* Stammdaten Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="card-elevated border-0 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Persönliche Daten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <InfoItem icon={User} label="Vorname" value={mandant.vorname} />
            <InfoItem icon={User} label="Nachname" value={mandant.nachname} />
            <InfoItem icon={Calendar} label="Geburtsdatum" value={geburtsdatumFormatted} />
            {!mandant.vorname && !mandant.nachname && !mandant.geburtsdatum && (
              <p className="text-xs text-muted-foreground italic py-2">Keine Daten hinterlegt</p>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated border-0 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Kontaktdaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <InfoItem icon={Mail} label="E-Mail" value={mandant.email} />
            <div className="flex items-center justify-between gap-2">
              <InfoItem icon={Phone} label="Telefon" value={mandant.telefon} />
              {mandant.telefon && (
                <WhatsAppButton telefon={mandant.telefon} mandantName={mandant.vorname ?? mandant.name} />
              )}
            </div>
            <InfoItem icon={MapPin} label="Adresse" value={adresse || null} />
            {!mandant.email && !mandant.telefon && !adresse && (
              <p className="text-xs text-muted-foreground italic py-2">Keine Daten hinterlegt</p>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated border-0 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Steuerliche Daten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <InfoItem icon={Hash} label="Steuernummer" value={mandant.steuernummer} />
            <InfoItem icon={CreditCard} label="Steuer-ID" value={mandant.steuer_id} />
            <InfoItem icon={CreditCard} label="USt-IdNr." value={mandant.umsatzsteuer_id} />
            <InfoItem icon={Briefcase} label="Unternehmensform" value={mandant.unternehmensform} />
            {!mandant.steuernummer && !mandant.steuer_id && !mandant.umsatzsteuer_id && !mandant.unternehmensform && (
              <p className="text-xs text-muted-foreground italic py-2">Keine Daten hinterlegt</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stamm-Sachbearbeiter */}
      <Card className="card-elevated border-0 shadow-none">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2.5 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Stamm-Sachbearbeiter</p>
            {mandant.bearbeiter?.name ? (
              <p className="text-sm font-medium text-foreground">{mandant.bearbeiter.name}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                Noch nicht zugewiesen — wird bei der ersten Buchhaltung festgelegt.
              </p>
            )}
          </div>
          {rolle === "Chef" && mandant.bearbeiter?.name && (
            <span className="text-xs text-muted-foreground">
              Wechsel über „Bearbeiten" einer Buchhaltung
            </span>
          )}
        </CardContent>
      </Card>

      {mandant.notizen && (
        <Card className="card-elevated border-0 shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Interne Notizen</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{mandant.notizen}</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: "Gesamt", value: stats.total, icon: <FileText className="h-5 w-5" />, color: "text-primary" },
          { label: "Offen", value: stats.open, icon: <Clock className="h-5 w-5" />, color: "text-yellow-600" },
          { label: "Erledigt", value: stats.done, icon: <CheckCircle className="h-5 w-5" />, color: "text-green-600" },
          { label: "Überfällig", value: stats.overdue, icon: <AlertOctagon className="h-5 w-5" />, color: "text-red-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Buchhaltungen Table */}
      <Card className="card-elevated border-0 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="table-modern">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Buchhaltung</TableHead>
                <TableHead>Monat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Frist</TableHead>
                <TableHead>Belege</TableHead>
                <TableHead>Bearbeiter</TableHead>
                <TableHead className="hidden xl:table-cell">Belegeingang</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buchhaltungen.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    Keine Buchhaltungen für diesen Mandanten.
                  </TableCell>
                </TableRow>
              ) : (
                visibleBuchhaltungen.map((b) => (
                  <Fragment key={b.id}>
                    <TableRow key={b.id} className={getDeadlineStatus(b.faellig_am, b.status) === "red" ? "bg-destructive/5" : ""}>
                      <TableCell className="w-[180px] p-2">
                        <Button
                          variant={b.hat_abschluss ? "default" : "outline"}
                          size="sm"
                          className={b.hat_abschluss ? "bg-green-600 hover:bg-green-700 text-white w-full" : "w-full"}
                          onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                        >
                          {b.hat_abschluss ? (
                            <><FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Buchhaltung</>
                          ) : (
                            <><FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Anzeigen</>
                          )}
                          {expandedId === b.id ? <ChevronDown className="h-3.5 w-3.5 ml-1" /> : <ChevronRight className="h-3.5 w-3.5 ml-1" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {b.monat}
                        {b.status === "Warten auf Mandant" && b.notizen && (
                          <p className="text-xs text-destructive mt-1 line-clamp-2 font-normal" title={b.notizen}>
                            📝 {b.notizen}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={b.status} />
                          {b.hat_abschluss && (
                            <Badge
                              variant="outline"
                              className="w-fit gap-1 border-green-600 text-green-700 cursor-pointer hover:bg-green-50"
                              onClick={() => navigate("/buchhaltungen")}
                              title="Im Archiv ansehen"
                            >
                              <FileSpreadsheet className="h-3 w-3" /> Buchhaltung erstellt
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><DeadlineIndicator faelligAm={b.faellig_am} status={b.status} /></TableCell>
                      <TableCell>
                        <BelegeVollansicht
                          buchhaltungId={b.id}
                          mandantId={mandant.id}
                          mandantName={mandant.name}
                          monat={b.monat}
                          dokumenteCount={b.dokumente_count}
                          onChanged={fetchAll}
                        />
                        <div className="mt-1.5">
                          <BuchhaltungsPaketDialog
                            buchhaltungId={b.id}
                            status={b.status}
                            monat={b.monat}
                            mandantName={mandant.name}
                            hatAbschluss={b.hat_abschluss}
                            onChanged={fetchAll}
                          />
                        </div>
                      </TableCell>
                      <TableCell>{b.bearbeiter?.name ?? "–"}</TableCell>
                      <TableCell className="hidden xl:table-cell">{b.belegeingang_datum ?? "–"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {rolle && (
                            <StatusTransitionWithFortschritt
                              buchhaltungId={b.id}
                              currentStatus={b.status}
                              rolle={rolle}
                              onStatusChanged={fetchAll}
                            />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingBuchhaltung(b)}>
                                <Pencil className="h-4 w-4 mr-2" /> Bearbeiten
                              </DropdownMenuItem>
                              {(rolle === "Chef" || rolle === "Sekretariat") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(b.id)}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Löschen
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === b.id && (
                      <TableRow key={b.id + "-expand"} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={8} className="p-4 space-y-4">
                          {b.dokumente_count > 0 && (
                            <BuchungsFortschritt buchhaltungId={b.id} />
                          )}
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Buchungen</p>
                            <BuchungenListe
                              buchhaltungId={b.id}
                              mandantId={mandant?.id ?? ""}
                              mandantName={mandant?.name ?? "Mandant"}
                              monat={b.monat}
                              onChanged={() => { fetchAll(); setSteuerRefreshKey((k) => k + 1); }}
                            />
                          </div>
                          <BuchhaltungsPaket
                            buchhaltungId={b.id}
                            status={b.status}
                            monat={b.monat}
                            mandantName={mandant?.firma || mandant?.name || "Mandant"}
                            refreshKey={steuerRefreshKey}
                            onChanged={() => { fetchAll(); setSteuerRefreshKey((k) => k + 1); }}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          {bhTotal > 0 && (
            <PaginationFooter
              page={bhPage}
              totalPages={bhTotalPages}
              total={bhTotal}
              shown={bhShown}
              onPageChange={bhGoTo}
              label="Buchhaltungen"
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>

      {editingBuchhaltung && (
        <BuchhaltungBearbeitenDialog
          open={!!editingBuchhaltung}
          onOpenChange={(open) => { if (!open) setEditingBuchhaltung(null); }}
          buchhaltung={{ ...editingBuchhaltung, mandant_id: mandant.id }}
          onSaved={fetchAll}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buchhaltung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Buchhaltung und alle zugehörigen Belege werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteId) return;
                const { data: docs } = await supabase
                  .from("buchhaltung_dokumente")
                  .select("id, dateipfad")
                  .eq("buchhaltung_id", deleteId);
                if (docs && docs.length > 0) {
                  await supabase.storage.from("belege").remove(docs.map((d) => d.dateipfad));
                  await supabase.from("buchhaltung_dokumente").delete().eq("buchhaltung_id", deleteId);
                }
                await supabase.from("benachrichtigungen").delete().eq("buchhaltung_id", deleteId);
                const { error } = await supabase.from("buchhaltungen").delete().eq("id", deleteId);
                if (error) {
                  toast({ title: "Fehler", description: error.message, variant: "destructive" });
                } else {
                  toast({ title: "Gelöscht" });
                  fetchAll();
                }
                setDeleteId(null);
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
