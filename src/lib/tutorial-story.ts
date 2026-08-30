import type { Database } from "@/integrations/supabase/types";

export type BuchhaltungStatus = Database["public"]["Enums"]["buchhaltung_status"];
export type StoryRole = "Sekretariat" | "Sachbearbeiter" | "Chef";

export interface StoryPerson {
  rolle: StoryRole;
  name: string;
  titel: string;
}

export const PERSONEN: Record<StoryRole, StoryPerson> = {
  Sekretariat: { rolle: "Sekretariat", name: "Sabine", titel: "Sekretariat" },
  Sachbearbeiter: { rolle: "Sachbearbeiter", name: "Simon", titel: "Sachbearbeiter" },
  Chef: { rolle: "Chef", name: "Christina", titel: "Chef / Steuerberater" },
};

export interface StoryDialog {
  titel: string;
  bestaetigen: string;
  felder: { label: string; wert: string }[];
}

export type StoryView = "mandanten" | "dashboard" | "kontakt" | "abschluss";

export interface StoryStep {
  id: string;
  rolle: StoryRole;
  /** Übergangskarte „Perspektivwechsel“ vor dem Schritt zeigen */
  wechsel?: boolean;
  view: StoryView;
  text: string;
  /** Beschriftung des Buttons, der vom Tutorial „gedrückt“ wird */
  druecke?: string;
  dialog?: StoryDialog;
  /** Nach dem Schritt sichtbarer Status der Beispiel-Buchhaltung */
  status?: BuchhaltungStatus;
  /** Mandanten-Stammdatensatz ab hier vorhanden */
  mandantAngelegt?: boolean;
  /** Buchhaltungszeile ab hier in der Tabelle */
  zeileSichtbar?: boolean;
  /** Rote Notiz an der Zeile */
  notiz?: { art: "warten" | "zurueckweisung"; text: string } | null;
  /** Kontaktvermerk im Sekretariat */
  kontakt?: string;
  /** Zusatz-Badge an der Zeile */
  badge?: string;
  /** Hinweisschritt: beide Wege nebeneinander zeigen */
  zweiWege?: boolean;
}

export const MANDANT = {
  nummer: "10042",
  name: "Muster GmbH",
  ansprechpartner: "Thomas Muster",
  telefon: "+49 170 1234567",
  email: "buchhaltung@muster-gmbh.de",
  sachbearbeiter: "Simon",
  monat: "03-2026",
  belegeingang: "12.04.2026",
  frist: "10.05.2026",
  belege: 24,
};

