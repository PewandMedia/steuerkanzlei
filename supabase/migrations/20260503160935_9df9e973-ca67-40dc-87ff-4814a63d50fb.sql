UPDATE auth.users
SET email = 'Umed@taxom.de',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = (SELECT user_id FROM public.benutzer WHERE id = '2d6ea829-45b9-4cb5-ad2e-1c7c4af1520f');