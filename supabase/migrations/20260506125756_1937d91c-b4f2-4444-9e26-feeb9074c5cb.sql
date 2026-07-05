DROP POLICY IF EXISTS "buchhaltungen_delete" ON public.buchhaltungen;
CREATE POLICY "buchhaltungen_delete" ON public.buchhaltungen
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  );

DROP POLICY IF EXISTS "abschluesse_delete" ON public.buchhaltungs_abschluesse;
CREATE POLICY "abschluesse_delete" ON public.buchhaltungs_abschluesse
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  );

DROP POLICY IF EXISTS "benachrichtigungen_delete" ON public.benachrichtigungen;
CREATE POLICY "benachrichtigungen_delete" ON public.benachrichtigungen
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  );