/**
 * Schmaler Steuerkanal für das Tutorial.
 *
 * Das Tutorial führt keine Aktionen mehr selbst aus — es erklärt und hebt
 * hervor. Übrig bleibt nur die Anzeige-Unterstützung des Dashboards
 * (Liste neu laden, eine Zeile fokussieren). Ohne aktives Tutorial hat die
 * Registrierung keinerlei Wirkung.
 */

export interface DashboardController {
  fokus: (buchhaltungId: string | null) => void;
  aktualisieren: () => Promise<void>;
}

interface ControllerMap {
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

/** Wartet, bis die Seite ihren Controller registriert hat. */
export async function warteAufController<K extends ControllerKey>(
  key: K,
  timeoutMs = 10000,
): Promise<ControllerMap[K] | null> {
  const ende = Date.now() + timeoutMs;
  for (;;) {
    const c = getController(key);
    if (c) return c;
    if (Date.now() > ende) return null;
    await new Promise((r) => setTimeout(r, 120));
  }
}
