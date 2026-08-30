import type { Database } from "@/integrations/supabase/types";

export type BenutzerRolle = Database["public"]["Enums"]["benutzer_rolle"];

export const LAUF_KEY = "tutorial:lauf";
export const GESEHEN_KEY = "tutorial:gesehen";
const VERSION = 1;

export interface TutorialLauf {
  version: number;
  /** Aktueller Abschnitt (1-basiert, siehe tutorial-schritte). */
  abschnitt: number;
  /** Rolle, mit der der Besucher angemeldet sein muss, um fortzusetzen. */
  erwarteteRolle: BenutzerRolle;
  mandantId?: string;
  buchhaltungId?: string;
}

export function leseLauf(): TutorialLauf | null {
  try {
    const raw = window.localStorage.getItem(LAUF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TutorialLauf;
    if (!parsed || parsed.version !== VERSION) return null;
    if (typeof parsed.abschnitt !== "number" || !parsed.erwarteteRolle) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function schreibeLauf(lauf: TutorialLauf): TutorialLauf {
  const mitVersion = { ...lauf, version: VERSION };
  try {
    window.localStorage.setItem(LAUF_KEY, JSON.stringify(mitVersion));
  } catch {
    /* privates Fenster: ignorieren */
  }
  return mitVersion;
}

export function loescheLauf(): void {
  try {
    window.localStorage.removeItem(LAUF_KEY);
  } catch {
    /* ignorieren */
  }
}

export function neuerLauf(): TutorialLauf {
  return schreibeLauf({ version: VERSION, abschnitt: 1, erwarteteRolle: "Sekretariat" });
}

export function leseGesehen(): boolean {
  try {
    return window.localStorage.getItem(GESEHEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function schreibeGesehen(): void {
  try {
    window.localStorage.setItem(GESEHEN_KEY, "1");
  } catch {
    /* ignorieren */
  }
}
