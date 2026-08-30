import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TourStep } from "@/lib/tutorial-steps";

interface TutorialTourProps {
  steps: TourStep[];
  onFinish: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const CARD_WIDTH = 340;
const GAP = 14;

function boxFromElement(el: Element): Box {
  const r = el.getBoundingClientRect();
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function waitForElement(selector: string, timeout: number): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && isVisible(el)) {
        resolve(el);
        return;
      }
      if (Date.now() - start > timeout) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 120);
    };
    tick();
  });
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

export function TutorialTour({ steps, onFinish }: TutorialTourProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { setOpen, setOpenMobile } = useSidebar();

  const [index, setIndex] = useState<number>(-1);
  const [box, setBox] = useState<Box | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [shown, setShown] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [preparing, setPreparing] = useState(true);

  const elementRef = useRef<HTMLElement | null>(null);
  const runRef = useRef(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const finish = useCallback(() => {
    runRef.current += 1;
    elementRef.current = null;
    onFinish();
  }, [onFinish]);

  const goTo = useCallback(
    async (start: number, dir: 1 | -1) => {
      const token = ++runRef.current;
      setPreparing(true);
      let i = start;
      let localSkipped = 0;

      while (i >= 0 && i < steps.length) {
        const step = steps[i];

        if (step.route && locationRef.current !== step.route) {
          navigate(step.route);
          await sleep(reducedMotion ? 120 : 260);
          if (token !== runRef.current) return;
        }

        if (step.needsSidebar) {
          if (isMobile) setOpenMobile(true);
          else setOpen(true);
          await sleep(reducedMotion ? 60 : 220);
          if (token !== runRef.current) return;
        }

        if (step.center) {
          elementRef.current = null;
          setBox(null);
          setUsedFallback(false);
          setIndex(i);
          setShown((s) => Math.max(1, s + dir));
          setSkipped((s) => s + localSkipped);
          setPreparing(false);
          return;
        }

        let el = step.selector ? await waitForElement(step.selector, 2500) : null;
        let fallback = false;
        if (token !== runRef.current) return;
        if (!el && step.fallbackSelector) {
          el = await waitForElement(step.fallbackSelector, 800);
          fallback = !!el;
        }
        if (token !== runRef.current) return;

        if (el) {
          el.scrollIntoView({
            block: "center",
            inline: "center",
            behavior: reducedMotion ? "auto" : "smooth",
          });
          await sleep(reducedMotion ? 60 : 420);
          if (token !== runRef.current) return;
          elementRef.current = el;
          setBox(boxFromElement(el));
          setUsedFallback(fallback);
          setIndex(i);
          setShown((s) => Math.max(1, s + dir));
          setSkipped((s) => s + localSkipped);
          setPreparing(false);
          return;
        }

        localSkipped += 1;
        i += dir;
      }

      if (token !== runRef.current) return;
      finish();
    },
    [steps, navigate, isMobile, setOpen, setOpenMobile, reducedMotion, finish],
  );

  // Start
  useEffect(() => {
    void goTo(0, 1);
    return () => {
      runRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Body-Scroll sperren
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Position laufend nachführen
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = elementRef.current;
      if (el && document.contains(el)) setBox(boxFromElement(el));
      raf = window.requestAnimationFrame(update);
    };
    raf = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  // Fokus in die Karte
  useEffect(() => {
    if (!preparing) cardRef.current?.focus();
  }, [preparing, index]);

  const next = useCallback(() => {
    if (index < 0) return;
    void goTo(index + 1, 1);
  }, [index, goTo]);

  const back = useCallback(() => {
    if (index <= 0) return;
    void goTo(index - 1, -1);
  }, [index, goTo]);

  // Tastatur
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, finish]);

  if (index < 0 || preparing) {
    return createPortal(
      <div className="fixed inset-0 z-[120] bg-foreground/50" aria-hidden="true" />,
      document.body,
    );
  }

  const step = steps[index];
  const text = usedFallback && step.fallbackBody ? step.fallbackBody : step.body;
  const total = Math.max(shown, steps.length - skipped);
  const isLast = index === steps.length - 1;

  // Karten-Position berechnen
  let cardStyle: React.CSSProperties;
  if (isMobile || !box) {
    cardStyle = box
      ? { left: 12, right: 12, bottom: 12, position: "fixed" }
      : {
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: `min(${CARD_WIDTH}px, calc(100vw - 24px))`,
          position: "fixed",
        };
  } else {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - (box.top + box.height);
    const spaceAbove = box.top;
    const placeBelow = spaceBelow > 220 || spaceBelow >= spaceAbove;
    const left = Math.min(
      Math.max(12, box.left + box.width / 2 - CARD_WIDTH / 2),
      vw - CARD_WIDTH - 12,
    );
    cardStyle = {
      position: "fixed",
      width: CARD_WIDTH,
      left,
      ...(placeBelow
        ? { top: Math.min(box.top + box.height + GAP, vh - 200) }
        : { bottom: Math.min(vh - box.top + GAP, vh - 200) }),
    };
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Produkt-Tour"
      className="fixed inset-0 z-[120]"
    >
      {box ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-brand"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: "0 0 0 9999px hsl(var(--foreground) / 0.55)",
            transition: reducedMotion ? undefined : "all 180ms ease-out",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-foreground/55" />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        aria-live="polite"
        style={cardStyle}
        className="rounded-xl border border-border bg-card p-4 shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Schritt {shown} von {total}
          </p>
          <button
            type="button"
            onClick={finish}
            aria-label="Tour beenden"
            className="-mt-1 -mr-1 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${Math.round((shown / Math.max(total, 1)) * 100)}%` }}
          />
        </div>

        <h3 className="mt-3 text-base font-semibold text-foreground">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>

        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={isMobile ? "h-11 flex-1" : "h-9"}
            onClick={back}
            disabled={shown <= 1}
          >
            Zurück
          </Button>
          <Button
            size="sm"
            className={isMobile ? "h-11 flex-1" : "h-9 ml-auto"}
            onClick={isLast ? finish : next}
          >
            {isLast ? "Fertig" : "Weiter"}
          </Button>
        </div>

        <button
          type="button"
          onClick={finish}
          className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Tour überspringen
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default TutorialTour;
