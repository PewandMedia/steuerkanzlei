import { useEffect, useState, useMemo, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusTransitionWithFortschritt } from "@/components/StatusTransitionWithFortschritt";

import { DeadlineIndicator } from "@/components/DeadlineIndicator";
import { BelegeVollansicht } from "@/components/BelegeVollansicht";
import { NeueBuchhaltungDialog } from "@/components/NeueBuchhaltungDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Constants } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";
import { FileText, Clock, AlertTriangle, CheckCircle, AlertOctagon, Inbox, MoreHorizontal, Pencil, Trash2, MessageSquare, PhoneCall, ChevronDown, ChevronRight, FileSpreadsheet, PlayCircle, Search, Flame, Star, Send, X, Briefcase, ClipboardCheck, Loader2 } from "lucide-react";
import { Sparkles, Forward } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BuchhaltungBearbeitenDialog } from "@/components/BuchhaltungBearbeitenDialog";
import { MandantKontaktDialog } from "@/components/MandantKontaktDialog";
import { BelegeingaengeListeDialog } from "@/components/BelegeingaengeListeDialog";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { toast } from "@/hooks/use-toast";
import { getDeadlineStatus } from "@/lib/deadline-utils";
import { getPrioritaet, istUeberfaellig, istBaldFaellig, inDieserWoche, inDiesemMonat, compareFaellig } from "@/lib/dashboard-prioritaet";
import { usePageMeta } from "@/hooks/use-page-meta";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { PaginationFooter } from "@/components/PaginationFooter";
import { usePageSize } from "@/hooks/use-page-size";
import { fetchAll } from "@/lib/fetch-all";
import { useFocusRow } from "@/hooks/use-focus-row";

type BuchhaltungStatus = Database["public"]["Enums"]["buchhaltung_status"];

interface BuchhaltungRow {
  id: string;
  monat: string;
  status: BuchhaltungStatus;
  belegeingang_datum: string | null;
  fertiggestellt_datum: string | null;
  abgabe_datum: string | null;
  faellig_am: string | null;
  notizen: string | null;
  mandant: { id: string; mandanten_nummer: string | null; name: string; firma: string | null; telefon: string | null; email: string | null } | null;
  bearbeiter: { name: string } | null;
  bearbeiter_id: string;
  mandant_id: string;
  dokumente_count: number;
  hat_abschluss: boolean;
  dauerfristverlaengerung: boolean;
  faellig_am_manuell: boolean;
  automatisierung_aktiv: boolean;
  zurueckgewiesen_am: string | null;
  co_bearbeiter: { id: string; name: string }[];
  dokumente_ocr_done: number;
  belegeingaenge: { id: string; datum: string; notiz: string | null }[];
  gruppen_id: string | null;
}

