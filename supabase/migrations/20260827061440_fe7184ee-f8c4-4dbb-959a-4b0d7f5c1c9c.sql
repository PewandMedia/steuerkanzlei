-- 1. Spalten
ALTER TABLE public.benutzer ADD COLUMN IF NOT EXISTS arbeitsbereich text NOT NULL DEFAULT 'demo';
ALTER TABLE public.mandanten ADD COLUMN IF NOT EXISTS arbeitsbereich text NOT NULL DEFAULT 'demo';
CREATE INDEX IF NOT EXISTS idx_mandanten_arbeitsbereich ON public.mandanten(arbeitsbereich);

-- 2. Helper-Funktionen
CREATE OR REPLACE FUNCTION public.current_arbeitsbereich()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT arbeitsbereich FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1), 'demo')
$$;

CREATE OR REPLACE FUNCTION public.mandant_in_arbeitsbereich(_mandant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mandanten m
    WHERE m.id = _mandant_id AND m.arbeitsbereich = public.current_arbeitsbereich()
  )
$$;

CREATE OR REPLACE FUNCTION public.buchhaltung_in_arbeitsbereich(_buchhaltung_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buchhaltungen b
    JOIN public.mandanten m ON m.id = b.mandant_id
    WHERE b.id = _buchhaltung_id AND m.arbeitsbereich = public.current_arbeitsbereich()
  )
$$;

-- 3. Trigger: Arbeitsbereich automatisch setzen
CREATE OR REPLACE FUNCTION public.set_mandant_arbeitsbereich()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.arbeitsbereich := public.current_arbeitsbereich();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_mandant_arbeitsbereich ON public.mandanten;
CREATE TRIGGER trg_set_mandant_arbeitsbereich
BEFORE INSERT ON public.mandanten
FOR EACH ROW EXECUTE FUNCTION public.set_mandant_arbeitsbereich();

-- 4. RLS: mandanten
DROP POLICY IF EXISTS mandanten_select ON public.mandanten;
CREATE POLICY mandanten_select ON public.mandanten FOR SELECT TO authenticated
USING (
  arbeitsbereich = public.current_arbeitsbereich()
  AND (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
    OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND zugewiesener_bearbeiter_id = public.current_benutzer_id())
  )
);

DROP POLICY IF EXISTS mandanten_update ON public.mandanten;
CREATE POLICY mandanten_update ON public.mandanten FOR UPDATE TO authenticated
USING (
  arbeitsbereich = public.current_arbeitsbereich()
  AND (has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle))
);

DROP POLICY IF EXISTS mandanten_delete ON public.mandanten;
CREATE POLICY mandanten_delete ON public.mandanten FOR DELETE TO authenticated
USING (
  arbeitsbereich = public.current_arbeitsbereich()
  AND has_role(auth.uid(), 'Chef'::benutzer_rolle)
);

-- 5. RLS: buchhaltungen
DROP POLICY IF EXISTS buchhaltungen_select ON public.buchhaltungen;
CREATE POLICY buchhaltungen_select ON public.buchhaltungen FOR SELECT TO authenticated
USING (
  public.mandant_in_arbeitsbereich(mandant_id)
  AND (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
    OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND (
      bearbeiter_id = public.current_benutzer_id()
      OR EXISTS (SELECT 1 FROM public.buchhaltung_co_bearbeiter c WHERE c.buchhaltung_id = buchhaltungen.id AND c.bearbeiter_id = public.current_benutzer_id())
    ))
  )
);

DROP POLICY IF EXISTS buchhaltungen_update ON public.buchhaltungen;
CREATE POLICY buchhaltungen_update ON public.buchhaltungen FOR UPDATE TO authenticated
USING (
  public.mandant_in_arbeitsbereich(mandant_id)
  AND (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
    OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND (
      bearbeiter_id = public.current_benutzer_id()
      OR EXISTS (SELECT 1 FROM public.buchhaltung_co_bearbeiter c WHERE c.buchhaltung_id = buchhaltungen.id AND c.bearbeiter_id = public.current_benutzer_id())
    ))
  )
);

DROP POLICY IF EXISTS buchhaltungen_insert ON public.buchhaltungen;
CREATE POLICY buchhaltungen_insert ON public.buchhaltungen FOR INSERT TO authenticated
WITH CHECK (
  public.mandant_in_arbeitsbereich(mandant_id)
  AND (has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle))
);

