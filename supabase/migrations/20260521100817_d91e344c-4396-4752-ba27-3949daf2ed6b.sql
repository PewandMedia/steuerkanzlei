ALTER TABLE public.buchhaltungen ADD COLUMN IF NOT EXISTS gruppen_id uuid;
CREATE INDEX IF NOT EXISTS idx_buchhaltungen_gruppen_id ON public.buchhaltungen(gruppen_id);