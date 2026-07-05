// Vereinfachter Kontenplan für Phase 1 — kein voller SKR03/04
export type Kategorie = "Einnahme" | "Ausgabe";

export interface Konto {
  name: string;
  kategorie: Kategorie;
  defaultMwst: number;
}

export const KONTEN: Konto[] = [
  // === Einnahmen ===
  { name: "Erlöse Dienstleistungen 19%", kategorie: "Einnahme", defaultMwst: 19 },
  { name: "Erlöse IT-Leistungen 19%", kategorie: "Einnahme", defaultMwst: 19 },
  { name: "Erlöse Warenverkauf 19%", kategorie: "Einnahme", defaultMwst: 19 },
  { name: "Erlöse Warenverkauf 7%", kategorie: "Einnahme", defaultMwst: 7 },
  { name: "Sonstige Erträge", kategorie: "Einnahme", defaultMwst: 0 },

  // === Ausgaben ===
  { name: "Wareneinkauf", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "Fremdleistungen", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "Softwarekosten / SaaS-Abos", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "IT-Leistungen / Hosting", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "Werbekosten / Online-Marketing", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "Beratungskosten Recht", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "Beratungskosten Steuer", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "Beratungskosten Unternehmen", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "Büromaterial", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "Telekommunikation", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "Mietkosten Geschäftsräume", kategorie: "Ausgabe", defaultMwst: 0 },
  { name: "Reisekosten Bahn/Flug", kategorie: "Ausgabe", defaultMwst: 7 },
  { name: "Reisekosten Kfz/Tankstelle", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "Bewirtungskosten", kategorie: "Ausgabe", defaultMwst: 19 },
  { name: "Versicherungen", kategorie: "Ausgabe", defaultMwst: 0 },
  { name: "Bankgebühren", kategorie: "Ausgabe", defaultMwst: 0 },
  { name: "Sonstige betriebliche Aufwendungen", kategorie: "Ausgabe", defaultMwst: 19 },
];

export const KONTEN_BY_KATEGORIE = (k: Kategorie) =>
  KONTEN.filter((konto) => konto.kategorie === k);

export const formatEuro = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
