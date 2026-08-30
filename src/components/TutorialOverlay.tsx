import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Info,
  MousePointerClick,
  RotateCcw,
  UserRoundCog,
  X,
} from "lucide-react";
import {
  ABSCHNITTE,
  ANZAHL_ABSCHNITTE,
  SCHRITTE,
  ersterSchrittDesAbschnitts,
  schrittImAbschnitt,
  type SchrittKontext,
} from "@/lib/tutorial-schritte";
import {
  loescheLauf,
  schreibeGesehen,
  schreibeLauf,
  type TutorialLauf,
} from "@/lib/tutorial-lauf";
import { getController } from "@/lib/tutorial-bus";

interface Props {
  lauf: TutorialLauf;
  onBeenden: () => void;
}

const KARTEN_BREITE = 320;
const ABSTAND = 16;
const RAND = 12;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

const toBox = (r: DOMRect): Box => ({
  top: r.top,
  left: r.left,
  width: r.width,
  height: r.height,
  right: r.right,
  bottom: r.bottom,
});

function berechnePosition(
  hindernis: Box | null,
  kartenHoehe: number,
): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const schmal = vw < 900;
  const breite = Math.min(KARTEN_BREITE, vw - RAND * 2);

  if (schmal || !hindernis) {
    return {
      left: "50%",
      bottom: RAND,
      transform: "translateX(-50%)",
      width: breite,
    };
  }

  const clampTop = (t: number) => Math.max(RAND, Math.min(t, vh - kartenHoehe - RAND));
  const clampLeft = (l: number) => Math.max(RAND, Math.min(l, vw - breite - RAND));

  // rechts
  if (vw - hindernis.right - ABSTAND - RAND >= breite) {
    return { top: clampTop(hindernis.top), left: hindernis.right + ABSTAND, width: breite };
  }
  // links
  if (hindernis.left - ABSTAND - RAND >= breite) {
    return {
      top: clampTop(hindernis.top),
      left: hindernis.left - ABSTAND - breite,
      width: breite,
    };
  }
  // darunter
  if (vh - hindernis.bottom - ABSTAND - RAND >= kartenHoehe) {
    return { top: hindernis.bottom + ABSTAND, left: clampLeft(hindernis.left), width: breite };
  }
  // darüber
  if (hindernis.top - ABSTAND - RAND >= kartenHoehe) {
    return {
      top: hindernis.top - ABSTAND - kartenHoehe,
      left: clampLeft(hindernis.left),
      width: breite,
    };
  }
  // Notfall: schmaler an den freieren Rand
  const schmalBreite = Math.min(300, Math.max(240, vw - hindernis.right - RAND * 2));
  const rechtsFrei = vw - hindernis.right;
  const linksFrei = hindernis.left;
  if (Math.max(rechtsFrei, linksFrei) >= 240) {
    return rechtsFrei >= linksFrei
      ? { top: clampTop(hindernis.top), left: vw - schmalBreite - RAND, width: schmalBreite }
      : { top: clampTop(hindernis.top), left: RAND, width: schmalBreite };
  }
  return { left: "50%", bottom: RAND, transform: "translateX(-50%)", width: breite };
}

