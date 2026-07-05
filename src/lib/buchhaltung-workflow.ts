import type { Database } from "@/integrations/supabase/types";

type BuchhaltungStatus = Database["public"]["Enums"]["buchhaltung_status"];
type BenutzerRolle = Database["public"]["Enums"]["benutzer_rolle"];

// Allowed transitions: from → [to states]
const TRANSITIONS: Record<BuchhaltungStatus, BuchhaltungStatus[]> = {
  "Eingegangen": ["In Bearbeitung"],
  "In Bearbeitung": ["Warten auf Mandant", "In Prüfung"],
  "Warten auf Mandant": ["In Bearbeitung"],
  "In Prüfung": ["Buchhaltung erledigt", "In Bearbeitung"],
  "Buchhaltung erledigt": [],
};

// Which roles can set which target statuses
const ROLE_PERMISSIONS: Record<BenutzerRolle, BuchhaltungStatus[]> = {
  "Sekretariat": [],
  "Sachbearbeiter": ["In Bearbeitung", "Warten auf Mandant", "In Prüfung"],
  "Chef": ["Buchhaltung erledigt", "In Bearbeitung"],
};

export function canTransition(
  from: BuchhaltungStatus,
  to: BuchhaltungStatus,
  rolle: BenutzerRolle
): boolean {
  const allowedTargets = TRANSITIONS[from] ?? [];
  const roleTargets = ROLE_PERMISSIONS[rolle] ?? [];
  return allowedTargets.includes(to) && roleTargets.includes(to);
}

export function getAllowedNextStatuses(
  currentStatus: BuchhaltungStatus,
  rolle: BenutzerRolle
): BuchhaltungStatus[] {
  const allowedTargets = TRANSITIONS[currentStatus] ?? [];
  const roleTargets = ROLE_PERMISSIONS[rolle] ?? [];
  return allowedTargets.filter((s) => roleTargets.includes(s));
}

export function getStatusColor(status: BuchhaltungStatus): string {
  switch (status) {
    case "Eingegangen":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "In Bearbeitung":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "Warten auf Mandant":
      return "bg-red-100 text-red-800 border-red-200";
    case "In Prüfung":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "Buchhaltung erledigt":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}
