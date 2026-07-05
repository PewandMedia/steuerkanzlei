
-- Allow authenticated users to create notifications (e.g. for "Beleg nachgereicht")
CREATE POLICY "Authentifizierte können Benachrichtigungen erstellen"
ON public.benachrichtigungen
FOR INSERT
TO authenticated
WITH CHECK (true);