export function TutorialOverlay({ lauf, onBeenden }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const startIndex = useMemo(() => ersterSchrittDesAbschnitts(lauf.abschnitt), [lauf.abschnitt]);
  const abschnittStart = useRef(startIndex);
  const [index, setIndex] = useState(startIndex);
  const [, setLaufState] = useState<TutorialLauf>(lauf);
  const laufRef = useRef<TutorialLauf>(lauf);
  const [rect, setRect] = useState<Box | null>(null);
  const [dialogBox, setDialogBox] = useState<Box | null>(null);
  const [zielFehlt, setZielFehlt] = useState(false);
  const karteRef = useRef<HTMLDivElement | null>(null);
  const [kartenHoehe, setKartenHoehe] = useState(260);

  const schritt = SCHRITTE[index];
  const istKarte = !!schritt?.uebergabeZu || !!schritt?.abschluss || !!schritt?.intro;

  const merke = useCallback((patch: Partial<TutorialLauf>): TutorialLauf => {
    const neu = schreibeLauf({ ...laufRef.current, ...patch });
    laufRef.current = neu;
    setLaufState(neu);
    return neu;
  }, []);

  const kontext: SchrittKontext = useMemo(
    () => ({
      get lauf() {
        return laufRef.current;
      },
      merke,
    }),
    [merke],
  );

  // ── Laufzustand ───────────────────────────────────────────
  useEffect(() => {
    const s = SCHRITTE[index];
    if (!s) return;
    if (s.uebergabeZu) {
      merke({ abschnitt: s.abschnitt + 1, erwarteteRolle: s.uebergabeZu });
    } else if (!s.abschluss) {
      merke({ abschnitt: s.abschnitt, erwarteteRolle: s.rolle });
    }
  }, [index, merke]);

  // ── Navigation zur passenden Seite ────────────────────────
  useEffect(() => {
    const s = SCHRITTE[index];
    if (s?.route && location.pathname !== s.route) navigate(s.route);
  }, [index, location.pathname, navigate]);

  // ── Erkennung des angelegten Datensatzes ──────────────────
  const [erkanntGeprueft, setErkanntGeprueft] = useState(false);
  useEffect(() => {
    const s = SCHRITTE[index];
    setErkanntGeprueft(false);
    if (!s?.erkennen) return;
    let abgebrochen = false;
    void (async () => {
      try {
        await s.erkennen!(kontext);
      } catch {
        /* nie hängenbleiben */
      }
      if (!abgebrochen) {
        setErkanntGeprueft(true);
        const dash = getController("dashboard");
        if (dash) {
          await dash.aktualisieren().catch(() => undefined);
          if (laufRef.current.buchhaltungId) dash.fokus(laufRef.current.buchhaltungId);
        }
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [index, kontext]);

  // Erkennungsschritt automatisch überspringen, wenn eindeutig erkannt.
  useEffect(() => {
    const s = SCHRITTE[index];
    if (s?.zeilenwahl && erkanntGeprueft && laufRef.current.buchhaltungId) {
      setIndex((i) => Math.min(i + 1, SCHRITTE.length - 1));
    }
  }, [index, erkanntGeprueft]);

  // Zeilenwahl per Klick des Nutzers
  useEffect(() => {
    const s = SCHRITTE[index];
    if (!s?.zeilenwahl) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("[data-buchhaltung-id]");
      const id = el?.getAttribute("data-buchhaltung-id");
      if (!id) return;
      merke({ buchhaltungId: id });
      setIndex((i) => Math.min(i + 1, SCHRITTE.length - 1));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [index, merke]);

  // ── Position von Ziel und offenem Dialog messen ───────────
  useEffect(() => {
    const s = SCHRITTE[index];
    const selector = s?.ziel?.(laufRef.current) ?? null;
    let gescrollt = false;
    let seit = Date.now();
    const messen = () => {
      const dialog = document.querySelector(
        '[role="dialog"]:not([data-tutorial-karte])',
      ) as HTMLElement | null;
      setDialogBox(dialog ? toBox(dialog.getBoundingClientRect()) : null);

      if (!selector) {
        setRect(null);
        setZielFehlt(false);
        return;
      }
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        setZielFehlt(Date.now() - seit > 1200);
        return;
      }
      seit = Date.now();
      setZielFehlt(false);
      if (!gescrollt) {
        gescrollt = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setRect(toBox(el.getBoundingClientRect()));
    };
    messen();
    const iv = window.setInterval(messen, 250);
    window.addEventListener("resize", messen);
    window.addEventListener("scroll", messen, true);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("resize", messen);
      window.removeEventListener("scroll", messen, true);
    };
  }, [index]);

  useLayoutEffect(() => {
    const h = karteRef.current?.offsetHeight;
    if (h && Math.abs(h - kartenHoehe) > 8) setKartenHoehe(h);
  });

  // ── Steuerung ─────────────────────────────────────────────
  const weiter = useCallback(() => {
    const s = SCHRITTE[index];
    if (!s) return;
    if (s.abschluss) {
      loescheLauf();
      schreibeGesehen();
      onBeenden();
      return;
    }
    setIndex((i) => Math.min(i + 1, SCHRITTE.length - 1));
  }, [index, onBeenden]);

  const zurueck = useCallback(() => {
    setIndex((i) => Math.max(abschnittStart.current, i - 1));
  }, []);

  const neustart = useCallback(() => {
    loescheLauf();
    onBeenden();
  }, [onBeenden]);

  const beenden = useCallback(() => {
    schreibeGesehen();
    onBeenden();
  }, [onBeenden]);

  const uebergabeBestaetigen = useCallback(() => {
    const s = SCHRITTE[index];
    if (s?.uebergabeZu) merke({ abschnitt: s.abschnitt + 1, erwarteteRolle: s.uebergabeZu });
    schreibeGesehen();
    onBeenden();
  }, [index, merke, onBeenden]);

  // ── Tastatursteuerung ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        beenden();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        weiter();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        zurueck();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [beenden, weiter, zurueck]);

  if (!schritt) return null;

  const [nr, gesamtImAbschnitt] = schrittImAbschnitt(index);
  const fortschritt = Math.round((nr / gesamtImAbschnitt) * 100);
  const abschnittInfo = ABSCHNITTE[schritt.abschnitt - 1];

  const kopfZeile = (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-brand">
      Teil {schritt.abschnitt} von {ANZAHL_ABSCHNITTE} · {schritt.rolle}
    </p>
  );

  const steuerung = (
    <div className="flex items-center gap-2 pt-3">
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        onClick={zurueck}
        disabled={index <= abschnittStart.current}
      >
        <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
      </Button>
      <Button size="sm" className="h-8 ml-auto" onClick={weiter}>
        Weiter
        <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );

  // ── Einstiegs-, Übergabe- und Abschlusskarte ──────────────
  if (istKarte) {
    return createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        role="dialog"
        data-tutorial-karte
        aria-modal="true"
        aria-label={schritt.titel}
      >
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-brand/15 p-2 text-brand">
              {schritt.abschluss ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : schritt.intro ? (
                <Info className="h-5 w-5" />
              ) : (
                <UserRoundCog className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {schritt.abschluss
                  ? "Fertig"
                  : schritt.intro
                    ? `Teil ${schritt.abschnitt} von ${ANZAHL_ABSCHNITTE}`
                    : "Rollenwechsel"}
              </p>
              <h3 className="text-lg font-semibold text-foreground leading-tight">
                {schritt.titel}
              </h3>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{schritt.text}</p>
          {schritt.intro && (
            <p className="text-xs text-muted-foreground mt-2">
              {gesamtImAbschnitt - 1} Schritte in diesem Teil.
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-6">
            {schritt.abschluss ? (
              <>
                <Button
                  onClick={() => {
                    loescheLauf();
                    schreibeGesehen();
                    onBeenden();
                  }}
                >
                  Tutorial abschließen
                </Button>
                <Button variant="outline" onClick={neustart}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Von vorn beginnen
                </Button>
              </>
            ) : schritt.intro ? (
              <>
                <Button onClick={weiter}>
                  Los geht’s <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
                <Button variant="ghost" onClick={beenden}>
                  Später
                </Button>
              </>
            ) : (
              <>
                <Button onClick={uebergabeBestaetigen}>Verstanden — jetzt ummelden</Button>
                <Button variant="ghost" onClick={zurueck}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
                </Button>
              </>
            )}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ── Spotlight ─────────────────────────────────────────────
  const pad = 8;
  const hindernis: Box | null = dialogBox ?? rect;
  const kartenStil = berechnePosition(hindernis, kartenHoehe);

  const wartetAufZeile = !!schritt.zeilenwahl;

  return createPortal(
    <div className="fixed inset-0 z-[100] pointer-events-none" aria-live="polite">
      {rect && (
        <div
          className="absolute rounded-lg ring-2 ring-brand transition-all duration-200 pointer-events-none"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(2,6,23,0.45)",
          }}
        />
      )}

      <div
        ref={karteRef}
        data-tutorial-karte
        className="fixed pointer-events-auto rounded-xl border border-border bg-card p-4 shadow-2xl max-[900px]:!left-3 max-[900px]:!right-3 max-[900px]:!top-auto max-[900px]:!bottom-3 max-[900px]:!w-auto max-[900px]:!transform-none"
        style={kartenStil}
        role="region"
        aria-label={schritt.titel}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {kopfZeile}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Schritt {nr} von {gesamtImAbschnitt}
              {abschnittInfo ? ` · ${abschnittInfo.titel}` : ""}
            </p>
            <h3 className="text-base font-semibold text-foreground mt-1">{schritt.titel}</h3>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 -mr-1 -mt-1"
            onClick={beenden}
            aria-label="Tutorial schließen"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{schritt.text}</p>

        {wartetAufZeile && (
          <div className="mt-3 rounded-md border border-brand/40 bg-brand/10 p-2.5">
            <p className="text-xs font-semibold text-brand flex items-center gap-1.5">
              <MousePointerClick className="h-3.5 w-3.5" />
              Jetzt klicken: die Zeile, die Sie gerade angelegt haben
            </p>
          </div>
        )}

        {!wartetAufZeile && schritt.aufforderung && !zielFehlt && (
          <div className="mt-3 rounded-md border border-brand/40 bg-brand/10 p-2.5">
            <p className="text-sm font-semibold text-brand flex items-center gap-1.5">
              <MousePointerClick className="h-4 w-4 shrink-0" />
              {schritt.aufforderung}
            </p>
          </div>
        )}

        {!zielFehlt && schritt.beispiele && (
          <div className="mt-2.5 rounded-md border border-border bg-muted/40 p-2.5">
            <ul className="space-y-0.5">
              {schritt.beispiele.map((b) => (
                <li key={b.label} className="text-xs text-foreground">
                  <span className="text-muted-foreground">{b.label}:</span> {b.wert}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Eigene Werte gehen genauso.
            </p>
          </div>
        )}

        {zielFehlt && (
          <div className="mt-3 rounded-md border border-border bg-muted/50 p-2.5">
            <p className="text-xs text-foreground">
              Dieser Schritt ist noch nicht ausgeführt.{" "}
              {schritt.fehlendHinweis ?? "Bitte führen Sie zuerst den vorigen Schritt aus."}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs mt-2"
              onClick={zurueck}
              disabled={index <= abschnittStart.current}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Zurück zum vorigen Schritt
            </Button>
          </div>
        )}

        <div className="mt-3 h-1 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-brand transition-all" style={{ width: `${fortschritt}%` }} />
        </div>
        {steuerung}
      </div>
    </div>,
    document.body,
  );
}
