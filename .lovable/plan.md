## Ziel
OCR- und Buchhaltungs-Paket-Automatisierung komplett aus dem Produkt entfernen. TAXOM wird zur reinen **Weiterleitungs- & Organisations-App**: Belege eingehen, Status-Workflow, Kommentare. Die Seite **„Erstellte Buchhaltungen"** bleibt als Übersicht der abgeschlossenen Fälle erhalten – nur ohne PDF-Paket/ELSTER-Ansicht.

## 1. Was rausfliegt

**Komponenten (Dateien löschen):**
- `src/components/BuchhaltungsPaket.tsx`
- `src/components/BuchhaltungsPaketDialog.tsx`
- `src/components/ElsterUebergabe.tsx`
- `src/components/SteuerUebersicht.tsx`
- `src/components/SteuerberaterPruefung.tsx`
- `src/components/PdfVorschauTabs.tsx`
- `src/components/BuchungsErfassung.tsx`
- `src/components/BuchungenListe.tsx`

**Libs:**
- `src/lib/steuer-berechnung.ts`
- `src/lib/elster-validierung.ts`
- `src/lib/konten.ts`
- `src/lib/buchungen-export.ts`

**Edge Functions:**
- `supabase/functions/beleg-ocr/`
- `supabase/functions/buchhaltung-abschliessen/`

**UI-Elemente entfernen:**
- Im `NeueBuchhaltungDialog`: Abschnitt „Bearbeitungsmodus / Automatisierung nutzen".
- Im `BuchhaltungBearbeitenDialog`: alles zum `automatisierung_aktiv`-Flag.
- Im Dashboard: Filter „Modus" (Nur Weiterleitung / Automatisierung), `automatisierung_aktiv`-Referenzen, OCR-Fortschritts-Spalten.
- Im `MandantProfil`: alles rund um Buchungen erfassen, Paket, Steuer, ELSTER.
- Im `BelegeVollansicht`: OCR-Status-Anzeige.

## 2. Was bleibt

- Mandanten verwalten (unverändert)
- Buchhaltungen anlegen (ohne Automatisierungs-Schalter)
- Belege hochladen und als Dokumente sammeln
- Status-Workflow: Eingegangen → In Bearbeitung → In Prüfung → Buchhaltung erledigt → Warten auf Mandant
- Zurückweisung durch den Chef mit Grund
- Kommentare, Benachrichtigungen, Co-Bearbeiter
- Dashboard, Meine Mandanten, Statistiken (rein Status-basiert), Benutzerverwaltung
- **Seite „Erstellte Buchhaltungen"** (`/buchhaltungen`) — umgebaut zu einer schlanken Liste aller Buchhaltungen mit Status „Buchhaltung erledigt": Mandant, Monat, Bearbeiter, Fertigstellung, Belege-Anzahl, PDF-Download der Original-Belege. Kein Journal/SuSa/UStVA/Paket mehr.

## 3. Datenbank-Cleanup (Migration)

- Tabellen droppen: `buchhaltungs_abschluesse`, `buchungen`.
- Spalten aus `buchhaltungen` entfernen: `automatisierung_aktiv`.
- Spalten aus `buchhaltung_dokumente` entfernen: `ocr_status`, `ocr_result`, `ocr_error` (falls vorhanden).
- Storage-Bucket `buchhaltungen` (enthält Paket-PDFs) leeren, Bucket kann bleiben.

## 4. Statistiken-Seite

Wird auf reine Workflow-KPIs reduziert: durchschnittliche Bearbeitungszeit pro Status, Buchhaltungen pro Bearbeiter, Rückweisungsquote, monatliche Volumenkurve. Nichts mehr über Umsatz, USt, Journal.

## 5. Demo-Seed anpassen

`supabase/functions/demo-seed/index.ts` erzeugt keine `buchungen` und keine `buchhaltungs_abschluesse` mehr — nur noch Mandanten, Buchhaltungen mit Status, Belegeingänge, Kommentare, Benachrichtigungen. Anschließend einmal neu ausführen.

## 6. Technisches

- Nach dem SQL-Cleanup wird `src/integrations/supabase/types.ts` automatisch neu generiert.
- Alle `import`-Referenzen auf gelöschte Dateien werden im gleichen Zug entfernt, damit der Build durchläuft.
- Routing: `/buchhaltungen` behält Route + Sidebar-Eintrag „Erstellte Buchhaltungen", nur der Inhalt ist minimal.

## Offene Frage
Soll die Seite „Erstellte Buchhaltungen" auch für **Sekretariat** sichtbar sein? Aktuell nur für Sachbearbeiter/Chef. Wenn du nichts sagst, lasse ich es so.
