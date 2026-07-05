import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["buchhaltung_status"];

export interface PrioritaetItem {
  status: Status;
  faellig_am: string | null;
}

/**
 * Returns true if deadline is in the past and item is not yet handed in.
 */
export function istUeberfaellig(item: PrioritaetItem): boolean {
  if (!item.faellig_am) return false;
  if (item.status === "Buchhaltung erledigt") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(item.faellig_am);
  deadline.setHours(0, 0, 0, 0);
  return deadline.getTime() < today.getTime();
}

/**
 * Returns true if deadline is within the next 3 days (and not overdue, not done).
 */
export function istBaldFaellig(item: PrioritaetItem): boolean {
  if (!item.faellig_am) return false;
  if (item.status === "Buchhaltung erledigt") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(item.faellig_am);
  deadline.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 3;
}

export function inDieserWoche(faelligAm: string | null): boolean {
  if (!faelligAm) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(faelligAm);
  deadline.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
}

export function inDiesemMonat(faelligAm: string | null): boolean {
  if (!faelligAm) return false;
  const today = new Date();
  const deadline = new Date(faelligAm);
  return (
    deadline.getFullYear() === today.getFullYear() &&
    deadline.getMonth() === today.getMonth()
  );
}

/**
 * Composite priority rank — lower number = higher priority.
 * 1: Overdue
 * 2: In Bearbeitung
 * 3: Warten auf Mandant
 * 4: In Prüfung
 * 5: Buchhaltung erledigt
 * 6: anything else (e.g. Eingegangen)
 */
export function getPrioritaet(item: PrioritaetItem): number {
  if (istUeberfaellig(item)) return 1;
  switch (item.status) {
    case "In Bearbeitung":
      return 2;
    case "Warten auf Mandant":
      return 3;
    case "In Prüfung":
      return 4;
    case "Buchhaltung erledigt":
      return 5;
    default:
      return 6;
  }
}

/**
 * Compare by faellig_am ascending; null values go to the end.
 */
export function compareFaellig(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}