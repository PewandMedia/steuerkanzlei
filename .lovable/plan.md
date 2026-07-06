# Rebranding: Taxom → Pewand Media

Das Backoffice wird komplett von "Taxom" (Steuerkanzlei) auf **Pewand Media** (Backoffice für eine Fahrschule) umgestellt. Alle sichtbaren Taxom-Erwähnungen, das Logo-Kürzel "TX" und die Steuerberater-Sprache verschwinden.

## Was auf der Login-Seite geändert wird

- Titel „TAXOM Backoffice testen" → „Pewand Media – Fahrschul-Backoffice testen"
- Überschrift „Testen Sie das TAXOM Backoffice" → „Testen Sie das Pewand Media Backoffice"
- Beschreibung: „Digitale Kanzlei-Software für Steuerberater" → „Digitales Backoffice für Fahrschulen"
- Footer: „© 2026 TAXOM · Kanzlei-Software" → „© 2026 Pewand Media · Fahrschul-Software"
- Kontakt-Mail `kontakt@taxom.de` → `kontakt@pewand-media.de`
- Demo-E-Mails (`demo-*@taxom-demo.de`) bleiben technisch bestehen (sind in der Datenbank hinterlegt), werden aber optisch nicht mehr angezeigt — die Rollen-Karten zeigen nur Titel/Beschreibung.
- Logo-Kürzel „TX" → „PM"
- Feature-Text „Rollenbasierte Workflows – Sekretariat, Buchhaltung, Chef" bleibt strukturell, wird aber sprachlich neutral gehalten.

## Was in Layout & Sidebar geändert wird

- `AppLayout` Header: Kürzel „TX" → „PM", Wortmarke „TAXOM" → „PEWAND MEDIA"
- `AppSidebar` Header: „TX" → „PM", „TAXOM" → „PEWAND MEDIA"

## Was global geändert wird

- `index.html`: `<title>` und `<meta description>`, `og:title`, `og:description`, `author` → Pewand Media / Fahrschul-Backoffice
- `README.md`: Titel und Beschreibung neu
- `usePageMeta`-Hook: Suffix „· Taxom Backoffice" → „· Pewand Media"

## Was NICHT geändert wird

- Datenbank-Tabellen, Spalten, Rollen-Namen (Sekretariat/Sachbearbeiter/Chef) — nur die Anzeige-Texte werden angepasst, keine Schema-Migrationen.
- Demo-Login-E-Mails im Backend (sonst funktioniert der Demo-Login nicht mehr).
- Geschäftslogik rund um Buchhaltungen bleibt bestehen — nur Wording wird generalisiert, wo Taxom/Kanzlei/Steuerberater explizit vorkommt.

## Offene Frage

Sollen die fachlichen Begriffe **„Buchhaltung", „Mandant", „Belege"** ebenfalls auf Fahrschul-Sprache (z. B. „Kurs", „Fahrschüler", „Unterlagen") umbenannt werden — oder nur das Branding (Name/Logo/Meta) tauschen und die Fachbegriffe erst in einem späteren Schritt anpassen?
