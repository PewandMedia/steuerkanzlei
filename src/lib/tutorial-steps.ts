import type { Database } from "@/integrations/supabase/types";

type BenutzerRolle = Database["public"]["Enums"]["benutzer_rolle"];

export interface TourStep {
  /** Eindeutiger Schlüssel */
  id: string;
  title: string;
  body: string;
  /** CSS-Selektor des Ankers (bestehendes Element mit data-tour-Attribut) */
  selector?: string;
  /** Ausweich-Selektor, falls der primäre Anker fehlt */
  fallbackSelector?: string;
  /** Text, der genutzt wird, wenn nur der Ausweich-Anker gefunden wurde */
  fallbackBody?: string;
  /** Route, auf die vor dem Schritt navigiert wird */
  route?: string;
  /** Sidebar vorher öffnen */
  needsSidebar?: boolean;
  /** Schritt ohne Anker, mittig angezeigt */
  center?: boolean;
}

const gemeinsamAnfang = (name: string, rolle: string): TourStep[] => [
  {
    id: "sidebar-user",
    selector: '[data-tour="sidebar-user"]',
    fallbackSelector: '[data-tour="sidebar-header"]',
    needsSidebar: true,
    title: "Ihr Konto",
    body: `Sie sind als ${name} (${rolle}) angemeldet. Jede Rolle sieht ein anderes Menü und andere Aktionen. Über „Abmelden" können Sie jederzeit die Rolle wechseln und den Ablauf aus einer anderen Perspektive erleben.`,
  },
  {
    id: "sidebar-nav",
    selector: '[data-tour="sidebar-nav"]',
    needsSidebar: true,
    title: "Navigation",
    body: "Hier springen Sie zwischen den Bereichen. Das Menü ist auf Ihre Rolle zugeschnitten — Sie sehen nur, was Sie wirklich brauchen.",
  },
  {
    id: "kpi",
    route: "/dashboard",
    selector: '[data-tour="kpi"]',
    title: "Überblick in Zahlen",
    body: "Überfällige Buchhaltungen, bald fällige, laufende, wartende und erledigte. Jede Kachel ist ein Klick-Filter — ein Klick auf „Überfällig" zeigt sofort nur die kritischen Fälle.",
  },
  {
    id: "schnellfilter",
    selector: '[data-tour="schnellfilter"]',
    title: "Schnellfilter",
    body: "Die häufigsten Ansichten mit einem Klick. Nochmal klicken hebt den Filter wieder auf.",
  },
  {
    id: "filter-toolbar",
    selector: '[data-tour="filter-toolbar"]',
    title: "Suchen, filtern, sortieren",
    body: "Suche nach Mandant, Monat oder Notiz, dazu Filter nach Status, Mitarbeiter und Frist. Die Sortierung steht auf „Priorität": Überfälliges und Dringendes rutscht automatisch nach oben.",
  },
  {
    id: "frist",
    selector: '[data-tour="frist"]',
    title: "Fristen",
    body: "Die Frist wird automatisch berechnet. Ist für den Mandanten eine Dauerfristverlängerung hinterlegt, verschiebt sich der Termin entsprechend — Sie müssen nichts selbst rechnen.",
  },
  {
    id: "belege",
    selector: '[data-tour="belege"]',
    title: "Belege",
    body: "Alle Belege des Mandanten für diesen Monat. Per Klick öffnet sich die Vollansicht mit PDF-Viewer, ohne dass Sie die Seite verlassen.",
  },
];

const gemeinsamEnde: TourStep[] = [
  {
    id: "glocke",
    selector: '[data-tour="glocke"]',
    needsSidebar: true,
    title: "Benachrichtigungen",
    body: "Alles, was Sie betrifft, landet hier: Zurückweisungen, neue Aufträge, Statuswechsel. Ein Klick auf eine Benachrichtigung springt direkt zur passenden Zeile.",
  },
  {
    id: "aktualisieren",
    route: "/dashboard",
    selector: '[data-tour="aktualisieren"]',
    title: "Aktualisieren",
    body: "Holt den aktuellen Stand, wenn parallel jemand anderes gearbeitet hat.",
  },
  {
    id: "theme",
    selector: '[data-tour="theme"]',
    needsSidebar: true,
    title: "Design",
    body: "Helles oder dunkles Design, ganz nach Geschmack.",
  },
];

