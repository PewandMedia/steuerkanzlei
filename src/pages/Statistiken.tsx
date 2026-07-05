import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DeadlineIndicator } from "@/components/DeadlineIndicator";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { PaginationFooter } from "@/components/PaginationFooter";
import { usePageSize } from "@/hooks/use-page-size";
import { fetchAll } from "@/lib/fetch-all";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import {
  CheckCircle,
  Clock,
  Users,
  Timer,
  Trophy,
  AlertTriangle,
  ShieldCheck,
  AlertOctagon,
  X,
  Calendar,
  User as UserIcon,
  Filter as FilterIcon,
} from "lucide-react";
import { getDeadlineStatus, getDaysUntilDeadline } from "@/lib/deadline-utils";
import {
  arbeitstageZwischen,
  bearbeitungsdauerTage,
  initialen,
  leistungsLabel,
  leistungsStatus,
  letzteMonate,
  monatInRange,
  zeitraumRange,
  zielerreichung,
  type Zeitraum,
} from "@/lib/mitarbeiter-stats";
import { usePageMeta } from "@/hooks/use-page-meta";

interface BuchhaltungRow {
  id: string;
  monat: string;
  status: string;
  faellig_am: string | null;
  erstellt_am: string;
  fertiggestellt_datum: string | null;
  abgabe_datum: string | null;
  bearbeiter: { name: string } | null;
  mandant: { name: string; firma: string | null } | null;
}

const STATUS_OPTIONS = [
  "Eingegangen",
  "In Bearbeitung",
  "Warten auf Mandant",
  "In Prüfung",
  "Buchhaltung erledigt",
];

const ERLEDIGT_STATUS = new Set(["Buchhaltung erledigt"]);

// Leistungsmonat: Erledigte Buchhaltungen zählen in dem Monat, in dem sie
// tatsächlich abgeschlossen wurden (fertiggestellt_datum), nicht im Periodenmonat.
// Offene Einträge bleiben dem Periodenmonat zugeordnet.
function leistungsMonat(b: { status: string; monat: string; fertiggestellt_datum: string | null; abgabe_datum: string | null }): string {
  if (ERLEDIGT_STATUS.has(b.status)) {
    const src = b.fertiggestellt_datum ?? b.abgabe_datum;
    if (src) {
      const d = new Date(src);
      if (!isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        return `${mm}-${d.getFullYear()}`;
      }
    }
  }
  return b.monat;
}

// minimal slate-based palette + one accent — soft & professional
const LINE_COLORS = [
  "hsl(var(--primary))",
  "hsl(215 25% 35%)",
  "hsl(215 20% 55%)",
  "hsl(215 15% 70%)",
  "hsl(200 50% 45%)",
  "hsl(170 35% 45%)",
  "hsl(260 30% 55%)",
  "hsl(30 50% 55%)",
];

const MONATE_KURZ = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

function formatMonatLabel(mmYYYY: string): string {
  if (!/^\d{2}-\d{4}$/.test(mmYYYY)) return mmYYYY;
  const [mm, yyyy] = mmYYYY.split("-");
  return `${MONATE_KURZ[parseInt(mm, 10) - 1]} ${yyyy}`;
}

type SortKey = "erledigt" | "offen" | "gesamt" | "schnitt";
type TrendLength = 3 | 6 | 12;

