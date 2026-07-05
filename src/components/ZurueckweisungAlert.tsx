import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertOctagon, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ZurueckweisungItem {
  notificationId: string;
  buchhaltungId: string;
  mandantId: string | null;
  mandantName: string | null;
  monat: string;
  notizen: string | null;
  zurueckgewiesenAm: string | null;
  erstelltAm: string;
}

export function ZurueckweisungAlert() {
  const { benutzerId, user } = useAuth();
  const [items, setItems] = useState<ZurueckweisungItem[]>([]);

  const loadItems = useCallback(async () => {
    if (!benutzerId) return;
    const { data: notes } = await supabase
      .from("benachrichtigungen")
      .select("id, buchhaltung_id, erstellt_am")
      .eq("empfaenger_id", benutzerId)
      .eq("typ", "zurueckgewiesen")
      .eq("gelesen", false)
      .order("erstellt_am", { ascending: true });

    if (!notes || notes.length === 0) {
      setItems([]);
      return;
    }

    const buchIds = notes.map((n: any) => n.buchhaltung_id).filter(Boolean);
    const { data: buchData } = await supabase
      .from("buchhaltungen")
      .select("id, monat, notizen, zurueckgewiesen_am, mandant_id")
      .in("id", buchIds);
    const buchMap = new Map((buchData ?? []).map((b: any) => [b.id, b]));

    const mandantIds = Array.from(new Set((buchData ?? []).map((b: any) => b.mandant_id).filter(Boolean)));
    const { data: mandanten } = mandantIds.length
      ? await supabase.from("mandanten").select("id, name").in("id", mandantIds)
      : { data: [] as { id: string; name: string }[] };
    const mandantMap = new Map((mandanten ?? []).map((m: any) => [m.id, m.name as string]));

    const next: ZurueckweisungItem[] = notes
      .map((n: any) => {
        const b: any = buchMap.get(n.buchhaltung_id);
        if (!b) return null;
        return {
          notificationId: n.id,
          buchhaltungId: n.buchhaltung_id,
          mandantId: b.mandant_id ?? null,
          mandantName: b.mandant_id ? mandantMap.get(b.mandant_id) ?? null : null,
          monat: b.monat,
          notizen: b.notizen,
          zurueckgewiesenAm: b.zurueckgewiesen_am,
          erstelltAm: n.erstellt_am,
        };
      })
      .filter(Boolean) as ZurueckweisungItem[];

    setItems(next);
  }, [benutzerId]);

  useEffect(() => {
    if (!user || !benutzerId) return;
    loadItems();
    const channel = supabase
      .channel("zurueckweisung-alert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "benachrichtigungen" },
        () => loadItems()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, benutzerId, loadItems]);

  const navigate = useNavigate();
  const current = items[0];

  if (!current) return null;

  const markRead = async () => {
    await supabase.from("benachrichtigungen").update({ gelesen: true }).eq("id", current.notificationId);
    setItems((prev) => prev.slice(1));
  };

  const handleOpen = async () => {
    await markRead();
    navigate("/dashboard");
  };

  const datum = current.zurueckgewiesenAm ?? current.erstelltAm;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg border-destructive/40"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive text-xl">
            <AlertOctagon className="h-6 w-6" />
            Buchhaltung zurückgewiesen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1">
            {current.mandantName && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Mandant</span>
                <span className="font-medium text-foreground">{current.mandantName}</span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Monat</span>
              <span className="font-medium text-foreground">{current.monat}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Zurückgewiesen am</span>
              <span className="font-medium text-foreground">
                {new Date(datum).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> Grund vom Chef
            </p>
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
              {current.notizen?.trim() || "(Kein Grund angegeben)"}
            </p>
          </div>

          {items.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Es liegen {items.length} Zurückweisungen vor. Die nächste wird nach Bestätigung angezeigt.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleOpen}>
            Buchhaltung öffnen
          </Button>
          <Button variant="destructive" onClick={markRead}>
            Verstanden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}