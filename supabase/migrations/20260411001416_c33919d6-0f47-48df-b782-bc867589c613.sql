
-- Trigger: Auto-create benutzer profile and default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.benutzer (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'Sachbearbeiter');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Auto-assign bearbeiter on buchhaltung creation
CREATE OR REPLACE FUNCTION public.auto_assign_bearbeiter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_id uuid;
BEGIN
  -- Try to use the mandant's assigned bearbeiter
  SELECT zugewiesener_bearbeiter_id INTO assigned_id
  FROM public.mandanten
  WHERE id = NEW.mandant_id;
  
  IF assigned_id IS NOT NULL THEN
    NEW.bearbeiter_id := assigned_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_buchhaltung_insert
  BEFORE INSERT ON public.buchhaltungen
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_bearbeiter();
