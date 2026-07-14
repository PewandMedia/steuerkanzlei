## Ziel
Alle bisherigen Demo-Daten löschen und ein realistisches, größeres Demo-Set aufbauen.

## Neue Daten
- **10 Sachbearbeiter** (zusätzlich zu den bestehenden Rollen-Demo-Usern Sekretariat / Sachbearbeiter / Chef). Namen z.B. „Sachbearbeiter Anna M.", „Sachbearbeiter Ben K." usw. Kein Login nötig — nur `benutzer`-Einträge + `user_roles = Sachbearbeiter` mit Auth-Usern `sb01@pewand-demo.de` … `sb10@pewand-demo.de` (Passwort = Demo-Passwort, damit man sich auch als sie einloggen könnte).
- **150 Mandanten**, realistisch gemischt (GmbH, UG, Einzelunternehmen, Freiberufler, GmbH & Co. KG). Jeder Mandant bekommt genau **einen** fest zugewiesenen Sachbearbeiter (`zugewiesener_bearbeiter_id`), gleichmäßig auf die 10 Sachbearbeiter verteilt (~15 Mandanten pro Sachbearbeiter).
- **Buchhaltungen — insgesamt 670**, verteilt sinnvoll über die Mandanten und Monate:
  - **550 „Buchhaltung erledigt"** — verteilt über vergangene Monate (2024–Anfang 2026), mit `fertiggestellt_datum` gesetzt.
  - **20 „überzogen / dringend"** — Status `In Bearbeitung` oder `Warten auf Mandant`, `faellig_am` liegt in der Vergangenheit (`faellig_am_manuell = true`, um Trigger zu umgehen). Diese erscheinen im Dashboard als überfällig/dringend.
  - **100 „noch offen, aber Zeit"** — Status `Eingegangen` / `In Bearbeitung` / `In Prüfung`, `faellig_am` in der Zukunft.
- **Co-Bearbeiter**: bei **12** Buchhaltungen wird ein zweiter Sachbearbeiter über `buchhaltung_co_bearbeiter` als Vertretung eingetragen, gemischt über erledigte und offene, damit die Zusammenarbeit-Funktion sichtbar ist.
- Zu jeder Buchhaltung 1–2 `belegeingaenge`-Einträge, damit die Belege-Historie plausibel aussieht. Bei „In Prüfung" ein kurzer `kommentare`-Eintrag vom bearbeitenden Sachbearbeiter.

## Umsetzung
Alles läuft über die bestehende Edge Function `supabase/functions/demo-seed/index.ts` — sie wird umgeschrieben und erneut aufgerufen. Sie ist idempotent (löscht erst alle Datensätze mit `[DEMO]`-Markierung + alle `@pewand-demo.de`-User und legt dann neu an).

Ablauf in der Function:
1. **Cleanup**: alle Mandanten mit `notizen ILIKE '[DEMO]%'` inkl. abhängiger `buchhaltungen`, `belegeingaenge`, `buchhaltung_co_bearbeiter`, `kommentare`, `benachrichtigungen` löschen. Alte `@pewand-demo.de` Sachbearbeiter-Auth-User (`sb01…sb10`) entfernen.
2. **Rollen-User** (Sekretariat, Sachbearbeiter-Rolle-Demo, Chef) wie bisher sicherstellen.
3. **10 Sachbearbeiter** anlegen (Auth-User + `benutzer` + `user_roles`).
4. **150 Mandanten** generieren aus Namens-/Orts-/Rechtsform-Pools, jeder mit einem der 10 Sachbearbeiter als `zugewiesener_bearbeiter_id`, `notizen` beginnt mit `[DEMO]`.
5. **Buchhaltungen batchweise** einfügen (Insert-Arrays à ~500 Zeilen, damit die Function schnell bleibt): 550 erledigt + 20 überzogen + 100 offen. `bearbeiter_id` = Sachbearbeiter des Mandanten. Monat, Fälligkeit, Fertigstellungsdatum, Status konsistent.
6. **Belegeingänge** und wenige **Kommentare / Co-Bearbeiter** in Folgeinserts.
7. Antwort mit Zählern zurück.

Nach dem Rewrite rufe ich die Function einmal auf und prüfe per DB-Query, dass die Zahlen stimmen (150 Mandanten, 550/20/100 Buchhaltungen, ~12 Co-Bearbeiter).

## Nicht Teil des Plans
- Änderungen am UI, Rollen-Login-Auswahl oder Workflow-Logik. Nur Daten.
