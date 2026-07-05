-- 1. Mandanten: Dauerfristverlängerung als Stamm-Einstellung
ALTER TABLE public.mandanten
  ADD COLUMN IF NOT EXISTS dauerfristverlaengerung boolean NOT NULL DEFAULT false;

-- 2. Buchhaltungen: DFV pro Buchhaltung + Manuell-Flag
ALTER TABLE public.buchhaltungen
  ADD COLUMN IF NOT EXISTS dauerfristverlaengerung boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS faellig_am_manuell boolean NOT NULL DEFAULT false;

-- 3. set_faellig_am() neu: 10. des Folgemonats, +1 Monat bei DFV
CREATE OR REPLACE FUNCTION public.set_faellig_am()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m integer;
  y integer;
  base_date date;
  monate_offset integer;
BEGIN
  -- Wenn Frist manuell gesetzt wurde, nichts überschreiben
  IF NEW.faellig_am_manuell IS TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.faellig_am IS NULL AND NEW.monat IS NOT NULL THEN
    BEGIN
      m := split_part(NEW.monat, '-', 1)::integer;
      y := split_part(NEW.monat, '-', 2)::integer;

      -- Standard: +1 Monat. Mit DFV: +2 Monate. Tag = 10.
      monate_offset := CASE WHEN COALESCE(NEW.dauerfristverlaengerung, false) THEN 2 ELSE 1 END;

      base_date := make_date(y, m, 1) + (monate_offset || ' months')::interval;
      NEW.faellig_am := date_trunc('month', base_date)::date + 9; -- 1. + 9 Tage = 10.
    EXCEPTION WHEN OTHERS THEN
      NEW.faellig_am := CURRENT_DATE + INTERVAL '30 days';
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Trigger sicherstellen (BEFORE INSERT auf buchhaltungen)
DROP TRIGGER IF EXISTS trg_set_faellig_am ON public.buchhaltungen;
CREATE TRIGGER trg_set_faellig_am
BEFORE INSERT ON public.buchhaltungen
FOR EACH ROW
EXECUTE FUNCTION public.set_faellig_am();