-- user_roles: Chef darf INSERT/UPDATE/DELETE
CREATE POLICY "chef_roles_insert"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'Chef'::benutzer_rolle));

CREATE POLICY "chef_roles_update"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'Chef'::benutzer_rolle));

CREATE POLICY "chef_roles_delete"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'Chef'::benutzer_rolle) AND user_id <> auth.uid());

-- benutzer: Chef darf Namen anderer Benutzer bearbeiten
CREATE POLICY "chef_benutzer_update"
  ON public.benutzer
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'Chef'::benutzer_rolle));