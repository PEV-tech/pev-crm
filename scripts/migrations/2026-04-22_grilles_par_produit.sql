-- Migration: grilles de rémunération par catégorie produit
-- Date: 2026-04-22
-- Context: retour Maxine — il faut 3 grilles distinctes :
--          · CAV      (contrat assurance-vie français)
--          · CAPI_LUX (contrat capitalisation / assurance-vie luxembourgeoise)
--          · PE       (private equity, grille sur les droits d'entrée,
--                      dégressif de 3% à 0,5% selon le montant souscrit)
--          Les taux sont INDICATIFS : le consultant peut les modifier
--          dossier par dossier au moment de la saisie.
--
-- Rollback: voir section ROLLBACK en bas.

BEGIN;

-- 1) Nouvelles colonnes sur grilles_frais
ALTER TABLE public.grilles_frais
  ADD COLUMN IF NOT EXISTS produit_categorie text NULL,
  ADD COLUMN IF NOT EXISTS libelle           text NULL;

COMMENT ON COLUMN public.grilles_frais.produit_categorie IS
  'Catégorie produit à laquelle s''applique la grille : CAV | CAPI_LUX | PE | NULL (=tous).';
COMMENT ON COLUMN public.grilles_frais.libelle IS
  'Libellé lisible pour le manager (ex: "PE — droits d''entrée dégressifs 2026").';

-- Contrainte de validité (text libre pour tolérer le NULL historique)
ALTER TABLE public.grilles_frais
  DROP CONSTRAINT IF EXISTS grilles_frais_produit_categorie_chk;
ALTER TABLE public.grilles_frais
  ADD CONSTRAINT grilles_frais_produit_categorie_chk
  CHECK (produit_categorie IS NULL
      OR produit_categorie IN ('CAV', 'CAPI_LUX', 'PE'));

-- 2) Seed du preset "PE — droits d'entrée dégressifs" (si absent)
--    Barème indicatif retour Maxine : 3% de 100K à 200K, dégressif jusqu'à 0,5%.
INSERT INTO public.grilles_frais
  (type_frais, encours_min, encours_max, taux, actif, produit_categorie, libelle)
SELECT 'entree', 100000,  200000, 0.0300, true, 'PE', 'PE — Droit d''entrée 100K-200K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.grilles_frais
   WHERE produit_categorie = 'PE' AND type_frais = 'entree'
     AND encours_min = 100000
);

INSERT INTO public.grilles_frais
  (type_frais, encours_min, encours_max, taux, actif, produit_categorie, libelle)
SELECT 'entree', 200000,  300000, 0.0200, true, 'PE', 'PE — Droit d''entrée 200K-300K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.grilles_frais
   WHERE produit_categorie = 'PE' AND type_frais = 'entree'
     AND encours_min = 200000
);

INSERT INTO public.grilles_frais
  (type_frais, encours_min, encours_max, taux, actif, produit_categorie, libelle)
SELECT 'entree', 300000,  500000, 0.0100, true, 'PE', 'PE — Droit d''entrée 300K-500K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.grilles_frais
   WHERE produit_categorie = 'PE' AND type_frais = 'entree'
     AND encours_min = 300000
);

INSERT INTO public.grilles_frais
  (type_frais, encours_min, encours_max, taux, actif, produit_categorie, libelle)
SELECT 'entree', 500000,  NULL,   0.0050, true, 'PE', 'PE — Droit d''entrée 500K et +'
WHERE NOT EXISTS (
  SELECT 1 FROM public.grilles_frais
   WHERE produit_categorie = 'PE' AND type_frais = 'entree'
     AND encours_min = 500000
);

-- 3) Index pour requêtes filtrées par catégorie produit
CREATE INDEX IF NOT EXISTS idx_grilles_frais_categorie
  ON public.grilles_frais (produit_categorie, type_frais, encours_min);

-- 4) Régénérer les types TS :
--    npx supabase gen types typescript --project-id <id> > src/types/database.ts

COMMIT;

-- =============================================================
-- ROLLBACK
-- =============================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_grilles_frais_categorie;
-- DELETE FROM public.grilles_frais
--  WHERE libelle LIKE 'PE — Droit d''entrée %';
-- ALTER TABLE public.grilles_frais DROP CONSTRAINT IF EXISTS grilles_frais_produit_categorie_chk;
-- ALTER TABLE public.grilles_frais
--   DROP COLUMN IF EXISTS libelle,
--   DROP COLUMN IF EXISTS produit_categorie;
-- COMMIT;
