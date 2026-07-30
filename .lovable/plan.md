## Ziel
Das Logo von https://pewandmedia.de/assets/logo.png ersetzt überall die aktuellen "PM"-Textkacheln und wird zum Favicon.

## Umsetzung

1. **Logo laden**
   - Datei herunterladen (PNG, ~250 KB), als `src/assets/logo.png` ablegen und über das Asset-CDN einbinden.
   - Zusätzlich als `public/favicon.png` speichern.

2. **Favicon**
   - `index.html`: `<link rel="icon" href="/favicon.png" type="image/png">` auf die neue Datei zeigen lassen (Cache-Buster `?v=3`), altes Favicon entfernen.

3. **Logo im UI ersetzen** (überall wo aktuell die "PM"-Box steht)
   - `src/components/AppSidebar.tsx` — Header (offen + eingeklappt)
   - `src/components/AppLayout.tsx` — Top-Header
   - `src/pages/Login.tsx` — Branding links + mobile Kopfzeile
   - `src/pages/Impressum.tsx` — Branding links + mobile Kopfzeile
   - Jeweils `<img>` mit `alt="Pewand Media"`, passender Größe und beibehaltenem Schriftzug "PEWAND MEDIA".

## Technisches
- Bild-Datei per `lovable-assets` ins CDN, `.asset.json`-Pointer im Repo; Favicon bleibt echte Datei unter `public/`.
- Auf dunklem Branding-Hintergrund (Login/Impressum) wird das Logo geprüft; falls es dort schlecht sichtbar ist, bekommt es einen hellen abgerundeten Container.
