import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface Notification {
  id: string;
  typ: string;
  titel: string;
  nachricht: string;
  gelesen: boolean;
  buchhaltung_id: string | null;
  erstellt_am: string;
}

export function useNotifications() {
  const { benutzerId } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = notifications.filter((n) => !n.gelesen).length;

  const fetchNotifications = useCallback(async () => {
    if (!benutzerId) return;
    const { data } = await supabase
      .from("benachrichtigungen")
      .select("id, typ, titel, nachricht, gelesen, buchhaltung_id, erstellt_am")
      .order("erstellt_am", { ascending: false })
      .limit(20);
    setNotifications((data as Notification[]) ?? []);
  }, [benutzerId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!benutzerId) return;
    const channel = supabase
      .channel("benachrichtigungen-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "benachrichtigungen" },
        () => fetchNotifications()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [benutzerId, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from("benachrichtigungen").update({ gelesen: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, gelesen: true } : n)));
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.gelesen).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("benachrichtigungen").update({ gelesen: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, gelesen: true })));
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
