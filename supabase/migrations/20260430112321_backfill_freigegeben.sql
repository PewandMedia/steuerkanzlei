-- Backfill: Alle Abschlüsse, deren Buchhaltung bereits "Buchhaltung erledigt" ist,
-- aber noch kein freigegeben_am haben, werden als freigegeben markiert.
UPDATE public.buchhaltungs_abschluesse a
SET freigegeben_am = COALESCE(b.fertiggestellt_datum::timestamptz, now())
FROM public.buchhaltungen b
WHERE b.id = a.buchhaltung_id
  AND b.status = 'Buchhaltung erledigt'
  AND a.freigegeben_am IS NULL;
