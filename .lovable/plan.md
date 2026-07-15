## Ziel
Demo-Datenmenge in `supabase/functions/demo-seed/index.ts` deutlich reduzieren, damit die App auf Mobile/Laptop nicht mehr laggt. Statt 670 Buchhaltungen nur noch **150 insgesamt**.

## Neue Verteilung
- **80 erledigt** (`Buchhaltung erledigt`)
- **20 überzogen** (Fälligkeit in der Vergangenheit, Status `In Bearbeitung` / `Warten auf Mandant`)
- **50 offen** (noch Zeit, Status `Eingegangen` / `In Bearbeitung` / `In Prüfung`)
- **Summe: 150**

150 Mandanten (M-1 … M-150) bleiben unverändert — jeder Mandant hat also im Schnitt ~1 Buchhaltung.

## Änderungen in `supabase/functions/demo-seed/index.ts`

1. **Erledigt-Verteilung**
   - `erledigtTarget = 80` (statt 550).
   - `perMandantErledigt`: Basis `0`, dann die ersten 80 Mandanten bekommen je 1 erledigte Buchhaltung. Kein `floor(80/150)`-Trick — einfach `Array(150).fill(0)` und Indizes 0-79 auf 1 setzen.
   - Monate weiterhin aus dem `erledigtMonths`-Pool (Jan 2024 – Aug 2025), rotierend per Mandant-Index.

2. **Überzogen**
   - Bleibt bei **20** (Loop unverändert). Verteilung `mandantenInfo[i * 7 % 150]` bleibt.

3. **Offen**
   - `for (let i = 0; i < 50; i++)` (statt 100). Rest der Logik unverändert (`openMonths`, `openStatuses`).

4. **Co-Bearbeiter**
   - `coCount = 12` bleibt — passt weiterhin (12 von 150 sind sichtbar).

5. **Belegeingänge / Kommentare**
   - Bleibt wie es ist (1-2 Belege pro Buchhaltung), skaliert automatisch mit der kleineren Menge.

6. **Return-Payload**
   - `erledigt` / `offen`-Zähler bleiben aus `insertedBh.filter(...)` — keine Änderung nötig.

## Nach dem Seed
- Edge-Function neu deployen.
- Einmalig `demo-seed` aufrufen, damit die Datenbank sofort auf 150 Zeilen schrumpft (der 03:00-UTC-Cron macht es sonst erst morgen).

## Nicht Teil dieses Plans
- Keine Änderungen am Frontend, Cache, Pagination oder Sortierung.
- Keine Änderung an Mandanten-Anzahl (bleibt 150) oder am Cron-Job.
