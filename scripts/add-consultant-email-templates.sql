-- =====================================================================
-- consultant_email_templates
-- =====================================================================
-- Retour Maxine #1 (2026-04-21) : chaque consultant doit pouvoir
-- personnaliser ses emails transactionnels (aujourd'hui : notifications
-- KYC envoyées au client et au consultant lui-même après signature).
-- Les managers peuvent aussi définir leurs propres templates (chaque
-- consultant est autonome).
--
-- Si aucun template n'est enregistré pour un couple (consultant_id,
-- template_key), l'envoi retombe sur le template par défaut hardcodé
-- dans `src/lib/kyc-email.ts` (historique).
--
-- Variables supportées (substitution Mustache-style {{nom}}) :
--   · {{clientLabel}}       → "Dupont Jean" ou raison sociale
--   · {{clientFirstName}}   → "Jean" (vide si PM)
--   · {{signerName}}        → nom saisi à la signature
--   · {{signedAtStr}}       → "22 avril 2026 à 14:30"
--   · {{completionRate}}    → 100 | 87 | …
--   · {{missingFields}}     → liste texte "Adresse, Profession, …"
--   · {{consultantPrenom}}  → prénom du consultant (contexte consultant)
--
-- On ne stocke que le SUBJECT + le BODY (texte brut). Le serveur
-- enveloppe le body dans le template HTML PEV standard pour garder la
-- charte — le consultant n'a pas à se soucier du HTML.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.consultant_email_templates (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id  UUID        NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  template_key   TEXT        NOT NULL
                 CHECK (template_key IN ('kyc_signed_consultant', 'kyc_signed_client')),
  subject        TEXT        NOT NULL,
  body           TEXT        NOT NULL,
  enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (consultant_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_consultant_email_templates_consultant
  ON public.consultant_email_templates(consultant_id);

-- Trigger updated_at.
CREATE OR REPLACE FUNCTION public._consultant_email_templates_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consultant_email_templates_touch ON public.consultant_email_templates;
CREATE TRIGGER consultant_email_templates_touch
  BEFORE UPDATE ON public.consultant_email_templates
  FOR EACH ROW EXECUTE FUNCTION public._consultant_email_templates_touch();

-- =====================================================================
-- RLS
-- =====================================================================
-- Lecture : tout consultant authentifié peut lire ses propres templates,
--           tout manager/back_office peut lire ceux de n'importe qui.
-- Écriture (INSERT/UPDATE/DELETE) : consultant écrit ses propres,
--           manager écrit pour tous.
-- =====================================================================

ALTER TABLE public.consultant_email_templates ENABLE ROW LEVEL SECURITY;

-- Helper : renvoie l'id consultant lié au user authentifié (via auth_user_id).
CREATE OR REPLACE FUNCTION public._current_consultant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM consultants WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Helper : renvoie TRUE si le user authentifié est manager ou back_office.
CREATE OR REPLACE FUNCTION public._is_manager_or_bo()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM consultants
     WHERE auth_user_id = auth.uid()
       AND role IN ('manager', 'back_office')
  );
$$;

REVOKE ALL ON FUNCTION public._current_consultant_id() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._current_consultant_id() TO authenticated;
REVOKE ALL ON FUNCTION public._is_manager_or_bo() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._is_manager_or_bo() TO authenticated;

DROP POLICY IF EXISTS cet_select ON public.consultant_email_templates;
CREATE POLICY cet_select ON public.consultant_email_templates
  FOR SELECT TO authenticated
  USING (
    consultant_id = public._current_consultant_id()
    OR public._is_manager_or_bo()
  );

DROP POLICY IF EXISTS cet_insert ON public.consultant_email_templates;
CREATE POLICY cet_insert ON public.consultant_email_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    consultant_id = public._current_consultant_id()
    OR public._is_manager_or_bo()
  );

DROP POLICY IF EXISTS cet_update ON public.consultant_email_templates;
CREATE POLICY cet_update ON public.consultant_email_templates
  FOR UPDATE TO authenticated
  USING (
    consultant_id = public._current_consultant_id()
    OR public._is_manager_or_bo()
  )
  WITH CHECK (
    consultant_id = public._current_consultant_id()
    OR public._is_manager_or_bo()
  );

DROP POLICY IF EXISTS cet_delete ON public.consultant_email_templates;
CREATE POLICY cet_delete ON public.consultant_email_templates
  FOR DELETE TO authenticated
  USING (
    consultant_id = public._current_consultant_id()
    OR public._is_manager_or_bo()
  );

-- =====================================================================
-- Vérification rapide (commenté)
-- =====================================================================
-- SELECT * FROM consultant_email_templates;
-- SELECT public._current_consultant_id();
-- SELECT public._is_manager_or_bo();
