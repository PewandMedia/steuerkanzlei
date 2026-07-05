
-- Enum für Benutzerrollen
CREATE TYPE public.benutzer_rolle AS ENUM ('Sekretariat', 'Sachbearbeiter', 'Chef');

-- Enum für Buchhaltungsstatus
CREATE TYPE public.buchhaltung_status AS ENUM (
  'Eingegangen',
  'In Bearbeitung',
  'Warten auf Mandant',
  'In Prüfung',
  'Buchhaltung erledigt',
  'Abgegeben'
);

-- Rollen-Tabelle (separiert von Profilen für Sicherheit)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role benutzer_rolle NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security Definer Funktion für Rollenprüfung
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role benutzer_rolle)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Benutzer-Profiltabelle
CREATE TABLE public.benutzer (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.benutzer ENABLE ROW LEVEL SECURITY;

-- Mandanten
CREATE TABLE public.mandanten (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  firma TEXT,
  zugewiesener_bearbeiter_id UUID REFERENCES public.benutzer(id) ON DELETE SET NULL,
  erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mandanten ENABLE ROW LEVEL SECURITY;

-- Buchhaltungen
CREATE TABLE public.buchhaltungen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mandant_id UUID NOT NULL REFERENCES public.mandanten(id) ON DELETE CASCADE,
  bearbeiter_id UUID NOT NULL REFERENCES public.benutzer(id) ON DELETE RESTRICT,
  monat TEXT NOT NULL,
  status buchhaltung_status NOT NULL DEFAULT 'Eingegangen',
  belegeingang_datum DATE,
  fertiggestellt_datum DATE,
  abgabe_datum DATE,
  notizen TEXT,
  erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.buchhaltungen ENABLE ROW LEVEL SECURITY;

-- Kommentare
CREATE TABLE public.kommentare (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buchhaltung_id UUID NOT NULL REFERENCES public.buchhaltungen(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.benutzer(id) ON DELETE CASCADE,
  kommentar TEXT NOT NULL,
  erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kommentare ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authentifizierte können user_roles lesen"
  ON public.user_roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authentifizierte können benutzer lesen"
  ON public.benutzer FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Benutzer können eigenes Profil erstellen"
  ON public.benutzer FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigenes Profil bearbeiten"
  ON public.benutzer FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authentifizierte können mandanten lesen"
  ON public.mandanten FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authentifizierte können mandanten erstellen"
  ON public.mandanten FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authentifizierte können mandanten bearbeiten"
  ON public.mandanten FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authentifizierte können mandanten löschen"
  ON public.mandanten FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "Authentifizierte können buchhaltungen lesen"
  ON public.buchhaltungen FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authentifizierte können buchhaltungen erstellen"
  ON public.buchhaltungen FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authentifizierte können buchhaltungen bearbeiten"
  ON public.buchhaltungen FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authentifizierte können buchhaltungen löschen"
  ON public.buchhaltungen FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "Authentifizierte können kommentare lesen"
  ON public.kommentare FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authentifizierte können kommentare erstellen"
  ON public.kommentare FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authentifizierte können eigene kommentare bearbeiten"
  ON public.kommentare FOR UPDATE TO authenticated
  USING (auth.uid() = (SELECT b.user_id FROM public.benutzer b WHERE b.id = public.kommentare.user_id));

CREATE POLICY "Authentifizierte können eigene kommentare löschen"
  ON public.kommentare FOR DELETE TO authenticated
  USING (auth.uid() = (SELECT b.user_id FROM public.benutzer b WHERE b.id = public.kommentare.user_id));

-- Indizes für Performance
CREATE INDEX idx_mandanten_bearbeiter ON public.mandanten(zugewiesener_bearbeiter_id);
CREATE INDEX idx_buchhaltungen_mandant ON public.buchhaltungen(mandant_id);
CREATE INDEX idx_buchhaltungen_bearbeiter ON public.buchhaltungen(bearbeiter_id);
CREATE INDEX idx_buchhaltungen_status ON public.buchhaltungen(status);
CREATE INDEX idx_buchhaltungen_monat ON public.buchhaltungen(monat);
CREATE INDEX idx_kommentare_buchhaltung ON public.kommentare(buchhaltung_id);
