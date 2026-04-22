-- Migration: enrichir le catalogue Partenaire × Produit
-- Date: 2026-04-22
-- Context: section Paramètres > Catalogue doit afficher pour chaque (partenaire, produit)
--          les frais d'entrée, frais d'encours, prix de part et commission rétrocédée.
--          Tout pilooté par DB (rien en dur côté code).
--
-- À exécuter dans l'éditeur SQL Supabase (project: PEV CRM).
-- Rollback: voir section ROLLBACK en bas.

BEGIN;

-- 1) Ajout du taux d'encours sur la compagnie (déjà utilisé par l'UI mais absent en DB)
ALTER TABLE public.compagnies
  ADD COLUMN IF NOT EXISTS taux_encours numeric(6,4) NULL;

COMMENT ON COLUMN public.compagnies.taux_encours IS
  'Taux d''encours par défaut de la compagnie (fallback si aucune ligne taux_produit_compagnie).';

-- 2) Enrichissement de taux_produit_compagnie
--    Ces 4 colonnes deviennent les "détails catalogue" par couple (produit, compagnie).
ALTER TABLE public.taux_produit_compagnie
  ADD COLUMN IF NOT EXISTS frais_entree numeric(6,4) NULL,
  ADD COLUMN IF NOT EXISTS frais_encours numeric(6,4) NULL,
  ADD COLUMN IF NOT EXISTS prix_part numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS commission_retrocedee numeric(6,4) NULL;

COMMENT ON COLUMN public.taux_produit_compagnie.frais_entree IS
  'Frais d''entrée facturés au client (ex: 0.0250 = 2,5%).';
COMMENT ON COLUMN public.taux_produit_compagnie.frais_encours IS
  'Frais d''encours annuels facturés au client (ex: 0.0100 = 1%).';
COMMENT ON COLUMN public.taux_produit_compagnie.prix_part IS
  'Prix de la part / de l''unité de compte (en €).';
COMMENT ON COLUMN public.taux_produit_compagnie.commission_retrocedee IS
  'Commission rétrocédée au cabinet sur l''encours (ex: 0.0050 = 0,5%).';

-- 3) Index utile pour la vue Catalogue (groupée par compagnie)
CREATE INDEX IF NOT EXISTS idx_taux_produit_compagnie_compagnie_produit
  ON public.taux_produit_compagnie (compagnie_id, produit_id);

-- 4) Régénérer les types TS côté repo après migration :
--    npx supabase gen types typescript --project-id <id> > src/types/database.ts

COMMIT;

-- =============================================================
-- ROLLBACK (à ne jouer que si besoin d'annuler)
-- =============================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_taux_produit_compagnie_compagnie_produit;
-- ALTER TABLE public.taux_produit_compagnie
--   DROP COLUMN IF EXISTS commission_retrocedee,
--   DROP COLUMN IF EXISTS prix_part,
--   DROP COLUMN IF EXISTS frais_encours,
--   DROP COLUMN IF EXISTS frais_entree;
-- ALTER TABLE public.compagnies DROP COLUMN IF EXISTS taux_encours;
-- COMMIT;
