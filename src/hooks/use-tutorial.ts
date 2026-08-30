import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

const KEY_PREFIX = "tour-gesehen:";

function storageKey(rolle: string | null): string {
  return `${KEY_PREFIX}${rolle ?? "unbekannt"}`;
}

function readSeen(rolle: string | null): boolean {
  try {
    return window.localStorage.getItem(storageKey(rolle)) === "1";
  } catch {
    return true;
  }
}

function writeSeen(rolle: string | null): void {
  try {
    window.localStorage.setItem(storageKey(rolle), "1");
  } catch {
    /* private Fenster: ignorieren */
  }
}

export interface TutorialState {
  introOpen: boolean;
  tourRunning: boolean;
  seen: boolean;
  openIntro: () => void;
  closeIntro: () => void;
  startTour: () => void;
  endTour: () => void;
}

export function useTutorial(): TutorialState {
  const { rolle, loading } = useAuth();
  const location = useLocation();
  const [introOpen, setIntroOpen] = useState(false);
  const [tourRunning, setTourRunning] = useState(false);
  const [seen, setSeen] = useState(true);

  // Gesehen-Status pro Rolle laden
  useEffect(() => {
    if (loading || !rolle) return;
    setSeen(readSeen(rolle));
  }, [rolle, loading]);

  // Auto-Start: einmal pro Rolle beim ersten Dashboard-Besuch
  useEffect(() => {
    if (loading || !rolle) return;
    if (location.pathname !== "/dashboard") return;
    if (readSeen(rolle)) return;
    const t = window.setTimeout(() => setIntroOpen(true), 800);
    return () => window.clearTimeout(t);
  }, [rolle, loading, location.pathname]);

  const markSeen = useCallback(() => {
    writeSeen(rolle);
    setSeen(true);
  }, [rolle]);

  const openIntro = useCallback(() => setIntroOpen(true), []);

  const closeIntro = useCallback(() => {
    setIntroOpen(false);
    markSeen();
  }, [markSeen]);

  const startTour = useCallback(() => {
    setIntroOpen(false);
    setTourRunning(true);
  }, []);

  const endTour = useCallback(() => {
    setTourRunning(false);
    markSeen();
  }, [markSeen]);

  return { introOpen, tourRunning, seen, openIntro, closeIntro, startTour, endTour };
}
