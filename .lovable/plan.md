## Ziel
Dashboard-Tabelle passt auf Laptop-Auflösungen (≥ 1280 px) ohne horizontales Scrollen. Die "Anzeigen"/"Buchhaltung"-Spalte fliegt raus — sie liefert im Weiterleitungs-Modell keinen Mehrwert und blockiert 180 px Breite.

## Änderungen in `src/pages/Dashboard.tsx`

1. **Spalte „Buchhaltung/Anzeigen" komplett entfernen**
   - `TableHead` mit `w-[180px]` (Zeile 527) raus.
   - Zugehörige `TableCell` mit dem Expand-Button (Zeile 566–580) raus.
   - `expandedId`-State, die aufklappbare Details-Row (Zeile 867–893) und der Import von `ChevronDown/ChevronRight/PlayCircle` (nur hier genutzt) werden entfernt.
   - `colSpan={9}` in der Leer-Zeile und Detail-Row auf `8` angepasst.
   - Der "Buchhaltung erledigt"-Hinweis bleibt weiter über den Status-Badge in der Status-Spalte sichtbar (klickbar → `/buchhaltungen`), also kein Info-Verlust.

2. **Aktionen-Spalte kompakter**
   - `min-w-[240px]` auf `min-w-[200px]` und die innere `min-w-[260px]` auf `min-w-[200px]` reduzieren, damit die Zeile bei 1280–1440 px nicht mehr überläuft.
   - `WhatsAppButton` bleibt, `StatusTransitionWithFortschritt` bleibt, `MoreHorizontal` bleibt.

3. **Belegeingang-Spalte an mittlere Laptops anpassen**
   - Breakpoint auf `hidden 2xl:table-cell` (≥ 1536 px) verschieben, damit auf 13"–14"-Laptops eine Spalte weniger konkurriert. Die Info bleibt in der Detail-Ansicht der Buchhaltung / im Mandantprofil erhalten.

4. **Sticky-Header + saubere Scroll-Fallback**
   - `overflow-x-auto` bleibt, zusätzlich wird `min-w-full` gesetzt und die Tabelle bekommt `whitespace-nowrap` nur für schmale Zellen (Monat, Frist, Bearbeiter), damit lange Firmennamen weiter umbrechen dürfen.

5. **Container-Padding auf Laptop reduzieren**
   - Wrapper `p-6 lg:p-10` → `p-4 lg:p-6 xl:p-8`, damit die Tabelle auf 1280 px mehr Platz hat.

## Nicht angefasst
- Sidebar, Filter-Toolbar, KPI-Kacheln bleiben unverändert.
- Keine Business-Logik-Änderung, keine Datenbank-Änderung.
- „Erstellte Buchhaltungen"-Seite bleibt der Ort, an dem abgeschlossene Buchhaltungen im Detail sichtbar sind.

## Offene Frage
Die aufklappbare Detail-Zeile enthielt aktuell nur den Hinweistext „Weiterleitung & Organisation — Belege dienen als Referenz." Ok, dass dieser Text ersatzlos entfällt? (Alternativ könnte er als kleiner Info-Tooltip am Tabellenkopf bleiben.)
