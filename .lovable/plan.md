# Impressum erstellen

## Ziel
Eine öffentliche, SEO-freundliche Impressum-Seite unter `/impressum` hinzufügen, die das bestehende Design-System verwendet und die vorgegebenen rechtlichen Angaben exakt wiedergibt.

## Umsetzung

1. **Neue Route in `src/App.tsx` registrieren**
   - Route `/impressum` ohne Auth-Guard (öffentlich zugänglich).
   - Sitzt als eigenständige öffentliche Seite neben `/login`.

2. **Neue Seite `src/pages/Impressum.tsx` erstellen**
   - Layout analog zur Login-Seite: zweigeteilte Ansicht auf Desktop (`lg:grid-cols-2`), zentrale Karte auf Mobile.
   - Linke Seite mit Branding (PM-Logo, „PEWAND MEDIA", kurzer Claim).
   - Rechte Seite mit dem Impressum-Inhalt als strukturierte Sektionen:
     - Diensteanbieter (Name, Inhaber, Adresse, Deutschland)
     - Kontakt (Telefon, E-Mail)
     - Rechtliche Hinweise (Rechtsform, USt-IdNr.)
     - Verantwortlich für den Inhalt (§ 55 RStV)
     - Haftung für Inhalte
     - Haftung für Links
     - Urheberrecht
     - EU-Streitschlichtung
   - Verwendung der exakten Texte des Benutzers, ohne inhaltliche Änderungen.
   - `usePageMeta` für Titel und Beschreibung setzen.

3. **Login-Seite um Impressum-Link ergänzen**
   - In der Fußzeile des rechten Bereichs oder unter dem Kontakt-Block einen Link „Impressum" hinzufügen, der auf `/impressum` verweist.

## Design-Details
- Farben ausschließlich über CSS-Variablen (`bg-brand`, `text-foreground`, `border`, etc.), keine hartcodierten Hex-Werte.
- Karte mit `card-elevated` (weiß/heller Hintergrund, abgerundete Ecken, Schatten).
- Überschriften mit `text-2xl font-semibold tracking-tight`.
- Sektionsüberschriften mit `section-label`.
- Links zu Telefon und E-Mail als `tel:` bzw. `mailto:`.
- Link zur ODR-Plattform als externer Link mit `target="_blank" rel="noopener noreferrer"`.

## Technische Details
- Route-Definition: `<Route path="/impressum" element={<LoginGuard><Impressum /></LoginGuard>} />` oder einfach ohne Guard, damit sowohl Gäste als auch eingeloggte Nutzer die Seite sehen können.
- Kein Backend- oder Datenbank-Change nötig.
- Keine neuen Abhängigkeiten.