const sekretariat: TourStep[] = [
  {
    id: "neue-buchhaltung",
    route: "/dashboard",
    selector: '[data-tour="neue-buchhaltung"]',
    title: "Neue Buchhaltung anlegen",
    body: "Ihr wichtigster Button: Kommen Belege eines Mandanten herein, legen Sie hier die Buchhaltung für den Monat an. Sie erfasst das Belegeingangs-Datum und startet im Status „Eingegangen" — ab da sieht der Sachbearbeiter den Auftrag.",
  },
  {
    id: "reihenfolge",
    selector: '[data-tour="reihenfolge-hinweis"]',
    fallbackSelector: '[data-tour="badge-zuerst-dran"]',
    title: "Reihenfolge",
    body: "Wer zuerst Belege eingereicht hat, wird zuerst bearbeitet. Das System markiert das automatisch — so wird kein Mandant übergangen.",
  },
  {
    id: "notiz-warten",
    selector: '[data-tour="notiz-warten"]',
    fallbackSelector: '[data-tour="status-zelle"]',
    title: "Was fehlt dem Mandanten",
    body: "Fehlt etwas, setzt der Sachbearbeiter die Buchhaltung auf „Warten auf Mandant" und schreibt dazu, was genau fehlt. Genau diese Notiz ist Ihre Arbeitsanweisung.",
    fallbackBody: "Im Status „Warten auf Mandant" hinterlegt der Sachbearbeiter eine Notiz, was genau fehlt. Diese Notiz ist Ihre Arbeitsanweisung.",
  },
  {
    id: "kontakt",
    selector: '[data-tour="row-menu"]',
    title: "Mandant kontaktieren",
    body: "Über dieses Menü dokumentieren Sie den Kontakt zum Mandanten: angerufen, gemailt, was besprochen wurde. Der Sachbearbeiter sieht sofort, dass Sie sich gekümmert haben.",
  },
  {
    id: "whatsapp",
    selector: '[data-tour="whatsapp"]',
    title: "WhatsApp",
    body: "Direkt per WhatsApp beim Mandanten nachfassen — die Telefonnummer kommt aus den Stammdaten.",
  },
  {
    id: "sidebar-mandanten",
    selector: '[data-tour="nav-/mandanten"]',
    needsSidebar: true,
    title: "Mandanten",
    body: "Die Mandantenstammdaten: Kontaktdaten, Mandantennummer, zuständiger Sachbearbeiter, Dauerfristverlängerung.",
  },
];

