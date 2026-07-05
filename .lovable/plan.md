## Ziel
Die App als offene Demo bereitstellen. Besucher öffnen den Link, wählen auf der Login-Seite eine von drei Rollen (Sekretariat, Sachbearbeiter, Chef) und sind sofort mit realistischen Beispiel-Daten drin.

## 1. Login-Seite: 3-Rollen-Auswahl
- `src/pages/Login.tsx` umbauen: statt E-Mail/Passwort-Formular drei große Karten:
  - **Sekretariat** – „Mandanten kontaktieren, Fristen im Blick"
  - **Sachbearbeiter** – „Buchhaltungen erfassen und bearbeiten"
  - **Chef** – „Prüfen, freigeben, Kanzlei-Übersicht"
- Klick → automatischer Login als vordefinierter Demo-User über `supabase.auth.signInWithPassword`.
- Kleiner Demo-Hinweis: „Live-Demo – Daten werden regelmäßig zurückgesetzt".
- Rechte TAXOM-Brand-Seite bleibt, Wording auf „Demo-Zugang" angepasst.

## 2. Drei Demo-User anlegen
- `demo-sekretariat@taxom-demo.de` (Rolle Sekretariat)
- `demo-sachbearbeiter@taxom-demo.de` (Rolle Sachbearbeiter)
- `demo-chef@taxom-demo.de` (Rolle Chef)
- Gemeinsames festes Passwort, im Frontend hinterlegt (nur Demo-Konten).
- E-Mails auto-confirmed. Signup bleibt deaktiviert.

## 3. Seed-Daten
Realistische Stammdaten einspielen:
- 6–8 **Mandanten** verschiedener Rechtsformen (GmbH, Einzelunternehmen, Freiberufler) mit Kontaktdaten und Zuweisung an Demo-Sachbearbeiter.
- **Buchhaltungen** über mehrere Monate mit gemischtem Status:
  - abgeschlossene (inkl. `buchhaltungs_abschluesse`)
  - „In Bearbeitung"
  - „In Prüfung" (für Chef sichtbar)
  - „Warten auf Mandant" (für Sekretariat sichtbar)
  - eine kürzlich „Zurückgewiesene"
- **Belegeingänge** und einige **Buchungen** pro laufender Buchhaltung.
- Ein paar **Benachrichtigungen** und **Kommentare** für Realismus.

## 4. Demo-Kennzeichnung
- Dezentes „DEMO"-Badge im Header/Sidebar.
- Login-Fußzeile mit Kontakt-Hinweis „Interessiert an dieser Lösung? …".

## Sicherheit
- Signup deaktiviert – nur die drei Demo-Konten existieren.
- Bestehende RLS bleibt unverändert (baut auf `auth.uid()` + `benutzer.user_id`).
- Alle Besucher teilen sich denselben Datensatz – gewollt für offene Verkaufs-Demo.

## Technische Details
- Auth = Supabase Email/Password (kein anonymer Zugang), damit die vorhandene RLS-Struktur unverändert bleibt.
- Auto-Login-Credentials liegen im Frontend – akzeptabel, da reine Demo-Daten.
- User-Anlage via bestehender `benutzer-verwalten` Edge Function oder einmalig manuell; Trigger `handle_new_user` erzeugt `benutzer`-Zeile + Default-Rolle, danach Rolle für Sekretariat/Chef korrigieren.
- Seed-Daten als einmaliges SQL-Insert-Skript.

## Offene Frage
- Welche Kontakt-Info (E-Mail / Telefon / Link) soll auf der Login-Seite als „Jetzt anfragen"-Hinweis stehen? Wenn du nichts angibst, nehme ich einen Platzhalter `kontakt@taxom.de`.
