/**
 * Steuerkanal für das Tutorial.
 *
 * Die echten Seiten und Dialoge registrieren hier freiwillig einen kleinen
 * Controller. Das Tutorial ruft diese Methoden auf, statt DOM-Events zu
 * fälschen. Ohne aktives Tutorial passiert dadurch nichts — die Registrierung
 * ist ein reiner Nebeneffekt ohne Verhaltensänderung.
 */

export type MandantFeld =
  | "vorname"
  | "nachname"
  | "firma"
  | "telefon"
  | "email"
  | "strasse"
  | "plz"
  | "ort"
  | "notizen";

export interface MandantDialogController {
  oeffnen: () => void;
  schliessen: () => void;
  setzeFeld: (feld: MandantFeld, wert: string) => void;
  setzeUnternehmensform: (wert: string) => void;
  speichern: () => Promise<string | null>;
}

export interface BuchhaltungDialogController {
  oeffnen: () => void;
  schliessen: () => void;
  setzeMandant: (id: string) => void;
  waehleBearbeiter: (name?: string) => boolean;
  setzeMonat: (ym: string) => void;
  setzeBelegeingang: (datum: string) => void;
  setzeNotiz: (text: string) => void;
  absenden: () => Promise<string[]>;
}

export interface NotizDialogController {
  setzeNotiz: (text: string) => void;
}

export interface DashboardController {
  fokus: (buchhaltungId: string | null) => void;
  aktualisieren: () => Promise<void>;
}

interface ControllerMap {
  mandant: MandantDialogController;
  buchhaltung: BuchhaltungDialogController;
  notiz: NotizDialogController;
  dashboard: DashboardController;
}

export type ControllerKey = keyof ControllerMap;

const registry = new Map<ControllerKey, unknown>();

export function registerController<K extends ControllerKey>(
  key: K,
  controller: ControllerMap[K] | null,
): void {
  if (controller) registry.set(key, controller);
  else registry.delete(key);
}

export function getController<K extends ControllerKey>(key: K): ControllerMap[K] | null {
  return (registry.get(key) as ControllerMap[K] | undefined) ?? null;
}

/** Wartet, bis die Seite/der Dialog seinen Controller registriert hat. */
export async function warteAufController<K extends ControllerKey>(
  key: K,
  timeoutMs = 10000,
): Promise<ControllerMap[K]> {
  const ende = Date.now() + timeoutMs;
  for (;;) {
    const c = getController(key);
    if (c) return c;
    if (Date.now() > ende) {
      throw new Error(`Der Bereich „${key}" konnte nicht geöffnet werden.`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}
