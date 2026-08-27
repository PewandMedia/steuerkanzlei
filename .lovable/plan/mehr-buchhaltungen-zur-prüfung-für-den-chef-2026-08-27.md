# Mehr Buchhaltungen zur Prüfung für den Chef

Aktuell liegen von den 50 offenen Buchhaltungen nur rund 12 im Status „In Prüfung" – also beim Chef zur Freigabe. Das ist im Demo-Dashboard kaum sichtbar. Zusätzlich fehlen Beispiele, die der Chef bereits zurückgewiesen hat.

## Was geändert wird

**Mehr Vorlagen beim Chef**
- Von den 50 offenen Buchhaltungen künftig etwa 20 im Status „In Prüfung" (statt 12), der Rest bleibt auf „Eingegangen" / „In Bearbeitung".
- Jede davon bekommt wie bisher einen Kommentar des Sachbearbeiters („Belege sind komplett — bitte prüfen und freigeben."), damit der Chef Kontext hat und sie direkt freigeben oder zurücksenden kann.

**Bereits zurückgewiesene Beispiele**
- 6 Buchhaltungen werden als „vom Chef zurückgewiesen" abgebildet: Status „In Bearbeitung", Zeitpunkt der Zurückweisung gesetzt und eine Notiz mit dem Grund (z. B. fehlende Kontoauszüge, falsche Kontierung, Beleg doppelt erfasst).
- Damit sieht man im Sachbearbeiter-Login sofort den Zurückweisungs-Hinweis und den Rückweg des Workflows.

**Verteilung bleibt gleich**
- Weiterhin 150 Mandanten und 150 Buchhaltungen: 80 erledigt, 20 überzogen, 50 offen. Nur die Statusverteilung innerhalb der 50 offenen verschiebt sich.
- Fristen kommen unverändert aus dem Trigger, keine manuellen Fristen.

## Technisch

- `supabase/functions/demo-seed/index.ts`:
  - Status-Pool der offenen Buchhaltungen so anpassen, dass ca. 20 auf „In Prüfung" fallen.
  - Nach dem Insert 6 Einträge (aus den „In Bearbeitung"-Zeilen) mit `zurueckgewiesen_am` und Grund-Notiz aktualisieren; das Setzen erfolgt per Service-Role-Update, damit der Status-Trigger nicht dazwischenfunkt.
  - Kommentar-Block bleibt, greift automatisch für alle „In Prüfung"-Zeilen; für die zurückgewiesenen zusätzlich ein Chef-Kommentar mit dem Grund.
- Funktion neu deployen und einmal ausführen, danach per Abfrage prüfen: ca. 20 „In Prüfung", 6 mit gesetztem Zurückweisungsdatum, Gesamtzahlen unverändert.
