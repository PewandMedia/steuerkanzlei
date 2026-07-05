CREATE OR REPLACE FUNCTION public.auto_assign_bearbeiter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assigned_id uuid;
BEGIN
  -- Only auto-assign if no bearbeiter was provided manually
  IF NEW.bearbeiter_id IS NULL THEN
    SELECT zugewiesener_bearbeiter_id INTO assigned_id
    FROM public.mandanten
    WHERE id = NEW.mandant_id;

    IF assigned_id IS NOT NULL THEN
      NEW.bearbeiter_id := assigned_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;