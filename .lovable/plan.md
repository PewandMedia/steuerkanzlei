## Ziel

Wenn man im Glocken-Menü auf eine Benachrichtigung klickt, wird man bereits zur richtigen Zeile geführt — aber die Ankunft fühlt sich „langweilig" an: kurzes Ring + Hintergrund, dann weg. Die Reise soll **lebendiger, klarer und freudiger** wirken, ohne kitschig zu werden.

## Was sich ändert

### 1. Sanftere, geführte Ankunft (in `src/hooks/use-focus-row.ts`)
- Beim Scroll: weiches Easing, Ziel landet **leicht oberhalb der Mitte** (besser lesbar, nicht mittig „verloren").
- Highlight bleibt **länger sichtbar** (~4 s statt 2,5 s), damit das Auge die Zeile wirklich findet.
- Statt nur „an/aus" wird ein **Pulse-Lifecycle** gesteuert: `enter` (0–300 ms) → `hold` (300–3000 ms) → `fade` (3000–4000 ms). Hook liefert eine `focusState`-Klasse pro Zeile, nicht nur einen boolean.
- Reduce-Motion-Fallback: bei `prefers-reduced-motion` wird nur ein dezentes statisches Highlight gesetzt, keine Animation.

### 2. Neue Highlight-Animation als Design-Token (in `src/index.css` + `tailwind.config.ts`)
Eine eigene Utility-Klasse `focus-row-highlight`, semantisch auf Tokens basierend (kein hardcoded Color):
- **Spotlight-Glow** links der Zeile: ein 3 px breiter, vertikaler Brand-Streifen, der von oben nach unten reinwischt (200 ms `ease-out`).
- **Sanfter Pulse** der Zeile: Hintergrund von `hsl(var(--accent)/0.0)` → `hsl(var(--accent)/0.6)` → `hsl(var(--accent)/0.25)` über 600 ms, dann hält er ruhig.
- **Ring**: weiches `ring-2 ring-primary/40` mit `ring-offset-1`, statt hart `ring-primary`.
- **Sparkle-Tick** rechts in der Zeile: ein winziges Häkchen-Icon (Lucide `Sparkles` oder `CheckCircle2`) erscheint kurz (fade+scale, 800 ms) als Bestätigung „hier bist du".
- Beim Fade-out: alles gleitet in 1 s sanft zurück auf den Standard.

Animation als Keyframes in `tailwind.config.ts` registriert (`focus-enter`, `focus-pulse`, `focus-fade`), genutzt via Klassen — keine Inline-Styles, keine Custom Colors.

### 3. Übergang aus dem Popover (in `src/components/NotificationBell.tsx`)
- Beim Klick: dezenter **Press-Effekt** auf der Notification-Zeile (scale 0.98, 120 ms), bevor `navigate` läuft. So fühlt sich der Klick „bestätigt" an.
- Popover schließt mit kleinem Delay (~80 ms), damit der Press-Effekt sichtbar bleibt.

### 4. Zeilen-Komponenten (in `src/pages/Dashboard.tsx` + `src/pages/BuchhaltungenAbschluesse.tsx`)
- Statt `bg-accent/60` direkt → die neue Klasse `focus-row-highlight` setzen, wenn `focusState !== "idle"`.
- Das kleine Bestätigungs-Icon wird als absolut positioniertes `<span>` in der **ersten Zelle** der fokussierten Zeile gerendert (nur sichtbar während `enter`/`hold`).

## Was sich NICHT ändert
- Keine Backend-/DB-Änderungen.
- Keine Änderung am Routing oder an `handleClick` in `NotificationBell` (außer Press-Delay).
- Keine neuen Farben — alles über bestehende Tokens (`--primary`, `--accent`, `--brand`).
- Andere Seiten/Komponenten bleiben unberührt.

## Technische Details

**Neue Tailwind-Keyframes (`tailwind.config.ts`):**
```text
focus-enter:  opacity 0→1, translateX(-4px)→0          (300ms ease-out)
focus-pulse:  bg-accent 0 → 0.6 → 0.25                  (600ms ease-in-out)
focus-fade:   opacity/bg → 0                            (1000ms ease-in)
spotlight:    scaleY 0→1 von top                        (250ms ease-out)
sparkle-in:   opacity 0→1, scale 0.6→1                  (400ms cubic-bezier)
sparkle-out:  opacity 1→0, scale 1→0.8                  (300ms ease-in)
```

**Hook-API neu:**
```ts
const { setRef, getFocusState } = useFocusRow();
// getFocusState(id) => "idle" | "enter" | "hold" | "fade"
```

**Zeilen-Nutzung:**
```tsx
<TableRow
  ref={setRef(b.id)}
  className={cn(
    "relative",
    getFocusState(b.id) !== "idle" && "focus-row-highlight"
  )}
>
```

## Edge Cases
- Mehrfaches Klicken auf dieselbe Benachrichtigung: Animation re-triggert sauber (handledRef wird zurückgesetzt, wenn `focusId` neu in URL erscheint).
- Reduced-Motion: nur statisches `bg-accent/40` + Ring, keine Keyframes.
- Wenn Zeile beim Mount noch nicht im DOM ist (Pagination/Filter): Polling läuft 3 s, danach abbruch — keine Geister-Animation.
