
-- Add faellig_am column
ALTER TABLE public.buchhaltungen ADD COLUMN faellig_am date;

-- Trigger function to auto-set deadline
CREATE OR REPLACE FUNCTION public.set_faellig_am()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  m integer;
  y integer;
  next_m integer;
  next_y integer;
BEGIN
  -- Only set if not manually provided
  IF NEW.faellig_am IS NULL AND NEW.monat IS NOT NULL THEN
    BEGIN
      -- Parse MM-YYYY format
      m := split_part(NEW.monat, '-', 1)::integer;
      y := split_part(NEW.monat, '-', 2)::integer;
      
      -- Calculate next month
      IF m = 12 THEN
        next_m := 1;
        next_y := y + 1;
      ELSE
        next_m := m + 1;
        next_y := y;
      END IF;
      
      NEW.faellig_am := make_date(next_y, next_m, 15);
    EXCEPTION WHEN OTHERS THEN
      -- If parsing fails, set 30 days from now
      NEW.faellig_am := CURRENT_DATE + INTERVAL '30 days';
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_buchhaltung_faellig_am
BEFORE INSERT ON public.buchhaltungen
FOR EACH ROW
EXECUTE FUNCTION public.set_faellig_am();

-- Backfill existing rows
UPDATE public.buchhaltungen
SET faellig_am = CASE
  WHEN monat ~ '^\d{2}-\d{4}$' THEN
    make_date(
      CASE WHEN split_part(monat, '-', 1)::int = 12 THEN split_part(monat, '-', 2)::int + 1 ELSE split_part(monat, '-', 2)::int END,
      CASE WHEN split_part(monat, '-', 1)::int = 12 THEN 1 ELSE split_part(monat, '-', 1)::int + 1 END,
      15
    )
  ELSE CURRENT_DATE + INTERVAL '30 days'
END
WHERE faellig_am IS NULL;
