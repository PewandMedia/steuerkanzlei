-- Buchungen Tabelle für belegbasierte Buchhaltung
CREATE TABLE public.buchungen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buchhaltung_id UUID NOT NULL REFERENCES public.buchhaltungen(id) ON DELETE CASCADE,
  dokument_id UUID REFERENCES public.buchhaltung_dokumente(id) ON DELETE SET NULL,
  mandant_id UUID NOT NULL REFERENCES public.mandanten(id) ON DELETE CASCADE,
  betrag NUMERIC(12, 2) NOT NULL,
  buchungsdatum DATE NOT NULL,
  kategorie TEXT NOT NULL CHECK (kategorie IN ('Einnahme', 'Ausgabe')),
  konto TEXT NOT NULL,
  beschreibung TEXT NOT NULL DEFAULT '',
  lieferant TEXT,
  mwst_satz NUMERIC(5, 2) NOT NULL DEFAULT 19,
  erstellt_von UUID NOT NULL REFERENCES public.benutzer(id),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  geaendert_von UUID REFERENCES public.benutzer(id),
  geaendert_am TIMESTAMPTZ
);

CREATE INDEX idx_buchungen_buchhaltung ON public.buchungen(buchhaltung_id);
CREATE INDEX idx_buchungen_dokument ON public.buchungen(dokument_id);
CREATE INDEX idx_buchungen_mandant_lieferant ON public.buchungen(mandant_id, lieferant);

-- RLS aktivieren
ALTER TABLE public.buchungen ENABLE ROW LEVEL SECURITY;

-- SELECT: Chef + Sekretariat alles, Sachbearbeiter nur eigene zugewiesene
CREATE POLICY "buchungen_select" ON public.buchungen
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND EXISTS (
      SELECT 1 FROM public.buchhaltungen b
      WHERE b.id = buchungen.buchhaltung_id
        AND b.bearbeiter_id = (SELECT id FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

-- INSERT: gleiche Regel — wer auf Buchhaltung Zugriff hat, darf buchen
CREATE POLICY "buchungen_insert" ON public.buchungen
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND EXISTS (
      SELECT 1 FROM public.buchhaltungen b
      WHERE b.id = buchungen.buchhaltung_id
        AND b.bearbeiter_id = (SELECT id FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

-- UPDATE: gleiche Regel
CREATE POLICY "buchungen_update" ON public.buchungen
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND EXISTS (
      SELECT 1 FROM public.buchhaltungen b
      WHERE b.id = buchungen.buchhaltung_id
        AND b.bearbeiter_id = (SELECT id FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

-- DELETE: nur Chef + Sekretariat
CREATE POLICY "buchungen_delete" ON public.buchungen
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
);

-- Trigger zum automatischen Setzen von geaendert_am bei Updates
CREATE OR REPLACE FUNCTION public.set_buchung_geaendert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.geaendert_am = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER buchungen_set_geaendert
BEFORE UPDATE ON public.buchungen
FOR EACH ROW
EXECUTE FUNCTION public.set_buchung_geaendert();