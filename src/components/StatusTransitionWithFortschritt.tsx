import { StatusTransition } from "@/components/StatusTransition";
import { useBuchungsFortschritt } from "@/hooks/use-buchungs-fortschritt";
import type { Database } from "@/integrations/supabase/types";

type BuchhaltungStatus = Database["public"]["Enums"]["buchhaltung_status"];
type BenutzerRolle = Database["public"]["Enums"]["benutzer_rolle"];

interface Props {
  buchhaltungId: string;
  currentStatus: BuchhaltungStatus;
  rolle: BenutzerRolle;
  onStatusChanged: () => void;
  /** Wenn false, wird nicht auf Belegbuchungen gewartet (Nur-Weiterleitung-Modus). */
  automatisierungAktiv?: boolean;
}

/**
 * Wraps StatusTransition and computes whether all documents in this Buchhaltung
 * have been booked. If not, "Zur Prüfung senden" is disabled with an explanation.
 */
export function StatusTransitionWithFortschritt({ buchhaltungId, currentStatus, rolle, onStatusChanged, automatisierungAktiv = true }: Props) {
  const { allBooked, offen, total, loading } = useBuchungsFortschritt(buchhaltungId);

  // Only relevant for Sachbearbeiter on "In Bearbeitung" AND when automation is active
  const shouldGate = automatisierungAktiv && currentStatus === "In Bearbeitung" && rolle === "Sachbearbeiter" && !loading;
  // Only block when there are documents (total > 0) and not all are booked
  const disablePruefung = shouldGate && total > 0 && !allBooked;
  const reason = disablePruefung
    ? `Es sind noch ${offen} von ${total} Belegen offen. Bitte alle buchen.`
    : undefined;

  return (
    <StatusTransition
      buchhaltungId={buchhaltungId}
      currentStatus={currentStatus}
      rolle={rolle}
      onStatusChanged={onStatusChanged}
      disablePruefung={disablePruefung}
      disablePruefungReason={reason}
    />
  );
}