const sachbearbeiter: TourStep[] = [
  {
    id: "nur-meine",
    route: "/dashboard",
    selector: '[data-tour="nur-meine"]',
    title: "Nur meine Mandanten",
    body: "Für Sie ist standardmäßig aktiviert, dass Sie nur Ihre eigenen Mandanten sehen. Ausschalten zeigt die ganze Kanzlei — praktisch bei Vertretungen.",
  },
  {
    id: "badge-naechstes",
    selector: '[data-tour="badge-naechstes"]',
    fallbackSelector: '[data-tour="filter-toolbar"]',
    title: "Als Nächstes",
    body: "Diese Buchhaltung schlägt Ihnen das System als nächste vor — sortiert nach Dringlichkeit, Frist und Reihenfolge des Belegeingangs. Sie müssen nicht überlegen, womit Sie anfangen.",
    fallbackBody: "Das System schlägt Ihnen die nächste Buchhaltung vor — sortiert nach Dringlichkeit, Frist und Reihenfolge des Belegeingangs.",
  },
  {
    id: "annehmen",
    selector: '[data-tour="aktionen"][data-tour-status="Eingegangen"]',
    fallbackSelector: '[data-tour="aktionen"]',
    title: "Annehmen",
    body: "Sie übernehmen den Auftrag. Der Status wechselt von „Eingegangen" auf „In Bearbeitung" — für alle sichtbar, dass Sie dran sind.",
    fallbackBody: "In den Aktionen einer Zeile im Status „Eingegangen" übernehmen Sie den Auftrag mit „Annehmen". Der Status wechselt auf „In Bearbeitung".",
  },
  {
    id: "unvollstaendig",
    selector: '[data-tour="aktionen"][data-tour-status="In Bearbeitung"]',
    fallbackSelector: '[data-tour="aktionen"]',
    title: "Unvollständig",
    body: "Fehlen Belege? Hier eintragen, was genau fehlt — die Notiz ist Pflicht. Der Status wird „Warten auf Mandant", und das Sekretariat sieht die Notiz als Auftrag, den Mandanten zu kontaktieren.",
    fallbackBody: "Fehlen Belege, tragen Sie über „Unvollständig" ein, was genau fehlt — die Notiz ist Pflicht. Das Sekretariat kontaktiert dann den Mandanten.",
  },
  {
    id: "weiterarbeiten",
    selector: '[data-tour="aktionen"][data-tour-status="Warten auf Mandant"]',
    title: "Weiterarbeiten",
    body: "Sind die fehlenden Belege da, holen Sie die Buchhaltung mit einem Klick zurück in die Bearbeitung.",
  },
  {
    id: "zur-pruefung",
    selector: '[data-tour="aktionen"][data-tour-status="In Bearbeitung"]',
    fallbackSelector: '[data-tour="aktionen"]',
    title: "Zur Prüfung senden",
    body: "Fertig? Damit geht die Buchhaltung an den Chef. Status: „In Prüfung". Der Zeitpunkt wird festgehalten — wer zuerst abgibt, wird zuerst geprüft.",
    fallbackBody: "Ist die Buchhaltung fertig, senden Sie sie an den Chef. Status: „In Prüfung" — der Zeitpunkt wird festgehalten.",
  },
  {
    id: "zurueckweisung",
    selector: '[data-tour="zurueckweisung"]',
    fallbackSelector: '[data-tour="status-zelle"]',
    title: "Zurückweisungen",
    body: "Weist der Chef eine Buchhaltung zurück, sehen Sie hier den Grund im Klartext. Der Fall landet wieder bei Ihnen in „In Bearbeitung".",
    fallbackBody: "Weist der Chef eine Buchhaltung zurück, sehen Sie den Grund im Klartext an der Zeile. Der Fall landet wieder bei Ihnen in „In Bearbeitung".",
  },
  {
    id: "sidebar-buchhaltungen",
    selector: '[data-tour="nav-/buchhaltungen"]',
    needsSidebar: true,
    title: "Erstellte Buchhaltungen",
    body: "Ihr Archiv: alle freigegebenen Buchhaltungen und Abschlüsse zum Nachschlagen.",
  },
  {
    id: "status-dropdown",
    route: "/dashboard",
    selector: '[data-tour="status-dropdown"]',
    title: "Status frei setzen",
    body: "Für Sonderfälle können Sie den Status auch frei setzen — das System schlägt Ihnen aber immer den richtigen nächsten Schritt als grünen Button vor.",
  },
];

