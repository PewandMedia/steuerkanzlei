
-- Drop all existing permissive policies on buchhaltungen
DROP POLICY IF EXISTS "Authentifizierte können buchhaltungen bearbeiten" ON public.buchhaltungen;
DROP POLICY IF EXISTS "Authentifizierte können buchhaltungen erstellen" ON public.buchhaltungen;
DROP POLICY IF EXISTS "Authentifizierte können buchhaltungen lesen" ON public.buchhaltungen;
DROP POLICY IF EXISTS "Authentifizierte können buchhaltungen löschen" ON public.buchhaltungen;

-- Buchhaltungen: SELECT - Chef/Sekretariat see all, Sachbearbeiter only own
CREATE POLICY "buchhaltungen_select" ON public.buchhaltungen
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'Chef') OR
    public.has_role(auth.uid(), 'Sekretariat') OR
    (public.has_role(auth.uid(), 'Sachbearbeiter') AND bearbeiter_id = (
      SELECT id FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Buchhaltungen: INSERT - only Sekretariat
CREATE POLICY "buchhaltungen_insert" ON public.buchhaltungen
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'Sekretariat'));

-- Buchhaltungen: UPDATE - all authenticated (status transitions are enforced in app logic)
CREATE POLICY "buchhaltungen_update" ON public.buchhaltungen
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'Chef') OR
    public.has_role(auth.uid(), 'Sekretariat') OR
    (public.has_role(auth.uid(), 'Sachbearbeiter') AND bearbeiter_id = (
      SELECT id FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Buchhaltungen: DELETE - only Chef
CREATE POLICY "buchhaltungen_delete" ON public.buchhaltungen
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Chef'));

-- Drop all existing policies on mandanten
DROP POLICY IF EXISTS "Authentifizierte können mandanten bearbeiten" ON public.mandanten;
DROP POLICY IF EXISTS "Authentifizierte können mandanten erstellen" ON public.mandanten;
DROP POLICY IF EXISTS "Authentifizierte können mandanten lesen" ON public.mandanten;
DROP POLICY IF EXISTS "Authentifizierte können mandanten löschen" ON public.mandanten;

-- Mandanten: SELECT - Chef/Sekretariat see all, Sachbearbeiter only assigned
CREATE POLICY "mandanten_select" ON public.mandanten
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'Chef') OR
    public.has_role(auth.uid(), 'Sekretariat') OR
    (public.has_role(auth.uid(), 'Sachbearbeiter') AND zugewiesener_bearbeiter_id = (
      SELECT id FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Mandanten: INSERT - only Sekretariat
CREATE POLICY "mandanten_insert" ON public.mandanten
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'Sekretariat'));

-- Mandanten: UPDATE - Sekretariat and Chef
CREATE POLICY "mandanten_update" ON public.mandanten
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'Chef') OR
    public.has_role(auth.uid(), 'Sekretariat')
  );

-- Mandanten: DELETE - only Chef
CREATE POLICY "mandanten_delete" ON public.mandanten
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Chef'));
