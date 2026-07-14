## Ziel
Jeder Demo-Mandant bekommt eine fortlaufende, sinnvolle Mandantennummer **M-1 … M-150**, sortiert und angezeigt in „Meine Mandanten".

## Änderungen

1. **`supabase/functions/demo-seed/index.ts`**
   - Beim Erzeugen der 150 Mandanten das Feld `mandanten_nummer: \`M-${i + 1}\`` mitschreiben.
   - Reihenfolge der Inserts bleibt, damit M-1 … M-150 sauber vergeben werden.
   - Edge Function neu deployen und einmal manuell ausführen, damit der aktuelle Demo-Stand die Nummern hat (der tägliche Cronjob übernimmt es danach automatisch).

2. **`src/pages/MeineMandanten.tsx`**
   - Query um `.order("mandanten_nummer")` mit natürlicher Sortierung ergänzen (bzw. clientseitig nach der Zahl hinter `M-` sortieren), damit M-1, M-2, … M-10, … M-150 in korrekter Reihenfolge erscheinen und nicht lexikographisch (M-1, M-10, M-100…).

## Nicht Teil dieses Plans
- Kein Schema-Change: `mandanten_nummer` existiert bereits inkl. Unique-Constraint.
- Keine Änderung an der manuellen Anlage in `Mandanten.tsx` (dort wird die Nummer weiterhin manuell / per Vorschlag vergeben).