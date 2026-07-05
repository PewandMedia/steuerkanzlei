ALTER TABLE public.buchhaltungs_abschluesse
  ADD CONSTRAINT buchhaltungs_abschluesse_buchhaltung_id_fkey
  FOREIGN KEY (buchhaltung_id) REFERENCES public.buchhaltungen(id) ON DELETE CASCADE;

ALTER TABLE public.buchhaltungs_abschluesse
  ADD CONSTRAINT buchhaltungs_abschluesse_erstellt_von_fkey
  FOREIGN KEY (erstellt_von) REFERENCES public.benutzer(id);

ALTER TABLE public.buchhaltungs_abschluesse
  ADD CONSTRAINT buchhaltungs_abschluesse_freigegeben_von_fkey
  FOREIGN KEY (freigegeben_von) REFERENCES public.benutzer(id);

CREATE INDEX IF NOT EXISTS idx_abschluesse_buchhaltung ON public.buchhaltungs_abschluesse(buchhaltung_id);