export const STORY: StoryStep[] = [
  {
    id: "start",
    rolle: "Sekretariat",
    view: "mandanten",
    text: "Ein neuer Mandant kommt in die Kanzlei. Das Sekretariat legt ihn zuerst als Stammdatensatz an.",
  },
  {
    id: "mandant-anlegen",
    rolle: "Sekretariat",
    view: "mandanten",
    text: "Der Mandant ist angelegt. Ab jetzt hängen alle Buchhaltungen an diesem Stammdatensatz.",
    druecke: "Speichern",
    mandantAngelegt: true,
    dialog: {
      titel: "Neuer Mandant",
      bestaetigen: "Speichern",
      felder: [
        { label: "Mandantennummer", wert: MANDANT.nummer },
        { label: "Name", wert: MANDANT.name },
        { label: "Ansprechpartner", wert: MANDANT.ansprechpartner },
        { label: "Telefon", wert: MANDANT.telefon },
        { label: "E-Mail", wert: MANDANT.email },
        { label: "Zuständiger Sachbearbeiter", wert: MANDANT.sachbearbeiter },
      ],
    },
  },
  {
    id: "belege-kommen",
    rolle: "Sekretariat",
    view: "dashboard",
    text: "Die Muster GmbH reicht ihre Belege für März ein. Das Sekretariat legt dafür die Buchhaltung an.",
    mandantAngelegt: true,
  },
  {
    id: "buchhaltung-anlegen",
    rolle: "Sekretariat",
    view: "dashboard",
    text: "Status: Eingegangen. Der Auftrag liegt jetzt beim zuständigen Sachbearbeiter.",
    druecke: "Anlegen",
    dialog: {
      titel: "Neue Buchhaltung",
      bestaetigen: "Anlegen",
      felder: [
        { label: "Mandant", wert: MANDANT.name },
        { label: "Monat", wert: MANDANT.monat },
        { label: "Belegeingang", wert: MANDANT.belegeingang },
      ],
    },
    zeileSichtbar: true,
    status: "Eingegangen",
  },
  {
    id: "simon-sieht",
    rolle: "Sachbearbeiter",
    wechsel: true,
    view: "dashboard",
    text: "Simon sieht den neuen Auftrag in seiner Liste — er muss nicht nachfragen, ob etwas für ihn da ist.",
  },
  {
    id: "annehmen",
    rolle: "Sachbearbeiter",
    view: "dashboard",
    text: "Simon übernimmt den Auftrag. Für alle in der Kanzlei ist jetzt sichtbar, dass er daran arbeitet.",
    druecke: "Annehmen",
    status: "In Bearbeitung",
  },
  {
    id: "zwei-wege",
    rolle: "Sachbearbeiter",
    view: "dashboard",
    zweiWege: true,
    text: "Ab hier gibt es zwei Wege: Sind die Belege vollständig, geht es zur Prüfung. Fehlt etwas, wird der Mandant angefordert. Wir zeigen zuerst den Fall, dass etwas fehlt.",
  },
  {
    id: "unvollstaendig",
    rolle: "Sachbearbeiter",
    view: "dashboard",
    text: "Die Notiz ist Pflicht — so weiß jeder sofort, woran es hängt.",
    druecke: "Unvollständig",
    dialog: {
      titel: "Was fehlt noch?",
      bestaetigen: "Bestätigen",
      felder: [
        {
          label: "Notiz an den Mandanten",
          wert: "Kontoauszüge März fehlen, Rechnung Nr. 4711 nicht lesbar.",
        },
      ],
    },
    status: "Warten auf Mandant",
    notiz: {
      art: "warten",
      text: "Kontoauszüge März fehlen, Rechnung Nr. 4711 nicht lesbar.",
    },
  },
  {
    id: "sekretariat-kontakt",
    rolle: "Sekretariat",
    wechsel: true,
    view: "kontakt",
    text: "Das Sekretariat sieht die Notiz als Arbeitsanweisung und fragt beim Mandanten nach. Der Kontakt ist dokumentiert — der Sachbearbeiter sieht sofort, dass sich jemand gekümmert hat.",
    druecke: "Vermerk speichern",
    dialog: {
      titel: "Mandant kontaktieren",
      bestaetigen: "Vermerk speichern",
      felder: [
        {
          label: "Kontaktvermerk",
          wert: "12.04. telefonisch erreicht, Unterlagen kommen bis Freitag.",
        },
      ],
    },
    kontakt: "12.04. telefonisch erreicht, Unterlagen kommen bis Freitag.",
  },
  {
    id: "weiterarbeiten",
    rolle: "Sachbearbeiter",
    wechsel: true,
    view: "dashboard",
    text: "Die fehlenden Belege sind eingetroffen.",
    druecke: "Weiterarbeiten",
    status: "In Bearbeitung",
    notiz: null,
  },
  {
    id: "zur-pruefung",
    rolle: "Sachbearbeiter",
    view: "dashboard",
    text: "Simon ist fertig und gibt ab. Der Abgabezeitpunkt wird festgehalten — wer zuerst abgibt, wird zuerst geprüft.",
    druecke: "Zur Prüfung senden",
    status: "In Prüfung",
  },
  {
    id: "chef-uebernimmt",
    rolle: "Chef",
    wechsel: true,
    view: "dashboard",
    text: "Die Buchhaltung liegt jetzt bei der Steuerberaterin zur Prüfung. Sie hat zwei Möglichkeiten: freigeben oder zurückweisen. Wir zeigen zuerst die Zurückweisung.",
  },
  {
    id: "zurueckweisen",
    rolle: "Chef",
    view: "dashboard",
    text: "Die Buchhaltung geht mit Begründung zurück — keine Rückfrage per Zuruf nötig.",
    druecke: "Zurückweisen",
    dialog: {
      titel: "Grund der Zurückweisung",
      bestaetigen: "Bestätigen",
      felder: [
        {
          label: "Grund",
          wert: "Umsatzsteuer für Rechnung 4711 falsch verbucht — bitte korrigieren.",
        },
      ],
    },
    status: "In Bearbeitung",
    notiz: {
      art: "zurueckweisung",
      text: "Umsatzsteuer für Rechnung 4711 falsch verbucht — bitte korrigieren.",
    },
  },
  {
    id: "korrektur",
    rolle: "Sachbearbeiter",
    wechsel: true,
    view: "dashboard",
    text: "Simon sieht den Grund im Klartext an der Buchhaltung und korrigiert. Danach gibt er erneut ab.",
    druecke: "Zur Prüfung senden",
    status: "In Prüfung",
    notiz: null,
  },
  {
    id: "freigeben",
    rolle: "Chef",
    wechsel: true,
    view: "dashboard",
    text: "Freigegeben. Das Fertigstellungsdatum wird festgehalten, der Fall wandert ins Archiv.",
    druecke: "Freigeben",
    status: "Buchhaltung erledigt",
    badge: "Buchhaltung erstellt",
  },
  {
    id: "abschluss",
    rolle: "Chef",
    view: "abschluss",
    text: "Das war der komplette Ablauf. Jeder Schritt ist dokumentiert, jede Rolle sieht genau das, was sie braucht, und nichts geht unterwegs verloren.",
  },
];

export interface StoryState {
  status: BuchhaltungStatus | null;
  mandantAngelegt: boolean;
  zeileSichtbar: boolean;
  notiz: { art: "warten" | "zurueckweisung"; text: string } | null;
  kontakt: string | null;
  badge: string | null;
}

/** Zustand aus allen Schritten bis einschließlich `bis` zusammensetzen. */
export function stateBis(bis: number): StoryState {
  const s: StoryState = {
    status: null,
    mandantAngelegt: false,
    zeileSichtbar: false,
    notiz: null,
    kontakt: null,
    badge: null,
  };
  for (let i = 0; i <= bis && i < STORY.length; i++) {
    const step = STORY[i];
    if (step.mandantAngelegt) s.mandantAngelegt = true;
    if (step.zeileSichtbar) s.zeileSichtbar = true;
    if (step.status) s.status = step.status;
    if (step.notiz !== undefined) s.notiz = step.notiz;
    if (step.kontakt) s.kontakt = step.kontakt;
    if (step.badge) s.badge = step.badge;
  }
  return s;
}

/** Aktionsbuttons der jeweiligen Rolle beim jeweiligen Status. */
export function aktionenFuer(
  rolle: StoryRole,
  status: BuchhaltungStatus | null,
): string[] {
  if (!status) return [];
  if (rolle === "Sachbearbeiter") {
    if (status === "Eingegangen") return ["Annehmen"];
    if (status === "In Bearbeitung") return ["Zur Prüfung senden", "Unvollständig"];
    if (status === "Warten auf Mandant") return ["Weiterarbeiten"];
  }
  if (rolle === "Chef" && status === "In Prüfung") return ["Freigeben", "Zurückweisen"];
  return [];
}
