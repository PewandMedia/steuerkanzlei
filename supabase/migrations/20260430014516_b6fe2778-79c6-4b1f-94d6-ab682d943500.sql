-- Drop old combined trigger
DROP TRIGGER IF EXISTS buchhaltung_benachrichtigung ON public.buchhaltungen;

-- Drop duplicate faellig_am trigger (set_buchhaltung_faellig_am bleibt)
DROP TRIGGER IF EXISTS trg_set_faellig_am ON public.buchhaltungen;

-- New BEFORE-UPDATE function: nur Flag setzen
CREATE OR REPLACE FUNCTION public.set_zurueckgewiesen_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'In Prüfung' OR NEW.status = 'Buchhaltung erledigt' THEN
      NEW.zurueckgewiesen_am := NULL;
    END IF;
    IF OLD.status = 'In Prüfung' AND NEW.status = 'In Bearbeitung' THEN
      NEW.zurueckgewiesen_am := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Replace notify function with AFTER-only version (no NEW mutation)
CREATE OR REPLACE FUNCTION public.notify_on_buchhaltung_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  grund text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.bearbeiter_id IS NOT NULL THEN
      INSERT INTO public.benachrichtigungen (empfaenger_id, typ, titel, nachricht, buchhaltung_id)
      VALUES (
        NEW.bearbeiter_id,
        'neue_buchhaltung',
        'Neue Buchhaltung zugewiesen',
        'Eine neue Buchhaltung für Monat ' || NEW.monat || ' wurde Ihnen zugewiesen.',
        NEW.id
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'In Prüfung' THEN
      INSERT INTO public.benachrichtigungen (empfaenger_id, typ, titel, nachricht, buchhaltung_id)
      SELECT b.id, 'in_pruefung', 'Buchhaltung bereit zur Prüfung',
             'Buchhaltung für Monat ' || NEW.monat || ' ist bereit zur Prüfung.',
             NEW.id
      FROM public.benutzer b
      JOIN public.user_roles ur ON ur.user_id = b.user_id
      WHERE ur.role = 'Chef';
    END IF;

    IF NEW.status = 'Warten auf Mandant' THEN
      INSERT INTO public.benachrichtigungen (empfaenger_id, typ, titel, nachricht, buchhaltung_id)
      SELECT b.id, 'warten_auf_mandant', 'Mandant muss kontaktiert werden',
             'Buchhaltung für Monat ' || NEW.monat || ' wartet auf den Mandanten.',
             NEW.id
      FROM public.benutzer b
      JOIN public.user_roles ur ON ur.user_id = b.user_id
      WHERE ur.role = 'Sekretariat';
    END IF;

    IF OLD.status = 'In Prüfung' AND NEW.status = 'In Bearbeitung' THEN
      grund := CASE WHEN NEW.notizen IS NOT NULL AND length(trim(NEW.notizen)) > 0
                    THEN E'\nGrund: ' || NEW.notizen ELSE '' END;

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

-- Re-create triggers: BEFORE for flag, AFTER for notifications
CREATE TRIGGER buchhaltung_set_zurueckgewiesen_flag
BEFORE UPDATE ON public.buchhaltungen
FOR EACH ROW
EXECUTE FUNCTION public.set_zurueckgewiesen_flag();

CREATE TRIGGER buchhaltung_benachrichtigung
AFTER INSERT OR UPDATE ON public.buchhaltungen
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_buchhaltung_change();