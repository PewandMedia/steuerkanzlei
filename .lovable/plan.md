## Ziel
Die Vite-Dev-Server-Fehlermeldung "Blocked request. This host (\"steuerkanzlei.pewandmedia.de\") is not allowed." beseitigen, damit die Vorschau/Seite über diese Domain erreichbar ist.

## Aktueller Zustand
In `vite.config.ts` sind bereits erlaubt:
- `backoffice.pewand-media.de`
- `.backoffice.pewand-media.de`
- `.lovable.app`
- `.lovable.dev`

`steuerkanzlei.pewandmedia.de` fehlt in `server.allowedHosts`.

## Änderung
`vite.config.ts` erweitern: `steuerkanzlei.pewandmedia.de` zur `server.allowedHosts`-Liste hinzufügen. Optional auch die Wildcard `.pewandmedia.de`, falls weitere Subdomains später genutzt werden sollen.

## Validierung
- Build/Typecheck durchlaufen lassen.
- Dev-Server neu starten (HMR-Flush bzw. Kill-ReSpawn), damit Vite die neue Konfiguration lädt.
- Seite über `https://steuerkanzlei.pewandmedia.de` aufrufen und prüfen, ob die "Blocked request"-Meldung verschwindet.