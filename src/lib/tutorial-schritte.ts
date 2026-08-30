import { supabase } from "@/integrations/supabase/client";
import type { TutorialLauf, BenutzerRolle } from "@/lib/tutorial-lauf";

/** Beispielwerte, die der Besucher selbst eintippt. */
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

export interface SchrittKontext {
  lauf: TutorialLauf;
  merke: (patch: Partial<TutorialLauf>) => TutorialLauf;
}

export interface Beispielwert {
  label: string;
  wert: string;
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
  /** Handlungsaufforderung, z. B. „Jetzt klicken: Annehmen“. */
  aufforderung?: string;
  /** Beispielwerte zum Abtippen. */
  beispiele?: Beispielwert[];
  /** Freundlicher Hinweis, falls das Zielelement (noch) fehlt. */
  fehlendHinweis?: string;
  /** Einstiegskarte eines Abschnitts. */
  intro?: boolean;
  /** Der Besucher wählt die eben angelegte Zeile aus. */
  zeilenwahl?: boolean;
  /** Versucht, den angelegten Datensatz automatisch zu erkennen. */
  erkennen?: (k: SchrittKontext) => Promise<boolean>;
  /** Übergabekarte: der Besucher meldet sich selbst mit dieser Rolle an. */
  uebergabeZu?: BenutzerRolle;
  /** Letzter Schritt. */
  abschluss?: boolean;
}

export interface Abschnitt {
  nummer: number;
  rolle: BenutzerRolle;
  titel: string;
  beschreibung: string;
}

export const ABSCHNITTE: Abschnitt[] = [
  {
    nummer: 1,
    rolle: "Sekretariat",
    titel: "Mandant anlegen und Buchhaltung erfassen",
    beschreibung:
      "Sie lernen das Dashboard kennen, legen einen echten Mandanten an und erfassen dazu eine Buchhaltung, die an den Sachbearbeiter geht.",
  },
  {
    nummer: 2,
    rolle: "Sachbearbeiter",
    titel: "Annehmen, Fehlendes anfordern, zur Prüfung geben",
    beschreibung:
      "Sie nehmen den Auftrag an, fordern fehlende Unterlagen an und geben die fertige Buchhaltung zur Prüfung.",
  },
  {
    nummer: 3,
    rolle: "Chef",
    titel: "Prüfen und zurückweisen",
    beschreibung:
      "Sie sehen die eingereichte Buchhaltung und weisen sie mit einer Begründung zurück.",
  },
  {
    nummer: 4,
    rolle: "Sachbearbeiter",
    titel: "Korrigieren und erneut abgeben",
    beschreibung: "Sie sehen die Zurückweisung und geben die korrigierte Buchhaltung erneut ab.",
  },
  {
    nummer: 5,
    rolle: "Chef",
    titel: "Freigeben",
    beschreibung: "Sie geben die Buchhaltung frei und schließen den Vorgang ab.",
  },
];

const zeile = (lauf: TutorialLauf) =>
  lauf.buchhaltungId ? `[data-buchhaltung-id="${lauf.buchhaltungId}"]` : null;

const aktion = (lauf: TutorialLauf, name: string) =>
  lauf.buchhaltungId
    ? `[data-buchhaltung-id="${lauf.buchhaltungId}"] [data-tour="aktion-${name}"]`
    : null;

/** Zuletzt angelegte Buchhaltung erkennen (bevorzugt zum gemerkten Mandanten). */
async function erkenneBuchhaltung(k: SchrittKontext): Promise<boolean> {
  try {
    let query = supabase
      .from("buchhaltungen")
      .select("id, mandant_id, erstellt_am")
      .order("erstellt_am", { ascending: false })
      .limit(1);
    if (k.lauf.mandantId) query = query.eq("mandant_id", k.lauf.mandantId);
    const { data } = await query.maybeSingle();
    if (!data?.id) return false;
    k.merke({ buchhaltungId: data.id, mandantId: data.mandant_id ?? k.lauf.mandantId });
    return true;
  } catch {
    return false;
  }
}

/** Zuletzt angelegten Mandanten erkennen. */
async function erkenneMandant(k: SchrittKontext): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("mandanten")
      .select("id, erstellt_am")
      .order("erstellt_am", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.id) return false;
    k.merke({ mandantId: data.id });
    return true;
  } catch {
    return false;
  }
}

const intro = (nummer: number): TutorialSchritt => {
  const a = ABSCHNITTE[nummer - 1];
  return {
    id: `intro-${nummer}`,
    abschnitt: nummer,
    rolle: a.rolle,
    intro: true,
    titel: `Teil ${nummer} · ${a.rolle}`,
    text: `${a.titel}. ${a.beschreibung}`,
  };
};

