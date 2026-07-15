## Problem
Der `demo-seed` löscht und erstellt bei jedem Reset die Auth-User neu → neue UUIDs. Wer davor eingeloggt war, hat eine Session mit einer User-ID, die es nicht mehr gibt. Alle Requests laufen zwar durch (Status 200), aber `benutzer`/`user_roles` liefern `[]`, und RLS blockt danach Mandanten & Buchhaltungen.

## Lösung (zwei Teile)

### 1. Stale-Session automatisch abfangen (Frontend)
In `src/pages/Login.tsx` beim Mount:
- `supabase.auth.getSession()` prüfen
- Falls Session existiert, gegen `benutzer` mit `user_id` prüfen
- Wenn kein Treffer → `supabase.auth.signOut()` und auf Login-Auswahl bleiben

Zusätzlich in `src/App.tsx` (oder wo Auth-Guard sitzt): wenn eingeloggter User keinen `benutzer`-Datensatz hat, automatisch ausloggen und nach `/` redirecten. Damit sind alle Bestandsnutzer nach einem nächtlichen Reset sofort sauber.

### 2. Demo-Seed stabil machen (Edge Function)
`supabase/functions/demo-seed/index.ts` so umbauen, dass Auth-User **nicht** neu angelegt werden, wenn sie schon existieren:
- Für die 3 fixen Demo-Mails: erst per `admin.listUsers` / `getUserByEmail` prüfen
- Falls vorhanden → wiederverwenden (ID behalten), nur Passwort/Meta refreshen
- Falls nicht vorhanden → einmal anlegen
- Nur `mandanten`, `buchhaltungen`, `belegeingaenge`, `buchhaltung_co_bearbeiter`, `benachrichtigungen`, `kommentare` werden geleert und neu befüllt
- `benutzer` + `user_roles` für die 3 Demo-User idempotent upserten

So bleiben die User-IDs über Resets hinweg stabil → offene Browser-Sessions funktionieren nach 03:00 UTC weiter.

### 3. Sofortmaßnahme
Damit du jetzt sofort wieder reinkommst: einmal ausloggen (oder Inkognito-Fenster) und über die Rollen-Karten neu einloggen. Ab dann greift Teil 1+2.

## Betroffene Dateien
- `src/pages/Login.tsx` — Stale-Session-Check on mount
- `src/App.tsx` bzw. Auth-Wrapper — Guard bei fehlendem `benutzer`
- `supabase/functions/demo-seed/index.ts` — idempotenter Umgang mit Auth-Usern
