-- Add column to track rejection
ALTER TABLE public.buchhaltungen
ADD COLUMN IF NOT EXISTS zurueckgewiesen_am timestamptz NULL;

-- Update notify trigger function
CREATE OR REPLACE FUNCTION public.notify_on_buchhaltung_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grund text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.benachrichtigungen (empfaenger_id, typ, titel, nachricht, buchhaltung_id)
    VALUES (
      NEW.bearbeiter_id,
      'neue_buchhaltung',
      'Neue Buchhaltung zugewiesen',
      'Eine neue Buchhaltung für Monat ' || NEW.monat || ' wurde Ihnen zugewiesen.',
      NEW.id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- In Prüfung -> notify all Chefs + clear rejection flag
    IF NEW.status = 'In Prüfung' THEN
      NEW.zurueckgewiesen_am := NULL;

      INSERT INTO public.benachrichtigungen (empfaenger_id, typ, titel, nachricht, buchhaltung_id)
      SELECT b.id, 'in_pruefung', 'Buchhaltung bereit zur Prüfung',
             'Buchhaltung für Monat ' || NEW.monat || ' ist bereit zur Prüfung.',
             NEW.id
      FROM public.benutzer b
      JOIN public.user_roles ur ON ur.user_id = b.user_id
      WHERE ur.role = 'Chef';
    END IF;

    -- Buchhaltung erledigt -> clear rejection flag
    IF NEW.status = 'Buchhaltung erledigt' THEN
      NEW.zurueckgewiesen_am := NULL;
    END IF;

    -- Warten auf Mandant -> notify Sekretariat
    IF NEW.status = 'Warten auf Mandant' THEN
      INSERT INTO public.benachrichtigungen (empfaenger_id, typ, titel, nachricht, buchhaltung_id)
      SELECT b.id, 'warten_auf_mandant', 'Mandant muss kontaktiert werden',
             'Buchhaltung für Monat ' || NEW.monat || ' wartet auf den Mandanten.',
             NEW.id
      FROM public.benutzer b
      JOIN public.user_roles ur ON ur.user_id = b.user_id
      WHERE ur.role = 'Sekretariat';
    END IF;

    -- Zurückweisung: In Prüfung -> In Bearbeitung
    IF OLD.status = 'In Prüfung' AND NEW.status = 'In Bearbeitung' THEN
      NEW.zurueckgewiesen_am := now();
      grund := CASE WHEN NEW.notizen IS NOT NULL AND length(trim(NEW.notizen)) > 0
                    THEN E'\nGrund: ' || NEW.notizen ELSE '' END;

      -- Hauptbearbeiter
      IF NEW.bearbeiter_id IS NOT NULL THEN
        INSERT INTO public.benachrichtigungen (empfaenger_id, typ, titel, nachricht, buchhaltung_id)
        VALUES (
          NEW.bearbeiter_id,
          'zurueckgewiesen',
          'Buchhaltung zurückgewiesen',
          'Monat ' || NEW.monat || ' wurde vom Chef zurückgewiesen.' || grund,
          NEW.id
        );
      END IF;

      -- Co-Bearbeiter
      INSERT INTO public.benachrichtigungen (empfaenger_id, typ, titel, nachricht, buchhaltung_id)
      SELECT c.bearbeiter_id, 'zurueckgewiesen', 'Buchhaltung zurückgewiesen',
             'Monat ' || NEW.monat || ' wurde vom Chef zurückgewiesen.' || grund,
             NEW.id
      FROM public.buchhaltung_co_bearbeiter c
      WHERE c.buchhaltung_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger must be BEFORE UPDATE for NEW.zurueckgewiesen_am assignments to persist
DROP TRIGGER IF EXISTS buchhaltung_benachrichtigung ON public.buchhaltungen;
CREATE TRIGGER buchhaltung_benachrichtigung
BEFORE INSERT OR UPDATE OF status ON public.buchhaltungen
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_buchhaltung_change();