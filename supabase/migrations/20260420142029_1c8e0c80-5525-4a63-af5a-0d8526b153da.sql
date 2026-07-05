-- Enable realtime for buchungen and buchhaltung_dokumente
ALTER TABLE public.buchungen REPLICA IDENTITY FULL;
ALTER TABLE public.buchhaltung_dokumente REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.buchungen;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.buchhaltung_dokumente;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;