export default function Statistiken() {
  usePageMeta("Statistiken", "Auswertungen zu Mandanten, Mitarbeitern und Auslastung.");

  const { rolle } = useAuth();
  const [buchhaltungen, setBuchhaltungen] = useState<BuchhaltungRow[]>([]);

  const [zeitraum, setZeitraum] = useState<Zeitraum>("current_month");
  const [specificMonat, setSpecificMonat] = useState("");
  const [bearbeiterFilter, setBearbeiterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ampelFilter, setAmpelFilter] = useState("all");

  const [sortKey, setSortKey] = useState<SortKey>("erledigt");
  const [detailMitarbeiter, setDetailMitarbeiter] = useState<string | null>(null);

  // Month/Year quick-pick state
  const today = new Date();
  const [pickMonth, setPickMonth] = useState<string>(String(today.getMonth() + 1).padStart(2, "0"));
  const [pickYear, setPickYear] = useState<string>(String(today.getFullYear()));
  const [trendLen, setTrendLen] = useState<TrendLength>(6);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchAll<BuchhaltungRow>((from, to) =>
          supabase
            .from("buchhaltungen")
            .select(
              "id, monat, status, faellig_am, erstellt_am, fertiggestellt_datum, abgabe_datum, bearbeiter:benutzer!buchhaltungen_bearbeiter_id_fkey(name), mandant:mandanten(name, firma)",
            )
            .order("erstellt_am", { ascending: false })
            .order("id", { ascending: true })
            .range(from, to) as any,
        );
        setBuchhaltungen(data);
      } catch {
        setBuchhaltungen([]);
      }
    })();
  }, []);

  const range = useMemo(() => zeitraumRange(zeitraum, specificMonat), [zeitraum, specificMonat]);

  // Years derived from data + current year
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(today.getFullYear());
    buchhaltungen.forEach((b) => {
      if (/^\d{2}-\d{4}$/.test(b.monat)) {
        years.add(parseInt(b.monat.split("-")[1], 10));
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [buchhaltungen]);

  // Sync pickMonth/pickYear with specificMonat
  const applySpecific = (mm: string, yyyy: string) => {
    setPickMonth(mm);
    setPickYear(yyyy);
    setSpecificMonat(`${mm}-${yyyy}`);
    setZeitraum("specific_month");
  };

  const bearbeiterList = useMemo(() => {
    const names = new Set<string>();
    buchhaltungen.forEach((b) => {
      if (b.bearbeiter?.name) names.add(b.bearbeiter.name);
    });
    return Array.from(names).sort();
  }, [buchhaltungen]);

  // Filtered by Zeitraum + dropdowns
  const filtered = useMemo(() => {
    return buchhaltungen.filter((b) => {
      if (!monatInRange(leistungsMonat(b), range)) return false;
      if (bearbeiterFilter !== "all" && b.bearbeiter?.name !== bearbeiterFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (ampelFilter !== "all" && getDeadlineStatus(b.faellig_am, b.status) !== ampelFilter) return false;
      return true;
    });
  }, [buchhaltungen, range, bearbeiterFilter, statusFilter, ampelFilter]);

  const total = filtered.length;
  const done = filtered.filter((b) => ERLEDIGT_STATUS.has(b.status)).length;
  const open = total - done;

  const aktiveMitarbeiterCount = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach((b) => b.bearbeiter?.name && set.add(b.bearbeiter.name));
    return set.size || bearbeiterList.length || 1;
  }, [filtered, bearbeiterList]);

  const avgPerEmployee = aktiveMitarbeiterCount > 0 ? Math.round((done / aktiveMitarbeiterCount) * 10) / 10 : 0;

  const avgDuration = useMemo(() => {
    const durations = filtered
      .map((b) => bearbeitungsdauerTage(b))
      .filter((d): d is number => d !== null);
    if (durations.length === 0) return null;
    const sum = durations.reduce((a, b) => a + b, 0);
    return Math.round((sum / durations.length) * 10) / 10;
  }, [filtered]);

  const deadlineCounts = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0 };
    filtered.forEach((b) => {
      counts[getDeadlineStatus(b.faellig_am, b.status)]++;
    });
    return counts;
  }, [filtered]);

  // Working days in range (for Ø/Tag)
  const arbeitstage = useMemo(() => {
    if (!range) {
      // "all": estimate by buchhaltungen.erstellt_am min/max
      const dates = buchhaltungen.map((b) => new Date(b.erstellt_am).getTime()).filter(Boolean);
      if (dates.length === 0) return 22;
      const start = new Date(Math.min(...dates));
      const end = new Date();
      return Math.max(1, arbeitstageZwischen(start, end));
    }
    return Math.max(1, arbeitstageZwischen(range.start, new Date(Math.min(range.end.getTime(), Date.now()))));
  }, [range, buchhaltungen]);

  type EmpStat = {
    name: string;
    erledigt: number;
    offen: number;
    gesamt: number;
    schnitt: number;
    zielProzent: number;
    statusKey: ReturnType<typeof leistungsStatus>;
  };

  const employeeStats = useMemo<EmpStat[]>(() => {
    const map: Record<string, { name: string; erledigt: number; offen: number }> = {};
    filtered.forEach((b) => {
      const name = b.bearbeiter?.name ?? "Unbekannt";
      if (!map[name]) map[name] = { name, erledigt: 0, offen: 0 };
      if (ERLEDIGT_STATUS.has(b.status)) map[name].erledigt++;
      else map[name].offen++;
    });
    const list = Object.values(map);
    const max = Math.max(0, ...list.map((e) => e.erledigt));
    const enriched = list.map((e) => {
      const zielProzent = zielerreichung(e.erledigt, max);
      return {
        ...e,
        gesamt: e.erledigt + e.offen,
        schnitt: Math.round((e.erledigt / arbeitstage) * 100) / 100,
        zielProzent,
        statusKey: leistungsStatus(zielProzent),
      };
    });
    return enriched.sort((a, b) => {
      switch (sortKey) {
        case "offen":
          return b.offen - a.offen;
        case "gesamt":
          return b.gesamt - a.gesamt;
        case "schnitt":
          return b.schnitt - a.schnitt;
        case "erledigt":
        default:
          return b.erledigt - a.erledigt;
      }
    });
  }, [filtered, arbeitstage, sortKey]);

  const topPerformer = employeeStats[0];
  const schwaechster = employeeStats.length >= 2 ? employeeStats[employeeStats.length - 1] : null;

  // Monthly trend: always last 6 months, line per top-8 employees
  const trendData = useMemo(() => {
    const monate = letzteMonate(trendLen);
    const top8 = [...employeeStats].sort((a, b) => b.gesamt - a.gesamt).slice(0, 8).map((e) => e.name);
    return monate.map((m) => {
      const row: Record<string, string | number> = { monat: m, label: formatMonatLabel(m) };
      top8.forEach((name) => (row[name] = 0));
      buchhaltungen.forEach((b) => {
        if (leistungsMonat(b) !== m) return;
        if (!ERLEDIGT_STATUS.has(b.status)) return;
        const name = b.bearbeiter?.name ?? "Unbekannt";
        if (top8.includes(name)) {
          row[name] = (row[name] as number) + 1;
        }
      });
      return row;
    });
  }, [buchhaltungen, employeeStats, trendLen]);

  const trendKeys = useMemo(
    () => [...employeeStats].sort((a, b) => b.gesamt - a.gesamt).slice(0, 8).map((e) => e.name),
    [employeeStats],
  );

  // Erledigt vs Offen bar — sorted by erledigt desc
  const barData = useMemo(
    () => [...employeeStats].sort((a, b) => b.erledigt - a.erledigt).map((e) => ({ name: e.name, erledigt: e.erledigt, offen: e.offen })),
    [employeeStats],
  );

  const criticalItems = useMemo(() => {
    return filtered
      .filter((b) => {
        const s = getDeadlineStatus(b.faellig_am, b.status);
        return s === "red" || s === "yellow";
      })
      .sort((a, b) => {
        const da = getDaysUntilDeadline(a.faellig_am) ?? 999;
        const db = getDaysUntilDeadline(b.faellig_am) ?? 999;
        return da - db;
      });
  }, [filtered]);

  const detailItems = useMemo(() => {
    if (!detailMitarbeiter) return [] as BuchhaltungRow[];
    return filtered.filter((b) => (b.bearbeiter?.name ?? "Unbekannt") === detailMitarbeiter);
  }, [filtered, detailMitarbeiter]);

  const detailStats = useMemo(() => {
    if (!detailMitarbeiter) return null;
    const erl = detailItems.filter((b) => ERLEDIGT_STATUS.has(b.status)).length;
    const off = detailItems.length - erl;
    const durations = detailItems.map(bearbeitungsdauerTage).filter((d): d is number => d !== null);
    const avg = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null;
    return { erledigt: erl, offen: off, avg };
  }, [detailMitarbeiter, detailItems]);

  if (rolle !== "Chef") {
    return (
      <div className="flex items-center justify-center p-12">
        <Card className="card-elevated border-0 shadow-none">
          <CardContent className="p-8 text-center text-muted-foreground">Zugriff nur für Chef-Rolle.</CardContent>
        </Card>
      </div>
    );
  }

  const statusBadgeClass = (s: ReturnType<typeof leistungsStatus>) => {
    if (s === "sehr_gut") return "bg-green-100 text-green-700 hover:bg-green-100 border-green-200";
    if (s === "normal") return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200";
    return "bg-red-100 text-red-700 hover:bg-red-100 border-red-200";
  };

  const zeitraumLabel = (() => {
    switch (zeitraum) {
      case "current_month": return "Aktueller Monat";
      case "last_3_months": return "Letzte 3 Monate";
      case "last_6_months": return "Letzte 6 Monate";
      case "this_year": return "Dieses Jahr";
      case "last_year": return "Letztes Jahr";
      case "all": return "Alle Monate";
      case "specific_month":
        return /^\d{2}-\d{4}$/.test(specificMonat)
          ? formatMonatLabel(specificMonat)
          : "Bestimmter Monat";
    }
  })();

  const hasActiveFilter =
    zeitraum !== "current_month" ||
    bearbeiterFilter !== "all" ||
    statusFilter !== "all" ||
    ampelFilter !== "all";

  return (
    <div className="p-6 lg:p-10 space-y-6 min-w-0">
      {/* Filter bar */}
      <Card className="card-elevated border-0 shadow-none">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Zeitraum
              </Label>
              <Select value={zeitraum} onValueChange={(v) => setZeitraum(v as Zeitraum)}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">Aktueller Monat</SelectItem>
                  <SelectItem value="last_3_months">Letzte 3 Monate</SelectItem>
                  <SelectItem value="last_6_months">Letzte 6 Monate</SelectItem>
                  <SelectItem value="this_year">Dieses Jahr</SelectItem>
                  <SelectItem value="last_year">Letztes Jahr</SelectItem>
                  <SelectItem value="all">Alle Monate</SelectItem>
                  <SelectItem value="specific_month">Bestimmter Monat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {zeitraum === "specific_month" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Monat</Label>
                  <Select value={pickMonth} onValueChange={(mm) => applySpecific(mm, pickYear)}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONATE_KURZ.map((label, i) => {
                        const mm = String(i + 1).padStart(2, "0");
                        return <SelectItem key={mm} value={mm}>{label}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Jahr</Label>
                  <Select value={pickYear} onValueChange={(yyyy) => applySpecific(pickMonth, yyyy)}>
                    <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableYears.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <UserIcon className="h-3 w-3" /> Mitarbeiter
              </Label>
              <Select value={bearbeiterFilter} onValueChange={setBearbeiterFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                  {bearbeiterList.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <FilterIcon className="h-3 w-3" /> Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Frist</Label>
              <Select value={ampelFilter} onValueChange={setAmpelFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="red">🔴 Überfällig</SelectItem>
                  <SelectItem value="yellow">🟡 Bald fällig</SelectItem>
                  <SelectItem value="green">🟢 Im Zeitplan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick month chips */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground mr-1">Schnellauswahl:</span>
            {MONATE_KURZ.map((label, i) => {
              const mm = String(i + 1).padStart(2, "0");
              const isActive =
                zeitraum === "specific_month" && specificMonat === `${mm}-${pickYear}`;
              return (
                <button
                  key={mm}
                  type="button"
                  onClick={() => applySpecific(mm, pickYear)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent border-border text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <span className="text-xs text-muted-foreground ml-2">Jahr:</span>
            <Select value={pickYear} onValueChange={(yyyy) => {
              setPickYear(yyyy);
              if (zeitraum === "specific_month") setSpecificMonat(`${pickMonth}-${yyyy}`);
            }}>
              <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Active filter pills */}
      {hasActiveFilter && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Aktiv:</span>
          <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
            <Calendar className="h-3 w-3" /> {zeitraumLabel}
            {zeitraum !== "current_month" && (
              <button
                onClick={() => { setZeitraum("current_month"); setSpecificMonat(""); }}
                className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5"
                aria-label="Zeitraum zurücksetzen"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
          {bearbeiterFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
              <UserIcon className="h-3 w-3" /> {bearbeiterFilter}
              <button onClick={() => setBearbeiterFilter("all")} className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5" aria-label="Mitarbeiter-Filter entfernen">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
              <FilterIcon className="h-3 w-3" /> {statusFilter}
              <button onClick={() => setStatusFilter("all")} className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5" aria-label="Status-Filter entfernen">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {ampelFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
              Frist: {ampelFilter === "red" ? "🔴" : ampelFilter === "yellow" ? "🟡" : "🟢"}
              <button onClick={() => setAmpelFilter("all")} className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5" aria-label="Frist-Filter entfernen">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="card-elevated border-0 shadow-none">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-muted p-2.5 text-green-600"><CheckCircle className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{done}</p>
              <p className="text-xs text-muted-foreground">Gesamt erledigt</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated border-0 shadow-none">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-muted p-2.5 text-yellow-600"><Clock className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{open}</p>
              <p className="text-xs text-muted-foreground">Gesamt offen</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated border-0 shadow-none">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-muted p-2.5 text-primary"><Users className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{avgPerEmployee}</p>
              <p className="text-xs text-muted-foreground">Ø pro Mitarbeiter</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated border-0 shadow-none">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-muted p-2.5 text-primary"><Timer className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{avgDuration ?? "–"}</p>
              <p className="text-xs text-muted-foreground">Ø Bearbeitungsdauer (Tage)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Frist mini row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-muted p-2 text-green-600"><ShieldCheck className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-foreground">{deadlineCounts.green}</p>
              <p className="text-[11px] text-muted-foreground truncate">Im Zeitplan</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-muted p-2 text-yellow-600"><AlertTriangle className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-foreground">{deadlineCounts.yellow}</p>
              <p className="text-[11px] text-muted-foreground truncate">Bald fällig</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-muted p-2 text-red-600"><AlertOctagon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-foreground">{deadlineCounts.red}</p>
              <p className="text-[11px] text-muted-foreground truncate">Überfällig</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top / Schwach */}
      {topPerformer && schwaechster && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-green-200">
            <CardContent className="flex items-center gap-4 p-5">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <Avatar><AvatarFallback>{initialen(topPerformer.name)}</AvatarFallback></Avatar>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">🥇 Top Performer</p>
                <p className="text-lg font-bold text-foreground">{topPerformer.name}</p>
                <p className="text-sm text-green-700">{topPerformer.erledigt} Buchhaltungen erledigt</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="flex items-center gap-4 p-5">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <Avatar><AvatarFallback>{initialen(schwaechster.name)}</AvatarFallback></Avatar>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">⚠️ Niedrigste Leistung</p>
                <p className="text-lg font-bold text-foreground">{schwaechster.name}</p>
                <p className="text-sm text-red-700">{schwaechster.erledigt} Buchhaltungen erledigt</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mitarbeiter-Leistungstabelle */}
      <Card className="card-elevated border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Mitarbeiter-Leistung</CardTitle>
          <p className="text-xs text-muted-foreground">Klick auf Spaltenkopf zum Sortieren · Klick auf Zeile für Details</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="table-modern">
            <TableHeader>
              <TableRow>
                <TableHead>Mitarbeiter</TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => setSortKey("erledigt")}>
                  Erledigt {sortKey === "erledigt" && "↓"}
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => setSortKey("offen")}>
                  Offen {sortKey === "offen" && "↓"}
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => setSortKey("gesamt")}>
                  Gesamt {sortKey === "gesamt" && "↓"}
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => setSortKey("schnitt")}>
                  Ø/Tag {sortKey === "schnitt" && "↓"}
                </TableHead>
                <TableHead className="w-[200px]">Zielerreichung</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeStats.map((e) => (
                <TableRow key={e.name} className="cursor-pointer" onClick={() => setDetailMitarbeiter(e.name)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initialen(e.name)}</AvatarFallback></Avatar>
                      <span className="font-medium">{e.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">{e.erledigt}</TableCell>
                  <TableCell className="text-right text-yellow-600 font-semibold">{e.offen}</TableCell>
                  <TableCell className="text-right font-bold">{e.gesamt}</TableCell>
                  <TableCell className="text-right">{e.schnitt}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={e.zielProzent} className="h-2" />
                      <span className="text-xs text-muted-foreground w-10 text-right">{e.zielProzent}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass(e.statusKey)}>
                      {leistungsLabel(e.statusKey)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {employeeStats.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Keine Daten im gewählten Zeitraum</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly trend line chart */}
      <Card className="card-elevated border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Monatliche Entwicklung</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Erledigte Buchhaltungen pro Mitarbeiter (letzte {trendLen} Monate)
            </p>
          </div>
          <div className="flex gap-1">
            {([3, 6, 12] as TrendLength[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTrendLen(n)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  trendLen === n
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-border text-foreground"
                }`}
              >
                {n}M
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={trendData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                domain={[0, (max: number) => Math.max(2, max + 1)]}
              />
              <Tooltip
                cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const items = [...payload]
                    .filter((p) => typeof p.value === "number" && p.value > 0)
                    .sort((a, b) => (b.value as number) - (a.value as number));
                  const sum = items.reduce((s, p) => s + (p.value as number), 0);
                  return (
                    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                      <div className="font-medium text-foreground mb-1.5">{label}</div>
                      {items.length === 0 && (
                        <div className="text-muted-foreground">Keine erledigten Buchhaltungen</div>
                      )}
                      {items.map((p) => (
                        <div key={p.dataKey as string} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                            <span className="text-foreground">{p.name}</span>
                          </span>
                          <span className="font-medium tabular-nums">{p.value as number}</span>
                        </div>
                      ))}
                      {items.length > 1 && (
                        <div className="mt-1.5 pt-1.5 border-t flex items-center justify-between text-muted-foreground">
                          <span>Gesamt</span>
                          <span className="font-medium tabular-nums">{sum}</span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={28}
                iconType="circle"
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              />
              {trendKeys.length === 1 && (
                <Area
                  type="monotone"
                  dataKey={trendKeys[0]}
                  fill={LINE_COLORS[0]}
                  fillOpacity={0.08}
                  stroke="none"
                  legendType="none"
                />
              )}
              {trendKeys.map((name, idx) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 5, strokeWidth: 2, fill: "hsl(var(--background))" }}
                  activeDot={{ r: 7, strokeWidth: 2 }}
                />
              ))}
              {trendKeys.length === 0 && (
                <Line dataKey="__empty" stroke="transparent" legendType="none" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          {trendKeys.length === 0 && (
            <p className="text-center text-sm text-muted-foreground -mt-8">
              Keine Daten für den gewählten Zeitraum
            </p>
          )}
        </CardContent>
      </Card>

      {/* Erledigt vs Offen */}
      <Card className="card-elevated border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Workload pro Mitarbeiter</CardTitle>
          <p className="text-xs text-muted-foreground">Erledigt (gefüllt) und Offen (gestapelt) im aktuellen Filter</p>
        </CardHeader>
        <CardContent>
          {barData.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Keine Daten</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, barData.length * 50)}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 8, right: 32, left: 16, bottom: 8 }}
                barSize={28}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                        <div className="font-medium text-foreground mb-1">{label}</div>
                        {payload.map((p) => (
                          <div key={p.dataKey as string} className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                              <span className="text-foreground">{p.name}</span>
                            </span>
                            <span className="font-medium tabular-nums">{p.value as number}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="erledigt" name="Erledigt" stackId="w" fill="hsl(var(--primary))" radius={[4, 0, 0, 4]}>
                  <LabelList dataKey="erledigt" position="insideLeft" fill="hsl(var(--primary-foreground))" fontSize={11} formatter={(v: number) => (v > 0 ? v : "")} />
                </Bar>
                <Bar dataKey="offen" name="Offen" stackId="w" fill="hsl(var(--muted))" stroke="hsl(var(--border))" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="offen" position="insideRight" fill="hsl(var(--foreground))" fontSize={11} formatter={(v: number) => (v > 0 ? v : "")} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Critical items table */}
      {criticalItems.length > 0 && (
        <CriticalItemsCard items={criticalItems} />
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailMitarbeiter} onOpenChange={(o) => !o && setDetailMitarbeiter(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {detailMitarbeiter && <Avatar><AvatarFallback>{initialen(detailMitarbeiter)}</AvatarFallback></Avatar>}
              {detailMitarbeiter}
            </DialogTitle>
          </DialogHeader>
          {detailStats && (
            <div className="grid grid-cols-3 gap-3 mb-2">
              <Card className="card-elevated border-0 shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Erledigt</p><p className="text-xl font-bold text-green-600">{detailStats.erledigt}</p></CardContent></Card>
              <Card className="card-elevated border-0 shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Offen</p><p className="text-xl font-bold text-yellow-600">{detailStats.offen}</p></CardContent></Card>
              <Card className="card-elevated border-0 shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ø Dauer (Tage)</p><p className="text-xl font-bold">{detailStats.avg ?? "–"}</p></CardContent></Card>
            </div>
          )}
          <Table className="table-modern">
            <TableHeader>
              <TableRow>
                <TableHead>Mandant</TableHead>
                <TableHead>Monat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Frist</TableHead>
                <TableHead className="text-right">Dauer (Tage)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailItems.map((b) => {
                const dauer = bearbeitungsdauerTage(b);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {b.mandant?.name}
                      {b.mandant?.firma && <span className="text-muted-foreground text-xs ml-1">({b.mandant.firma})</span>}
                    </TableCell>
                    <TableCell>{b.monat}</TableCell>
                    <TableCell><StatusBadge status={b.status as any} /></TableCell>
                    <TableCell><DeadlineIndicator faelligAm={b.faellig_am} status={b.status} /></TableCell>
                    <TableCell className="text-right">{dauer ?? "–"}</TableCell>
                  </TableRow>
                );
              })}
              {detailItems.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Keine Buchhaltungen im Zeitraum</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CriticalItemsCard({ items }: { items: any[] }) {
  const [pageSize, setPageSize] = usePageSize("pageSize:statistiken");
  const { visible, page, totalPages, goToPage, total, shown } = usePaginatedList(items, pageSize, items.length);
  return (
    <Card className="border-red-200">
      <CardHeader><CardTitle className="text-lg text-red-700">⚠️ Kritische Buchhaltungen</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table className="table-modern">
          <TableHeader>
            <TableRow>
              <TableHead>Mandant</TableHead>
              <TableHead>Monat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Frist</TableHead>
              <TableHead>Bearbeiter</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((b: any) => (
              <TableRow key={b.id} className={getDeadlineStatus(b.faellig_am, b.status) === "red" ? "bg-red-50" : "bg-yellow-50"}>
                <TableCell className="font-medium">
                  {b.mandant?.name}
                  {b.mandant?.firma && <span className="text-muted-foreground text-xs ml-1">({b.mandant.firma})</span>}
                </TableCell>
                <TableCell>{b.monat}</TableCell>
                <TableCell><StatusBadge status={b.status as any} /></TableCell>
                <TableCell><DeadlineIndicator faelligAm={b.faellig_am} status={b.status} /></TableCell>
                <TableCell>{b.bearbeiter?.name ?? "–"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="px-4">
          <PaginationFooter
            page={page}
            totalPages={totalPages}
            total={total}
            shown={shown}
            onPageChange={goToPage}
            label="kritische Einträge"
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        </div>
      </CardContent>
    </Card>
  );
}
