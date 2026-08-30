import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { getStatusColor } from "@/lib/buchhaltung-workflow";
import {
  MANDANT,
  PERSONEN,
  STORY,
  aktionenFuer,
  stateBis,
  type StoryDialog,
} from "@/lib/tutorial-story";

interface Props {
  onClose: () => void;
}

interface DialogState {
  titel: string;
  bestaetigen: string;
  felder: { label: string; wert: string; getippt: string }[];
}

const LESEPAUSE = 1800;

export function TutorialStory({ onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [schnell, setSchnell] = useState(false);
  const [wechselKarte, setWechselKarte] = useState(false);
  const [pressing, setPressing] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [committed, setCommitted] = useState(-1);
  const [run, setRun] = useState(0);

  const tokenRef = useRef(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const schnellRef = useRef(schnell);
  schnellRef.current = schnell;
  const steuerRef = useRef<HTMLDivElement | null>(null);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const step = STORY[index];
  const person = PERSONEN[step.rolle];
  const anzeige = stateBis(committed >= index ? index : index - 1);
  const aktionen = aktionenFuer(step.rolle, anzeige.status);

  // Wartet in kleinen Scheiben, respektiert Pause und Abbruch-Token.
  const wait = useCallback(async (ms: number, token: number) => {
    const faktor = schnellRef.current ? 0.55 : 1;
    let rest = reduced ? Math.min(ms, 250) : ms * faktor;
    while (rest > 0) {
      if (token !== tokenRef.current) throw new Error("abort");
      await new Promise((r) => window.setTimeout(r, 60));
      if (token !== tokenRef.current) throw new Error("abort");
      if (playingRef.current) rest -= 60;
    }
  }, [reduced]);

  // Ablauf eines Schrittes abspielen
  useEffect(() => {
    const token = ++tokenRef.current;
    let abgebrochen = false;

    const run = async () => {
      try {
        setPressing(null);
        setDialog(null);
        setWechselKarte(false);
        setCommitted(index - 1);

        if (step.wechsel) {
          setWechselKarte(true);
          await wait(1800, token);
          setWechselKarte(false);
          await wait(200, token);
        }

        if (step.dialog) {
          const d: StoryDialog = step.dialog;
          setDialog({
            titel: d.titel,
            bestaetigen: d.bestaetigen,
            felder: d.felder.map((f) => ({ ...f, getippt: reduced ? f.wert : "" })),
          });
          await wait(450, token);
          if (!reduced) {
            for (let fi = 0; fi < d.felder.length; fi++) {
              const wert = d.felder[fi].wert;
              for (let c = 1; c <= wert.length; c++) {
                if (token !== tokenRef.current) throw new Error("abort");
                if (!playingRef.current) {
                  await wait(0, token);
                }
                setDialog((prev) =>
                  prev
                    ? {
                        ...prev,
                        felder: prev.felder.map((f, i2) =>
                          i2 === fi ? { ...f, getippt: wert.slice(0, c) } : f,
                        ),
                      }
                    : prev,
                );
                await new Promise((r) =>
                  window.setTimeout(r, schnellRef.current ? 12 : 28),
                );
                while (!playingRef.current && token === tokenRef.current) {
                  await new Promise((r) => window.setTimeout(r, 80));
                }
              }
              await wait(220, token);
            }
          }
          await wait(400, token);
        }

        if (step.druecke) {
          setPressing(step.druecke);
          await wait(650, token);
          setPressing(null);
        }

        setDialog(null);
        setCommitted(index);

        const extra = Math.min(2200, Math.max(0, step.text.length - 90) * 14);
        await wait((schnellRef.current ? 900 : LESEPAUSE) + extra, token);

        if (token === tokenRef.current && index < STORY.length - 1) {
          setIndex((i) => (i === index ? i + 1 : i));
        }
      } catch {
        /* abgebrochen */
      }
    };

    void run();
    return () => {
      abgebrochen = true;
      void abgebrochen;
      tokenRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, run]);

  // Body-Scroll sperren
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    steuerRef.current?.focus();
  }, []);

  const vor = useCallback(() => {
    setIndex((i) => Math.min(STORY.length - 1, i + 1));
  }, []);
  const zurueck = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);
  const neustart = useCallback(() => {
    setCommitted(-1);
    setPlaying(true);
    setIndex(0);
    setRun((r) => r + 1);
  }, []);

  const schliessen = useCallback(() => {
    tokenRef.current += 1;
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        schliessen();
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        vor();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        zurueck();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vor, zurueck, schliessen]);

  const rollenFarbe: Record<string, string> = {
    Sekretariat: "border-sky-300 bg-sky-50 dark:bg-sky-950/40",
    Sachbearbeiter: "border-amber-300 bg-amber-50 dark:bg-amber-950/40",
    Chef: "border-violet-300 bg-violet-50 dark:bg-violet-950/40",
  };

  const fortschritt = Math.round(((index + 1) / STORY.length) * 100);

  const aktionsButton = (label: string) => (
    <span
      key={label}
      className={`inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-transform ${
        pressing === label
          ? "scale-95 border-brand bg-brand/10 text-foreground ring-2 ring-brand"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial: Ablauf einer Buchhaltung"
      className="fixed inset-0 z-[130] flex flex-col bg-background"
    >
      {/* Rollen-Banner */}
      <div className={`flex items-center gap-3 border-b px-4 py-3 ${rollenFarbe[step.rolle]}`}>
        <UserAvatar name={person.name} seed={person.rolle} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {person.name} — {person.titel}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Simulierter Ablauf — es werden keine echten Daten gespeichert.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-11 w-11"
          onClick={schliessen}
          aria-label="Tutorial schließen"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Bühne */}
      <div className="relative flex-1 overflow-auto px-3 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          {step.view === "mandanten" && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="section-label mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                Mandanten
              </p>
              {anzeige.mandantAngelegt ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">
                    {MANDANT.nummer} · {MANDANT.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {MANDANT.ansprechpartner} · {MANDANT.telefon} · {MANDANT.email}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Zuständig: {MANDANT.sachbearbeiter}
                  </p>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Noch keine Mandanten vorhanden.
                </p>
              )}
            </div>
          )}

          {step.view === "kontakt" && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="section-label mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                Mandant kontaktieren
              </p>
              <p className="text-sm font-semibold text-foreground">{MANDANT.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {MANDANT.ansprechpartner} · {MANDANT.telefon}
              </p>
              {anzeige.notiz && (
                <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                  Offen: {anzeige.notiz.text}
                </p>
              )}
              {anzeige.kontakt && (
                <p className="mt-3 rounded-md border border-border bg-muted/40 p-2 text-xs text-foreground">
                  Kontaktvermerk: {anzeige.kontakt}
                </p>
              )}
            </div>
          )}

          {step.view === "dashboard" && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="section-label mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                Dashboard — Buchhaltungen
              </p>
              {!anzeige.zeileSichtbar ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Noch keine Buchhaltungen vorhanden.
                </p>
              ) : (
                <>
                  {/* Desktop-Tabelle */}
                  <div className="hidden md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-2 font-medium">Mandant</th>
                          <th className="py-2 pr-2 font-medium">Monat</th>
                          <th className="py-2 pr-2 font-medium">Status</th>
                          <th className="py-2 pr-2 font-medium">Frist</th>
                          <th className="py-2 pr-2 font-medium">Belege</th>
                          <th className="py-2 pr-2 font-medium">Bearbeiter</th>
                          <th className="py-2 font-medium">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="align-top">
                          <td className="py-3 pr-2 font-medium text-foreground">
                            {MANDANT.name}
                            <div className="text-[11px] text-muted-foreground">
                              {MANDANT.nummer}
                            </div>
                          </td>
                          <td className="py-3 pr-2 text-muted-foreground">{MANDANT.monat}</td>
                          <td className="py-3 pr-2">
                            {anzeige.status && <StatusBadge status={anzeige.status} />}
                            {anzeige.badge && (
                              <Badge variant="outline" className="mt-1 block w-fit text-[10px]">
                                {anzeige.badge}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 pr-2 text-muted-foreground">{MANDANT.frist}</td>
                          <td className="py-3 pr-2 text-muted-foreground">{MANDANT.belege}</td>
                          <td className="py-3 pr-2 text-muted-foreground">
                            {MANDANT.sachbearbeiter}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {aktionen.map(aktionsButton)}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Karte */}
                  <div className="md:hidden rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold text-foreground">{MANDANT.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {MANDANT.nummer} · {MANDANT.monat} · Frist {MANDANT.frist}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {anzeige.status && <StatusBadge status={anzeige.status} />}
                      {anzeige.badge && (
                        <Badge variant="outline" className="text-[10px]">
                          {anzeige.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {MANDANT.belege} Belege · Bearbeiter {MANDANT.sachbearbeiter}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">{aktionen.map(aktionsButton)}</div>
                  </div>

                  {anzeige.notiz && (
                    <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                      {anzeige.notiz.art === "zurueckweisung"
                        ? `Vom Chef zurückgewiesen: ${anzeige.notiz.text}`
                        : `Warten auf Mandant: ${anzeige.notiz.text}`}
                    </p>
                  )}

                  {step.zweiWege && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-xs font-semibold text-foreground">Belege vollständig</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          „Zur Prüfung senden“ → In Prüfung
                        </p>
                      </div>
                      <div className="rounded-lg border border-dashed border-border p-3">
                        <p className="text-xs font-semibold text-foreground">Es fehlt etwas</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          „Unvollständig“ → Warten auf Mandant
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step.view === "abschluss" && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="section-label mb-4 text-xs uppercase tracking-wider text-muted-foreground">
                Der komplette Ablauf
              </p>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                {(
                  [
                    ["Eingegangen", "Sachbearbeiter · Annehmen"],
                    ["In Bearbeitung", "Sachbearbeiter · Zur Prüfung senden"],
                    ["In Prüfung", "Chef · Freigeben"],
                    ["Buchhaltung erledigt", ""],
                  ] as const
                ).map(([status, uebergang]) => (
                  <div key={status} className="flex items-center gap-2">
                    <span
                      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusColor(
                        status,
                      )}`}
                    >
                      {status}
                    </span>
                    {uebergang && (
                      <span className="text-[10px] leading-tight text-muted-foreground">
                        → {uebergang}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-border p-3">
                <span
                  className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusColor(
                    "Warten auf Mandant",
                  )}`}
                >
                  Warten auf Mandant
                </span>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Seitenast von „In Bearbeitung“: Sachbearbeiter · Unvollständig (Notiz Pflicht).
                  Zurück mit Sachbearbeiter · Weiterarbeiten. Das Sekretariat kontaktiert den
                  Mandanten.
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Rückweg aus „In Prüfung“ nach „In Bearbeitung“: Chef · Zurückweisen.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="h-11" variant="outline" onClick={neustart}>
                  Nochmal ansehen
                </Button>
                <Button className="h-11" onClick={schliessen}>
                  Demo selbst ausprobieren
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Simulierter Dialog */}
        {dialog && (
          <div className="absolute inset-0 flex items-start justify-center bg-foreground/40 px-3 pt-10">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-xl">
              <p className="text-sm font-semibold text-foreground">{dialog.titel}</p>
              <div className="mt-3 space-y-2">
                {dialog.felder.map((f) => (
                  <div key={f.label}>
                    <p className="text-[11px] text-muted-foreground">{f.label}</p>
                    <div className="mt-0.5 min-h-9 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                      {f.getippt}
                      <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-foreground align-middle" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <span
                  className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-transform ${
                    pressing === dialog.bestaetigen
                      ? "scale-95 border-brand bg-brand/10 ring-2 ring-brand"
                      : "border-border bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {dialog.bestaetigen}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Perspektivwechsel */}
        {wechselKarte && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/85 px-4">
            <div className="w-full max-w-sm rounded-xl border border-brand bg-card p-5 text-center shadow-xl">
              <ArrowLeftRight className="mx-auto h-6 w-6 text-brand" />
              <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
                Perspektivwechsel
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                Jetzt sind Sie: {person.name}, {person.titel}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Erzähler-Leiste */}
      <div
        ref={steuerRef}
        tabIndex={-1}
        className="border-t border-border bg-card px-3 py-3 outline-none sm:px-6"
      >
        <div className="mx-auto w-full max-w-4xl">
          <p aria-live="polite" className="text-sm leading-relaxed text-foreground">
            {step.text}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
              Schritt {index + 1} von {STORY.length}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand" style={{ width: `${fortschritt}%` }} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause" : "Weiter abspielen"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">{playing ? "Pause" : "Abspielen"}</span>
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={zurueck}
              disabled={index === 0}
              aria-label="Schritt zurück"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={vor}
              disabled={index === STORY.length - 1}
              aria-label="Schritt vor"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="h-11" onClick={neustart} aria-label="Neu starten">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setSchnell((s) => !s)}
              aria-label="Tempo umschalten"
            >
              <Gauge className="h-4 w-4" />
              <span className="ml-1.5 text-xs">{schnell ? "Schnell" : "Normal"}</span>
            </Button>
            <Button variant="ghost" className="ml-auto h-11" onClick={schliessen}>
              Schließen
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default TutorialStory;
