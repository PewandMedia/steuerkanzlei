## Ziel
1. Alle Buchhaltungen/Mandanten auf **einen** Sachbearbeiter (Simon) legen — die 10 extra Sachbearbeiter entfernen.
2. Automatischer **Reset alle 24 Stunden** auf genau diesen Demo-Stand.

## Änderungen

### 1. `supabase/functions/demo-seed/index.ts` umbauen
- Sektion „10 Sachbearbeiter erzeugen" (sb01–sb10) entfernen.
- Cleanup so erweitern, dass bereits existierende `sb01@…` bis `sb10@pewand-demo.de` Auth-User + zugehörige `benutzer`-Zeilen gelöscht werden (Aufräumen der aktuellen Demo-Daten).
- Alle 150 Mandanten bekommen `zugewiesener_bearbeiter_id = Simon`.
- Alle 670 Buchhaltungen (`bearbeiter_id`) laufen auf Simon.
- Die 12 „Co-Bearbeiter"-Einträge bleiben, verwenden aber als Zweitbearbeiter **Christina Chef** (einziger anderer verfügbarer Benutzer) — damit die Co-Bearbeiter-Funktion in der Demo sichtbar bleibt.
- Rückgabe-JSON entsprechend anpassen.

### 2. Täglicher Reset (24 h)
- `pg_cron` + `pg_net` per Migration aktivieren.
- Per **Insert-Tool** (nicht Migration, da URL/Key enthalten) einen Cronjob anlegen, der täglich um **03:00 Uhr UTC** die Edge Function `demo-seed` per `net.http_post` aufruft. Die Function ist bereits idempotent (löscht `[DEMO]`-Daten + `@pewand-demo.de` User und legt alles frisch an).

### 3. Function neu deployen und einmal ausführen
Damit der aktuelle Stand sofort auf „nur Simon" umgestellt ist.

## Ergebnis
- Login-Auswahl zeigt weiterhin Sekretariat / Simon Sachbearbeiter / Christina Chef.
- Alle 670 Buchhaltungen bei Simon sichtbar.
- 12 Buchhaltungen mit Christina als Co-Bearbeiterin → Co-Bearbeiter-Feature vorführbar.
- Jede Nacht um 03:00 UTC (ca. 04:00/05:00 deutscher Zeit) setzt sich alles automatisch auf diesen Stand zurück.
