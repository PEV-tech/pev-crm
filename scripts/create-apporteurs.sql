-- =============================================================================
-- create-apporteurs.sql — Reverse-engineered DDL pour la table `apporteurs`
-- =============================================================================
--
-- Date : 2026-04-25
-- Contexte :
--   La table `apporteurs` a été créée directement en prod via Supabase SQL
--   editor le 2026-04-13 (commit `6bd8756` côté front). Aucun script DDL
--   n'avait été tracé dans `scripts/`. Ce fichier comble cette dette pour
--   qu'un environnement neuf soit reproductible (cf. STATUS.md §Dette résiduelle).
--
-- Source de vérité utilisée pour la reverse-engineering :
--   - `src/types/database.ts` (régénéré 2026-04-20, commit `6ab7c4f`)
--   - `dossiers.apporteur_id` FK vers `apporteurs.id`
--   - usage front dans `dossier-detail-wrapper.tsx` (sélection nom/prénom/taux)
--
-- Idempotent : utilise IF NOT EXISTS partout. Sûr à rejouer.
--
-- ⚠️  Ne PAS appliquer ce script sur un environnement où la table existe déjà
-- (production) — il est idempotent mais génère du bruit dans les logs Supabase.
-- Réservé aux nouveaux environnements (dev/staging/restauration backup).
-- =============================================================================

-- 1. Table apporteurs
CREATE TABLE IF NOT EXISTS public.apporteurs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT NOT NULL,
  prenom          TEXT NOT NULL,
  taux_commission NUMERIC(5,4),                                     -- ex. 0.0500 = 5%
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID REFERENCES public.consultants(id) ON DELETE SET NULL
);

-- 2. Index secondaire pour la recherche par nom (utilisée dans le dropdown)
CREATE INDEX IF NOT EXISTS idx_apporteurs_nom ON public.apporteurs (nom, prenom);

-- 3. RLS — alignée sur la politique générale du CRM
--    (lecture pour tout consultant authentifié, mutations managers/back-office only)
ALTER TABLE public.apporteurs ENABLE ROW LEVEL SECURITY;

-- SELECT : tous les utilisateurs authentifiés
DROP POLICY IF EXISTS apporteurs_select ON public.apporteurs;
CREATE POLICY apporteurs_select ON public.apporteurs
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT : managers + back-office
DROP POLICY IF EXISTS apporteurs_insert ON public.apporteurs;
CREATE POLICY apporteurs_insert ON public.apporteurs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_manager() OR public.is_back_office());

-- UPDATE : managers + back-office
DROP POLICY IF EXISTS apporteurs_update ON public.apporteurs;
CREATE POLICY apporteurs_update ON public.apporteurs
  FOR UPDATE
  TO authenticated
  USING (public.is_manager() OR public.is_back_office())
  WITH CHECK (public.is_manager() OR public.is_back_office());

-- DELETE : managers only
DROP POLICY IF EXISTS apporteurs_delete ON public.apporteurs;
CREATE POLICY apporteurs_delete ON public.apporteurs
  FOR DELETE
  TO authenticated
  USING (public.is_manager());

-- 4. FK depuis dossiers (déjà présente en prod, reproduite ici pour les nouveaux envs)
--    cf. dossiers.apporteur_id → apporteurs.id avec ON DELETE SET NULL
ALTER TABLE public.dossiers
  DROP CONSTRAINT IF EXISTS dossiers_apporteur_id_fkey;

ALTER TABLE public.dossiers
  ADD CONSTRAINT dossiers_apporteur_id_fkey
  FOREIGN KEY (apporteur_id) REFERENCES public.apporteurs(id) ON DELETE SET NULL;

-- 5. Commentaires de documentation
COMMENT ON TABLE  public.apporteurs IS 'Apporteurs d''affaires externes (référents tiers, NPS payés en %). FK depuis dossiers.apporteur_id.';
COMMENT ON COLUMN public.apporteurs.taux_commission IS 'Taux de rétro-commission par défaut sur le brut (NUMERIC, ex. 0.0500 = 5%). Surchargeable au niveau dossier via taux_apporteur_ext.';
COMMENT ON COLUMN public.apporteurs.created_by      IS 'Consultant qui a saisi cet apporteur (audit trail).';
