## Ziel
`Meine Mandanten` immer nach Mandantennummer (M-1 → M-150) sortieren und die Mobilansicht (390 px) aufräumen und beschleunigen.

## Änderungen in `src/pages/MeineMandanten.tsx`

### 1. Chronologische Sortierung überall
- Sachbearbeiter-Ansicht: aktuell wird vor dem Rendern per `.sort((a,b) => a.name.localeCompare(b.name))` alphabetisch umsortiert → entfernen. Die Liste bleibt in der bereits geladenen Reihenfolge M-1 … M-150.
- Chef-Ansicht (`grouped`): jede Gruppe wird ebenfalls per `a.name.localeCompare(b.name)` sortiert → auf natürliche Sortierung nach `mandanten_nummer` umstellen (gleiche `numOf`-Helper-Funktion wie im initialen Load).
- Ergebnis: In beiden Rollen zählt die Liste sichtbar M-1, M-2, M-3, …

### 2. Mobile-Layout (< 640 px)
Karte kompakter, ohne horizontales Überlaufen:
- Nummer-Tile schmaler auf Mobile (`h-10 w-14`, größere Größen nur ab `md`), Font-Skalierung an `nr.length` bleibt.
- Statuspill rechts auf Mobile nur Icon + Zahl (kein „offen"-Text), damit die Zeile nicht bricht.
- „X erledigt"-Text bleibt bereits `hidden sm:inline` — beibehalten.
- Padding der Karte auf Mobile von `px-3 py-2.5` auf `px-2.5 py-2`, Gap `gap-2` statt `gap-3`.
- Suchleiste: Input auf Mobile `h-11 text-sm`, Zähler-Badge bleibt `hidden sm:inline-flex`.
- Seitenpadding von `p-6 lg:p-10` auf `p-4 sm:p-6 lg:p-10`, Card-Padding `p-3 sm:p-5`.
- Überschrift auf Mobile `text-xl`, ab `sm` `text-2xl`.

### 3. Performance auf Mobile
- `PaginatedList`-Default-Seitengröße: auf Mobile-Viewport (`window.matchMedia("(max-width: 640px)")`) initial 25 statt 50 Einträge — reduziert First-Paint-Kosten spürbar; Nutzer kann via Footer erhöhen (bestehender `pageSize`-Selector).
- `renderCard` in `useCallback` verpacken und pro Zeile nur die tatsächlich benötigten Felder ableiten (kein `find()` über `bearbeiter` pro Row) → `bearbeiterMap = useMemo(new Map(bearbeiter.map(b => [b.id, b.name])))` einmalig, in `renderCard` per `.get()` nutzen. Spart bei 150 Zeilen × Rerender die O(n·m)-Lookups.
- `filtered`-Memo behält die aktuelle Deps-Liste; die überflüssige Nachsortierung in Punkt 1 entfällt und spart pro Render einen 150-Item-Sort.

## Nicht Teil dieses Plans
- Keine Änderung an Datenmodell, Query oder Cache (`simple-cache` bleibt).
- Keine Redesigns der Karten außer den Mobile-Anpassungen oben.
- Kein Eingriff in Dashboard oder andere Seiten.