export default function Dashboard() {
  usePageMeta("Dashboard", "Übersicht aller offenen Buchhaltungen, Fristen und Prioritäten.");

  const { rolle, benutzerId } = useAuth();
  const navigate = useNavigate();
  const [buchhaltungen, setBuchhaltungen] = useState<BuchhaltungRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bearbeiterFilter, setBearbeiterFilter] = useState<string>("all");
  const [monatFilter, setMonatFilter] = useState("");
  const [fristFilter, setFristFilter] = useState<"all" | "ueberfaellig" | "woche" | "monat">("all");
  const [modusFilter, setModusFilter] = useState<"all" | "weiterleitung" | "automatisierung">("all");
  const [suche, setSuche] = useState("");
  const [sortierung, setSortierung] = useState<"prioritaet" | "frist" | "mandant" | "erstellt">("prioritaet");
  const [nurMeine, setNurMeine] = useState(false);
  const [mandanten, setMandanten] = useState<{ id: string; name: string; firma: string | null; zugewiesener_bearbeiter_id: string | null; dauerfristverlaengerung: boolean }[]>([]);
  const [editingBuchhaltung, setEditingBuchhaltung] = useState<BuchhaltungRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [kontaktBuchhaltung, setKontaktBuchhaltung] = useState<BuchhaltungRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [belegeingaengeDialog, setBelegeingaengeDialog] = useState<BuchhaltungRow | null>(null);
  // ocr batch button removed

  // Sachbearbeiter standardmäßig nur eigene anzeigen
  useEffect(() => {
    if (rolle === "Sachbearbeiter") setNurMeine(true);
  }, [rolle]);

  const fetchData = async () => {
    let data: any[] = [];
    try {
      data = await fetchAll<any>((from, to) =>
        supabase
          .from("buchhaltungen")
          .select("id, monat, status, belegeingang_datum, fertiggestellt_datum, abgabe_datum, faellig_am, faellig_am_manuell, dauerfristverlaengerung, automatisierung_aktiv, zurueckgewiesen_am, notizen, bearbeiter_id, mandant_id, gruppen_id, mandant:mandanten(id, mandanten_nummer, name, firma, telefon, email), bearbeiter:benutzer!buchhaltungen_bearbeiter_id_fkey(name), buchhaltung_dokumente(id, ocr_status), buchhaltungs_abschluesse(id), co:buchhaltung_co_bearbeiter(bearbeiter:benutzer!buchhaltung_co_bearbeiter_bearbeiter_id_fkey(id, name)), belegeingaenge(id, datum, notiz)")
          .order("erstellt_am", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to) as any,
      );
    } catch {
      data = [];
    }

    setBuchhaltungen(
      data.map((d: any) => {
        const docs = Array.isArray(d.buchhaltung_dokumente) ? d.buchhaltung_dokumente : [];
        return {
        id: d.id,
        monat: d.monat,
        status: d.status,
        belegeingang_datum: d.belegeingang_datum,
        fertiggestellt_datum: d.fertiggestellt_datum,
        abgabe_datum: d.abgabe_datum,
        faellig_am: d.faellig_am,
        faellig_am_manuell: !!d.faellig_am_manuell,
        dauerfristverlaengerung: !!d.dauerfristverlaengerung,
        automatisierung_aktiv: !!d.automatisierung_aktiv,
        zurueckgewiesen_am: d.zurueckgewiesen_am ?? null,
        notizen: d.notizen,
        bearbeiter_id: d.bearbeiter_id,
        mandant_id: d.mandant_id,
        mandant: d.mandant,
        bearbeiter: d.bearbeiter,
        dokumente_count: docs.length,
        dokumente_ocr_done: docs.filter((x: any) => x.ocr_status === "done").length,
        hat_abschluss: Array.isArray(d.buchhaltungs_abschluesse) && d.buchhaltungs_abschluesse.length > 0,
        co_bearbeiter: Array.isArray(d.co)
          ? d.co.map((c: any) => c.bearbeiter).filter(Boolean)
          : [],
        belegeingaenge: Array.isArray(d.belegeingaenge)
          ? [...d.belegeingaenge]
              .map((e: any) => ({ id: e.id, datum: e.datum, notiz: e.notiz ?? null }))
              .sort((a, b) => a.datum.localeCompare(b.datum))
          : [],
        gruppen_id: d.gruppen_id ?? null,
        };
      })
    );
  };

  const fetchMandanten = async () => {
    let data: any[] = [];
    try {
      data = await fetchAll<any>((from, to) =>
        supabase
          .from("mandanten")
          .select("id, mandanten_nummer, name, firma, zugewiesener_bearbeiter_id, dauerfristverlaengerung")
          .order("mandanten_nummer")
          .order("id", { ascending: true })
          .range(from, to) as any,
      );
    } catch {
      data = [];
    }
    setMandanten(data.map((m: any) => ({ ...m, dauerfristverlaengerung: !!m.dauerfristverlaengerung })));
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchMandanten(); }, []);


  const bearbeiterList = useMemo(() => {
    const names = new Set<string>();
    buchhaltungen.forEach((b) => { if (b.bearbeiter?.name) names.add(b.bearbeiter.name); });
    return Array.from(names).sort();
  }, [buchhaltungen]);

  const filtered = useMemo(() => {
    const sucheLower = suche.trim().toLowerCase();
    const result = buchhaltungen.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (bearbeiterFilter !== "all" && b.bearbeiter?.name !== bearbeiterFilter) return false;
      if (modusFilter === "weiterleitung" && b.automatisierung_aktiv) return false;
      if (modusFilter === "automatisierung" && !b.automatisierung_aktiv) return false;
      if (monatFilter && !b.monat.toLowerCase().includes(monatFilter.toLowerCase())) return false;
      if (nurMeine && benutzerId) {
        const istHaupt = b.bearbeiter_id === benutzerId;
        const istCo = b.co_bearbeiter.some((c) => c.id === benutzerId);
        if (!istHaupt && !istCo) return false;
      }
      if (fristFilter === "ueberfaellig" && !istUeberfaellig(b)) return false;
      if (fristFilter === "woche" && !inDieserWoche(b.faellig_am)) return false;
      if (fristFilter === "monat" && !inDiesemMonat(b.faellig_am)) return false;
      if (sucheLower) {
        const haystack = [
          b.mandant?.name,
          b.mandant?.firma,
          b.monat,
          b.notizen,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(sucheLower)) return false;
      }
      return true;
    });

    return result.sort((a, b) => {
      // „In Prüfung"-Einträge immer nach Abgabezeitpunkt sortieren (älteste = zuerst abgegeben oben),
      // unabhängig von der gewählten Sortierung. Fairness für den Sachbearbeiter, der zuerst geliefert hat.
      if (a.status === "In Prüfung" && b.status === "In Prüfung") {
        const av = a.abgabe_datum ?? a.fertiggestellt_datum ?? "";
        const bv = b.abgabe_datum ?? b.fertiggestellt_datum ?? "";
        if (av && bv && av !== bv) return av.localeCompare(bv);
        if (av && !bv) return -1;
        if (!av && bv) return 1;
      }
      // Offene Einträge: wer früher Belege eingereicht hat, ist zuerst dran (fair).
      const istOffenA = a.status === "Eingegangen" || a.status === "In Bearbeitung" || a.status === "Warten auf Mandant";
      const istOffenB = b.status === "Eingegangen" || b.status === "In Bearbeitung" || b.status === "Warten auf Mandant";
      if (istOffenA && istOffenB && a.belegeingang_datum && b.belegeingang_datum && a.belegeingang_datum !== b.belegeingang_datum) {
        return a.belegeingang_datum.localeCompare(b.belegeingang_datum);
      }
      switch (sortierung) {
        case "frist":
          return compareFaellig(a.faellig_am, b.faellig_am);
        case "mandant":
          return (a.mandant?.name ?? "").localeCompare(b.mandant?.name ?? "", "de");
        case "erstellt":
          return 0; // already ordered desc by erstellt_am from query
        case "prioritaet":
        default: {
          const pa = getPrioritaet(a);
          const pb = getPrioritaet(b);
          if (pa !== pb) return pa - pb;
          return compareFaellig(a.faellig_am, b.faellig_am);
        }
      }
    });
  }, [buchhaltungen, statusFilter, bearbeiterFilter, monatFilter, fristFilter, suche, sortierung, nurMeine, benutzerId]);

  // Pagination — initial 10, weitere per Button / Auto-Load on Scroll
  const paginationKey = `${statusFilter}|${bearbeiterFilter}|${monatFilter}|${fristFilter}|${modusFilter}|${suche}|${sortierung}|${nurMeine}`;
  const [pageSize, setPageSize] = usePageSize("pageSize:dashboard");
  const { visible: visibleRows, page, totalPages, goToPage, total: totalRows, shown: shownRows } =
    usePaginatedList(filtered, pageSize, paginationKey);

  // Fokus aus Benachrichtigung: Filter zurücksetzen, richtige Seite ansteuern,
  // Zeile per Ref hervorheben.
  const { focusId, highlightId, setRef } = useFocusRow();
  useEffect(() => {
    if (!focusId) return;
    const exists = buchhaltungen.some((b) => b.id === focusId);
    if (!exists) return;
    // Filter weich zurücksetzen, damit die Zeile garantiert sichtbar ist
    setStatusFilter("all");
    setBearbeiterFilter("all");
    setFristFilter("all");
    setModusFilter("all");
    setMonatFilter("");
    setSuche("");
    setNurMeine(false);
  }, [focusId, buchhaltungen]);
  useEffect(() => {
    if (!focusId) return;
    const idx = filtered.findIndex((b) => b.id === focusId);
    if (idx < 0) return;
    const targetPage = Math.floor(idx / pageSize) + 1;
    if (targetPage !== page) goToPage(targetPage);
  }, [focusId, filtered, pageSize, page, goToPage]);

  const stats = useMemo(() => {
    const overdue = buchhaltungen.filter(istUeberfaellig).length;
    const soon = buchhaltungen.filter(istBaldFaellig).length;
    const inProgress = buchhaltungen.filter((b) => b.status === "In Bearbeitung").length;
    const waiting = buchhaltungen.filter((b) => b.status === "Warten auf Mandant").length;
    const done = buchhaltungen.filter((b) => b.status === "Buchhaltung erledigt").length;
    return [
      { label: "Überfällig", value: overdue, icon: <AlertOctagon className="h-4 w-4" />, colorClass: "text-destructive", onClick: () => { setFristFilter("ueberfaellig"); setStatusFilter("all"); } },
      { label: "Bald fällig", value: soon, icon: <AlertTriangle className="h-4 w-4" />, colorClass: "text-yellow-600", onClick: () => { setFristFilter("woche"); setStatusFilter("all"); } },
      { label: "In Bearbeitung", value: inProgress, icon: <Clock className="h-4 w-4" />, colorClass: "text-blue-600", onClick: () => { setStatusFilter("In Bearbeitung"); setFristFilter("all"); } },
      { label: "Warten auf Mandant", value: waiting, icon: <AlertTriangle className="h-4 w-4" />, colorClass: "text-orange-600", onClick: () => { setStatusFilter("Warten auf Mandant"); setFristFilter("all"); } },
      { label: "Erledigt", value: done, icon: <CheckCircle className="h-4 w-4" />, colorClass: "text-green-600", onClick: () => { setStatusFilter("Buchhaltung erledigt"); setFristFilter("all"); } },
    ];
  }, [buchhaltungen]);

  // Map gruppen_id → Liste der Monate dieser Sammelabgabe (für Badge & Tooltip)
  const gruppenMonate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of buchhaltungen) {
      if (!b.gruppen_id) continue;
      const arr = map.get(b.gruppen_id) ?? [];
      arr.push(b.monat);
      map.set(b.gruppen_id, arr);
    }
    for (const [k, v] of map) {
      v.sort();
      map.set(k, v);
    }
    return map;
  }, [buchhaltungen]);

  const istFilterAktiv = statusFilter !== "all" || bearbeiterFilter !== "all" || monatFilter !== "" || fristFilter !== "all" || suche !== "" || modusFilter !== "all";
  const resetFilter = () => {
    setStatusFilter("all");
    setBearbeiterFilter("all");
    setMonatFilter("");
    setFristFilter("all");
    setSuche("");
    setModusFilter("all");
  };

  // Erste Zeile als "Als Nächstes" highlighten — außer wenn nur Erledigte da sind
  const naechsterId = useMemo(() => {
    if (filtered.length === 0) return null;
    if (sortierung !== "prioritaet") return null;
    const first = filtered[0];
    if (first.status === "Buchhaltung erledigt") return null;
    return first.id;
  }, [filtered, sortierung]);

  // Reihenfolge der Abgabe für „In Prüfung"-Einträge (nur für Chef relevant).
  // Map: buchhaltung.id → Rang (1 = zuerst abgegeben).
  const pruefungRang = useMemo(() => {
    const map = new Map<string, number>();
    const inPruefung = filtered
      .filter((b) => b.status === "In Prüfung")
      .slice()
      .sort((a, b) => {
        const av = a.abgabe_datum ?? a.fertiggestellt_datum ?? "";
        const bv = b.abgabe_datum ?? b.fertiggestellt_datum ?? "";
        if (av && bv && av !== bv) return av.localeCompare(bv);
        if (av && !bv) return -1;
        if (!av && bv) return 1;
        return 0;
      });
    inPruefung.forEach((b, i) => map.set(b.id, i + 1));
    return map;
  }, [filtered]);
  const pruefungAnzahl = pruefungRang.size;

  // Reihenfolge der offenen Buchhaltungen nach Belegeingang (Mandant-Einreichung):
  // wer früher eingereicht hat, soll zuerst bearbeitet werden — fair für alle Mandanten.
  // Map: buchhaltung.id → Rang (1 = frühester Belegeingang).
  const belegRang = useMemo(() => {
    const map = new Map<string, number>();
    const offen = filtered
      .filter(
        (b) =>
          (b.status === "Eingegangen" || b.status === "In Bearbeitung" || b.status === "Warten auf Mandant") &&
          !!b.belegeingang_datum,
      )
      .slice()
      .sort((a, b) => {
        const av = a.belegeingang_datum ?? "";
        const bv = b.belegeingang_datum ?? "";
        if (av !== bv) return av.localeCompare(bv);
        return 0;
      });
    offen.forEach((b, i) => map.set(b.id, i + 1));
    return map;
  }, [filtered]);
  const belegAnzahl = belegRang.size;
  const belegRangFirst = useMemo(() => {
    for (const b of filtered) {
      if (belegRang.get(b.id) === 1) return b;
    }
    return null;
  }, [filtered, belegRang]);

  return (
    <div className="p-6 lg:p-10 space-y-6 min-w-0">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="section-label">Übersicht</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-1">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Alle offenen Buchhaltungen, Fristen und Prioritäten auf einen Blick.</p>
        </div>
        <NeueBuchhaltungDialog mandanten={mandanten} onCreated={fetchData} />
      </div>


      {/* Stats — clickable */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {stats.map((s) => (
          <Card
            key={s.label}
            className="kpi-tile border-0 shadow-none"
            onClick={s.onClick}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-lg bg-accent/60 p-2 ${s.colorClass}`}>
                {s.icon}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums text-foreground leading-none">{s.value}</p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate mt-1.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick filter buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={fristFilter === "ueberfaellig" ? "default" : "outline"}
          size="sm"
          onClick={() => setFristFilter(fristFilter === "ueberfaellig" ? "all" : "ueberfaellig")}
          className={`rounded-full h-8 px-3.5 ${fristFilter === "ueberfaellig" ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}`}
        >
          <Flame className="h-4 w-4 mr-1.5" /> Dringend
        </Button>
        <Button
          variant={fristFilter === "woche" ? "default" : "outline"}
          size="sm"
          onClick={() => setFristFilter(fristFilter === "woche" ? "all" : "woche")}
          className="rounded-full h-8 px-3.5"
        >
          <Clock className="h-4 w-4 mr-1.5" /> Diese Woche
        </Button>
        <Button
          variant={statusFilter === "In Bearbeitung" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter(statusFilter === "In Bearbeitung" ? "all" : "In Bearbeitung")}
          className="rounded-full h-8 px-3.5"
        >
          <Briefcase className="h-4 w-4 mr-1.5" /> In Bearbeitung
        </Button>
        <Button
          variant={statusFilter === "In Prüfung" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter(statusFilter === "In Prüfung" ? "all" : "In Prüfung")}
          className="rounded-full h-8 px-3.5"
        >
          <ClipboardCheck className="h-4 w-4 mr-1.5" /> In Prüfung
        </Button>
        {istFilterAktiv && (
          <Button variant="ghost" size="sm" onClick={resetFilter} className="rounded-full h-8 px-3.5">
            <X className="h-4 w-4 mr-1.5" /> Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Filter-Toolbar — kompakt, max. 2 Zeilen auf Laptop */}
      <div className="card-elevated p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Mandant, Monat, Notiz…"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Constants.public.Enums.buchhaltung_status.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bearbeiterFilter} onValueChange={setBearbeiterFilter}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Mitarbeiter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Mitarbeiter</SelectItem>
            {bearbeiterList.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fristFilter} onValueChange={(v) => setFristFilter(v as typeof fristFilter)}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Frist" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Fristen</SelectItem>
            <SelectItem value="ueberfaellig">Überfällig</SelectItem>
            <SelectItem value="woche">Diese Woche</SelectItem>
            <SelectItem value="monat">Dieser Monat</SelectItem>
          </SelectContent>
        </Select>
        <Select value={modusFilter} onValueChange={(v) => setModusFilter(v as typeof modusFilter)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Modus" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Modi</SelectItem>
            <SelectItem value="weiterleitung">Nur Weiterleitung</SelectItem>
            <SelectItem value="automatisierung">Automatisierung</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="h-9 w-[130px]"
          placeholder="Monat z.B. 01-2026"
          value={monatFilter}
          onChange={(e) => setMonatFilter(e.target.value)}
        />
        <Select value={sortierung} onValueChange={(v) => setSortierung(v as typeof sortierung)}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Sortierung" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="prioritaet">Priorität</SelectItem>
            <SelectItem value="frist">Frist (nächste)</SelectItem>
            <SelectItem value="mandant">Mandant A–Z</SelectItem>
            <SelectItem value="erstellt">Erstellt (neu)</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 h-9 px-2 rounded-md border bg-card">
          <Switch id="nur-meine" checked={nurMeine} onCheckedChange={setNurMeine} />
          <Label htmlFor="nur-meine" className="text-xs cursor-pointer whitespace-nowrap">Nur meine</Label>
        </div>
        {rolle === "Sekretariat" && (
          <div className="ml-auto">
            <NeueBuchhaltungDialog mandanten={mandanten} onCreated={fetchData} />
          </div>
        )}
      </div>

      {/* Table */}
      {belegAnzahl > 1 && belegRangFirst && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Clock className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="font-medium">Reihenfolge-Hinweis: </span>
            Mandant{" "}
            <span className="font-semibold">
              {belegRangFirst.mandant?.name}
              {belegRangFirst.mandant?.firma ? ` (${belegRangFirst.mandant.firma})` : ""}
            </span>{" "}
            hat am{" "}
            <span className="font-semibold">
              {belegRangFirst.belegeingang_datum
                ? new Date(belegRangFirst.belegeingang_datum).toLocaleDateString("de-DE")
                : "—"}
            </span>{" "}
            als Erster Belege eingereicht und sollte zuerst bearbeitet werden.
          </div>
        </div>
      )}
      <Card className="card-elevated border-0 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="table-modern">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Buchhaltung</TableHead>
                <TableHead className="min-w-[260px]">Mandant</TableHead>
                <TableHead>Monat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Frist</TableHead>
                <TableHead>Belege</TableHead>
                <TableHead>Bearbeiter</TableHead>
                <TableHead className="hidden xl:table-cell">Belegeingang</TableHead>
                <TableHead className="min-w-[240px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Keine Buchhaltungen vorhanden</p>
                    <p className="text-sm">
                      {rolle === "Sekretariat" ? "Erstellen Sie eine neue Buchhaltung über den Button oben." : "Es liegen keine Aufträge für Sie vor."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((b) => {
                  const ueberfaellig = istUeberfaellig(b);
                  const baldFaellig = !ueberfaellig && istBaldFaellig(b);
                  const istNaechster = naechsterId === b.id;
                  const rowCls = [
                    "hover:bg-muted/50",
                    ueberfaellig ? "bg-destructive/10 border-l-4 border-l-destructive" : "",
                    baldFaellig ? "bg-yellow-50 border-l-4 border-l-yellow-500" : "",
                    !ueberfaellig && !baldFaellig && b.status === "Warten auf Mandant" ? "bg-destructive/5 border-l-2 border-l-destructive" : "",
                  ].filter(Boolean).join(" ");
                  return (
                  <Fragment key={b.id}>
                  <TableRow
                    ref={setRef(b.id) as any}
                    className={[rowCls, highlightId === b.id ? "focus-row-highlight" : ""].filter(Boolean).join(" ")}
                  >
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
                    <TableCell className="font-medium min-w-[260px] align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {istNaechster && (
                          <Badge className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
                            <Star className="h-3 w-3" /> Als Nächstes
                          </Badge>
                        )}
                        {rolle === "Chef" && b.status === "In Prüfung" && pruefungAnzahl > 1 && pruefungRang.get(b.id) === 1 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500/90 cursor-help">
                                  <Flame className="h-3 w-3" /> Zuerst abgegeben — bitte zuerst prüfen
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  {b.bearbeiter?.name ?? "Sachbearbeiter"} hat als Erster abgegeben
                                  {b.abgabe_datum ? ` am ${new Date(b.abgabe_datum).toLocaleDateString("de-DE")}` : ""}.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {rolle === "Chef" && b.status === "In Prüfung" && pruefungAnzahl > 1 && (pruefungRang.get(b.id) ?? 0) > 1 && (
                          <Badge variant="outline" className="gap-1 text-[10px] h-5 text-muted-foreground">
                            #{pruefungRang.get(b.id)} abgegeben
                          </Badge>
                        )}
                        {belegAnzahl > 1 && belegRang.get(b.id) === 1 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600/90 cursor-help">
                                  <Clock className="h-3 w-3" /> Zuerst dran
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  Mandant hat als Erster am{" "}
                                  {b.belegeingang_datum
                                    ? new Date(b.belegeingang_datum).toLocaleDateString("de-DE")
                                    : "—"}{" "}
                                  Belege eingereicht — bitte zuerst bearbeiten.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {belegAnzahl > 1 && (belegRang.get(b.id) ?? 0) > 1 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="gap-1 text-[10px] h-5 text-muted-foreground cursor-help">
                                  #{belegRang.get(b.id)} nach Belegeingang
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  Belegeingang am{" "}
                                  {b.belegeingang_datum
                                    ? new Date(b.belegeingang_datum).toLocaleDateString("de-DE")
                                    : "—"}
                                  .
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {ueberfaellig && (
                          <Badge variant="destructive" className="gap-1">
                            <Flame className="h-3 w-3" /> Dringend
                          </Badge>
                        )}
                        {baldFaellig && (
                          <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-700 bg-yellow-50">
                            <Clock className="h-3 w-3" /> Bald fällig
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1">
                        {b.mandant?.mandanten_nummer && (
                          <span className="font-mono text-[10px] mr-1.5 px-1 py-0.5 rounded bg-muted text-muted-foreground">{b.mandant.mandanten_nummer}</span>
                        )}
                        {b.mandant?.name}
                        {b.mandant?.firma && <span className="text-muted-foreground text-xs ml-1">({b.mandant.firma})</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {b.automatisierung_aktiv ? (
                          <Badge variant="outline" className="gap-1 text-[10px] h-5 border-primary/40 text-primary bg-primary/5">
                            <Sparkles className="h-2.5 w-2.5" /> Automatisierung
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-[10px] h-5 text-muted-foreground">
                            <Forward className="h-2.5 w-2.5" /> Nur Weiterleitung
                          </Badge>
                        )}
                        {b.zurueckgewiesen_am && b.status === "In Bearbeitung" && (
                          <Badge variant="destructive" className="gap-1 text-[10px] h-5">
                            <AlertOctagon className="h-2.5 w-2.5" /> Vom Chef zurückgewiesen
                          </Badge>
                        )}
                      </div>
                      {b.zurueckgewiesen_am && b.status === "In Bearbeitung" && b.notizen && (
                        <div className="mt-2 block w-full rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive flex items-center gap-1">
                            <AlertOctagon className="h-3 w-3" /> Grund der Zurückweisung
                          </p>
                          <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap line-clamp-3">{b.notizen}</p>
                        </div>
                      )}
                      {b.status === "Warten auf Mandant" && b.notizen && (
                        <p className="text-xs text-destructive mt-1 line-clamp-2 font-normal" title={b.notizen}>
                          📝 {b.notizen}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span>{b.monat}</span>
                        {b.gruppen_id && (gruppenMonate.get(b.gruppen_id)?.length ?? 0) > 1 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSuche("");
                                    setMonatFilter("");
                                    // Filter alle Monate dieser Gruppe via Suche nach gemeinsamen Mandanten + Group
                                  }}
                                  className="inline-flex items-center gap-1 self-start rounded-full bg-primary/10 text-primary text-[10px] font-medium px-1.5 py-0.5 hover:bg-primary/20 transition-colors cursor-help"
                                >
                                  Sammelabgabe · {gruppenMonate.get(b.gruppen_id!)!.length} Monate
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-[11px] font-semibold mb-0.5">Gemeinsam abgegeben:</p>
                                <p className="text-xs">{gruppenMonate.get(b.gruppen_id!)!.join(" · ")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <StatusBadge status={b.status} />
                          {b.notizen && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs whitespace-pre-wrap">{b.notizen}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {b.hat_abschluss && (
                          rolle === "Sekretariat" ? (
                            <Badge
                              variant="outline"
                              className="w-fit gap-1 border-green-600 text-green-700"
                            >
                              <FileSpreadsheet className="h-3 w-3" /> Buchhaltung erstellt
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="w-fit gap-1 border-green-600 text-green-700 cursor-pointer hover:bg-green-50"
                              onClick={() => navigate("/buchhaltungen")}
                              title="Im Archiv ansehen"
                            >
                              <FileSpreadsheet className="h-3 w-3" /> Buchhaltung erstellt
                            </Badge>
                          )
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DeadlineIndicator
                        faelligAm={b.faellig_am}
                        status={b.status}
                        dauerfristverlaengerung={b.dauerfristverlaengerung}
                        faelligAmManuell={b.faellig_am_manuell}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 min-w-[170px]">
                        <BelegeVollansicht
                          buchhaltungId={b.id}
                          mandantId={b.mandant?.id}
                          mandantName={b.mandant?.name ?? "–"}
                          monat={b.monat}
                          dokumenteCount={b.dokumente_count}
                          autoStartBuchen={b.automatisierung_aktiv && (b.status === "In Bearbeitung" || b.status === "Eingegangen")}
                          onChanged={fetchData}
                        />
                        {b.automatisierung_aktiv ? (
                          b.dokumente_count > 0 && (
                            <>
                              <BuchungsFortschritt buchhaltungId={b.id} variant="compact" />
                            </>
                          )
                        ) : (
                          b.dokumente_count > 0 && (
                            <p className="text-[10px] text-muted-foreground italic">Belege als Referenz</p>
                          )
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{b.bearbeiter?.name ?? "–"}</span>
                        {b.co_bearbeiter.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {b.co_bearbeiter.map((c) => (
                              <Badge
                                key={c.id}
                                variant="outline"
                                className="h-4 px-1 text-[10px] font-normal text-muted-foreground"
                                title="Vertretung"
                              >
                                + {c.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {benutzerId && b.bearbeiter_id !== benutzerId && b.co_bearbeiter.some((c) => c.id === benutzerId) && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px] w-fit border-blue-500 text-blue-700 bg-blue-50">
                            Vertretung
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <div className="flex flex-col gap-1">
                        {b.belegeingaenge.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] w-fit"
                            onClick={() => setBelegeingaengeDialog(b)}
                          >
                            +{b.belegeingaenge.length - 1} weitere · Alle anzeigen
                          </Button>
                        )}
                        <span>{b.belegeingang_datum ?? "–"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1 min-w-[260px]">
                        <WhatsAppButton
                          telefon={b.mandant?.telefon}
                          mandantName={b.mandant?.firma || b.mandant?.name}
                        />
                        {rolle && (
                          <StatusTransitionWithFortschritt
                            buchhaltungId={b.id}
                            currentStatus={b.status}
                            rolle={rolle}
                            onStatusChanged={fetchData}
                            automatisierungAktiv={b.automatisierung_aktiv}
                          />
                        )}
                        {b.automatisierung_aktiv && (
                          <BuchhaltungsPaketDialog
                            buchhaltungId={b.id}
                            status={b.status}
                            monat={b.monat}
                            mandantName={b.mandant?.firma || b.mandant?.name || "–"}
                            hatAbschluss={b.hat_abschluss}
                            onChanged={fetchData}
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
                              <Pencil className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                            {rolle === "Sekretariat" && b.status === "Warten auf Mandant" && (
                              <DropdownMenuItem onClick={() => setKontaktBuchhaltung(b)}>
                                <PhoneCall className="h-4 w-4 mr-2" />
                                Mandant kontaktieren
                              </DropdownMenuItem>
                            )}
                            {(rolle === "Chef" || rolle === "Sekretariat") && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(b.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Löschen
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === b.id && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={9} className="p-4">
                        {b.status === "Warten auf Mandant" && (
                          <div className="mb-3 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm flex items-start gap-2">
                            <Inbox className="h-4 w-4 mt-0.5 text-orange-600 shrink-0" />
                            <div>
                              <p className="font-medium text-orange-900">Mandant hat Unterlagen nachgereicht?</p>
                              <p className="text-xs text-orange-800">
                                In der Spalte „Belege" auf <strong>{b.dokumente_count > 0 ? "Belege ansehen" : "Belege hochladen"}</strong> klicken und im Dialog oben rechts „Belege nachreichen" wählen, um die neuen Dateien hinzuzufügen. Der Sachbearbeiter wird automatisch informiert.
                              </p>
                            </div>
                          </div>
                        )}
                        {b.automatisierung_aktiv ? (
                          <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Automatisierung aktiv — KI-Belegerkennung und Buchhaltungs-Paket finden Sie direkt in den Spalten „Belege" und „Aktionen" dieser Zeile.
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                              <Forward className="h-4 w-4" />
                              Nur Weiterleitung — Belege dienen als Hinweis. Bearbeiten Sie diese Buchhaltung extern.
                            </div>
                            <p className="text-xs text-muted-foreground pl-6">
                              Status hier ändern → <strong>Annehmen</strong>, <strong>Warten auf Mandant</strong>, <strong>Zur Prüfung senden</strong>, <strong>Erledigt</strong>.
                            </p>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
          {totalRows > 0 && (
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

      {/* Edit Dialog */}
      {editingBuchhaltung && (
        <BuchhaltungBearbeitenDialog
          open={!!editingBuchhaltung}
          onOpenChange={(open) => { if (!open) setEditingBuchhaltung(null); }}
          buchhaltung={{
            ...editingBuchhaltung,
            dauerfristverlaengerung: editingBuchhaltung.dauerfristverlaengerung,
            faellig_am_manuell: editingBuchhaltung.faellig_am_manuell,
            automatisierung_aktiv: editingBuchhaltung.automatisierung_aktiv,
          }}
          onSaved={fetchData}
        />
      )}

      {/* Mandant kontaktieren Dialog */}
      {kontaktBuchhaltung && (
        <MandantKontaktDialog
          open={!!kontaktBuchhaltung}
          onOpenChange={(open) => { if (!open) setKontaktBuchhaltung(null); }}
          buchhaltungId={kontaktBuchhaltung.id}
          mandantName={kontaktBuchhaltung.mandant?.name ?? "–"}
          telefon={kontaktBuchhaltung.mandant?.telefon ?? null}
          email={kontaktBuchhaltung.mandant?.email ?? null}
          bestehendeNotiz={kontaktBuchhaltung.notizen}
          onSaved={fetchData}
        />
      )}

      {belegeingaengeDialog && (
        <BelegeingaengeListeDialog
          open={!!belegeingaengeDialog}
          onOpenChange={(o) => { if (!o) setBelegeingaengeDialog(null); }}
          eintraege={belegeingaengeDialog.belegeingaenge}
          mandantName={belegeingaengeDialog.mandant?.firma || belegeingaengeDialog.mandant?.name}
          monat={belegeingaengeDialog.monat}
        />
      )}

      {/* Delete Confirmation */}
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
                // Delete documents from storage first
                const { data: docs } = await supabase
                  .from("buchhaltung_dokumente")
                  .select("id, dateipfad")
                  .eq("buchhaltung_id", deleteId);
                if (docs && docs.length > 0) {
                  await supabase.storage.from("belege").remove(docs.map((d) => d.dateipfad));
                  await supabase.from("buchhaltung_dokumente").delete().eq("buchhaltung_id", deleteId);
                }
                // Delete notifications
                await supabase.from("benachrichtigungen").delete().eq("buchhaltung_id", deleteId);
                // Delete the buchhaltung
                const { error } = await supabase.from("buchhaltungen").delete().eq("id", deleteId);
                if (error) {
                  toast({ title: "Fehler", description: error.message, variant: "destructive" });
                } else {
                  toast({ title: "Gelöscht" });
                  fetchData();
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
