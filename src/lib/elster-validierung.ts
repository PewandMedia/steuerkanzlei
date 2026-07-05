import type { BuchungInput } from "@/lib/buchhaltung-erstellung";

export type ElsterValidierungStatus = "bereit" | "warnung" | "fehler";
export type ElsterCheckLevel = "ok" | "warn" | "error";

export interface ElsterCheck {
  id: string;
  level: ElsterCheckLevel;
  label: string;
  detail?: string;
}

export interface ElsterValidierung {
  status: ElsterValidierungStatus;
  checks: ElsterCheck[];
  hatFehler: boolean;
  hatWarnung: boolean;
}

interface UStVALike {
  "81": number;
  "81_steuer": number;
  "86": number;
  "86_steuer": number;
  "35": number;
  "66": number;
  "83": number;
}

interface FortschrittLike {
  total: number;
  gebucht: number;
  offen: number;
  allBooked: boolean;
}

const GROSS_BOOKING_THRESHOLD = 10_000;

/**
 * Reine Validierungsfunktion für die ELSTER-Übergabe.
 * Liefert eine Liste von Checks (ok/warn/error) und einen aggregierten Status.
 */
export function validiereElster(
  buchungen: BuchungInput[],
  ustva: UStVALike,
  fortschritt: FortschrittLike,
): ElsterValidierung {
  const checks: ElsterCheck[] = [];

  // 1) Gibt es überhaupt Belege?
  if (fortschritt.total === 0 && buchungen.length === 0) {
    checks.push({
      id: "keine-belege",
      level: "error",
      label: "Keine Belege vorhanden",
      detail: "Es wurden noch keine Belege hochgeladen oder gebucht.",
    });
  } else {
    // 2) Alle Belege gebucht?
    if (!fortschritt.allBooked && fortschritt.total > 0) {
      checks.push({
        id: "offene-belege",
        level: "error",
        label: `${fortschritt.offen} von ${fortschritt.total} Belegen noch offen`,
        detail: "Alle Belege müssen gebucht sein, bevor an ELSTER übergeben werden kann.",
      });
    } else if (fortschritt.total > 0) {
      checks.push({
        id: "alle-gebucht",
        level: "ok",
        label: `Alle ${fortschritt.total} Belege gebucht`,
      });
    }
  }

  // 3) Sind Einnahmen / Ausgaben überhaupt vorhanden?
  const summeUmsaetze = ustva["81"] + ustva["86"] + ustva["35"];
  const summeVorsteuer = ustva["66"];
  if (summeUmsaetze < 0.005 && buchungen.length > 0) {
    checks.push({
      id: "keine-umsaetze-zeitraum",
      level: "warn",
      label: "Keine steuerpflichtigen Umsätze im ausgewählten Zeitraum erfasst",
      detail:
        summeVorsteuer > 0.005
          ? "Es wurde nur Vorsteuer erfasst, aber keine Umsätze."
          : "Buchungen vorhanden, aber alle Umsatz-Beträge wurden zu 0 € erfasst.",
    });
  } else if (buchungen.length > 0) {
    checks.push({
      id: "einnahmen-ausgaben",
      level: "ok",
      label: "Einnahmen und Ausgaben plausibel",
    });
  }

  // 4) USt-Beträge dürfen nicht negativ sein
  const negativeUSt =
    ustva["81_steuer"] < -0.005 ||
    ustva["86_steuer"] < -0.005 ||
    ustva["66"] < -0.005;
  if (negativeUSt) {
    checks.push({
      id: "negative-ust",
      level: "error",
      label: "Negativer Steuerbetrag in den Kennziffern",
      detail: "USt 19%, USt 7% oder Vorsteuer ist negativ. Bitte Buchungen prüfen.",
    });
  }

  // 5) Ungewöhnlich grosse Einzelbuchung
  const grosseBuchungen = buchungen.filter((b) => Math.abs(b.betrag) > GROSS_BOOKING_THRESHOLD);
  if (grosseBuchungen.length > 0) {
    checks.push({
      id: "grosse-buchung",
      level: "warn",
      label: `${grosseBuchungen.length} Buchung${grosseBuchungen.length === 1 ? "" : "en"} über 10.000 €`,
      detail: "Bitte ungewöhnlich hohe Einzelbeträge stichprobenartig prüfen.",
    });
  }

  const hatFehler = checks.some((c) => c.level === "error");
  const hatWarnung = checks.some((c) => c.level === "warn");
  const status: ElsterValidierungStatus = hatFehler
    ? "fehler"
    : hatWarnung
      ? "warnung"
      : "bereit";

  return { status, checks, hatFehler, hatWarnung };
}

/**
 * Formatiert einen Geldbetrag im ELSTER-Eingabeformat:
 * - Punkt als Dezimaltrennzeichen
 * - keine Tausender-Separatoren
 * - kein Währungssymbol
 * - 2 Nachkommastellen
 */
export function formatElsterValue(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}