DROP POLICY IF EXISTS buchhaltungen_delete ON public.buchhaltungen;
CREATE POLICY buchhaltungen_delete ON public.buchhaltungen FOR DELETE TO authenticated
USING (
  public.mandant_in_arbeitsbereich(mandant_id)
  AND (has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle))
);

-- 6. RLS: belegeingaenge
DROP POLICY IF EXISTS belegeingaenge_select ON public.belegeingaenge;
CREATE POLICY belegeingaenge_select ON public.belegeingaenge FOR SELECT TO authenticated
USING (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))));

DROP POLICY IF EXISTS belegeingaenge_insert ON public.belegeingaenge;
CREATE POLICY belegeingaenge_insert ON public.belegeingaenge FOR INSERT TO authenticated
WITH CHECK (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))));

DROP POLICY IF EXISTS belegeingaenge_update ON public.belegeingaenge;
CREATE POLICY belegeingaenge_update ON public.belegeingaenge FOR UPDATE TO authenticated
USING (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))));

DROP POLICY IF EXISTS belegeingaenge_delete ON public.belegeingaenge;
CREATE POLICY belegeingaenge_delete ON public.belegeingaenge FOR DELETE TO authenticated
USING (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))));

-- 7. RLS: kommentare
DROP POLICY IF EXISTS kommentare_select ON public.kommentare;
CREATE POLICY kommentare_select ON public.kommentare FOR SELECT TO authenticated
USING (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))));

DROP POLICY IF EXISTS kommentare_insert ON public.kommentare;
CREATE POLICY kommentare_insert ON public.kommentare FOR INSERT TO authenticated
WITH CHECK (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))));

-- 8. RLS: buchhaltung_dokumente
DROP POLICY IF EXISTS dokumente_select ON public.buchhaltung_dokumente;
CREATE POLICY dokumente_select ON public.buchhaltung_dokumente FOR SELECT TO authenticated
USING (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))));

DROP POLICY IF EXISTS dokumente_insert ON public.buchhaltung_dokumente;
CREATE POLICY dokumente_insert ON public.buchhaltung_dokumente FOR INSERT TO authenticated
WITH CHECK (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Sekretariat'::benutzer_rolle) OR has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)));

DROP POLICY IF EXISTS dokumente_update ON public.buchhaltung_dokumente;
CREATE POLICY dokumente_update ON public.buchhaltung_dokumente FOR UPDATE TO authenticated
USING (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle) AND has_buchhaltung_access(auth.uid(), buchhaltung_id))));

DROP POLICY IF EXISTS dokumente_delete ON public.buchhaltung_dokumente;
CREATE POLICY dokumente_delete ON public.buchhaltung_dokumente FOR DELETE TO authenticated
USING (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Sekretariat'::benutzer_rolle) OR has_role(auth.uid(), 'Chef'::benutzer_rolle)));

-- 9. RLS: buchhaltung_co_bearbeiter
DROP POLICY IF EXISTS co_bearb_select ON public.buchhaltung_co_bearbeiter;
CREATE POLICY co_bearb_select ON public.buchhaltung_co_bearbeiter FOR SELECT TO authenticated
USING (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR bearbeiter_id = public.current_benutzer_id()
  OR has_buchhaltung_access(auth.uid(), buchhaltung_id)));

DROP POLICY IF EXISTS co_bearb_insert ON public.buchhaltung_co_bearbeiter;
CREATE POLICY co_bearb_insert ON public.buchhaltung_co_bearbeiter FOR INSERT TO authenticated
WITH CHECK (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR EXISTS (SELECT 1 FROM public.buchhaltungen b WHERE b.id = buchhaltung_co_bearbeiter.buchhaltung_id AND b.bearbeiter_id = public.current_benutzer_id())));

DROP POLICY IF EXISTS co_bearb_delete ON public.buchhaltung_co_bearbeiter;
CREATE POLICY co_bearb_delete ON public.buchhaltung_co_bearbeiter FOR DELETE TO authenticated
USING (public.buchhaltung_in_arbeitsbereich(buchhaltung_id) AND (
  has_role(auth.uid(), 'Chef'::benutzer_rolle) OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR EXISTS (SELECT 1 FROM public.buchhaltungen b WHERE b.id = buchhaltung_co_bearbeiter.buchhaltung_id AND b.bearbeiter_id = public.current_benutzer_id())));

-- 10. RLS: benutzer (nur eigener Arbeitsbereich)
DROP POLICY IF EXISTS benutzer_select ON public.benutzer;
CREATE POLICY benutzer_select ON public.benutzer FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (public.ist_freigegeben(auth.uid()) AND arbeitsbereich = public.current_arbeitsbereich())
);