-- =========================================================================
-- Migration : get_frais_taux accepte une catégorie produit
-- Date      : 2026-04-27
-- Contexte  : retour Maxine session test 2026-04-27 (Florent Sygall)
--
-- Symptôme observé :
--   Dossier CAV Vitis Life 80K → grille appliquée 0,23% au lieu de 1,5%.
--   La grille de gestion 1,20% n'apparaissait pas non plus.
--
-- Cause :
--   Le RPC get_frais_taux(p_type, p_encours) filtrait uniquement par type
--   de frais (entree/gestion) et par tranche d'encours. La table
--   `grilles_frais` contient des grilles distinctes par
--   `produit_categorie` (LUX, PE, CAV…) MAIS aussi des lignes "génériques"
--   (produit_categorie IS NULL) qui servent de référence transverse —
--   c'est là que sont stockées les grilles 1,5% / 1,2% applicables à
--   CAV/CAV LUX/CAPI quand aucune ligne typée n'existe.
--
-- Fix :
--   Nouvelle signature get_frais_taux(p_type, p_encours, p_categorie text)
--   qui filtre additionnellement sur produit_categorie. Stratégie de match :
--     1. Match exact sur produit_categorie = catégorie demandée (PE etc.)
--     2. Sinon fallback sur les lignes génériques (produit_categorie IS NULL)
--   Les lignes spécifiques à la catégorie sont prioritaires sur les
--   génériques (ORDER BY priorité 0 < 1).
--
-- Pas de wrapper 2-args :
--   On ne définit PAS de wrapper get_frais_taux(p_type, p_encours) car ça
--   crée une ambiguïté avec la version 3-args + DEFAULT NULL côté planner
--   PostgreSQL ("function is not unique"). Les anciens callers JS doivent
--   passer p_categorie explicitement (NULL accepté).
--
-- Déployé en prod : 2026-04-27 (Cowork session, validé sur Florent Sygall)
-- =========================================================================

-- 1) Drop des éventuelles versions précédentes (idempotent).
DROP FUNCTION IF EXISTS public.get_frais_taux(public.type_frais, numeric);
DROP FUNCTION IF EXISTS public.get_frais_taux(public.type_frais, numeric, text);

-- 2) Nouvelle signature unique (3-args avec DEFAULT NULL pour la catégorie).
CREATE OR REPLACE FUNCTION public.get_frais_taux(
  p_type      public.type_frais,
  p_encours   numeric,
  p_categorie text DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $func$
  -- Normalisation : on mappe les variantes catégorie sur les valeurs
  -- stockées dans grilles_frais.produit_categorie ('LUX', 'PE', 'CAV',
  -- 'CAPI_LUX'). Si p_categorie est NULL, categorie_norm = NULL et
  -- seul le fallback générique s'applique.
  WITH norm AS (
    SELECT CASE
      WHEN p_categorie IS NULL THEN NULL
      WHEN upper(trim(p_categorie)) IN ('CAV', 'CAV LUX', 'CAPI', 'CAPI LUX') THEN
        CASE
          WHEN upper(trim(p_categorie)) IN ('CAPI LUX', 'CAPI') THEN 'CAPI_LUX'
          ELSE 'CAV'
        END
      WHEN upper(trim(p_categorie)) = 'LUX' THEN 'LUX'
      WHEN upper(trim(p_categorie)) IN ('PE', 'PRIVATE EQUITY') THEN 'PE'
      ELSE upper(trim(p_categorie))
    END AS categorie_norm
  )
  SELECT g.taux
    FROM public.grilles_frais g, norm
   WHERE g.actif = true
     AND g.type_frais = p_type
     AND p_encours BETWEEN g.encours_min AND g.encours_max
     AND (
       -- Match exact sur la catégorie normalisée
       (norm.categorie_norm IS NOT NULL AND g.produit_categorie = norm.categorie_norm)
       OR
       -- Fallback générique : on accepte les lignes produit_categorie IS NULL
       -- quelle que soit la catégorie demandée (utile pour CAV, GIRARDIN…
       -- qui n'ont pas de lignes spécifiques mais doivent retomber sur la
       -- grille de référence par tranche d'encours).
       (g.produit_categorie IS NULL)
     )
   ORDER BY
     -- Priorité aux lignes spécifiques à la catégorie demandée sur les
     -- génériques (NULL). Si pas de match catégorie → on retombe sur NULL.
     CASE WHEN g.produit_categorie IS NOT NULL
            AND norm.categorie_norm IS NOT NULL
            AND g.produit_categorie = norm.categorie_norm
          THEN 0 ELSE 1 END,
     g.encours_min DESC
   LIMIT 1;
$func$;

COMMENT ON FUNCTION public.get_frais_taux(public.type_frais, numeric, text) IS
  'Retourne le taux de frais (entrée/gestion) applicable pour un montant donné, avec filtre par catégorie produit (PE, CAV, LUX, CAPI_LUX). Si aucune ligne spécifique n''existe pour la catégorie, fallback sur les grilles génériques (produit_categorie IS NULL).';

-- 3) Permissions
GRANT EXECUTE ON FUNCTION public.get_frais_taux(public.type_frais, numeric, text) TO authenticated, anon, service_role;

-- 4) Sanity checks (validés en prod le 2026-04-27)
--   PE 200K (catégorie spécifique)  → 0.02000   (grille PE 200K-300K)
--   CAV 80K entrée (fallback)       → 0.01500   ✅ Florent Sygall
--   CAV 80K gestion (fallback)      → 0.01200   ✅ Florent Sygall
--   GIRARDIN 60K (fallback)         → 0.01500
--   sans catégorie 100K (générique) → 0.01500
SELECT 'PE 200K (cat-spe)'   AS test, public.get_frais_taux('entree'::public.type_frais,  200000, 'PE')        AS taux
UNION ALL
SELECT 'CAV 80K ent (gen)'   AS test, public.get_frais_taux('entree'::public.type_frais,  80000,  'CAV')       AS taux
UNION ALL
SELECT 'CAV 80K gest (gen)'  AS test, public.get_frais_taux('gestion'::public.type_frais, 80000,  'CAV')       AS taux
UNION ALL
SELECT 'GIRARDIN 60K (gen)'  AS test, public.get_frais_taux('entree'::public.type_frais,  60000,  'GIRARDIN')  AS taux
UNION ALL
SELECT 'sans cat 100K (gen)' AS test, public.get_frais_taux('entree'::public.type_frais,  100000, NULL)        AS taux;

-- =========================================================================
-- ROLLBACK (à coller dans une nouvelle session SQL si besoin)
-- =========================================================================
-- DROP FUNCTION IF EXISTS public.get_frais_taux(public.type_frais, numeric, text);
-- -- Recréer la version pré-2026-04-27 si besoin (à adapter si différente).
-- CREATE OR REPLACE FUNCTION public.get_frais_taux(
--   p_type    public.type_frais,
--   p_encours numeric
-- ) RETURNS numeric LANGUAGE sql STABLE AS $$
--   SELECT taux FROM public.grilles_frais
--    WHERE actif = true AND type_frais = p_type
--      AND p_encours BETWEEN encours_min AND encours_max
--    ORDER BY encours_min DESC LIMIT 1;
-- $$;
-- GRANT EXECUTE ON FUNCTION public.get_frais_taux(public.type_frais, numeric) TO authenticated, anon, service_role;
