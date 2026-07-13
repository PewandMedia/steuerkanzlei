# E-Mail auf Startseite korrigieren

## Ziel
Die Kontakt-E-Mail auf der Login-/Startseite von `kontakt@pewand-media.de` auf `info@pewandmedia.de` ändern.

## Umsetzung
1. In `src/pages/Login.tsx` den Text im Kontakt-Block anpassen:
   - Link-Ziel: `mailto:info@pewandmedia.de`
   - Angezeigter Text: `info@pewandmedia.de`
2. Keine weiteren Dateien betroffen, kein Backend-Change nötig.
