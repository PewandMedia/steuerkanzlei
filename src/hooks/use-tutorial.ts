import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  leseGesehen,
  leseLauf,
  loescheLauf,
  neuerLauf,
  type TutorialLauf,
} from "@/lib/tutorial-lauf";

export interface TutorialState {
  lauf: TutorialLauf | null;
  aktiv: boolean;
  gesehen: boolean;
  /** Angemeldete Rolle passt zum gespeicherten Laufzustand. */
  rolleStimmt: boolean;
  /** Startet bzw. setzt fort. Gibt einen Hinweistext zurück, falls das nicht geht. */
  starten: () => string | null;
  schliessen: () => void;
  verwerfen: () => void;
}

export function useTutorial(): TutorialState {
  const { rolle, loading } = useAuth();
  const [lauf, setLauf] = useState<TutorialLauf | null>(null);
  const [aktiv, setAktiv] = useState(false);
  const [gesehen, setGesehen] = useState(true);

  useEffect(() => {
    setGesehen(leseGesehen());
  }, []);

  // Gespeicherten Lauf laden und gegen die echten Daten prüfen.
  // Nach dem nächtlichen Demo-Reset existieren die Datensätze nicht mehr —
  // dann wird der Lauf verworfen.
  useEffect(() => {
    if (loading) return;
    const gespeichert = leseLauf();
    if (!gespeichert) {
      setLauf(null);
      return;
    }
    let abgebrochen = false;
    (async () => {
      try {
        if (gespeichert.buchhaltungId) {
          const { data } = await supabase
            .from("buchhaltungen")
            .select("id")
            .eq("id", gespeichert.buchhaltungId)
            .maybeSingle();
          if (!data) {
            loescheLauf();
            if (!abgebrochen) setLauf(null);
            return;
          }
        } else if (gespeichert.mandantId) {
          const { data } = await supabase
            .from("mandanten")
            .select("id")
            .eq("id", gespeichert.mandantId)
            .maybeSingle();
          if (!data) {
            loescheLauf();
            if (!abgebrochen) setLauf(null);
            return;
          }
        }
        if (!abgebrochen) setLauf(gespeichert);
      } catch {
        if (!abgebrochen) setLauf(gespeichert);
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [loading, rolle]);

  const rolleStimmt = !!lauf && lauf.erwarteteRolle === rolle;

  const starten = useCallback((): string | null => {
    const vorhanden = leseLauf();
    if (vorhanden) {
      if (vorhanden.erwarteteRolle !== rolle) {
        return `Dieser Tutorial-Lauf wird als ${vorhanden.erwarteteRolle} fortgesetzt. Bitte melden Sie sich mit dieser Rolle an.`;
      }
      setLauf(vorhanden);
      setAktiv(true);
      return null;
    }
    if (rolle !== "Sekretariat") {
      return "Das Tutorial beginnt beim Sekretariat. Bitte melden Sie sich als Sekretariat an, um es von vorn zu starten.";
    }
    setLauf(neuerLauf());
    setAktiv(true);
    return null;
  }, [rolle]);

  const schliessen = useCallback(() => {
    setAktiv(false);
    setGesehen(leseGesehen());
    setLauf(leseLauf());
  }, []);

  const verwerfen = useCallback(() => {
    loescheLauf();
    setLauf(null);
    setAktiv(false);
  }, []);

  return { lauf, aktiv, gesehen, rolleStimmt, starten, schliessen, verwerfen };
}
