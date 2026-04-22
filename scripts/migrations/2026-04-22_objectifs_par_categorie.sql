-- Migration: objectifs de collecte par catégorie (SCPI / PE / LUX)
-- Date: 2026-04-22
-- Context: retour Maxine — les objectifs consultant ne sont pas globaux,
--          ils sont répartis par famille de produits : SCPI, Private Equity
--          et CAPI Luxembourgeoise. L'UI Paramètres > Équipe > Objectifs
--          doit permettre d'éditer les 3 montants. Le champ `objectif`
--          existant est conservé (colonne dérivée = somme des 3 catégories)
--          pour garder le dashboard compatible sans refactor.
--
-- À exécuter dans l'éditeur SQL Supabase.
-- Rollback: voir section ROLLBACK en bas.

BEGIN;

-- 1) Nouvelles colonnes par catégorie (montants en €)
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS objectif_scpi numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS objectif_pe   numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS objectif_lux  numeric(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.challenges.objectif_scpi IS
  'Objectif annuel de collecte SCPI (€).';
COMMENT ON COLUMN public.challenges.objectif_pe IS
  'Objectif annuel de collecte Private Equity (€).';
COMMENT ON COLUMN public.challenges.objectif_lux IS
  'Objectif annuel de collecte CAPI Luxembourgeoise (€).';

-- 2) Rétrocompat : `objectif` devient la somme des 3 catégories.
--    - Au démarrage : si les catégories sont à 0, on reventile
--      l'ancien `objectif` à 100% sur SCPI (choix par défaut le moins
--      surprenant vu que SCPI est la famille majoritaire historiquement).
UPDATE public.challenges
   SET objectif_scpi = objectif
 WHERE objectif > 0
   AND objectif_scpi = 0
   AND objectif_pe = 0
   AND objectif_lux = 0;

-- 3) Trigger qui maintient `objectif` en somme des 3 catégories.
CREATE OR REPLACE FUNCTION public.sync_challenge_objectif()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.objectif := COALESCE(NEW.objectif_scpi, 0)
                + COALESCE(NEW.objectif_pe, 0)
                + COALESCE(NEW.objectif_lux, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_challenge_objectif ON public.challenges;
CREATE TRIGGER trg_sync_challenge_objectif
  BEFORE INSERT OR UPDATE OF objectif_scpi, objectif_pe, objectif_lux
  ON public.challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_challenge_objectif();

-- 4) Re-synchronise l'existant (au cas où `objectif` avait dérivé).
UPDATE public.challenges
   SET objectif_scpi = objectif_scpi;  -- no-op qui déclenche le trigger

-- 5) Régénérer les types TS :
--    npx supabase gen types typescript --project-id <id> > src/types/database.ts

COMMIT;

-- =============================================================
-- ROLLBACK
-- =============================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_sync_challenge_objectif ON public.challenges;
-- DROP FUNCTION IF EXISTS public.sync_challenge_objectif();
-- ALTER TABLE public.challenges
--   DROP COLUMN IF EXISTS objectif_lux,
--   DROP COLUMN IF EXISTS objectif_pe,
--   DROP COLUMN IF EXISTS objectif_scpi;
-- COMMIT;
