import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Users, Phone, Mail, Building2, Search, UserCircle2, CheckCircle2, AlertCircle, MapPin } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { PaginationFooter } from "@/components/PaginationFooter";
import { usePageSize } from "@/hooks/use-page-size";
import { fetchAll } from "@/lib/fetch-all";
import { getCached, setCached } from "@/lib/simple-cache";

interface MandantCard {
  id: string;
  mandanten_nummer: string;
  name: string;
  firma: string | null;
  telefon: string | null;
  email: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  unternehmensform: string | null;
  zugewiesener_bearbeiter_id: string | null;
  offene_count: number;
  erledigte_count: number;
}

interface Bearbeiter {
  id: string;
  name: string;
}

export default function MeineMandanten() {
  usePageMeta("Meine Mandanten", "Persönliche Mandantenliste des Sachbearbeiters.");

  const navigate = useNavigate();
  const { rolle, benutzerId, loading: authLoading } = useAuth();
  const [mandanten, setMandanten] = useState<MandantCard[]>([]);
  const [bearbeiter, setBearbeiter] = useState<Bearbeiter[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !rolle) return;

    // Sofort aus Cache hydratisieren, damit Wechsel zwischen Seiten instant ist.
    const cachedMand = getCached<MandantCard[]>("meine-mandanten:cards");
    const cachedBearb = getCached<Bearbeiter[]>("meine-mandanten:bearbeiter");
    if (cachedMand) {
      setMandanten(cachedMand);
      if (cachedBearb) setBearbeiter(cachedBearb);
      setLoading(false);
    }

    const load = async () => {
      if (!cachedMand) setLoading(true);
      const [mandantenData, buchhaltungenData, benutzerData] = await Promise.all([
        fetchAll<any>((from, to) =>
          supabase
            .from("mandanten")
            .select("id, mandanten_nummer, name, firma, telefon, email, strasse, plz, ort, unternehmensform, zugewiesener_bearbeiter_id")
            .order("id", { ascending: true })
            .range(from, to) as any,
        ).catch(() => [] as any[]),
        fetchAll<any>((from, to) =>
          supabase
            .from("buchhaltungen")
            .select("mandant_id, status")
            .order("id", { ascending: true })
            .range(from, to) as any,
        ).catch(() => [] as any[]),
        rolle === "Chef"
          ? fetchAll<Bearbeiter>((from, to) =>
              supabase
                .from("benutzer")
                .select("id, name")
                .order("id", { ascending: true })
                .range(from, to) as any,
            ).catch(() => [] as Bearbeiter[])
          : Promise.resolve([] as Bearbeiter[]),
      ]);

      const offeneCounts = new Map<string, number>();
      const erledigteCounts = new Map<string, number>();
      buchhaltungenData.forEach((b: any) => {
        if (b.status === "Buchhaltung erledigt") {
          erledigteCounts.set(b.mandant_id, (erledigteCounts.get(b.mandant_id) ?? 0) + 1);
        } else {
          offeneCounts.set(b.mandant_id, (offeneCounts.get(b.mandant_id) ?? 0) + 1);
        }
      });

      const all: MandantCard[] = mandantenData.map((m: any) => ({
        id: m.id,
        mandanten_nummer: m.mandanten_nummer,
        name: m.name,
        firma: m.firma,
        telefon: m.telefon,
        email: m.email,
        strasse: m.strasse,
        plz: m.plz,
        ort: m.ort,
        unternehmensform: m.unternehmensform,
        zugewiesener_bearbeiter_id: m.zugewiesener_bearbeiter_id,
        offene_count: offeneCounts.get(m.id) ?? 0,
        erledigte_count: erledigteCounts.get(m.id) ?? 0,
      }));

      const numOf = (nr: string | null | undefined) => {
        const m = nr?.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
      };
      all.sort((a, b) => numOf(a.mandanten_nummer) - numOf(b.mandanten_nummer));

      setMandanten(all);
      setBearbeiter(benutzerData as Bearbeiter[]);
      setCached("meine-mandanten:cards", all);
      setCached("meine-mandanten:bearbeiter", benutzerData as Bearbeiter[]);
      setLoading(false);
    };
    load();
  }, [rolle, authLoading]);

  const filtered = useMemo(() => {
    const base = rolle === "Sachbearbeiter"
      ? mandanten.filter((m) => m.zugewiesener_bearbeiter_id === benutzerId)
      : mandanten;
    if (!search.trim()) return base;
    const s = search.toLowerCase();
    const sPhone = s.replace(/[\s+\-()/]/g, "");
    return base.filter((m) => {
      const phone = (m.telefon ?? "").replace(/[\s+\-()/]/g, "").toLowerCase();
      return (
        m.name.toLowerCase().includes(s) ||
        (m.firma?.toLowerCase().includes(s) ?? false) ||
        (m.mandanten_nummer?.toLowerCase().includes(s) ?? false) ||
        (m.email?.toLowerCase().includes(s) ?? false) ||
        (sPhone.length > 0 && phone.includes(sPhone))
      );
    });
  }, [mandanten, rolle, benutzerId, search]);

  const numOf = useCallback((nr: string | null | undefined) => {
    const m = nr?.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  }, []);

  const bearbeiterMap = useMemo(
    () => new Map(bearbeiter.map((b) => [b.id, b.name])),
    [bearbeiter],
  );

  const grouped = useMemo(() => {
    if (rolle !== "Chef") return null;
    const groups = new Map<string, MandantCard[]>();
    filtered.forEach((m) => {
      const key = m.zugewiesener_bearbeiter_id ?? "__none__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    });
    return Array.from(groups.entries())
      .map(([key, items]) => ({
        key,
        name: key === "__none__" ? "Nicht zugewiesen" : (bearbeiterMap.get(key) ?? "Unbekannt"),
        items: items.sort((a, b) => numOf(a.mandanten_nummer) - numOf(b.mandanten_nummer)),
      }))
      .sort((a, b) => {
        if (a.key === "__none__") return 1;
        if (b.key === "__none__") return -1;
        return a.name.localeCompare(b.name);
      });
  }, [rolle, filtered, bearbeiterMap, numOf]);

  const renderCard = useCallback((m: MandantCard) => {
    const adresse = [m.strasse, [m.plz, m.ort].filter(Boolean).join(" ")].filter((v) => v && v.trim() !== "").join(", ");
    const sachbearbeiter = m.zugewiesener_bearbeiter_id ? bearbeiterMap.get(m.zugewiesener_bearbeiter_id) : undefined;
    const offenLabel = m.offene_count === 1 ? "offene Buchhaltung" : "offene Buchhaltungen";
    const isUrgent = m.offene_count >= 3;
    const nr = m.mandanten_nummer || "—";
    const nrSize = nr.length > 9 ? "text-[10px]" : nr.length > 6 ? "text-xs" : "text-sm";
    return (
      <div
        key={m.id}
        onClick={() => navigate(`/mandanten/${m.id}`, { state: { from: "/meine-mandanten" } })}
        className="group cursor-pointer w-full rounded-lg border border-border/70 bg-card border-l-4 border-l-brand/60 hover:border-l-brand hover:shadow-[var(--shadow-card)] hover:bg-accent/30 transition-all duration-150 px-2.5 py-2 sm:px-3 sm:py-2.5"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mandantennummer-Tile */}
          <div className="shrink-0 h-10 w-14 sm:h-12 sm:w-20 md:w-24 rounded-md bg-brand/10 border border-brand/20 flex items-center justify-center text-brand px-1.5">
            <span className={`font-mono font-bold leading-none whitespace-nowrap truncate ${nrSize}`}>
              {nr}
            </span>
          </div>

          {/* Spalte: Name / Firma */}
          <div className="min-w-0 flex-1 md:basis-1/3 md:flex-none">
            <p className="font-semibold text-sm text-foreground truncate group-hover:text-brand transition-colors">
              {m.name}
            </p>
            {(m.firma || m.unternehmensform) && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {m.firma}
                  {m.firma && m.unternehmensform && <span className="text-muted-foreground/70"> · {m.unternehmensform}</span>}
                  {!m.firma && m.unternehmensform}
                </span>
              </p>
            )}
          </div>

          {/* Spalte: Kontakt – nur md+ */}
          <div className="hidden md:block min-w-0 flex-1 text-xs text-muted-foreground">
            {m.telefon && (
              <div
                className="flex items-center gap-1.5 truncate"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{m.telefon}</span>
                <WhatsAppButton telefon={m.telefon} mandantName={m.name} />
              </div>
            )}
            {m.email && (
              <p className="flex items-center gap-1.5 truncate mt-0.5">
                <Mail className="h-3 w-3 shrink-0" /> {m.email}
              </p>
            )}
            {!m.telefon && !m.email && adresse && (
              <p className="flex items-center gap-1.5 truncate">
                <MapPin className="h-3 w-3 shrink-0" /> {adresse}
              </p>
            )}
          </div>

          {/* Status rechts */}
          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
            {sachbearbeiter && rolle === "Chef" && (
              <span className="hidden lg:inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                <UserCircle2 className="h-3 w-3" />
                {sachbearbeiter}
              </span>
            )}
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {m.erledigte_count} erledigt
            </span>
            {m.offene_count > 0 ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 rounded-md border text-xs font-semibold bg-amber-50 border-amber-300 text-amber-900 ${isUrgent ? "ring-2 ring-amber-200" : ""}`}
                aria-label={`${m.offene_count} ${offenLabel}`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="font-bold">{m.offene_count}</span>
                <span className="hidden sm:inline">{offenLabel}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="h-3 w-3" />
                <span className="hidden sm:inline">Alles erledigt</span>
                <span className="sm:hidden">OK</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }, [bearbeiterMap, navigate, rolle]);

  const title = rolle === "Sachbearbeiter" ? "Meine Mandanten" : "Mandanten je Sachbearbeiter";
  const totalCount = filtered.length;

  if (authLoading) {
    return <div className="p-6">Laden…</div>;
  }

  if (rolle !== "Sachbearbeiter" && rolle !== "Chef") {
    return (
      <div className="p-6">
        <Card className="card-elevated border-0 shadow-none"><CardContent className="p-6 text-sm text-muted-foreground">Diese Seite ist nur für Sachbearbeiter und Chefs verfügbar.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-4 sm:space-y-6 min-w-0">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 sm:h-6 sm:w-6 text-brand" />
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          {title} <span className="text-muted-foreground font-normal text-base sm:text-lg">({totalCount})</span>
        </h1>
      </div>

      <Card className="card-elevated border-0 shadow-none">
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 sm:h-5 sm:w-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche nach Name, Nummer, Firma, E-Mail…"
                className="pl-10 sm:pl-11 h-11 sm:h-12 text-sm sm:text-base w-full"
              />
            </div>
            <span className="hidden sm:inline-flex shrink-0 text-sm text-muted-foreground px-3 py-1.5 rounded-md bg-brand/5 border border-brand/15">
              <span className="font-semibold text-brand mr-1">{totalCount}</span> Mandanten
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated border-0 shadow-none">
        <CardContent className="p-3 sm:p-5">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-10">Lädt…</p>
          ) : totalCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {rolle === "Sachbearbeiter"
                ? "Ihnen sind aktuell keine Mandanten zugewiesen."
                : "Keine Mandanten gefunden."}
            </p>
          ) : rolle === "Sachbearbeiter" ? (
            <PaginatedList items={filtered} renderCard={renderCard} resetKey={search} />
          ) : (
            <Accordion type="multiple" defaultValue={grouped!.map((g) => g.key)} className="space-y-2">
              {grouped!.map((g) => (
                <AccordionItem key={g.key} value={g.key} className="border rounded-lg px-3">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2">
                      <UserCircle2 className="h-4 w-4 text-brand" />
                      <span className="font-medium">{g.name}</span>
                      <Badge variant="secondary" className="bg-brand/10 text-brand border-brand/20 hover:bg-brand/15">{g.items.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <PaginatedList items={g.items} renderCard={renderCard} resetKey={search} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PaginatedList({
  items,
  renderCard,
  resetKey,
}: {
  items: MandantCard[];
  renderCard: (m: MandantCard) => JSX.Element;
  resetKey?: unknown;
}) {
  const [pageSize, setPageSize] = usePageSize("pageSize:meine-mandanten");
  const { visible, page, totalPages, goToPage, total, shown } = usePaginatedList(items, pageSize, resetKey);
  return (
    <>
      <div className="flex flex-col gap-3 pt-2 pb-1">
        {visible.map(renderCard)}
      </div>
      {total > 0 && (
        <PaginationFooter
          page={page}
          totalPages={totalPages}
          total={total}
          shown={shown}
          onPageChange={goToPage}
          label="Mandanten"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      )}
    </>
  );
}