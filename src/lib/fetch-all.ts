import type { PostgrestError } from "@supabase/supabase-js";

type PageResult<T> = { data: T[] | null; error: PostgrestError | null };

/**
 * Lädt alle Datensätze einer Supabase-Abfrage seitenweise nach.
 *
 * Hintergrund: Die Supabase-API liefert pro Antwort maximal eine bestimmte
 * Anzahl Zeilen (Standard 1000). `.range(0, 99999)` umgeht das nicht — es
 * begrenzt nur clientseitig. Diese Helferfunktion ruft die Query so oft auf,
 * bis wirklich alle Datensätze geladen sind.
 *
 * Wichtig: Die übergebene Query MUSS eine stabile Sortierung haben, sonst
 * können Datensätze doppelt oder gar nicht geladen werden.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Sicherheitsnetz: maximal 1.000.000 Zeilen, damit nichts in eine
  // Endlosschleife laufen kann.
  const hardCap = 1_000_000;
  while (from < hardCap) {
    const to = from + pageSize - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}