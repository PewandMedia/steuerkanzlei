ALTER TABLE public.buchhaltung_co_bearbeiter
  ADD CONSTRAINT buchhaltung_co_bearbeiter_buchhaltung_id_fkey
  FOREIGN KEY (buchhaltung_id) REFERENCES public.buchhaltungen(id) ON DELETE CASCADE;

ALTER TABLE public.buchhaltung_co_bearbeiter
  ADD CONSTRAINT buchhaltung_co_bearbeiter_bearbeiter_id_fkey
  FOREIGN KEY (bearbeiter_id) REFERENCES public.benutzer(id) ON DELETE CASCADE;