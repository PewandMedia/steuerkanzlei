# Plan: Branding korrigieren — Pewand Media bleibt, Branche zurück zu Steuerberater

Das vorherige Rebranding hat versehentlich nicht nur das Branding (Taxom → Pewand Media), sondern auch die Branchensprache auf „Fahrschule“ geändert. Dieser Plan stellt die Steuerberater-/Kanzlei-Sprache wieder her und entfernt die restlichen versteckten Taxom-Referenzen.

## Ziel
- User-facing Texte sagen wieder „Steuerberater / Kanzlei“ statt „Fahrschule“.
- Der Firmenname bleibt überall **Pewand Media** (kein Taxom mehr).
- Funktionale Demo-Logins bleiben intakt.

## Änderungen

### 1. User-facing Texte zurücksetzen

| Datei | Was geändert wird |
|-------|-------------------|
| `index.html` | `<title>`: „Fahrschul-Backoffice“ → „Kanzlei-Backoffice“; `description`/`og:description`: „für Fahrschulen“ → „für Steuerberater“ |
| `README.md` | Beschreibung von „Internes Backoffice für Fahrschulen“ → „Internes Backoffice für Steuerberater: Organisation, Weiterleitung und Verwaltung von Mandanten, Belegen und Fristen.“ |
| `src/pages/Login.tsx` | Meta-Titel/Description, Hero-Text, Footer ("Fahrschul-Software" → "Kanzlei-Software"), Kontakt-CTA ("für Ihre Fahrschule" → "für Ihre Kanzlei") |

Dabei bleiben der Firmenname „Pewand Media“, das Logo-Kürzel „PM“ und die Demo-Rollen-Karten unverändert.

### 2. Versteckte Taxom-Referenzen entfernen

| Datei | Was geändert wird |
|-------|-------------------|
| `src/hooks/use-theme.tsx` | `localStorage`-Key `taxom:theme` → `pewand:theme` |
| `src/components/StatusTransitionWithFortschritt.tsx` | Kommentar „TAXOM verwaltet jetzt …“ → neutral „Pewand Media verwaltet jetzt …“ |
| `src/pages/Login.tsx` | `DEMO_PASSWORD = "demo-taxom-2026!"` → `demo-pewand-2026!` |

### 3. Backend-Demo-Seed anpassen und neu ausführen

`supabase/functions/demo-seed/index.ts`:
- `DEMO_PASSWORD` an neues Frontend-Passwort anpassen.
- Demo-E-Mail-Domain `taxom-demo.de` → `pewand-demo.de` (z. B. `demo-sekretariat@pewand-demo.de`).
- Vor dem Anlegen neuer Demo-User die alten `taxom-demo.de`-User löschen, damit keine Taxom-Reste in der Datenbank verbleiben.
- Edge Function neu deployen und Seed ausführen.

## Was NICHT geändert wird

- Fachbegriffe wie „Mandant“, „Buchhaltung“, „Belege“, „Sekretariat“, „Sachbearbeiter“, „Chef“ — diese gehören zum Steuerberater-Workflow und bleiben.
- UI-Struktur, Dashboard, Sidebar, Funktionalität.

## Risiken / Hinweise

- Das Löschen der alten Demo-User entfernt auch deren Kommentar-/Benachrichtigungs-History. Diese werden aber durch den Seed ohnehin neu erzeugt.
- Der `localStorage`-Key-Wechsel setzt das Theme für bestehende Browser einmal auf System-Default zurück (da der alte Key nicht mehr gelesen wird).

## Abschluss

Nach dem Plan ist das Projekt wieder ein Steuerberater-Backoffice mit Pewand Media als Markenname und ohne sichtbare oder versteckte Taxom-Referenzen.