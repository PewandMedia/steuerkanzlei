-- Step 1: Remove duplicate bookings (keep the most recent per document)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY buchhaltung_id, dokument_id
           ORDER BY erstellt_am DESC, id DESC
         ) AS rn
  FROM public.buchungen
  WHERE dokument_id IS NOT NULL
)
DELETE FROM public.buchungen
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: Prevent future duplicates with partial UNIQUE index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_buchung_pro_dokument
  ON public.buchungen (buchhaltung_id, dokument_id)
  WHERE dokument_id IS NOT NULL;