import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Liest `?focus=<id>` aus der URL. Liefert `focusId` und einen `setRef`-Callback,
 * der an die Ziel-Zeile gehängt wird. Sobald das DOM-Element bekannt ist, wird
 * dorthin gescrollt und für ~2 s eine Highlight-Klasse angewendet. Anschließend
 * wird der Query-Param entfernt, damit der Effekt nicht erneut auslöst.
 */
export function useFocusRow() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const elementsRef = useRef<Map<string, HTMLElement | null>>(new Map());
  const handledRef = useRef<string | null>(null);

  const setRef = (id: string) => (el: HTMLElement | null) => {
    if (el) elementsRef.current.set(id, el);
    else elementsRef.current.delete(id);
  };

  useEffect(() => {
    if (!focusId || handledRef.current === focusId) return;
    // Warten bis Element gerendert ist
    const tryFocus = () => {
      const el = elementsRef.current.get(focusId);
      if (!el) return false;
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });
      setHighlightId(focusId);
      handledRef.current = focusId;
      // URL aufräumen
      const next = new URLSearchParams(searchParams);
      next.delete("focus");
      setSearchParams(next, { replace: true });
      window.setTimeout(() => setHighlightId(null), 4000);
      return true;
    };
    if (tryFocus()) return;
    const interval = window.setInterval(() => {
      if (tryFocus()) window.clearInterval(interval);
    }, 100);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 3000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [focusId, searchParams, setSearchParams]);

  return { focusId, highlightId, setRef };
}