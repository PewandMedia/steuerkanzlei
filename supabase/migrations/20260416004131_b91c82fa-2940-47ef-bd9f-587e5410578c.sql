
ALTER TABLE public.mandanten
  ADD COLUMN vorname text,
  ADD COLUMN nachname text,
  ADD COLUMN geburtsdatum date,
  ADD COLUMN strasse text,
  ADD COLUMN plz text,
  ADD COLUMN ort text,
  ADD COLUMN telefon text,
  ADD COLUMN email text,
  ADD COLUMN steuernummer text,
  ADD COLUMN steuer_id text,
  ADD COLUMN umsatzsteuer_id text,
  ADD COLUMN unternehmensform text,
  ADD COLUMN notizen text;