const chef: TourStep[] = [
  {
    id: "filter-pruefung",
    route: "/dashboard",
    selector: '[data-tour="schnellfilter-pruefung"]',
    fallbackSelector: '[data-tour="schnellfilter"]',
    title: "Ihr Posteingang",
    body: "Alle Buchhaltungen, die Ihre Sachbearbeiter zur Prüfung abgegeben haben. Ein Klick, und Sie sehen nur diese.",
  },
  {
    id: "badge-zuerst-abgegeben",
    selector: '[data-tour="badge-zuerst-abgegeben"]',
    fallbackSelector: '[data-tour="filter-toolbar"]',
    title: "Faire Reihenfolge",
    body: "Liegen mehrere Buchhaltungen zur Prüfung, markiert das System, welche zuerst abgegeben wurde. So bleibt die Reihenfolge fair und nichts liegt unbemerkt liegen.",
    fallbackBody: "Liegen mehrere Buchhaltungen zur Prüfung, markiert das System, welche zuerst abgegeben wurde — die Reihenfolge bleibt fair.",
  },
  {
    id: "freigeben",
    selector: '[data-tour="aktionen"][data-tour-status="In Prüfung"]',
    fallbackSelector: '[data-tour="aktionen"]',
    title: "Freigeben",
    body: "Alles korrekt? Freigeben setzt den Status auf „Buchhaltung erledigt", hält das Fertigstellungsdatum fest und archiviert den Fall.",
    fallbackBody: "Bei Buchhaltungen im Status „In Prüfung" setzt „Freigeben" den Status auf „Buchhaltung erledigt", hält das Fertigstellungsdatum fest und archiviert den Fall.",
  },
  {
    id: "zurueckweisen",
    selector: '[data-tour="aktionen"][data-tour-status="In Prüfung"]',
    fallbackSelector: '[data-tour="aktionen"]',
    title: "Zurückweisen",
    body: "Stimmt etwas nicht, geht die Buchhaltung mit Ihrem Kommentar zurück an den Sachbearbeiter. Der sieht den Grund direkt an der Buchhaltung — keine Rückfragen per Zuruf nötig.",
    fallbackBody: "Stimmt etwas nicht, geht die Buchhaltung mit Ihrem Kommentar zurück an den Sachbearbeiter — er sieht den Grund direkt an der Buchhaltung.",
  },
  {
    id: "chef-aktionen",
    selector: '[data-tour="status-dropdown"]',
    title: "Sonderwege",
    body: "Als Chef haben Sie zusätzlich Sonderwege: zurück an den Sachbearbeiter, ablehnen und den Mandanten kontaktieren lassen, oder komplett auf „Eingegangen" zurücksetzen.",
  },
  {
    id: "sidebar-statistiken",
    route: "/statistiken",
    selector: '[data-tour="nav-/statistiken"]',
    needsSidebar: true,
    title: "Statistiken",
    body: "Auslastung, Durchlaufzeiten und Erledigungen pro Mitarbeiter. Sie sehen auf einen Blick, wo sich Arbeit staut.",
  },
  {
    id: "sidebar-benutzer",
    selector: '[data-tour="nav-/benutzer"]',
    needsSidebar: true,
    title: "Benutzer",
    body: "Hier legen Sie Mitarbeiter an und vergeben Rollen. Die Rolle entscheidet, was jemand sehen und tun darf.",
  },
];

const abschluss: Record<BenutzerRolle, string> = {
  Sekretariat:
    "Das war Ihr Ablauf: Belege annehmen, Buchhaltung anlegen, Mandanten nachfassen. Den Status ändern bewusst nur Sachbearbeiter und Chef — so bleibt klar, wer wofür verantwortlich ist. Tipp: Melden Sie sich als „Sachbearbeiter" an, um den nächsten Schritt zu sehen.",
  Sachbearbeiter:
    "Ihr Ablauf: Annehmen, bearbeiten, Fehlendes anfordern, zur Prüfung senden. Melden Sie sich als „Chef / Steuerberater" an, um die Prüfung und Freigabe zu sehen.",
  Chef:
    "Ihr Ablauf: prüfen, freigeben oder zurückweisen, dazu der Blick auf die ganze Kanzlei. Melden Sie sich als „Sekretariat" oder „Sachbearbeiter" an, um den Ablauf von der anderen Seite zu sehen.",
};

export function getTourSteps(
  rolle: BenutzerRolle | null,
  name: string | null,
): TourStep[] {
  const anzeigeName = name ?? "Demo-Nutzer";
  const anzeigeRolle = rolle ?? "Demo";
  const rollenSchritte =
    rolle === "Sekretariat" ? sekretariat : rolle === "Sachbearbeiter" ? sachbearbeiter : rolle === "Chef" ? chef : [];

  return [
    ...gemeinsamAnfang(anzeigeName, anzeigeRolle),
    ...rollenSchritte,
    ...gemeinsamEnde,
    {
      id: "abschluss",
      center: true,
      route: "/dashboard",
      title: "Geschafft",
      body: rolle ? abschluss[rolle] : "Sie kennen jetzt die wichtigsten Bereiche des Systems.",
    },
  ];
}
