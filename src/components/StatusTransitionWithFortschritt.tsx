import { StatusTransition } from "@/components/StatusTransition";
import type { Database } from "@/integrations/supabase/types";

type BuchhaltungStatus = Database["public"]["Enums"]["buchhaltung_status"];
type BenutzerRolle = Database["public"]["Enums"]["benutzer_rolle"];

interface Props {
  buchhaltungId: string;
  currentStatus: BuchhaltungStatus;
  rolle: BenutzerRolle;
  onStatusChanged: () => void;
}

/**
 * Passthrough für Kompatibilität. Früher hat diese Komponente auf den
 * Buchungsfortschritt gewartet — Pewand Media verwaltet jetzt nur noch die
 * Weiterleitung, deshalb einfacher Wrapper um StatusTransition.
 */
export function StatusTransitionWithFortschritt({ buchhaltungId, currentStatus, rolle, onStatusChanged }: Props) {
  return (
    <StatusTransition
      buchhaltungId={buchhaltungId}
      currentStatus={currentStatus}
      rolle={rolle}
      onStatusChanged={onStatusChanged}
    />
  );
}
