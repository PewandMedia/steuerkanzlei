import type { TutorialLauf, BenutzerRolle } from "@/lib/tutorial-lauf";
import {
  warteAufController,
  type MandantFeld,
} from "@/lib/tutorial-bus";

/** Beispieldaten, die das Tutorial wirklich anlegt. */
export const TUTORIAL_MANDANT = {
  vorname: "Thomas",
  nachname: "Muster",
  firma: "Muster GmbH",
  unternehmensform: "GmbH",
  telefon: "+49 170 1234567",
  email: "buchhaltung@muster-gmbh.de",
};

export const TUTORIAL_NOTIZ_FEHLT =
  "Kontoauszüge fehlen, Rechnung Nr. 4711 ist nicht lesbar.";
export const TUTORIAL_NOTIZ_ZURUECK =
  "Umsatzsteuer für Rechnung 4711 falsch verbucht — bitte korrigieren.";

/** Buchungsmonat: zwei Monate zurück, im DB-Format MM-YYYY bzw. UI-Format YYYY-MM. */
export function tutorialMonatYm(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function heuteIso(): string {
  return new Date().toISOString().split("T")[0];
}

export interface SchrittKontext {
  lauf: TutorialLauf;
  /** Laufzustand ergänzen und persistieren. Gibt den neuen Zustand zurück. */
  merke: (patch: Partial<TutorialLauf>) => TutorialLauf;
  gehe: (pfad: string) => void;
  warte: (ms: number) => Promise<void>;
  /** Tippt Text sichtbar Zeichen für Zeichen in ein echtes Formularfeld. */
  tippe: (setter: (wert: string) => void, text: string) => Promise<void>;
  /** Klickt einen echten Button der Oberfläche (nativer Klick, kein Fake-Event). */
  klicke: (selector: string) => Promise<void>;
  warteAufElement: (selector: string, timeoutMs?: number) => Promise<HTMLElement>;
}

export interface TutorialSchritt {
  id: string;
  abschnitt: number;
  rolle: BenutzerRolle;
  titel: string;
  text: string;
  /** Route, die vor dem Schritt angesteuert wird. */
  route?: string;
  /** CSS-Selektor des hervorzuhebenden Elements. */
  ziel?: (lauf: TutorialLauf) => string | null;
  /** Lesezeit in ms, bevor die Aktion automatisch ausgeführt wird. */
  lesezeit?: number;
  aktion?: (k: SchrittKontext) => Promise<void>;
  /** Übergabekarte: der Besucher meldet sich selbst mit dieser Rolle an. */
  uebergabeZu?: BenutzerRolle;
  /** Letzter Schritt. */
  abschluss?: boolean;
}

const zeile = (lauf: TutorialLauf) =>
  lauf.buchhaltungId ? `[data-buchhaltung-id="${lauf.buchhaltungId}"]` : null;

const aktion = (lauf: TutorialLauf, name: string) =>
  lauf.buchhaltungId
    ? `[data-buchhaltung-id="${lauf.buchhaltungId}"] [data-tour="aktion-${name}"]`
    : null;

async function fokussiereZeile(k: SchrittKontext) {
  const dash = await warteAufController("dashboard");
  await dash.aktualisieren();
  if (k.lauf.buchhaltungId) dash.fokus(k.lauf.buchhaltungId);
  await k.warte(500);
}

export const SCHRITTE: TutorialSchritt[] = [
  // ─────────────── Abschnitt 1 · Sekretariat ───────────────
  {
    id: "start",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Willkommen",
    text: "Wir gehen den kompletten Ablauf einmal durch — in der echten Oberfläche. Das Tutorial legt dabei wirklich einen Mandanten und eine Buchhaltung an. Sie sehen genau das, was Ihre Mitarbeiter später sehen.",
    ziel: () => '[data-tour="sidebar"]',
    lesezeit: 6000,
  },
  {
    id: "kpi",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Kennzahlen",
    text: "Ganz oben sehen Sie sofort, wie viele Buchhaltungen überfällig sind, bald fällig werden oder gerade bearbeitet werden. Ein Klick auf eine Kachel filtert die Liste darunter.",
    ziel: () => '[data-tour="kpi"]',
  },
  {
    id: "schnellfilter",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Schnellfilter",
    text: "Die Schnellfilter zeigen mit einem Klick nur die dringenden Fälle oder alles, was diese Woche fällig ist.",
    ziel: () => '[data-tour="schnellfilter"]',
  },
  {
    id: "filter",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Suche und Sortierung",
    text: "Hier suchen Sie nach Mandant, Monat oder Notiz und legen die Sortierung fest. Standard ist die Priorität: Was zuerst fällig ist, steht oben.",
    ziel: () => '[data-tour="filter"]',
  },
  {
    id: "zu-mandanten",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/mandanten",
    titel: "Neuer Mandant",
    text: "Ein neuer Mandant kommt in die Kanzlei. Das Sekretariat legt ihn zuerst als Stammdatensatz an. Wir öffnen jetzt den echten Dialog.",
    ziel: () => '[data-tour="neuer-mandant"]',
    aktion: async (k) => {
      const c = await warteAufController("mandant");
      c.oeffnen();
      await k.warte(600);
    },
  },
  {
    id: "mandant-felder",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/mandanten",
    titel: "Stammdaten erfassen",
    text: "Die Mandantennummer wird automatisch vorgeschlagen. Wir füllen Firma, Ansprechpartner und Kontaktdaten aus — genau wie Ihre Mitarbeiter es später tun.",
    ziel: () => '[data-tour="mandant-dialog"]',
    lesezeit: 1200,
    aktion: async (k) => {
      const c = await warteAufController("mandant");
      const felder: [MandantFeld, string][] = [
        ["firma", TUTORIAL_MANDANT.firma],
        ["vorname", TUTORIAL_MANDANT.vorname],
        ["nachname", TUTORIAL_MANDANT.nachname],
        ["telefon", TUTORIAL_MANDANT.telefon],
        ["email", TUTORIAL_MANDANT.email],
      ];
      for (const [feld, wert] of felder) {
        await k.tippe((v) => c.setzeFeld(feld, v), wert);
        await k.warte(180);
      }
      c.setzeUnternehmensform(TUTORIAL_MANDANT.unternehmensform);
      await k.warte(400);
    },
  },
  {
    id: "mandant-speichern",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/mandanten",
    titel: "Mandant anlegen",
    text: "Mit „Anlegen" wird der Mandant wirklich gespeichert. Ab jetzt hängen alle Buchhaltungen an diesem Stammdatensatz.",
    ziel: () => '[data-tour="mandant-speichern"]',
    aktion: async (k) => {
      const c = await warteAufController("mandant");
      const id = await c.speichern();
      if (!id) throw new Error("Der Mandant konnte nicht angelegt werden.");
      k.merke({ mandantId: id });
      await k.warte(600);
    },
  },
  {
    id: "zu-buchhaltung",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Belege sind eingegangen",
    text: "Der Mandant reicht seine Belege ein. Das Sekretariat legt dafür eine Buchhaltung an und leitet sie an den Sachbearbeiter weiter.",
    ziel: () => '[data-tour="neue-buchhaltung"]',
    aktion: async (k) => {
      const dash = await warteAufController("dashboard");
      await dash.aktualisieren();
      const c = await warteAufController("buchhaltung");
      c.oeffnen();
      await k.warte(900);
    },
  },
  {
    id: "buchhaltung-felder",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Mandant, Sachbearbeiter, Monat",
    text: "Mandant auswählen, Sachbearbeiter zuweisen, Buchungsmonat setzen. Die Abgabefrist berechnet das System automatisch — der 10. des Folgemonats, bei Dauerfristverlängerung einen Monat später.",
    ziel: () => '[data-tour="buchhaltung-dialog"]',
    lesezeit: 1500,
    aktion: async (k) => {
      const c = await warteAufController("buchhaltung");
      if (!k.lauf.mandantId) throw new Error("Kein Mandant aus dem vorherigen Schritt vorhanden.");
      c.setzeMandant(k.lauf.mandantId);
      await k.warte(900);
      c.waehleBearbeiter();
      await k.warte(500);
      c.setzeMonat(tutorialMonatYm());
      await k.warte(500);
      c.setzeBelegeingang(heuteIso());
      await k.warte(700);
    },
  },
  {
    id: "buchhaltung-absenden",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "An Sachbearbeiter weiterleiten",
    text: "Ein Klick — und der Auftrag liegt beim zuständigen Sachbearbeiter. Er wird automatisch benachrichtigt, niemand muss nachfragen.",
    ziel: () => '[data-tour="buchhaltung-absenden"]',
    aktion: async (k) => {
      const c = await warteAufController("buchhaltung");
      const ids = await c.absenden();
      if (!ids.length) throw new Error("Die Buchhaltung konnte nicht angelegt werden.");
      k.merke({ buchhaltungId: ids[0] });
      await k.warte(800);
      const dash = await warteAufController("dashboard");
      await dash.aktualisieren();
      dash.fokus(ids[0]);
      await k.warte(600);
    },
  },
  {
    id: "zeile-eingegangen",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Status: Eingegangen",
    text: "Das ist der eben angelegte Vorgang — echte Daten in der echten Liste. Der Status „Eingegangen" bedeutet: liegt beim Sachbearbeiter, noch nicht angenommen.",
    ziel: zeile,
    lesezeit: 6000,
    aktion: fokussiereZeile,
  },
  {
    id: "uebergabe-sachbearbeiter-1",
    abschnitt: 1,
    rolle: "Sekretariat",
    titel: "Rollenwechsel: Sachbearbeiter",
    text: "Der erste Teil ist geschafft. Melden Sie sich jetzt bitte ab und als Sachbearbeiter (Simon) wieder an. Das Tutorial merkt sich, wo Sie stehen, und bietet Ihnen die Fortsetzung automatisch an.",
    uebergabeZu: "Sachbearbeiter",
  },

  // ─────────────── Abschnitt 2 · Sachbearbeiter ───────────────
  {
    id: "sb-sieht",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Der Auftrag ist da",
    text: "Der Sachbearbeiter sieht den neuen Auftrag direkt in seiner Liste. Kein Zuruf, keine E-Mail, kein Nachfragen.",
    ziel: zeile,
    aktion: fokussiereZeile,
  },
  {
    id: "sb-annehmen",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Auftrag annehmen",
    text: "Mit „Annehmen" übernimmt er den Vorgang. Für alle in der Kanzlei ist ab jetzt sichtbar, dass daran gearbeitet wird.",
    ziel: (l) => aktion(l, "annehmen"),
    aktion: async (k) => {
      await k.klicke(aktion(k.lauf, "annehmen")!);
      await k.warte(1400);
    },
  },
  {
    id: "sb-zwei-wege",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Zwei Wege",
    text: "Jetzt gibt es zwei Möglichkeiten: Sind die Belege vollständig, geht es zur Prüfung. Fehlt etwas, wird der Mandant angefordert. Wir zeigen zuerst den Fall, dass etwas fehlt.",
    ziel: (l) => zeile(l),
    lesezeit: 6000,
  },
  {
    id: "sb-unvollstaendig",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Unterlagen unvollständig",
    text: "„Unvollständig" öffnet den echten Notiz-Dialog. Die Notiz ist Pflicht — so weiß jeder sofort, woran es hängt.",
    ziel: (l) => aktion(l, "unvollstaendig"),
    aktion: async (k) => {
      await k.klicke(aktion(k.lauf, "unvollstaendig")!);
      await k.warte(700);
    },
  },
  {
    id: "sb-notiz",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Was genau fehlt?",
    text: "Im Klartext festhalten, was fehlt. Diese Notiz ist gleichzeitig die Arbeitsanweisung für das Sekretariat.",
    ziel: () => '[data-tour="notiz-dialog"]',
    lesezeit: 1200,
    aktion: async (k) => {
      const c = await warteAufController("notiz");
      await k.tippe(c.setzeNotiz, TUTORIAL_NOTIZ_FEHLT);
      await k.warte(600);
      await k.klicke('[data-tour="notiz-bestaetigen"]');
      await k.warte(1400);
    },
  },
  {
    id: "sb-warten",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Warten auf Mandant",
    text: "Der Status steht auf „Warten auf Mandant", die Notiz hängt sichtbar an der Zeile. Das Sekretariat sieht den Vorgang und kann den Mandanten kontaktieren.",
    ziel: zeile,
    lesezeit: 6000,
    aktion: fokussiereZeile,
  },
  {
    id: "sb-weiterarbeiten",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Unterlagen sind da",
    text: "Die fehlenden Belege sind eingetroffen — mit „Weiterarbeiten" geht der Vorgang zurück in Bearbeitung.",
    ziel: (l) => aktion(l, "weiterarbeiten"),
    aktion: async (k) => {
      await k.klicke(aktion(k.lauf, "weiterarbeiten")!);
      await k.warte(1400);
    },
  },
  {
    id: "sb-zur-pruefung",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Zur Prüfung abgeben",
    text: "Die Buchhaltung ist fertig und geht zur Prüfung. Der Abgabezeitpunkt wird festgehalten — wer zuerst abgibt, wird zuerst geprüft.",
    ziel: (l) => aktion(l, "zur-pruefung"),
    aktion: async (k) => {
      await k.klicke(aktion(k.lauf, "zur-pruefung")!);
      await k.warte(1400);
    },
  },
  {
    id: "uebergabe-chef-1",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    titel: "Rollenwechsel: Chef",
    text: "Melden Sie sich jetzt bitte als Chef (Christina) an. Danach setzen wir mit der Prüfung fort.",
    uebergabeZu: "Chef",
  },

  // ─────────────── Abschnitt 3 · Chef prüft und weist zurück ───────────────
  {
    id: "chef-sieht",
    abschnitt: 3,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Zur Prüfung eingegangen",
    text: "Die Buchhaltung liegt jetzt beim Steuerberater. Zwei Möglichkeiten: freigeben oder mit Begründung zurückweisen. Wir zeigen zuerst die Zurückweisung.",
    ziel: zeile,
    lesezeit: 6500,
    aktion: fokussiereZeile,
  },
  {
    id: "chef-zurueckweisen",
    abschnitt: 3,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Zurückweisen",
    text: "„Zurückweisen" öffnet den echten Dialog für die Begründung.",
    ziel: (l) => aktion(l, "zurueckweisen"),
    aktion: async (k) => {
      await k.klicke(aktion(k.lauf, "zurueckweisen")!);
      await k.warte(700);
    },
  },
  {
    id: "chef-grund",
    abschnitt: 3,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Grund der Zurückweisung",
    text: "Der Grund steht im Klartext am Vorgang. Keine Rückfrage per Zuruf, keine verlorene Information.",
    ziel: () => '[data-tour="notiz-dialog"]',
    lesezeit: 1200,
    aktion: async (k) => {
      const c = await warteAufController("notiz");
      await k.tippe(c.setzeNotiz, TUTORIAL_NOTIZ_ZURUECK);
      await k.warte(600);
      await k.klicke('[data-tour="notiz-bestaetigen"]');
      await k.warte(1400);
    },
  },
  {
    id: "uebergabe-sachbearbeiter-2",
    abschnitt: 3,
    rolle: "Chef",
    titel: "Rollenwechsel: Sachbearbeiter",
    text: "Die Buchhaltung ist zurück beim Sachbearbeiter. Melden Sie sich bitte wieder als Sachbearbeiter (Simon) an.",
    uebergabeZu: "Sachbearbeiter",
  },

  // ─────────────── Abschnitt 4 · Sachbearbeiter korrigiert ───────────────
  {
    id: "sb-korrektur",
    abschnitt: 4,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Zurückweisung sichtbar",
    text: "Der Sachbearbeiter sieht die Zurückweisung samt Begründung direkt an der Zeile — rot markiert, nicht zu übersehen.",
    ziel: zeile,
    lesezeit: 6500,
    aktion: fokussiereZeile,
  },
  {
    id: "sb-erneut-abgeben",
    abschnitt: 4,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Korrigiert und erneut abgegeben",
    text: "Nach der Korrektur geht die Buchhaltung erneut zur Prüfung.",
    ziel: (l) => aktion(l, "zur-pruefung"),
    aktion: async (k) => {
      await k.klicke(aktion(k.lauf, "zur-pruefung")!);
      await k.warte(1400);
    },
  },
  {
    id: "uebergabe-chef-2",
    abschnitt: 4,
    rolle: "Sachbearbeiter",
    titel: "Rollenwechsel: Chef",
    text: "Letzter Schritt: Melden Sie sich bitte noch einmal als Chef (Christina) an.",
    uebergabeZu: "Chef",
  },

  // ─────────────── Abschnitt 5 · Chef gibt frei ───────────────
  {
    id: "chef-final",
    abschnitt: 5,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Erneut zur Prüfung",
    text: "Die korrigierte Buchhaltung liegt wieder zur Prüfung vor.",
    ziel: zeile,
    aktion: fokussiereZeile,
  },
  {
    id: "chef-freigeben",
    abschnitt: 5,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Freigeben",
    text: "Mit „Freigeben" ist der Vorgang abgeschlossen. Das Fertigstellungsdatum wird festgehalten.",
    ziel: (l) => aktion(l, "freigeben"),
    aktion: async (k) => {
      await k.klicke(aktion(k.lauf, "freigeben")!);
      await k.warte(1600);
    },
  },
  {
    id: "chef-erledigt",
    abschnitt: 5,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Buchhaltung erledigt",
    text: "Der Vorgang ist erledigt und wandert ins Archiv unter „Erstellte Buchhaltungen". Jeder Schritt ist dokumentiert.",
    ziel: zeile,
    lesezeit: 6000,
    aktion: fokussiereZeile,
  },
  {
    id: "abschluss",
    abschnitt: 5,
    rolle: "Chef",
    titel: "Das war der komplette Ablauf",
    text: "Vom neuen Mandanten bis zur freigegebenen Buchhaltung — jede Rolle sieht genau das, was sie braucht, und nichts geht unterwegs verloren. Die eben angelegten Daten bleiben bis zum nächtlichen Demo-Reset stehen.",
    abschluss: true,
  },
];

export function ersterSchrittDesAbschnitts(abschnitt: number): number {
  const idx = SCHRITTE.findIndex((s) => s.abschnitt === abschnitt);
  return idx < 0 ? 0 : idx;
}

export const LETZTER_ABSCHNITT = SCHRITTE[SCHRITTE.length - 1].abschnitt;
