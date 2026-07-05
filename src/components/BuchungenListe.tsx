import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchAll } from "@/lib/fetch-all";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatEuro } from "@/lib/konten";
import { exportBuchungenAsCsv } from "@/lib/buchungen-export";
import { toast } from "@/hooks/use-toast";
import { BuchungsErfassung } from "@/components/BuchungsErfassung";
import { Loader2, Pencil, Trash2, Download, Plus } from "lucide-react";

interface BuchungRow {
  id: string;
  buchungsdatum: string;
  lieferant: string | null;
  konto: string;
  kategorie: "Einnahme" | "Ausgabe";
  betrag: number;
  beschreibung: string;
  mwst_satz: number;
  dokument_id: string | null;
}

interface Props {
  buchhaltungId: string;
  mandantId: string;
  mandantName: string;
  monat: string;
  onChanged?: () => void;
}

export function BuchungenListe({ buchhaltungId, mandantId, mandantName, monat, onChanged }: Props) {
  const { rolle } = useAuth();
  const canDelete = rolle === "Chef" || rolle === "Sekretariat";

  const [buchungen, setBuchungen] = useState<BuchungRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editBuchungId, setEditBuchungId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAll<BuchungRow>((from, to) =>
        supabase
          .from("buchungen")
          .select("id, buchungsdatum, lieferant, konto, kategorie, betrag, beschreibung, mwst_satz, dokument_id")
          .eq("buchhaltung_id", buchhaltungId)
          .order("buchungsdatum", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to) as any,
      );
      setBuchungen(data);
    } catch {
      setBuchungen([]);
    }
    setLoading(false);
  }, [buchhaltungId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("buchungen").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Fehler beim Löschen", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Buchung gelöscht" });
      setDeleteId(null);
      await load();
      onChanged?.();
    }
  };

  const handleExport = () => {
    if (buchungen.length === 0) {
      toast({ title: "Keine Buchungen", description: "Es gibt keine Buchungen zum Exportieren.", variant: "destructive" });
      return;
    }
    exportBuchungenAsCsv(buchungen, mandantName, monat);
    toast({ title: "CSV exportiert", description: `${buchungen.length} Buchungen` });
  };

  const summe = buchungen.reduce((acc, b) => {
    const v = Number(b.betrag);
    return b.kategorie === "Einnahme" ? acc + v : acc - v;
  }, 0);
  const einnahmen = buchungen.filter((b) => b.kategorie === "Einnahme").reduce((a, b) => a + Number(b.betrag), 0);
  const ausgaben = buchungen.filter((b) => b.kategorie === "Ausgabe").reduce((a, b) => a + Number(b.betrag), 0);

  const editingBuchung = editBuchungId ? buchungen.find((b) => b.id === editBuchungId) : null;

  // Derive netto + mwst from brutto + satz (DB stores brutto + satz only)
  const splitBetrag = (brutto: number, satz: number) => {
    const netto = satz === 0 ? brutto : Math.round((brutto / (1 + satz / 100)) * 100) / 100;
    const mwst = Math.round((brutto - netto) * 100) / 100;
    return { netto, mwst };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {buchungen.length} {buchungen.length === 1 ? "Buchung" : "Buchungen"}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}>
            <Plus className="h-4 w-4" /> Buchung ohne Beleg
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={buchungen.length === 0}>
            <Download className="h-4 w-4" /> CSV-Export
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : buchungen.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Noch keine Buchungen erfasst.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Lieferant / Kunde</TableHead>
                <TableHead>Konto</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Netto</TableHead>
                <TableHead className="text-right">MwSt</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buchungen.map((b) => {
                const { netto, mwst } = splitBetrag(Number(b.betrag), Number(b.mwst_satz));
                return (
                <TableRow key={b.id}>
                  <TableCell className="text-sm">{new Date(b.buchungsdatum).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell className="text-sm">
                    {b.lieferant ?? "–"}
                    {!b.dokument_id && <Badge variant="outline" className="ml-2 text-[10px]">manuell</Badge>}
                  </TableCell>
                  <TableCell className="text-sm">{b.konto}</TableCell>
                  <TableCell>
                    <Badge variant={b.kategorie === "Einnahme" ? "default" : "secondary"}>{b.kategorie}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {formatEuro(netto)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {b.mwst_satz > 0 ? `${formatEuro(mwst)} (${b.mwst_satz}%)` : "–"}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${b.kategorie === "Einnahme" ? "text-green-600" : "text-foreground"}`}>
                    {b.kategorie === "Einnahme" ? "+" : "−"}{formatEuro(Number(b.betrag))}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditBuchungId(b.id)} title="Bearbeiten">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {canDelete && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(b.id)} title="Löschen">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="grid grid-cols-3 gap-4 px-5 py-4 bg-muted/40 rounded-lg border">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Einnahmen</p>
              <p className="text-lg font-bold text-green-600">+{formatEuro(einnahmen)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Ausgaben</p>
              <p className="text-lg font-bold text-destructive">−{formatEuro(ausgaben)}</p>
            </div>
            <div className="border-l pl-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo</p>
              <p className={`text-xl font-bold ${summe >= 0 ? "text-green-600" : "text-destructive"}`}>
                {summe >= 0 ? "+" : ""}{formatEuro(summe)}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Edit / manual booking dialog */}
      {(editingBuchung || manualOpen) && (
        <BuchungsErfassung
          open={!!editingBuchung || manualOpen}
          onOpenChange={(o) => {
            if (!o) {
              setEditBuchungId(null);
              setManualOpen(false);
            }
          }}
          buchhaltungId={buchhaltungId}
          mandantId={mandantId}
          dokumente={[]}
          startDokumentId={null}
          editBuchungId={editingBuchung?.id ?? null}
          onSaved={() => {
            load();
            onChanged?.();
          }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buchung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Buchung wird unwiderruflich gelöscht. Der zugehörige Beleg bleibt erhalten und kann erneut gebucht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
