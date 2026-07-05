import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function usePruefungCount() {
  const { rolle } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (rolle !== "Chef") {
      setCount(0);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { count: c } = await supabase
        .from("buchhaltungen")
        .select("id", { count: "exact", head: true })
        .eq("status", "In Prüfung");
      if (!cancelled) setCount(c ?? 0);
    };

    load();
    const interval = setInterval(load, 60_000);

    const channel = supabase
      .channel("pruefung-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "buchhaltungen" },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [rolle]);

  return count;
}