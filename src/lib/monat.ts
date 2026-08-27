/**
 * Buchhaltungsmonate sind Text im Format "MM-YYYY".
 * Alphabetisches Sortieren ergibt Unsinn ("01-2025" < "10-2024"),
 * daher hier eine gemeinsame Hilfsfunktion für sortierbare Werte.
 */
export function monatSortKey(monat: string | null | undefined): number {
  if (!monat) return 0;
  const m = /^(\d{1,2})-(\d{4})$/.exec(monat.trim());
  if (!m) return 0;
  return Number(m[2]) * 12 + (Number(m[1]) - 1);
}

/** Aufsteigend (ältester Monat zuerst). */
export function compareMonat(a: string | null | undefined, b: string | null | undefined): number {
  return monatSortKey(a) - monatSortKey(b);
}

/** Absteigend (neuester Monat zuerst). */
export function compareMonatDesc(a: string | null | undefined, b: string | null | undefined): number {
  return monatSortKey(b) - monatSortKey(a);
}
