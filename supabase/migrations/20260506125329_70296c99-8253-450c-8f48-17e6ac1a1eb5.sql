DROP POLICY IF EXISTS "mandanten_insert" ON public.mandanten;
CREATE POLICY "mandanten_insert" ON public.mandanten
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  );

DROP POLICY IF EXISTS "buchhaltungen_insert" ON public.buchhaltungen;
CREATE POLICY "buchhaltungen_insert" ON public.buchhaltungen
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  );