
-- Benachrichtigungen table
CREATE TABLE public.benachrichtigungen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empfaenger_id uuid NOT NULL REFERENCES public.benutzer(id) ON DELETE CASCADE,
  typ text NOT NULL,
  titel text NOT NULL,
  nachricht text NOT NULL,
  gelesen boolean NOT NULL DEFAULT false,
  buchhaltung_id uuid REFERENCES public.buchhaltungen(id) ON DELETE CASCADE,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.benachrichtigungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Benutzer sehen eigene Benachrichtigungen"
ON public.benachrichtigungen FOR SELECT
TO authenticated
USING (empfaenger_id = (SELECT id FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Benutzer können eigene Benachrichtigungen aktualisieren"
ON public.benachrichtigungen FOR UPDATE
TO authenticated
USING (empfaenger_id = (SELECT id FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1));

-- Index
CREATE INDEX idx_benachrichtigungen_empfaenger ON public.benachrichtigungen(empfaenger_id, gelesen);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.benachrichtigungen;

-- Trigger function
CREATE OR REPLACE FUNCTION public.notify_on_buchhaltung_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT: notify the assigned bearbeiter
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

  -- UPDATE: check status changes
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- In Prüfung -> notify all Chefs
    IF NEW.status = 'In Prüfung' THEN
      INSERT INTO public.benachrichtigungen (empfaenger_id, typ, titel, nachricht, buchhaltung_id)
      SELECT b.id, 'in_pruefung', 'Buchhaltung bereit zur Prüfung',
             'Buchhaltung für Monat ' || NEW.monat || ' ist bereit zur Prüfung.',
             NEW.id
      FROM public.benutzer b
      JOIN public.user_roles ur ON ur.user_id = b.user_id
      WHERE ur.role = 'Chef';
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
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger
CREATE TRIGGER buchhaltung_benachrichtigung
AFTER INSERT OR UPDATE OF status ON public.buchhaltungen
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_buchhaltung_change();
