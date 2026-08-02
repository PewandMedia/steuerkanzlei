# Mobile-Ansicht: Sidebar reparieren und App bedienbar machen

## Problem

Auf dem Handy öffnet sich die Sidebar zwar als Overlay-Panel, zeigt aber nur Icons ohne Text: `AppSidebar` leitet seinen "collapsed"-Zustand aus dem Desktop-Zustand ab und ignoriert, dass mobil ein volles Panel (288 px) angezeigt wird. Da die Sidebar beim Start auf schmalen Geräten kollabiert ist, sind Menütexte, Benutzerkarte und Theme-Umschalter im mobilen Panel ausgeblendet. Zusätzlich bleibt das Panel nach dem Antippen eines Menüpunkts offen und legt sich über die Zielseite.

## Was gemacht wird

1. **Sidebar mobil korrekt darstellen**
   - Im mobilen Overlay immer die volle Ansicht zeigen (Logo + Titel, Menütexte, Benutzerkarte, Benachrichtigungen, Theme-Schalter, Abmelden).
   - Icon-Only-Modus bleibt ausschließlich für die eingeklappte Desktop-Sidebar.

2. **Bedienlogik**
   - Panel schließt automatisch beim Navigieren auf einen Menüpunkt und beim Abmelden.
   - Menüzeilen und Buttons bekommen touch-taugliche Höhen (mind. 44 px) im mobilen Panel.
   - Zugänglicher Titel für das Overlay-Panel, damit keine Screenreader-/Konsolenwarnung mehr auftritt.

3. **Header und Layout**
   - Trigger-Button bleibt mobil immer sichtbar und ausreichend groß; Logo/Wortmarke im Header auch auf kleinen Bildschirmen sinnvoll (Logo an, Text ab Bedarf).
   - Seiteninhalt bekommt mobil kleinere horizontale Innenabstände, damit nichts abgeschnitten wird oder seitlich scrollt.

4. **Restliche Seiten mobil prüfen**
   - Dashboard, Buchhaltungen, Mandanten-Profil, Statistiken und Benutzerverwaltung auf horizontales Überlaufen prüfen; breite Tabellen bekommen scrollbare Container bzw. bereits vorhandene Karten-/Kompaktdarstellung, Dialoge werden auf schmalen Displays voll nutzbar.

## Technische Details

- `src/components/AppSidebar.tsx`: `collapsed` aus `useSidebar()` mit `isMobile` kombinieren (`collapsed = state === "collapsed" && !isMobile`); `setOpenMobile(false)` bei Klick auf `NavLink` und bei `signOut`.
- `src/components/ui/sidebar.tsx`: im mobilen `SheetContent` einen visuell versteckten Titel ergänzen (keine sonstigen Änderungen an der Komponente).
- `src/components/AppLayout.tsx`: Padding/Header-Feinschliff für kleine Breakpoints.
- Seiten-Feinschliff nur in Präsentations-Klassen (Tailwind), keine Änderungen an Daten-, Auth- oder Backend-Logik.
- Prüfung der Ergebnisse per Playwright-Screenshots bei 390 px Breite.
