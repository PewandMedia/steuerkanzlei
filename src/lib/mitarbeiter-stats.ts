export type Zeitraum =
  | "current_month"
  | "last_3_months"
  | "last_6_months"
  | "this_year"
  | "last_year"
  | "all"
  | "specific_month";

/**
 * Number of weekdays (Mon–Fri) between two dates inclusive.
 */
export function arbeitstageZwischen(start: Date, end: Date): number {
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur.getTime() <= last.getTime()) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Returns date range [start, end] for the given Zeitraum.
 * For "specific_month" pass MM-YYYY in specificMonat.
 * For "all" returns null (no boundary).
 */
export function zeitraumRange(
  zeitraum: Zeitraum,
  specificMonat?: string,
): { start: Date; end: Date } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const y = today.getFullYear();
  const m = today.getMonth();

  switch (zeitraum) {
    case "current_month":
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
    case "last_3_months":
      return { start: new Date(y, m - 2, 1), end: new Date(y, m + 1, 0) };
    case "last_6_months":
      return { start: new Date(y, m - 5, 1), end: new Date(y, m + 1, 0) };
    case "this_year":
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
    case "last_year":
      return { start: new Date(y - 1, 0, 1), end: new Date(y - 1, 11, 31) };
    case "specific_month": {
      if (!specificMonat || !/^\d{2}-\d{4}$/.test(specificMonat)) return null;
      const [mm, yyyy] = specificMonat.split("-").map(Number);
      return { start: new Date(yyyy, mm - 1, 1), end: new Date(yyyy, mm, 0) };
    }
    case "all":
    default:
      return null;
  }
}

/**
 * Check if the buchhaltung's `monat` (MM-YYYY) falls into the time range.
 */
export function monatInRange(monat: string, range: { start: Date; end: Date } | null): boolean {
  if (!range) return true;
  if (!/^\d{2}-\d{4}$/.test(monat)) return true;
  const [mm, yyyy] = monat.split("-").map(Number);
  const monatStart = new Date(yyyy, mm - 1, 1);
  const monatEnd = new Date(yyyy, mm, 0);
  return monatEnd >= range.start && monatStart <= range.end;
}

/**
 * Processing duration in days: fertiggestellt_datum (or abgabe_datum) - erstellt_am.
 */
export function bearbeitungsdauerTage(b: {
  erstellt_am: string;
  fertiggestellt_datum: string | null;
  abgabe_datum: string | null;
}): number | null {
  const endStr = b.fertiggestellt_datum ?? b.abgabe_datum;
  if (!endStr) return null;
  const start = new Date(b.erstellt_am);
  const end = new Date(endStr);
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

export function zielerreichung(erledigt: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((erledigt / max) * 100);
}

export type LeistungsStatus = "sehr_gut" | "normal" | "schwach";

export function leistungsStatus(prozent: number): LeistungsStatus {
  if (prozent >= 80) return "sehr_gut";
  if (prozent >= 40) return "normal";
  return "schwach";
}

export function leistungsLabel(s: LeistungsStatus): string {
  return s === "sehr_gut" ? "Sehr gut" : s === "normal" ? "Normal" : "Schwach";
}

/**
 * Returns a sorted list of "MM-YYYY" labels for the last N months (chronological).
 */
export function letzteMonate(n: number): string[] {
  const today = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    out.push(`${mm}-${d.getFullYear()}`);
  }
  return out;
}

export function initialen(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
