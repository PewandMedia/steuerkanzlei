
-- Drop dependent triggers/functions first
DROP TRIGGER IF EXISTS trg_set_buchung_geaendert ON public.buchungen;
DROP FUNCTION IF EXISTS public.set_buchung_geaendert() CASCADE;

-- Drop dependent tables
DROP TABLE IF EXISTS public.buchungen CASCADE;
DROP TABLE IF EXISTS public.buchhaltungs_abschluesse CASCADE;

-- Remove automation flag
ALTER TABLE public.buchhaltungen DROP COLUMN IF EXISTS automatisierung_aktiv;

-- Remove OCR-related columns from buchhaltung_dokumente if they exist
ALTER TABLE public.buchhaltung_dokumente DROP COLUMN IF EXISTS ocr_status;
ALTER TABLE public.buchhaltung_dokumente DROP COLUMN IF EXISTS ocr_result;
ALTER TABLE public.buchhaltung_dokumente DROP COLUMN IF EXISTS ocr_error;
ALTER TABLE public.buchhaltung_dokumente DROP COLUMN IF EXISTS ocr_verarbeitet_am;
