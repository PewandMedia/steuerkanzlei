
-- Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('belege', 'belege', false);

-- Storage RLS policies
CREATE POLICY "Authentifizierte können Belege lesen"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'belege');

CREATE POLICY "Sekretariat und Chef können Belege hochladen"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'belege'
  AND (
    public.has_role(auth.uid(), 'Sekretariat'::public.benutzer_rolle)
    OR public.has_role(auth.uid(), 'Chef'::public.benutzer_rolle)
    OR public.has_role(auth.uid(), 'Sachbearbeiter'::public.benutzer_rolle)
  )
);

CREATE POLICY "Sekretariat und Chef können Belege löschen"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'belege'
  AND (
    public.has_role(auth.uid(), 'Sekretariat'::public.benutzer_rolle)
    OR public.has_role(auth.uid(), 'Chef'::public.benutzer_rolle)
  )
);

-- Dokumente-Tabelle
CREATE TABLE public.buchhaltung_dokumente (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buchhaltung_id UUID NOT NULL REFERENCES public.buchhaltungen(id) ON DELETE CASCADE,
  dateiname TEXT NOT NULL,
  dateipfad TEXT NOT NULL,
  hochgeladen_von UUID NOT NULL REFERENCES public.benutzer(id),
  erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.buchhaltung_dokumente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dokumente_select"
ON public.buchhaltung_dokumente FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.buchhaltungen b
    WHERE b.id = buchhaltung_id
    AND (
      public.has_role(auth.uid(), 'Chef'::public.benutzer_rolle)
      OR public.has_role(auth.uid(), 'Sekretariat'::public.benutzer_rolle)
      OR (public.has_role(auth.uid(), 'Sachbearbeiter'::public.benutzer_rolle)
          AND b.bearbeiter_id = (SELECT be.id FROM public.benutzer be WHERE be.user_id = auth.uid() LIMIT 1))
    )
  )
);

CREATE POLICY "dokumente_insert"
ON public.buchhaltung_dokumente FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'Sekretariat'::public.benutzer_rolle)
  OR public.has_role(auth.uid(), 'Chef'::public.benutzer_rolle)
  OR public.has_role(auth.uid(), 'Sachbearbeiter'::public.benutzer_rolle)
);

CREATE POLICY "dokumente_delete"
ON public.buchhaltung_dokumente FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'Sekretariat'::public.benutzer_rolle)
  OR public.has_role(auth.uid(), 'Chef'::public.benutzer_rolle)
);
