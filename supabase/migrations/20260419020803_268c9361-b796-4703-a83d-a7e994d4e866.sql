-- Neue Tabelle für abgeschlossene Buchhaltungen
CREATE TABLE public.buchhaltungs_abschluesse (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buchhaltung_id UUID NOT NULL UNIQUE,
  erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  erstellt_von UUID NOT NULL,
  journal_pdf_pfad TEXT,
  susa_pdf_pfad TEXT,
  ustva_pdf_pfad TEXT,
  paket_pdf_pfad TEXT,
  ustva_kennziffern JSONB NOT NULL DEFAULT '{}'::jsonb,
  susa_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  journal_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  freigegeben_am TIMESTAMP WITH TIME ZONE,
  freigegeben_von UUID,
  finanzamt_eingereicht_am DATE,
  finanzamt_referenz TEXT
);

CREATE INDEX idx_abschluesse_buchhaltung ON public.buchhaltungs_abschluesse(buchhaltung_id);

ALTER TABLE public.buchhaltungs_abschluesse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "abschluesse_select"
ON public.buchhaltungs_abschluesse FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND EXISTS (
      SELECT 1 FROM public.buchhaltungen b
      WHERE b.id = buchhaltungs_abschluesse.buchhaltung_id
        AND b.bearbeiter_id = (SELECT id FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

CREATE POLICY "abschluesse_insert"
ON public.buchhaltungs_abschluesse FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  OR (
    has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
    AND EXISTS (
      SELECT 1 FROM public.buchhaltungen b
      WHERE b.id = buchhaltungs_abschluesse.buchhaltung_id
        AND b.bearbeiter_id = (SELECT id FROM public.benutzer WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

CREATE POLICY "abschluesse_update"
ON public.buchhaltungs_abschluesse FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'Chef'::benutzer_rolle)
  OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
);

CREATE POLICY "abschluesse_delete"
ON public.buchhaltungs_abschluesse FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'Chef'::benutzer_rolle));

-- Storage Bucket für Buchhaltungs-PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('buchhaltungen', 'buchhaltungen', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "buchhaltungen_storage_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'buchhaltungen'
  AND (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
  )
);

CREATE POLICY "buchhaltungen_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'buchhaltungen'
  AND (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sachbearbeiter'::benutzer_rolle)
  )
);

CREATE POLICY "buchhaltungen_storage_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'buchhaltungen'
  AND (
    has_role(auth.uid(), 'Chef'::benutzer_rolle)
    OR has_role(auth.uid(), 'Sekretariat'::benutzer_rolle)
  )
);

CREATE POLICY "buchhaltungen_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'buchhaltungen'
  AND has_role(auth.uid(), 'Chef'::benutzer_rolle)
);