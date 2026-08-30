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
  storyOpen: boolean;
  seen: boolean;
  startStory: () => void;
  endStory: () => void;
}

export function useTutorial(): TutorialState {
  const { rolle, loading } = useAuth();
  const location = useLocation();
  const [storyOpen, setStoryOpen] = useState(false);
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    if (loading || !rolle) return;
    setSeen(readSeen(rolle));
  }, [rolle, loading]);

  // Auto-Start: einmal pro Rolle beim ersten Dashboard-Besuch
  useEffect(() => {
    if (loading || !rolle) return;
    if (location.pathname !== "/dashboard") return;
    if (readSeen(rolle)) return;
    const t = window.setTimeout(() => setStoryOpen(true), 800);
    return () => window.clearTimeout(t);
  }, [rolle, loading, location.pathname]);

  const startStory = useCallback(() => setStoryOpen(true), []);

  const endStory = useCallback(() => {
    setStoryOpen(false);
    writeSeen(rolle);
    setSeen(true);
  }, [rolle]);

  return { storyOpen, seen, startStory, endStory };
}
