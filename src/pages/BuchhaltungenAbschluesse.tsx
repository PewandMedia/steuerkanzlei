import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { elsterCsvExport, type UStVAKennziffern } from "@/lib/buchhaltung-erstellung";
import { downloadFromStorage, openFromStorage } from "@/lib/pdf-download";
import { ElsterUebergabe } from "@/components/ElsterUebergabe";
import {
  FileSpreadsheet,
  Download,
  Receipt,
  FileText,
  CheckCircle2,
  Lock,
  Building2,
  Inbox,
  Loader2,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { PaginationFooter } from "@/components/PaginationFooter";
import { usePageSize } from "@/hooks/use-page-size";
import { fetchAll } from "@/lib/fetch-all";
import { useFocusRow } from "@/hooks/use-focus-row";

interface AbschlussRow {
  id: string;
  buchhaltung_id: string;
  erstellt_am: string;
  buchhaltung_status?: string | null;
  freigegeben_am: string | null;
  finanzamt_eingereicht_am: string | null;
  finanzamt_referenz: string | null;
  paket_pdf_pfad: string | null;
  journal_pdf_pfad: string | null;
  susa_pdf_pfad: string | null;
  ustva_pdf_pfad: string | null;
  ustva_kennziffern: Record<string, number>;
  buchhaltung: {
    id: string;
    monat: string;
    status?: string | null;
    mandant: { id: string; name: string; firma: string | null } | null;
  } | null;
}

type StatusFilter = "all" | "abgeschlossen" | "freigegeben" | "eingereicht";

export default function BuchhaltungenAbschluesse() {
  usePageMeta("Buchhaltungen & Abschlüsse", "Erstellte Buchhaltungen, Status und Abschlüsse.");

  const { rolle, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<AbschlussRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [mandantFilter, setMandantFilter] = useState<string>("all");
  const [monatFilter, setMonatFilter] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [elsterRow, setElsterRow] = useState<AbschlussRow | null>(null);
  const [elsterBuchungen, setElsterBuchungen] = useState<any[]>([]);
  const [elsterLoading, setElsterLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    let abschlData: any[] = [];
    let erledigtData: any[] = [];
    try {
      [abschlData, erledigtData] = await Promise.all([
        fetchAll<any>((from, to) =>
          supabase
            .from("buchhaltungs_abschluesse")
            .select(`
              id, buchhaltung_id, erstellt_am, freigegeben_am, finanzamt_eingereicht_am, finanzamt_referenz,
              paket_pdf_pfad, journal_pdf_pfad, susa_pdf_pfad, ustva_pdf_pfad, ustva_kennziffern,
              buchhaltung:buchhaltungen!buchhaltungs_abschluesse_buchhaltung_id_fkey(
                id, monat, status, mandant:mandanten(id, name, firma)
              )
            `)
            .order("erstellt_am", { ascending: false })
            .order("id", { ascending: true })
            .range(from, to) as any,
        ),
        fetchAll<any>((from, to) =>
          supabase
            .from("buchhaltungen")
            .select("id, monat, fertiggestellt_datum, erstellt_am, abgabe_datum, mandant:mandanten(id, name, firma), buchhaltungs_abschluesse(id)")
            .eq("status", "Buchhaltung erledigt")
            .order("erstellt_am", { ascending: false })
            .order("id", { ascending: true })
            .range(from, to) as any,
        ),
      ]);
    } catch (e: any) {
      toast({ title: "Fehler beim Laden", description: e?.message ?? String(e), variant: "destructive" });
      setRows([]);
      setLoading(false);
      return;
    }

    const abschluesse = (abschlData as unknown as AbschlussRow[]).map((row) => ({
      ...row,
      buchhaltung_status: row.buchhaltung?.status ?? null,
    }));
    const abschlussBuchhIds = new Set(abschluesse.map((a) => a.buchhaltung_id));

    // Virtuelle Zeilen für Buchhaltungen, die "erledigt" sind aber kein Abschluss-Paket haben
    // (z.B. reine Weiterleitungs-Buchhaltungen)
    const virtuelle: AbschlussRow[] = (erledigtData as any[])
      .filter((b) => !abschlussBuchhIds.has(b.id))
      .map((b) => ({
        id: `virtual-${b.id}`,
        buchhaltung_id: b.id,
        erstellt_am: b.fertiggestellt_datum || b.abgabe_datum || b.erstellt_am,
        buchhaltung_status: b.status,
        freigegeben_am: b.fertiggestellt_datum || b.erstellt_am,
        finanzamt_eingereicht_am: b.abgabe_datum,
        finanzamt_referenz: null,
        paket_pdf_pfad: null,
        journal_pdf_pfad: null,
        susa_pdf_pfad: null,
        ustva_pdf_pfad: null,
        ustva_kennziffern: {},
        buchhaltung: { id: b.id, monat: b.monat, mandant: b.mandant },
      }));

    const merged = [...abschluesse, ...virtuelle].sort((a, b) =>
      (b.erstellt_am ?? "").localeCompare(a.erstellt_am ?? "")
    );

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const mandantenList = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      const m = r.buchhaltung?.mandant;
      if (m) map.set(m.id, m.firma || m.name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (mandantFilter !== "all" && r.buchhaltung?.mandant?.id !== mandantFilter) return false;
      if (monatFilter && !(r.buchhaltung?.monat ?? "").toLowerCase().includes(monatFilter.toLowerCase())) return false;
      const istErledigt = r.buchhaltung_status === "Buchhaltung erledigt" || !!r.freigegeben_am;
      if (statusFilter === "eingereicht" && !r.finanzamt_eingereicht_am) return false;
      if (statusFilter === "freigegeben" && (!istErledigt || r.finanzamt_eingereicht_am)) return false;
      if (statusFilter === "abgeschlossen" && istErledigt) return false;
      return true;
    });
  }, [rows, mandantFilter, monatFilter, statusFilter]);

  const paginationKey = `${statusFilter}|${mandantFilter}|${monatFilter}`;
  const [pageSize, setPageSize] = usePageSize("pageSize:buchhaltungen");
  const { visible: visibleRows, page, totalPages, goToPage, total: totalRows, shown: shownRows } =
    usePaginatedList(filtered, pageSize, paginationKey);

  const { focusId, highlightId, setRef } = useFocusRow();
  useEffect(() => {
    if (!focusId) return;
    const idx = filtered.findIndex((r) => r.buchhaltung_id === focusId);
    if (idx < 0) return;
    const targetPage = Math.floor(idx / pageSize) + 1;
    if (targetPage !== page) goToPage(targetPage);
  }, [focusId, filtered, pageSize, page, goToPage]);

  const stats = useMemo(() => {
    const total = rows.length;
    const eingereicht = rows.filter((r) => r.finanzamt_eingereicht_am).length;
    const freigegeben = rows.filter((r) => (r.buchhaltung_status === "Buchhaltung erledigt" || !!r.freigegeben_am) && !r.finanzamt_eingereicht_am).length;
    const offen = rows.filter((r) => r.buchhaltung_status !== "Buchhaltung erledigt" && !r.freigegeben_am).length;
    return { total, eingereicht, freigegeben, offen };
  }, [rows]);

  const sanitize = (s: string) => s.replace(/[^\w.-]+/g, "_");

  const downloadPdf = async (
    rowId: string,
    pfad: string | null,
    label: string,
    mandant: string,
    monat: string,
  ) => {
    if (!pfad) {
      toast({ title: "Datei nicht verfügbar", variant: "destructive" });
      return;
    }
    const key = `dl:${rowId}:${label}`;
    setBusyKey(key);
    try {
      await downloadFromStorage(
        "buchhaltungen",
        pfad,
        `${sanitize(label)}_${sanitize(mandant)}_${sanitize(monat)}.pdf`,
      );
    } catch (e: any) {
      toast({ title: "Download fehlgeschlagen", description: e?.message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  const openPdf = async (rowId: string, pfad: string | null, label: string) => {
    if (!pfad) {
      toast({ title: "Datei nicht verfügbar", variant: "destructive" });
      return;
    }
    const key = `open:${rowId}:${label}`;
    setBusyKey(key);
    try {
      await openFromStorage("buchhaltungen", pfad);
    } catch (e: any) {
      toast({ title: "Öffnen fehlgeschlagen", description: e?.message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  const downloadElster = (r: AbschlussRow) => {
    const mandant = r.buchhaltung?.mandant?.firma || r.buchhaltung?.mandant?.name || "Mandant";
    const monat = r.buchhaltung?.monat || "";
    const csv = elsterCsvExport(r.ustva_kennziffern as unknown as UStVAKennziffern, monat, mandant);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `UStVA_ELSTER_${mandant}_${monat}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openElster = async (r: AbschlussRow) => {
    setElsterRow(r);
    setElsterLoading(true);
    try {
      const data = await fetchAll<any>((from, to) =>
        supabase
          .from("buchungen")
          .select("id, buchungsdatum, lieferant, konto, kategorie, betrag, beschreibung, mwst_satz, dokument_id")
          .eq("buchhaltung_id", r.buchhaltung_id)
          .order("buchungsdatum", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to) as any,
      );
      setElsterBuchungen(data);
    } catch (e: any) {
      toast({ title: "Fehler beim Laden der Buchungen", description: e?.message ?? String(e), variant: "destructive" });
      setElsterBuchungen([]);
    }
    setElsterLoading(false);
  };

  const handleElsterEingereicht = async (referenz: string) => {
    if (!elsterRow) return;
    const today = new Date().toISOString().split("T")[0];
    const { error: e1 } = await supabase
      .from("buchhaltungs_abschluesse")
      .update({ finanzamt_eingereicht_am: today, finanzamt_referenz: referenz || null })
      .eq("id", elsterRow.id);
    const { error: e2 } = await supabase
      .from("buchhaltungen")
      .update({ status: "Buchhaltung erledigt", abgabe_datum: today })
      .eq("id", elsterRow.buchhaltung_id);
    if (e1 || e2) {
      toast({ title: "Fehler", description: (e1 || e2)?.message, variant: "destructive" });
    } else {
      toast({ title: "Beim Finanzamt eingereicht" });
      setElsterRow(null);
      await load();
    }
  };

  const renderStatusBadge = (r: AbschlussRow) => {
    const istErledigt = r.buchhaltung_status === "Buchhaltung erledigt" || !!r.freigegeben_am;
    if (r.finanzamt_eingereicht_am) {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-600/90 gap-1">
          <Building2 className="h-3 w-3" /> Eingereicht
        </Badge>
      );
    }
    if (istErledigt) {
      return (
        <Badge className="bg-green-600 hover:bg-green-600/90 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Erledigt
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Lock className="h-3 w-3" /> Wartet auf Erledigt
      </Badge>
    );
  };

  if (authLoading) return null;
  if (rolle === "Sekretariat") return <Navigate to="/dashboard" replace />;

  return (
    <div className="p-6 lg:p-10 space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          Erstellte Buchhaltungen
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Zentrales Archiv aller erstellten Buchhaltungs-Pakete (Journal · SuSa · UStVA · ELSTER-CSV).
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Gesamt", value: stats.total, icon: <FileSpreadsheet className="h-5 w-5" />, color: "text-primary" },
          { label: "Wartet auf Erledigt", value: stats.offen, icon: <Lock className="h-5 w-5" />, color: "text-yellow-600" },
          { label: "Erledigt", value: stats.freigegeben, icon: <CheckCircle2 className="h-5 w-5" />, color: "text-green-600" },
          { label: "Beim Finanzamt", value: stats.eingereicht, icon: <Building2 className="h-5 w-5" />, color: "text-blue-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-md bg-muted p-2 ${s.color}`}>{s.icon}</div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="abgeschlossen">Wartet auf Erledigt</SelectItem>
            <SelectItem value="freigegeben">Erledigt</SelectItem>
            <SelectItem value="eingereicht">Beim Finanzamt</SelectItem>
          </SelectContent>
        </Select>
        <Select value={mandantFilter} onValueChange={setMandantFilter}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Mandant" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Mandanten</SelectItem>
            {mandantenList.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-9 w-[140px]"
          placeholder="Monat z.B. 01-2026"
          value={monatFilter}
          onChange={(e) => setMonatFilter(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card className="card-elevated border-0 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="table-modern">
            <TableHeader>
              <TableRow>
                <TableHead>Mandant</TableHead>
                <TableHead>Monat</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Downloads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Lade …
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Noch keine Buchhaltungen erstellt</p>
                    <p className="text-sm">
                      Sobald eine Buchhaltung im Dashboard abgeschlossen wird, erscheint sie hier.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((r) => {
                  const mandantName = r.buchhaltung?.mandant?.firma || r.buchhaltung?.mandant?.name || "–";
                  const monat = r.buchhaltung?.monat ?? "–";
                  const isVirtual = r.id.startsWith("virtual-");
                  return (
                    <TableRow
                      key={r.id}
                      ref={setRef(r.buchhaltung_id) as any}
                      className={["hover:bg-muted/50", highlightId === r.buchhaltung_id ? "focus-row-highlight" : ""].filter(Boolean).join(" ")}
                    >
                      <TableCell className="font-medium">{mandantName}</TableCell>
                      <TableCell>{monat}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.erstellt_am).toLocaleDateString("de-DE")}
                      </TableCell>
                      <TableCell>
                        {isVirtual ? (
                          <Badge className="bg-green-600 hover:bg-green-600/90 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Erledigt
                          </Badge>
                        ) : (
                          renderStatusBadge(r)
                        )}
                      </TableCell>
                      <TableCell>
                        {isVirtual ? (
                          <span className="text-xs text-muted-foreground italic">
                            Kein Buchhaltungs-Paket erstellt (Weiterleitung)
                          </span>
                        ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: "Buchhaltungs-Paket", short: "Komplett-Paket", pfad: r.paket_pdf_pfad, icon: Download, primary: true },
                            { label: "UStVA", short: "UStVA", pfad: r.ustva_pdf_pfad, icon: Receipt, primary: false },
                            { label: "SuSa", short: "SuSa", pfad: r.susa_pdf_pfad, icon: FileText, primary: false },
                            { label: "Journal", short: "Journal", pfad: r.journal_pdf_pfad, icon: FileText, primary: false },
                          ].map(({ label, short, pfad, icon: Icon, primary }) => {
                            const dlBusy = busyKey === `dl:${r.id}:${label}`;
                            const opBusy = busyKey === `open:${r.id}:${label}`;
                            const disabled = !pfad || dlBusy || opBusy;
                            return (
                              <div
                                key={label}
                                className={`inline-flex rounded-md overflow-hidden border ${primary ? "border-primary" : "bg-background"}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => downloadPdf(r.id, pfad, label, mandantName, monat)}
                                  disabled={disabled}
                                  className={`inline-flex items-center gap-1 px-2.5 h-9 text-sm disabled:opacity-50 disabled:pointer-events-none ${
                                    primary
                                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                      : "hover:bg-accent"
                                  }`}
                                >
                                  {dlBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                                  {short}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openPdf(r.id, pfad, label)}
                                  disabled={disabled}
                                  title={`${label} in neuem Tab öffnen`}
                                  aria-label={`${label} in neuem Tab öffnen`}
                                  className={`inline-flex items-center justify-center w-9 h-9 border-l disabled:opacity-50 disabled:pointer-events-none ${
                                    primary
                                      ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary-foreground/20"
                                      : "hover:bg-accent"
                                  }`}
                                >
                                  {opBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            );
                          })}
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openElster(r)}
                            className="gap-1"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            ELSTER-Übergabe
                          </Button>
                          {(r.buchhaltung_status === "Buchhaltung erledigt" || !!r.freigegeben_am) && (
                            <Button size="sm" variant="outline" onClick={() => downloadElster(r)}>
                              <Download className="h-3.5 w-3.5 mr-1" /> ELSTER-CSV
                            </Button>
                          )}
                        </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
          {!loading && totalRows > 0 && (
            <PaginationFooter
              page={page}
              totalPages={totalPages}
              total={totalRows}
              shown={shownRows}
              onPageChange={goToPage}
              label="Buchhaltungen"
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* ELSTER-Übergabe Dialog */}
      <Dialog open={!!elsterRow} onOpenChange={(o) => { if (!o) setElsterRow(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              ELSTER-Übergabe
            </DialogTitle>
          </DialogHeader>
          {elsterRow && (
            elsterLoading ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Lade Buchungen …
              </div>
            ) : (
              <ElsterUebergabe
                mandantName={elsterRow.buchhaltung?.mandant?.firma || elsterRow.buchhaltung?.mandant?.name || "Mandant"}
                monat={elsterRow.buchhaltung?.monat ?? ""}
                ustva={elsterRow.ustva_kennziffern as unknown as UStVAKennziffern}
                buchungen={elsterBuchungen}
                fortschritt={{
                  total: elsterBuchungen.length,
                  gebucht: elsterBuchungen.length,
                  offen: 0,
                  allBooked: true,
                }}
                istAbgeschlossen={true}
                istFreigegeben={elsterRow.buchhaltung_status === "Buchhaltung erledigt" || !!elsterRow.freigegeben_am}
                istEingereicht={!!elsterRow.finanzamt_eingereicht_am}
                kannEingereichtMarkieren={(elsterRow.buchhaltung_status === "Buchhaltung erledigt" || !!elsterRow.freigegeben_am) && !elsterRow.finanzamt_eingereicht_am}
                finanzamtReferenz={elsterRow.finanzamt_referenz}
                onEingereicht={handleElsterEingereicht}
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
