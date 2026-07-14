## Ziel
Dashboard und „Meine Mandanten" merklich schneller machen. Aktuell zieht das Dashboard beim Aufruf alle 670 Buchhaltungen mit 5 verschachtelten Joins (mandant, bearbeiter, dokumente, co-bearbeiter, alle Belegeingänge) in einem einzigen Request und rendert alles unmittelbar.

## Änderungen

### 1. Dashboard-Query verschlanken (`src/pages/Dashboard.tsx`)
- `buchhaltung_dokumente(id)` und `belegeingaenge(id, datum, notiz)` aus dem initialen Select entfernen.
- Stattdessen in zwei kompakten Zweitabfragen nur die **Counts** laden:
  - `buchhaltung_dokumente` → gruppiert per `buchhaltung_id`
  - `belegeingaenge` → nur `buchhaltung_id, datum` (für Sortierung und Anzeige des jüngsten Datums reicht `belegeingang_datum`, das eh schon auf der Buchhaltungszeile liegt).
- Die vollständige Belegeingang-Liste erst laden, wenn der Nutzer den „Belegeingänge"-Dialog öffnet (`belegeingaengeDialog`) — bereits vorhandener Trigger.
- „+N weitere / Alle anzeigen"-Anzeige erhält nur noch den Count (aus dem Zweit-Fetch), Detailliste kommt aus dem Dialog.

### 2. Sachbearbeiter-Standardansicht ohne Erledigte
- Beim ersten Laden für Sachbearbeiter zusätzlich `statusFilter` so setzen, dass „Buchhaltung erledigt" nicht mit im Rendering ist (die 550 erledigten Zeilen sind der größte Renderposten). Ein Klick auf die „Erledigt"-Kachel oben blendet sie wie bisher wieder ein.

### 3. React-Query-Cache nutzen
- `fetchData` / `fetchMandanten` auf `useQuery` umstellen (`@tanstack/react-query` ist bereits eingebunden) mit `staleTime: 60_000`. Damit wird beim Wechsel zwischen Dashboard, „Meine Mandanten" und Detailseiten kein Full-Refetch mehr ausgelöst.
- Nach Mutationen (Status ändern, Löschen, Kontakt aktualisieren) gezielt `queryClient.invalidateQueries` statt kompletter Neuladung.

### 4. `MeineMandanten` (`src/pages/MeineMandanten.tsx`)
- Statt aller `buchhaltungen` (670 Rows) nur noch `mandant_id, status` mit `head:false` selecten — bereits der Fall — aber zusätzlich via React-Query cachen und mit Dashboard-Query teilen (gleicher `queryKey`), damit Wechseln zwischen den Seiten instant ist.

### 5. Tabellen-Rendering entschlacken
- Konstante Formatter (`new Date(...).toLocaleDateString("de-DE")` in jeder Zeile) werden per `Intl.DateTimeFormat`-Singleton außerhalb der Row-Map angelegt.
- Der interne `useMemo` für `filtered` wird auf notwendige Deps reduziert; teure Sub-Sortierungen (z. B. Belegeingang-Array-Sort pro Row) fallen mit Punkt 1 komplett weg.

## Nicht Teil dieses Plans
- Keine DB-Schema- oder Index-Änderungen (Indizes sind bereits gesetzt).
- Kein Wechsel auf Server-side Pagination (bleibt clientseitig; die Datenmenge ist nach Punkt 1 kein Problem mehr).
- Kein Redesign — nur Performance, keine sichtbaren UI-Änderungen außer dem Standardfilter für Sachbearbeiter.