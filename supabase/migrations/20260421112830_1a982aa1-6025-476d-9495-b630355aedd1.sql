ALTER TABLE public.buchhaltungs_abschluesse
  ADD COLUMN IF NOT EXISTS steuerberater_geprueft_am timestamptz NULL,
  ADD COLUMN IF NOT EXISTS steuerberater_geprueft_von uuid NULL,
  ADD COLUMN IF NOT EXISTS steuerberater_notiz text NULL;