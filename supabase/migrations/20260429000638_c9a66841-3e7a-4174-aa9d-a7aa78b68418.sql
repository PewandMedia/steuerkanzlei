-- 1. Spalte hinzufügen
ALTER TABLE public.mandanten
  ADD COLUMN IF NOT EXISTS mandanten_nummer TEXT;

-- 2. Sequenz für fortlaufende Nummern
CREATE SEQUENCE IF NOT EXISTS public.mandanten_nummer_seq START 1;

-- 3. Bestandsdaten nachziehen (nach erstellt_am sortiert)
WITH ord AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY erstellt_am, id) AS rn
  FROM public.mandanten
  WHERE mandanten_nummer IS NULL
)
UPDATE public.mandanten m
SET mandanten_nummer = 'M-' || LPAD(o.rn::text, 4, '0')
FROM ord o
WHERE m.id = o.id;

-- 4. Sequenz auf aktuellen Maximalwert setzen
SELECT setval(
  'public.mandanten_nummer_seq',
  GREATEST(
    (SELECT COALESCE(MAX(NULLIF(regexp_replace(mandanten_nummer, '\D', '', 'g'), '')::int), 0) FROM public.mandanten),
    1
  )
);

-- 5. NOT NULL + UNIQUE
ALTER TABLE public.mandanten ALTER COLUMN mandanten_nummer SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mandanten_nummer_unique ON public.mandanten(mandanten_nummer);

-- 6. Trigger-Funktion für automatische Vergabe
CREATE OR REPLACE FUNCTION public.set_mandanten_nummer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mandanten_nummer IS NULL OR NEW.mandanten_nummer = '' THEN
    NEW.mandanten_nummer := 'M-' || LPAD(nextval('public.mandanten_nummer_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Trigger anlegen
DROP TRIGGER IF EXISTS trg_set_mandanten_nummer ON public.mandanten;
CREATE TRIGGER trg_set_mandanten_nummer
  BEFORE INSERT ON public.mandanten
  FOR EACH ROW EXECUTE FUNCTION public.set_mandanten_nummer();