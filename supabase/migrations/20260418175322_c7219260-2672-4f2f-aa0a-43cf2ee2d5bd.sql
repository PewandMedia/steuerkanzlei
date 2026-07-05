ALTER TABLE public.buchhaltung_dokumente
  ADD COLUMN IF NOT EXISTS ocr_data jsonb,
  ADD COLUMN IF NOT EXISTS ocr_status text,
  ADD COLUMN IF NOT EXISTS ocr_am timestamp with time zone;

-- Allow updates so the OCR result can be cached back to the row.
-- Anyone who can SELECT a Beleg may also write the OCR cache for it.
DROP POLICY IF EXISTS dokumente_update ON public.buchhaltung_dokumente;
CREATE POLICY dokumente_update
ON public.buchhaltung_dokumente
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.buchhaltungen b
    WHERE b.id = buchhaltung_dokumente.buchhaltung_id
      AND (
        public.has_role(auth.uid(), 'Chef'::public.benutzer_rolle)
        OR public.has_role(auth.uid(), 'Sekretariat'::public.benutzer_rolle)
        OR (
          public.has_role(auth.uid(), 'Sachbearbeiter'::public.benutzer_rolle)
          AND b.bearbeiter_id = (
            SELECT be.id FROM public.benutzer be WHERE be.user_id = auth.uid() LIMIT 1
          )
        )
      )
  )
);