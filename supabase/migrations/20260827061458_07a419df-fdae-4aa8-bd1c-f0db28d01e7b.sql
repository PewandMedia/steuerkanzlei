REVOKE ALL ON FUNCTION public.current_arbeitsbereich() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mandant_in_arbeitsbereich(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buchhaltung_in_arbeitsbereich(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_mandant_arbeitsbereich() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_arbeitsbereich() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mandant_in_arbeitsbereich(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buchhaltung_in_arbeitsbereich(uuid) TO authenticated, service_role;