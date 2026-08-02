import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileSpreadsheet, Search, Loader2 } from "lucide-react";
import { BelegeVollansicht } from "@/components/BelegeVollansicht";
import { usePageMeta } from "@/hooks/use-page-meta";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { usePageSize } from "@/hooks/use-page-size";
import { PaginationFooter } from "@/components/PaginationFooter";
import { fetchAll } from "@/lib/fetch-all";

interface Row {
  id: string;
  monat: string;
  fertiggestellt_datum: string | null;
  abgabe_datum: string | null;
  erstellt_am: string;
  bearbeiter_name: string | null;
  mandant_id: string | null;
  mandant_name: string | null;
  mandant_firma: string | null;
  mandanten_nummer: string | null;
  dokumente_count: number;
}

export default function BuchhaltungenAbschluesse() {
  usePageMeta("Erstellte Buchhaltungen", "Übersicht aller abgeschlossenen Buchhaltungen.");
  const { rolle } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [suche, setSuche] = useState("");
  const [pageSize, setPageSize] = usePageSize("pageSize:abschluesse");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchAll<any>((from, to) =>
          supabase
            .from("buchhaltungen")
            .select(
              "id, monat, fertiggestellt_datum, abgabe_datum, erstellt_am, mandant_id, bearbeiter:benutzer!buchhaltungen_bearbeiter_id_fkey(name), mandant:mandanten(name, firma, mandanten_nummer), buchhaltung_dokumente(id)",
            )
            .eq("status", "Buchhaltung erledigt")
            .order("fertiggestellt_datum", { ascending: false, nullsFirst: false })
            .order("erstellt_am", { ascending: false })
            .range(from, to) as any,
        );
        setRows(
          data.map((d: any) => ({
            id: d.id,
            monat: d.monat,
            fertiggestellt_datum: d.fertiggestellt_datum,
            abgabe_datum: d.abgabe_datum,
            erstellt_am: d.erstellt_am,
            bearbeiter_name: d.bearbeiter?.name ?? null,
            mandant_id: d.mandant_id,
            mandant_name: d.mandant?.name ?? null,
            mandant_firma: d.mandant?.firma ?? null,
            mandanten_nummer: d.mandant?.mandanten_nummer ?? null,
            dokumente_count: Array.isArray(d.buchhaltung_dokumente) ? d.buchhaltung_dokumente.length : 0,
          })),
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.mandant_name, r.mandant_firma, r.mandanten_nummer, r.monat, r.bearbeiter_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, suche]);

  const { visible, page, totalPages, goToPage, total, shown } = usePaginatedList(filtered, pageSize);

  const canSee = rolle === "Sachbearbeiter" || rolle === "Chef";
  if (!canSee) {
    return (
      <div className="p-6 lg:p-10">
        <p className="text-sm text-muted-foreground">Keine Berechtigung.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-6 min-w-0">
      <div>
        <p className="section-label">Archiv</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-1 flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" /> Erstellte Buchhaltungen
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alle Buchhaltungen mit Status „Buchhaltung erledigt". Die zugehörigen Belege bleiben abrufbar.
        </p>
      </div>

      <div className="card-elevated p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Mandant, Monat, Bearbeiter…"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
        </div>
        <Badge variant="outline" className="gap-1 border-green-600 text-green-700">
          <CheckCircle className="h-3.5 w-3.5" /> {rows.length} erledigt
        </Badge>
      </div>

      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Noch keine abgeschlossenen Buchhaltungen.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-2 px-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mandant</TableHead>
                      <TableHead>Monat</TableHead>
                      <TableHead className="hidden md:table-cell">Bearbeiter</TableHead>
                      <TableHead className="hidden sm:table-cell">Fertiggestellt</TableHead>
                      <TableHead>Belege</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {r.mandanten_nummer && (
                              <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {r.mandanten_nummer}
                              </span>
                            )}
                            <span className="min-w-0">{r.mandant_name ?? "–"}</span>
                            {r.mandant_firma && r.mandant_firma !== r.mandant_name && (
                              <span className="hidden lg:inline text-xs text-muted-foreground">({r.mandant_firma})</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{r.monat}</TableCell>
                        <TableCell className="hidden md:table-cell">{r.bearbeiter_name ?? "–"}</TableCell>
                        <TableCell className="hidden sm:table-cell whitespace-nowrap">
                          {r.fertiggestellt_datum
                            ? new Date(r.fertiggestellt_datum).toLocaleDateString("de-DE")
                            : "–"}
                        </TableCell>
                        <TableCell>
                          <BelegeVollansicht
                            buchhaltungId={r.id}
                            mandantId={r.mandant_id ?? undefined}
                            mandantName={r.mandant_name ?? "–"}
                            monat={r.monat}
                            dokumenteCount={r.dokumente_count}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {total > 0 && (
                <PaginationFooter
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  shown={shown}
                  onPageChange={goToPage}
                  label="Buchhaltungen"
                  pageSize={pageSize}
                  onPageSizeChange={setPageSize}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          Drucken
        </Button>
      </div>
    </div>
  );
}
