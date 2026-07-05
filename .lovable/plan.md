## Ziel
Auf dem Dashboard einen **„Neue Buchhaltung"**-Button einbauen, damit Buchhaltungen direkt von dort angelegt werden können (bisher nur über die Mandanten-Seite möglich).

## Änderungen in `src/pages/Dashboard.tsx`

1. **Mandantenliste immer laden** (statt nur für Sekretariat), damit der Dialog für alle Rollen mit Anlege-Recht (Sekretariat, Sachbearbeiter, Chef) funktioniert.
2. **Button oben rechts im Page-Header** (`flex ... justify-between`) neben Titel:
   - Primary Button mit `Plus`-Icon: „Neue Buchhaltung"
   - Rendert `<NeueBuchhaltungDialog mandanten={mandanten} onCreated={fetchData} />` — der Dialog bringt seinen eigenen Trigger und State mit.
3. **Rollen-Check**: Button nur anzeigen für Sekretariat / Sachbearbeiter / Chef (alle drei aktuell existierenden Rollen dürfen anlegen — kein Ausschluss nötig).

## Kein Backend-Change
Der bestehende `NeueBuchhaltungDialog` erledigt bereits das Einfügen inkl. Belegeingang, Bearbeiter-Zuweisung usw. Es wird kein neuer Code, keine Migration und kein Edge-Function-Aufruf gebraucht.
