ALTER TABLE public.buchhaltungen
  ADD COLUMN automatisierung_aktiv boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.buchhaltungen.automatisierung_aktiv IS
  'Wenn true: OCR, Buchungserfassung und UStVA-Paket werden angeboten. Wenn false: nur Belegweiterleitung + Status.';