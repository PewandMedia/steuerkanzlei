-- 1. Tabelle für Co-Bearbeiter
CREATE TABLE IF NOT EXISTS public.buchhaltung_co_bearbeiter (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buchhaltung_id uuid NOT NULL,
  bearbeiter_id uuid NOT NULL,
  zugewiesen_am timestamp with time zone NOT NULL DEFAULT now(),
  zugewiesen_von uuid,
  UNIQUE (buchhaltung_id, bearbeiter_id)
);

CREATE INDEX IF NOT EXISTS idx_co_bearb_buchhaltung ON public.buchhaltung_co_bearbeiter(buchhaltung_id);
CREATE INDEX IF NOT EXISTS idx_co_bearb_bearbeiter ON public.buchhaltung_co_bearbeiter(bearbeiter_id);

ALTER TABLE public.buchhaltung_co_bearbeiter ENABLE ROW LEVEL SECURITY;

-- 2. Security-Definer: Zugriff prüfen (Haupt- ODER Co-Bearbeiter)
CREATE OR REPLACE FUNCTION public.has_buchhaltung_access(_user_id uuid, _buchhaltung_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.buchhaltungen b
    LEFT JOIN public.benutzer be ON be.user_id = _user_id
    WHERE b.id = _buchhaltung_id
      AND (
        b.bearbeiter_id = be.id
        OR EXISTS (
          SELECT 1 FROM public.buchhaltung_co_bearbeiter c
          WHERE c.buchhaltung_id = _buchhaltung_id
            AND c.bearbeiter_id = be.id
        )
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_buchhaltung_access(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_buchhaltung_access(uuid, uuid) TO authenticated;

-- 3. Hilfsfunktion: aktuelle benutzer.id
CREATE OR REPLACE FUNCTION public.current_benutzer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.current_benutzer_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_benutzer_id() TO authenticated;

-- 4. RLS auf buchhaltung_co_bearbeiter
CREATE POLICY "co_bearb_select" ON public.buchhaltung_co_bearbeiter
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "co_bearb_insert" ON public.buchhaltung_co_bearbeiter
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR EXISTS (
    SELECT 1 FROM public.buchhaltungen b
    WHERE b.id = buchhaltung_id
      AND b.bearbeiter_id = public.current_benutzer_id()
  )
);

CREATE POLICY "co_bearb_delete" ON public.buchhaltung_co_bearbeiter
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR EXISTS (
    SELECT 1 FROM public.buchhaltungen b
    WHERE b.id = buchhaltung_id
      AND b.bearbeiter_id = public.current_benutzer_id()
  )
);

-- 5. Bestehende RLS-Policies erweitern um Co-Bearbeiter

-- buchhaltungen: SELECT
DROP POLICY IF EXISTS buchhaltungen_select ON public.buchhaltungen;
CREATE POLICY buchhaltungen_select ON public.buchhaltungen
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND (
      bearbeiter_id = public.current_benutzer_id()
      OR EXISTS (
        SELECT 1 FROM public.buchhaltung_co_bearbeiter c
        WHERE c.buchhaltung_id = buchhaltungen.id
          AND c.bearbeiter_id = public.current_benutzer_id()
      )
    )
  )
);

-- buchhaltungen: UPDATE
DROP POLICY IF EXISTS buchhaltungen_update ON public.buchhaltungen;
CREATE POLICY buchhaltungen_update ON public.buchhaltungen
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND (
      bearbeiter_id = public.current_benutzer_id()
      OR EXISTS (
        SELECT 1 FROM public.buchhaltung_co_bearbeiter c
        WHERE c.buchhaltung_id = buchhaltungen.id
          AND c.bearbeiter_id = public.current_benutzer_id()
      )
    )
  )
);

-- buchungen: SELECT
DROP POLICY IF EXISTS buchungen_select ON public.buchungen;
CREATE POLICY buchungen_select ON public.buchungen
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND public.has_buchhaltung_access(auth.uid(), buchhaltung_id)
  )
);

-- buchungen: INSERT
DROP POLICY IF EXISTS buchungen_insert ON public.buchungen;
CREATE POLICY buchungen_insert ON public.buchungen
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND public.has_buchhaltung_access(auth.uid(), buchhaltung_id)
  )
);

-- buchungen: UPDATE
DROP POLICY IF EXISTS buchungen_update ON public.buchungen;
CREATE POLICY buchungen_update ON public.buchungen
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND public.has_buchhaltung_access(auth.uid(), buchhaltung_id)
  )
);

-- buchhaltung_dokumente: SELECT
DROP POLICY IF EXISTS dokumente_select ON public.buchhaltung_dokumente;
CREATE POLICY dokumente_select ON public.buchhaltung_dokumente
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND public.has_buchhaltung_access(auth.uid(), buchhaltung_id)
  )
);

-- buchhaltung_dokumente: UPDATE
DROP POLICY IF EXISTS dokumente_update ON public.buchhaltung_dokumente;
CREATE POLICY dokumente_update ON public.buchhaltung_dokumente
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND public.has_buchhaltung_access(auth.uid(), buchhaltung_id)
  )
);

-- abschluesse: SELECT
DROP POLICY IF EXISTS abschluesse_select ON public.buchhaltungs_abschluesse;
CREATE POLICY abschluesse_select ON public.buchhaltungs_abschluesse
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND public.has_buchhaltung_access(auth.uid(), buchhaltung_id)
  )
);

-- abschluesse: INSERT
DROP POLICY IF EXISTS abschluesse_insert ON public.buchhaltungs_abschluesse;
CREATE POLICY abschluesse_insert ON public.buchhaltungs_abschluesse
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND public.has_buchhaltung_access(auth.uid(), buchhaltung_id)
  )
);

-- 6. Benachrichtigung bei neuer Co-Bearbeiter-Zuweisung
CREATE OR REPLACE FUNCTION public.notify_co_bearbeiter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_monat text;
BEGIN
  SELECT monat INTO v_monat FROM public.buchhaltungen WHERE id = NEW.buchhaltung_id;
  INSERT INTO public.benachrichtigungen (empfaenger_id, typ, titel, nachricht, buchhaltung_id)
  VALUES (
    NEW.bearbeiter_id,
    'co_bearbeiter_zugewiesen',
    'Als Vertretung zugewiesen',
    'Sie wurden als Vertretung für die Buchhaltung Monat ' || COALESCE(v_monat, '?') || ' zugewiesen.',
    NEW.buchhaltung_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_co_bearbeiter ON public.buchhaltung_co_bearbeiter;
CREATE TRIGGER trg_notify_co_bearbeiter
AFTER INSERT ON public.buchhaltung_co_bearbeiter
FOR EACH ROW
EXECUTE FUNCTION public.notify_co_bearbeiter();