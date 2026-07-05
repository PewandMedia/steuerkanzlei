
-- Tabelle für mehrere Belegeingangs-Daten pro Buchhaltung
CREATE TABLE public.belegeingaenge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buchhaltung_id uuid NOT NULL REFERENCES public.buchhaltungen(id) ON DELETE CASCADE,
  datum date NOT NULL,
  notiz text NULL,
  erstellt_von uuid NULL,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_belegeingaenge_buchhaltung ON public.belegeingaenge(buchhaltung_id, datum DESC);

ALTER TABLE public.belegeingaenge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "belegeingaenge_select" ON public.belegeingaenge
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
    OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))
  );

CREATE POLICY "belegeingaenge_insert" ON public.belegeingaenge
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
    OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))
  );

CREATE POLICY "belegeingaenge_update" ON public.belegeingaenge
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
    OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))
  );

CREATE POLICY "belegeingaenge_delete" ON public.belegeingaenge
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
    OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))
  );

-- Bestehende Eingangsdaten migrieren
INSERT INTO public.belegeingaenge (buchhaltung_id, datum)
SELECT id, belegeingang_datum FROM public.buchhaltungen WHERE belegeingang_datum IS NOT NULL;

-- Trigger: frühestes Datum aus belegeingaenge nach buchhaltungen.belegeingang_datum spiegeln
CREATE OR REPLACE FUNCTION public.sync_belegeingang_datum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid uuid;
  earliest date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    bid := OLD.buchhaltung_id;
  ELSE
    bid := NEW.buchhaltung_id;
  END IF;

  SELECT MIN(datum) INTO earliest FROM public.belegeingaenge WHERE buchhaltung_id = bid;
  UPDATE public.buchhaltungen SET belegeingang_datum = earliest WHERE id = bid;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_belegeingaenge_sync
AFTER INSERT OR UPDATE OR DELETE ON public.belegeingaenge
FOR EACH ROW EXECUTE FUNCTION public.sync_belegeingang_datum();
