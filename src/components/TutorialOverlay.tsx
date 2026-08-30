import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  UserRoundCog,
  X,
} from "lucide-react";
import {
  SCHRITTE,
  ersterSchrittDesAbschnitts,
  type SchrittKontext,
} from "@/lib/tutorial-schritte";
import {
  loescheLauf,
  schreibeGesehen,
  schreibeLauf,
  type TutorialLauf,
} from "@/lib/tutorial-lauf";

interface Props {
  lauf: TutorialLauf;
  onBeenden: () => void;
}

const TEMPI = [
  { wert: 0.6, label: "Langsam" },
  { wert: 1, label: "Normal" },
  { wert: 1.8, label: "Schnell" },
];

export function TutorialOverlay({ lauf, onBeenden }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const startIndex = useMemo(() => ersterSchrittDesAbschnitts(lauf.abschnitt), [lauf.abschnitt]);
  const abschnittStart = useRef(startIndex);
  const [index, setIndex] = useState(startIndex);
  const [laufState, setLaufState] = useState<TutorialLauf>(lauf);
  const laufRef = useRef<TutorialLauf>(lauf);
  const [spielt, setSpielt] = useState(true);
  const [tempo, setTempo] = useState(1);
  const tempoRef = useRef(1);
  tempoRef.current = tempo;
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const beschaeftigtRef = useRef(false);
  const ausgefuehrt = useRef<Set<string>>(new Set());

  const schritt = SCHRITTE[index];
  const istKarte = !!schritt?.uebergabeZu || !!schritt?.abschluss;

  // ── Laufzustand ───────────────────────────────────────────
  const merke = useCallback((patch: Partial<TutorialLauf>): TutorialLauf => {
    const neu = schreibeLauf({ ...laufRef.current, ...patch });
    laufRef.current = neu;
    setLaufState(neu);
    return neu;
  }, []);

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

  // ── Spotlight-Position laufend messen ─────────────────────
  useEffect(() => {
    const s = SCHRITTE[index];
    const selector = s?.ziel?.(laufRef.current) ?? null;
    if (!selector) {
      setRect(null);
      return;
    }
    let gescrollt = false;
    const messen = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      if (!gescrollt) {
        gescrollt = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setRect(el.getBoundingClientRect());
    };
    messen();
    const iv = window.setInterval(messen, 250);
    window.addEventListener("resize", messen);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("resize", messen);
    };
  }, [index, laufState.buchhaltungId]);

  // ── Hilfsfunktionen für Schritt-Aktionen ──────────────────
  const warte = useCallback(
    (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms / tempoRef.current))),
    [],
  );

  const warteAufElement = useCallback(
    async (selector: string, timeoutMs = 10000): Promise<HTMLElement> => {
      const ende = Date.now() + timeoutMs;
      for (;;) {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el) return el;
        if (Date.now() > ende) throw new Error("Ein erwartetes Bedienelement wurde nicht gefunden.");
        await new Promise((r) => setTimeout(r, 120));
      }
    },
    [],
  );

  const klicke = useCallback(
    async (selector: string) => {
      const el = await warteAufElement(selector);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      await new Promise((r) => setTimeout(r, 350));
      if ((el as HTMLButtonElement).disabled) {
        throw new Error("Die Schaltfläche ist derzeit nicht verfügbar.");
      }
      el.click();
    },
    [warteAufElement],
  );

  const tippe = useCallback(
    async (setter: (wert: string) => void, text: string) => {
      for (let i = 1; i <= text.length; i++) {
        setter(text.slice(0, i));
        await new Promise((r) => setTimeout(r, 24 / tempoRef.current));
      }
    },
    [],
  );

  const kontext: SchrittKontext = useMemo(
    () => ({
      get lauf() {
        return laufRef.current;
      },
      merke,
      gehe: (pfad: string) => navigate(pfad),
      warte,
      tippe,
      klicke,
      warteAufElement,
    }),
    [merke, navigate, warte, tippe, klicke, warteAufElement],
  );

  // ── Vorwärts ──────────────────────────────────────────────
  const weiter = useCallback(async () => {
    const s = SCHRITTE[index];
    if (!s || beschaeftigtRef.current) return;

    if (s.aktion && !ausgefuehrt.current.has(s.id)) {
      ausgefuehrt.current.add(s.id);
      beschaeftigtRef.current = true;
      setBeschaeftigt(true);
      try {
        await s.aktion(kontext);
      } catch (e) {
        ausgefuehrt.current.delete(s.id);
        beschaeftigtRef.current = false;
        setBeschaeftigt(false);
        setSpielt(false);
        setFehler(e instanceof Error ? e.message : "Unbekannter Fehler.");
        return;
      }
      beschaeftigtRef.current = false;
      setBeschaeftigt(false);
    }

    if (s.abschluss) {
      loescheLauf();
      schreibeGesehen();
      onBeenden();
      return;
    }
    setIndex((i) => Math.min(i + 1, SCHRITTE.length - 1));
  }, [index, kontext, onBeenden]);

  const zurueck = useCallback(() => {
    setFehler(null);
    setSpielt(false);
    setIndex((i) => Math.max(abschnittStart.current, i - 1));
  }, []);

  const neustart = useCallback(() => {
    setFehler(null);
    ausgefuehrt.current.clear();
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

  // ── Autoplay ──────────────────────────────────────────────
  useEffect(() => {
    const s = SCHRITTE[index];
    if (!s || !spielt || fehler || s.uebergabeZu || s.abschluss) return;
    const t = window.setTimeout(() => {
      void weiter();
    }, (s.lesezeit ?? 4500) / tempo);
    return () => window.clearTimeout(t);
  }, [index, spielt, tempo, fehler, weiter]);

  // ── Tastatursteuerung ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        beenden();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        void weiter();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        zurueck();
      } else if (e.key === " ") {
        e.preventDefault();
        setSpielt((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [beenden, weiter, zurueck]);

  if (!schritt) return null;

  const gesamt = SCHRITTE.length;
  const fortschritt = Math.round(((index + 1) / gesamt) * 100);

  const steuerung = (
    <div className="flex flex-wrap items-center gap-1.5 pt-3">
      <Button
        size="sm"
        variant="ghost"
        className="h-8 px-2"
        onClick={zurueck}
        disabled={index <= abschnittStart.current || beschaeftigt}
        aria-label="Vorheriger Schritt"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 px-2"
        onClick={() => setSpielt((v) => !v)}
        aria-label={spielt ? "Tutorial pausieren" : "Tutorial fortsetzen"}
      >
        {spielt ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 px-2 gap-1 text-xs"
        onClick={() => {
          const i = TEMPI.findIndex((t) => t.wert === tempo);
          setTempo(TEMPI[(i + 1) % TEMPI.length].wert);
        }}
        aria-label="Abspielgeschwindigkeit ändern"
      >
        <Gauge className="h-4 w-4" />
        {TEMPI.find((t) => t.wert === tempo)?.label}
      </Button>
      <Button
        size="sm"
        className="h-8 ml-auto"
        onClick={() => void weiter()}
        disabled={beschaeftigt}
      >
        {beschaeftigt ? "Läuft…" : "Weiter"}
        <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );

  const kopf = (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand">
          Schritt {index + 1} von {gesamt} · {schritt.rolle}
        </p>
        <h3 className="text-base font-semibold text-foreground mt-0.5">{schritt.titel}</h3>
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
  );

  const fehlerBlock = fehler && (
    <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
      <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" /> Schritt konnte nicht ausgeführt werden
      </p>
      <p className="text-xs text-foreground mt-1">{fehler}</p>
      <div className="flex gap-1.5 mt-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setFehler(null);
            void weiter();
          }}
        >
          Erneut versuchen
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={neustart}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Abbrechen
        </Button>
      </div>
    </div>
  );

  // ── Übergabe- und Abschlusskarte ──────────────────────────
  if (istKarte) {
    return createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-label={schritt.titel}
      >
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-brand/15 p-2 text-brand">
              {schritt.abschluss ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <UserRoundCog className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {schritt.abschluss ? "Fertig" : "Rollenwechsel"}
              </p>
              <h3 className="text-lg font-semibold text-foreground leading-tight">{schritt.titel}</h3>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{schritt.text}</p>
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
  const kartenBreite = 380;
  let kartenStil: React.CSSProperties;
  if (rect) {
    const untenPlatz = window.innerHeight - rect.bottom;
    const oben = untenPlatz > 260 ? rect.bottom + pad + 12 : Math.max(12, rect.top - 260);
    const links = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - kartenBreite - 12),
    );
    kartenStil = { top: oben, left: links, width: Math.min(kartenBreite, window.innerWidth - 24) };
  } else {
    kartenStil = {
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      width: Math.min(kartenBreite, window.innerWidth - 24),
    };
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] pointer-events-none" aria-live="polite">
      {rect ? (
        <div
          className="absolute rounded-lg ring-2 ring-brand transition-all duration-300 pointer-events-none"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(2,6,23,0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/40" />
      )}

      <div
        className="absolute pointer-events-auto rounded-xl border border-border bg-card p-4 shadow-2xl max-sm:!left-3 max-sm:!right-3 max-sm:!top-auto max-sm:!bottom-3 max-sm:!w-auto max-sm:!transform-none"
        style={kartenStil}
        role="dialog"
        aria-label={schritt.titel}
      >
        {kopf}
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{schritt.text}</p>
        {fehlerBlock}
        <div className="mt-3 h-1 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-brand transition-all" style={{ width: `${fortschritt}%` }} />
        </div>
        {steuerung}
      </div>
    </div>,
    document.body,
  );
}
