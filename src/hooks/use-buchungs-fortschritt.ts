import { useEffect, useState, useCallback, useRef, useId } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Fortschritt {
  total: number;
  gebucht: number;
  offen: number;
  pct: number;
  allBooked: boolean;
  loading: boolean;
  bookedDocIds: Set<string>;
  refresh: () => void;
  /** Optimistically mark a document as booked (UI updates instantly). */
  markBooked: (dokumentId: string) => void;
  /** Optimistically un-mark a document. */
  unmarkBooked: (dokumentId: string) => void;
}

export function useBuchungsFortschritt(buchhaltungId: string | null | undefined): Fortschritt {
  const [total, setTotal] = useState(0);
  const [bookedDocIds, setBookedDocIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const reloadTimer = useRef<number | null>(null);
  const instanceId = useId();

  const load = useCallback(async () => {
    if (!buchhaltungId) {
      setTotal(0);
      setBookedDocIds(new Set());
      setLoading(false);
      return;
    }
    const [docsRes, buchRes] = await Promise.all([
      supabase
        .from("buchhaltung_dokumente")
        .select("id", { count: "exact", head: true })
        .eq("buchhaltung_id", buchhaltungId),
      supabase
        .from("buchungen")
        .select("dokument_id")
        .eq("buchhaltung_id", buchhaltungId)
        .not("dokument_id", "is", null),
    ]);
    const totalCount = docsRes.count ?? 0;
    const bookedSet = new Set(
      (buchRes.data ?? []).map((b) => b.dokument_id).filter(Boolean) as string[]
    );
    setTotal(totalCount);
    setBookedDocIds(bookedSet);
    setLoading(false);
  }, [buchhaltungId]);

  // Debounced reload to coalesce bursts of realtime events
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => {
      load();
    }, 150);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!buchhaltungId) return;
    const channel = supabase
      .channel(`fortschritt-${buchhaltungId}-${instanceId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buchungen",
          filter: `buchhaltung_id=eq.${buchhaltungId}`,
        },
        () => scheduleReload()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buchhaltung_dokumente",
          filter: `buchhaltung_id=eq.${buchhaltungId}`,
        },
        () => scheduleReload()
      )
      .subscribe();

    return () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [buchhaltungId, scheduleReload, instanceId]);

  const markBooked = useCallback((dokumentId: string) => {
    if (!dokumentId) return;
    setBookedDocIds((prev) => {
      if (prev.has(dokumentId)) return prev;
      const next = new Set(prev);
      next.add(dokumentId);
      return next;
    });
  }, []);

  const unmarkBooked = useCallback((dokumentId: string) => {
    if (!dokumentId) return;
    setBookedDocIds((prev) => {
      if (!prev.has(dokumentId)) return prev;
      const next = new Set(prev);
      next.delete(dokumentId);
      return next;
    });
  }, []);

  const gebucht = bookedDocIds.size;
  const offen = Math.max(0, total - gebucht);
  const pct = total === 0 ? 0 : Math.min(100, Math.round((gebucht / total) * 100));
  const allBooked = total > 0 && gebucht >= total;

  return {
    total,
    gebucht,
    offen,
    pct,
    allBooked,
    loading,
    bookedDocIds,
    refresh: load,
    markBooked,
    unmarkBooked,
  };
}
