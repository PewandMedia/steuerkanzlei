import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertOctagon, Bell, Check, CheckCheck, MessageSquare } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface BuchhaltungInfo {
  notizen: string | null;
  mandant_id: string;
  monat: string;
  mandant_name: string | null;
  bearbeiter_name: string | null;
}

export function NotificationBell({ variant = "icon" }: { variant?: "icon" | "full" } = {}) {
  const navigate = useNavigate();
  const { rolle } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [buchhaltungInfos, setBuchhaltungInfos] = useState<Record<string, BuchhaltungInfo>>({});
  const [open, setOpen] = useState(false);

  // Fetch buchhaltung details for ALL notifications with buchhaltung_id
  useEffect(() => {
    const ids = notifications
      .filter((n) => n.buchhaltung_id)
      .map((n) => n.buchhaltung_id as string);
    const missing = Array.from(new Set(ids.filter((id) => !(id in buchhaltungInfos))));
    if (missing.length === 0) return;

    (async () => {
      const { data: buchhaltungen } = await supabase
        .from("buchhaltungen")
        .select("id, notizen, mandant_id, monat, bearbeiter_id")
        .in("id", missing);
      if (!buchhaltungen) return;

      const mandantIds = Array.from(new Set(buchhaltungen.map((b) => b.mandant_id).filter(Boolean)));
      const bearbeiterIds = Array.from(new Set(buchhaltungen.map((b) => b.bearbeiter_id).filter(Boolean) as string[]));

      const [mandantenRes, benutzerRes] = await Promise.all([
        mandantIds.length
          ? supabase.from("mandanten").select("id, name").in("id", mandantIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        bearbeiterIds.length
          ? supabase.from("benutzer").select("id, name").in("id", bearbeiterIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);

      const mandantenMap = new Map((mandantenRes.data ?? []).map((m: any) => [m.id, m.name as string]));
      const benutzerMap = new Map((benutzerRes.data ?? []).map((u: any) => [u.id, u.name as string]));

      const next: Record<string, BuchhaltungInfo> = {};
      buchhaltungen.forEach((b: any) => {
        next[b.id] = {
          notizen: b.notizen,
          mandant_id: b.mandant_id,
          monat: b.monat,
          mandant_name: mandantenMap.get(b.mandant_id) ?? null,
          bearbeiter_name: b.bearbeiter_id ? benutzerMap.get(b.bearbeiter_id) ?? null : null,
        };
      });
      setBuchhaltungInfos((prev) => ({ ...prev, ...next }));
    })();
  }, [notifications, buchhaltungInfos]);

  const handleClick = (n: typeof notifications[number]) => {
    if (!n.gelesen) markAsRead(n.id);
    setOpen(false);

    const info = n.buchhaltung_id ? buchhaltungInfos[n.buchhaltung_id] : null;
    const focus = n.buchhaltung_id ? `?focus=${n.buchhaltung_id}` : "";

    switch (n.typ) {
      case "warten_auf_mandant":
        if (info) navigate(`/mandanten/${info.mandant_id}`);
        else navigate(`/dashboard${focus}`);
        return;
      case "erledigt":
        navigate(`/buchhaltungen${focus}`);
        return;
      case "zurueckgewiesen":
      case "in_pruefung":
      case "neue_buchhaltung":
      case "co_bearbeiter_zugewiesen":
      default:
        navigate(`/dashboard${focus}`);
        return;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "full" ? (
          <Button variant="outline" className="w-full justify-start gap-2 h-9 text-muted-foreground hover:text-foreground relative">
            <Bell className="h-4 w-4" />
            <span>Benachrichtigungen</span>
            {unreadCount > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 flex flex-col max-h-[85vh]" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <h4 className="text-sm font-semibold text-foreground">Benachrichtigungen</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={markAllAsRead}>
              <CheckCheck className="h-3 w-3 mr-1" /> Alle gelesen
            </Button>
          )}
        </div>
        <ScrollArea className="h-[min(70vh,480px)]">
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Keine Benachrichtigungen</p>
          ) : (
            notifications.map((n) => {
              const info = n.buchhaltung_id ? buchhaltungInfos[n.buchhaltung_id] : null;
              const isWarten = n.typ === "warten_auf_mandant";
              const isReject = n.typ === "zurueckgewiesen";
              const bearbeiterLabel = (() => {
                if (!info?.bearbeiter_name) return null;
                switch (n.typ) {
                  case "in_pruefung":
                    return `Eingereicht von: ${info.bearbeiter_name}`;
                  case "zurueckgewiesen":
                    return `Bearbeiter: ${info.bearbeiter_name}`;
                  case "warten_auf_mandant":
                    return `Bearbeiter: ${info.bearbeiter_name}`;
                  case "neue_buchhaltung":
                  case "co_bearbeiter_zugewiesen":
                    return `Zugewiesen an: ${info.bearbeiter_name}`;
                  default:
                    return `Bearbeiter: ${info.bearbeiter_name}`;
                }
              })();
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left flex items-start gap-3 border-b px-4 py-3 text-sm transition-colors last:border-0 hover:bg-accent cursor-pointer",
                    !n.gelesen && "bg-accent/50",
                    isReject && !n.gelesen && "bg-destructive/10"
                  )}
                >
                  {isReject && (
                    <AlertOctagon className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium text-foreground", isReject && "text-destructive")}>{n.titel}</p>
                    {info?.mandant_name && (
                      <p className="text-xs font-medium text-foreground mt-0.5">
                        Mandant: {info.mandant_name} · Monat {info.monat}
                      </p>
                    )}
                    {bearbeiterLabel && (
                      <p className="text-xs text-muted-foreground mt-0.5">{bearbeiterLabel}</p>
                    )}
                    {isWarten && info?.notizen && (
                      <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> Was fehlt
                        </p>
                        <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap line-clamp-3">{info.notizen}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.erstellt_am).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {!n.gelesen && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-destructive mt-1.5" aria-label="ungelesen" />
                  )}
                </button>
              );
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