export const SCHRITTE: TutorialSchritt[] = [
  // ─────────────── Teil 1 · Sekretariat ───────────────
  intro(1),
  {
    id: "start",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Willkommen",
    text: "Wir gehen den kompletten Ablauf einmal durch — in der echten Oberfläche. Sie bedienen dabei selbst und legen wirklich einen Mandanten und eine Buchhaltung an.",
    ziel: () => '[data-tour="sidebar"]',
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
    text: "Ein neuer Mandant kommt in die Kanzlei. Das Sekretariat legt ihn zuerst als Stammdatensatz an.",
    ziel: () => '[data-tour="neuer-mandant"]',
    aufforderung: "Jetzt klicken: Neuer Mandant",
    fehlendHinweis: "Bitte öffnen Sie zuerst die Seite „Mandanten“.",
  },
  {
    id: "mandant-felder",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/mandanten",
    titel: "Stammdaten erfassen",
    text: "Die Mandantennummer wird automatisch vorgeschlagen. Füllen Sie Firma, Ansprechpartner und Kontaktdaten aus.",
    ziel: () => '[data-tour="mandant-dialog"]',
    aufforderung: "Jetzt ausfüllen: Firma, Ansprechpartner, Kontaktdaten",
    beispiele: [
      { label: "Firma", wert: TUTORIAL_MANDANT.firma },
      { label: "Unternehmensform", wert: TUTORIAL_MANDANT.unternehmensform },
      {
        label: "Ansprechpartner",
        wert: `${TUTORIAL_MANDANT.vorname} ${TUTORIAL_MANDANT.nachname}`,
      },
      { label: "Telefon", wert: TUTORIAL_MANDANT.telefon },
      { label: "E-Mail", wert: TUTORIAL_MANDANT.email },
    ],
    fehlendHinweis: "Bitte klicken Sie zuerst auf „Neuer Mandant“.",
  },
  {
    id: "mandant-speichern",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/mandanten",
    titel: "Mandant anlegen",
    text: "Mit „Anlegen“ wird der Mandant wirklich gespeichert. Ab jetzt hängen alle Buchhaltungen an diesem Stammdatensatz.",
    ziel: () => '[data-tour="mandant-speichern"]',
    aufforderung: "Jetzt klicken: Anlegen",
    fehlendHinweis: "Bitte klicken Sie zuerst auf „Neuer Mandant“ und füllen Sie die Felder aus.",
    erkennen: erkenneMandant,
  },
  {
    id: "zu-buchhaltung",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Belege sind eingegangen",
    text: "Der Mandant reicht seine Belege ein. Das Sekretariat legt dafür eine Buchhaltung an und leitet sie an den Sachbearbeiter weiter.",
    ziel: () => '[data-tour="neue-buchhaltung"]',
    aufforderung: "Jetzt klicken: Neue Buchhaltung",
  },
  {
    id: "buchhaltung-felder",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Mandant, Sachbearbeiter, Monat",
    text: "Mandant auswählen, Sachbearbeiter zuweisen, Buchungsmonat setzen. Die Abgabefrist berechnet das System automatisch — der 10. des Folgemonats, bei Dauerfristverlängerung einen Monat später.",
    ziel: () => '[data-tour="buchhaltung-dialog"]',
    aufforderung: "Jetzt ausfüllen: Mandant, Sachbearbeiter und Buchungsmonat wählen",
    beispiele: [
      { label: "Mandant", wert: TUTORIAL_MANDANT.firma },
      { label: "Sachbearbeiter", wert: "Simon" },
      { label: "Buchungsmonat", wert: "ein zurückliegender Monat" },
    ],
    fehlendHinweis: "Bitte klicken Sie zuerst auf „Neue Buchhaltung“.",
  },
  {
    id: "buchhaltung-absenden",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "An Sachbearbeiter weiterleiten",
    text: "Ein Klick — und der Auftrag liegt beim zuständigen Sachbearbeiter. Er wird automatisch benachrichtigt, niemand muss nachfragen.",
    ziel: () => '[data-tour="buchhaltung-absenden"]',
    aufforderung: "Jetzt klicken: Buchhaltung anlegen",
    fehlendHinweis: "Bitte klicken Sie zuerst auf „Neue Buchhaltung“ und füllen Sie den Dialog aus.",
  },
  {
    id: "buchhaltung-erkennen",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Ihr Vorgang",
    text: "Das Tutorial merkt sich die eben angelegte Buchhaltung, damit sich alle weiteren Schritte genau auf diese Zeile beziehen.",
    zeilenwahl: true,
    erkennen: erkenneBuchhaltung,
  },
  {
    id: "zeile-eingegangen",
    abschnitt: 1,
    rolle: "Sekretariat",
    route: "/dashboard",
    titel: "Status: Eingegangen",
    text: "Das ist der eben angelegte Vorgang — echte Daten in der echten Liste. Der Status „Eingegangen“ bedeutet: liegt beim Sachbearbeiter, noch nicht angenommen.",
    ziel: zeile,
    fehlendHinweis: "Bitte legen Sie zuerst die Buchhaltung an.",
  },
  {
    id: "uebergabe-sachbearbeiter-1",
    abschnitt: 1,
    rolle: "Sekretariat",
    titel: "Rollenwechsel: Sachbearbeiter",
    text: "Der erste Teil ist geschafft. Melden Sie sich jetzt bitte ab und als Sachbearbeiter (Simon) wieder an. Das Tutorial merkt sich, wo Sie stehen, und bietet Ihnen die Fortsetzung automatisch an.",
    uebergabeZu: "Sachbearbeiter",
  },

  // ─────────────── Teil 2 · Sachbearbeiter ───────────────
  intro(2),
  {
    id: "sb-sieht",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Der Auftrag ist da",
    text: "Der Sachbearbeiter sieht den neuen Auftrag direkt in seiner Liste. Kein Zuruf, keine E-Mail, kein Nachfragen.",
    ziel: zeile,
    fehlendHinweis: "Bitte legen Sie zuerst in Teil 1 die Buchhaltung an.",
  },
  {
    id: "sb-annehmen",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Auftrag annehmen",
    text: "Mit „Annehmen“ übernimmt er den Vorgang. Für alle in der Kanzlei ist ab jetzt sichtbar, dass daran gearbeitet wird.",
    ziel: (l) => aktion(l, "annehmen"),
    aufforderung: "Jetzt klicken: Annehmen",
    fehlendHinweis: "Bitte suchen Sie zuerst Ihre Zeile im Dashboard.",
  },
  {
    id: "sb-zwei-wege",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Zwei Wege",
    text: "Jetzt gibt es zwei Möglichkeiten: Sind die Belege vollständig, geht es zur Prüfung. Fehlt etwas, wird der Mandant angefordert. Wir zeigen zuerst den Fall, dass etwas fehlt.",
    ziel: (l) => zeile(l),
  },
  {
    id: "sb-unvollstaendig",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Unterlagen unvollständig",
    text: "„Unvollständig“ öffnet den Notiz-Dialog. Die Notiz ist Pflicht — so weiß jeder sofort, woran es hängt.",
    ziel: (l) => aktion(l, "unvollstaendig"),
    aufforderung: "Jetzt klicken: Unvollständig",
    fehlendHinweis: "Bitte klicken Sie zuerst auf „Annehmen“.",
  },
  {
    id: "sb-notiz",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Was genau fehlt?",
    text: "Halten Sie im Klartext fest, was fehlt. Diese Notiz ist gleichzeitig die Arbeitsanweisung für das Sekretariat.",
    ziel: () => '[data-tour="notiz-dialog"]',
    aufforderung: "Jetzt eintragen und bestätigen",
    beispiele: [{ label: "Notiz", wert: TUTORIAL_NOTIZ_FEHLT }],
    fehlendHinweis: "Bitte klicken Sie zuerst auf „Unvollständig“.",
  },
  {
    id: "sb-warten",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Warten auf Mandant",
    text: "Der Status steht auf „Warten auf Mandant“, die Notiz hängt sichtbar an der Zeile. Das Sekretariat sieht den Vorgang und kann den Mandanten kontaktieren.",
    ziel: zeile,
  },
  {
    id: "sb-weiterarbeiten",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Unterlagen sind da",
    text: "Die fehlenden Belege sind eingetroffen — mit „Weiterarbeiten“ geht der Vorgang zurück in Bearbeitung.",
    ziel: (l) => aktion(l, "weiterarbeiten"),
    aufforderung: "Jetzt klicken: Weiterarbeiten",
    fehlendHinweis: "Bitte setzen Sie den Vorgang zuerst auf „Unvollständig“.",
  },
  {
    id: "sb-zur-pruefung",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Zur Prüfung abgeben",
    text: "Die Buchhaltung ist fertig und geht zur Prüfung. Der Abgabezeitpunkt wird festgehalten — wer zuerst abgibt, wird zuerst geprüft.",
    ziel: (l) => aktion(l, "zur-pruefung"),
    aufforderung: "Jetzt klicken: Zur Prüfung",
    fehlendHinweis: "Bitte klicken Sie zuerst auf „Weiterarbeiten“.",
  },
  {
    id: "uebergabe-chef-1",
    abschnitt: 2,
    rolle: "Sachbearbeiter",
    titel: "Rollenwechsel: Chef",
    text: "Melden Sie sich jetzt bitte als Chef (Christina) an. Danach setzen wir mit der Prüfung fort.",
    uebergabeZu: "Chef",
  },

  // ─────────────── Teil 3 · Chef prüft und weist zurück ───────────────
  intro(3),
  {
    id: "chef-sieht",
    abschnitt: 3,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Zur Prüfung eingegangen",
    text: "Die Buchhaltung liegt jetzt beim Steuerberater. Zwei Möglichkeiten: freigeben oder mit Begründung zurückweisen. Wir zeigen zuerst die Zurückweisung.",
    ziel: zeile,
    fehlendHinweis: "Bitte geben Sie den Vorgang zuerst als Sachbearbeiter zur Prüfung ab.",
  },
  {
    id: "chef-zurueckweisen",
    abschnitt: 3,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Zurückweisen",
    text: "„Zurückweisen“ öffnet den Dialog für die Begründung.",
    ziel: (l) => aktion(l, "zurueckweisen"),
    aufforderung: "Jetzt klicken: Zurückweisen",
    fehlendHinweis: "Bitte geben Sie den Vorgang zuerst zur Prüfung ab.",
  },
  {
    id: "chef-grund",
    abschnitt: 3,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Grund der Zurückweisung",
    text: "Der Grund steht im Klartext am Vorgang. Keine Rückfrage per Zuruf, keine verlorene Information.",
    ziel: () => '[data-tour="notiz-dialog"]',
    aufforderung: "Jetzt eintragen und bestätigen",
    beispiele: [{ label: "Begründung", wert: TUTORIAL_NOTIZ_ZURUECK }],
    fehlendHinweis: "Bitte klicken Sie zuerst auf „Zurückweisen“.",
  },
  {
    id: "uebergabe-sachbearbeiter-2",
    abschnitt: 3,
    rolle: "Chef",
    titel: "Rollenwechsel: Sachbearbeiter",
    text: "Die Buchhaltung ist zurück beim Sachbearbeiter. Melden Sie sich bitte wieder als Sachbearbeiter (Simon) an.",
    uebergabeZu: "Sachbearbeiter",
  },

  // ─────────────── Teil 4 · Sachbearbeiter korrigiert ───────────────
  intro(4),
  {
    id: "sb-korrektur",
    abschnitt: 4,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Zurückweisung sichtbar",
    text: "Der Sachbearbeiter sieht die Zurückweisung samt Begründung direkt an der Zeile — rot markiert, nicht zu übersehen.",
    ziel: zeile,
  },
  {
    id: "sb-erneut-abgeben",
    abschnitt: 4,
    rolle: "Sachbearbeiter",
    route: "/dashboard",
    titel: "Korrigiert und erneut abgegeben",
    text: "Nach der Korrektur geht die Buchhaltung erneut zur Prüfung.",
    ziel: (l) => aktion(l, "zur-pruefung"),
    aufforderung: "Jetzt klicken: Zur Prüfung",
    fehlendHinweis: "Bitte lassen Sie den Vorgang zuerst als Chef zurückweisen.",
  },
  {
    id: "uebergabe-chef-2",
    abschnitt: 4,
    rolle: "Sachbearbeiter",
    titel: "Rollenwechsel: Chef",
    text: "Letzter Schritt: Melden Sie sich bitte noch einmal als Chef (Christina) an.",
    uebergabeZu: "Chef",
  },

  // ─────────────── Teil 5 · Chef gibt frei ───────────────
  intro(5),
  {
    id: "chef-final",
    abschnitt: 5,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Erneut zur Prüfung",
    text: "Die korrigierte Buchhaltung liegt wieder zur Prüfung vor.",
    ziel: zeile,
  },
  {
    id: "chef-freigeben",
    abschnitt: 5,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Freigeben",
    text: "Mit „Freigeben“ ist der Vorgang abgeschlossen. Das Fertigstellungsdatum wird festgehalten.",
    ziel: (l) => aktion(l, "freigeben"),
    aufforderung: "Jetzt klicken: Freigeben",
    fehlendHinweis: "Bitte geben Sie den Vorgang zuerst erneut zur Prüfung ab.",
  },
  {
    id: "chef-erledigt",
    abschnitt: 5,
    rolle: "Chef",
    route: "/dashboard",
    titel: "Buchhaltung erledigt",
    text: "Der Vorgang ist erledigt und wandert ins Archiv unter „Erstellte Buchhaltungen“. Jeder Schritt ist dokumentiert.",
    ziel: zeile,
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

/** Position innerhalb des Abschnitts: [Nummer, Anzahl]. */
export function schrittImAbschnitt(index: number): [number, number] {
  const s = SCHRITTE[index];
  if (!s) return [1, 1];
  const gleiche = SCHRITTE.filter((x) => x.abschnitt === s.abschnitt);
  return [gleiche.indexOf(s) + 1, gleiche.length];
}

export const ANZAHL_ABSCHNITTE = ABSCHNITTE.length;
export const LETZTER_ABSCHNITT = SCHRITTE[SCHRITTE.length - 1].abschnitt;
