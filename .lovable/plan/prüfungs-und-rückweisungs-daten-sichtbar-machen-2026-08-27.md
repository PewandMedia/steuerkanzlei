# Prüfungs- und Rückweisungs-Daten sichtbar machen

## Was ich geprüft habe

Ich habe mich im Browser als Chef (Christina) in der Demo angemeldet. Die Daten sind vorhanden und werden im Dashboard angezeigt:

- 20 Buchhaltungen im Status „In Prüfung“ – inklusive der Buttons „Freigeben“ und „Zurückweisen“
- 6 zurückgewiesene Buchhaltungen (Status „In Bearbeitung“ mit Rückweisungs-Grund)
- 80 erledigt, 11 eingegangen, 10 warten auf Mandant

Der Grund, warum bei dir nichts Neues auftaucht, liegt nicht an fehlenden Daten, sondern an drei Punkten in der Oberfläche.

## Ursachen

1. **Zwischenspeicher im Browser (60 Sekunden) + offene Sitzung**: Wenn die Demo-Daten neu erzeugt werden, zeigt eine bereits geöffnete Seite weiter den alten Stand, bis manuell neu geladen wird.
2. **Keine Benachrichtigung für den Chef**: Die Glocke meldet „zur Prüfung“ nur, wenn ein Sachbearbeiter den Status *während der Nutzung* ändert. Die 20 vorbereiteten Prüfungsfälle wurden direkt angelegt – dafür entsteht kein Hinweis.
3. **Keine Benachrichtigung für den Sachbearbeiter** bei den 6 vorbereiteten Rückweisungen, dadurch wirkt der Rückweisungs-Ablauf leer, wenn man sich als Simon anmeldet.

## Was ich ändern werde

1. **Sofort sichtbarer Stand**: Beim Öffnen des Dashboards wird der Zwischenspeicher nur noch als kurzfristige Vorschau genutzt und immer sofort mit frischen Daten überschrieben; zusätzlich kommt ein „Aktualisieren“-Knopf in die Kopfzeile.
2. **Prüf-Hinweise für den Chef**: Die Demo-Daten erzeugen für die 20 Fälle „In Prüfung“ passende Benachrichtigungen für den Chef, sodass die Glocke gefüllt ist.
3. **Rückweisungs-Hinweise für den Sachbearbeiter**: Für die 6 zurückgewiesenen Buchhaltungen werden Benachrichtigungen an Simon erzeugt, inklusive Begründung.
4. Danach Demo-Daten neu erzeugen und als Chef sowie als Sachbearbeiter im Browser gegenprüfen.

## Technische Details

- `src/pages/Dashboard.tsx`: Cache-Hydrierung nur als Erst-Anzeige, Refetch immer ausführen; Refresh-Button, der `simple-cache`-Einträge (`dashboard:*`) löscht und neu lädt.
- `supabase/functions/demo-seed/index.ts`: nach dem Insert-Block Einträge in `benachrichtigungen` erzeugen – Typ `in_pruefung` für den Chef, Typ `zurueckgewiesen` für den Hauptbearbeiter (und Co-Bearbeiter) der 6 Rückweisungen.
- Anschließend Edge Function neu deployen, Seed einmal ausführen, Ergebnis per SQL und Browser-Check verifizieren.

Keine Schema-Änderungen, keine Änderungen an Rechten/Policies.
