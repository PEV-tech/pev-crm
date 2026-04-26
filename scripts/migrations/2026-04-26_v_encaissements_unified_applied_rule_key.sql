-- =========================================================================
-- Migration: ré-expose applied_rule_key dans v_encaissements_unified
-- Date: 2026-04-26
--
-- Contexte :
--   La migration 2026-04-25_is_historique.sql a fait DROP / CREATE VIEW de
--   v_encaissements_unified sans embarquer la colonne applied_rule_key qui
--   avait été ajoutée à `encaissements` par 2026-04-25_commissions_split_columns.sql.
--   Conséquence : le bandeau "Conformité grille V4" en page Encaissements lit
--   undefined pour entry.applied_rule_key et affiche 0/N quel que soit l'état
--   réel des splits.
--
-- Objectif :
--   Recréer la vue à l'identique + ajouter applied_rule_key sur les 2 sources :
--     · Source 1 (encaissements auto)        → e.applied_rule_key
--     · Source 2 (encours V2 via batches)    → recoupé via commissions.applied_rule_key
--                                              (pour le dossier de la ligne)
--
-- Autre fix UX (optionnel — gardé conservatif) :
--   Pas de modif des champs annee/mois/consultant_*. Les 121 legacy aux
--   champs nuls le restent ; le banner les compte simplement comme "non
--   conforme V4" et les liste — ce qui est l'intention.
-- =========================================================================

BEGIN;

DROP VIEW IF EXISTS public.v_encaissements_unified;

CREATE VIEW public.v_encaissements_unified AS

-- ─── Source 1 : flux existant (encaissements auto, depuis factures payées) ───
SELECT
  e.id,
  e.dossier_id,
  e.client_nom, e.client_prenom, e.client_pays,
  e.consultant_id, e.consultant_nom, e.consultant_prenom,
  e.produit_nom, e.compagnie_nom,
  e.apporteur_id, e.apporteur_ext_nom, e.taux_apporteur_ext,
  e.annee, e.mois, e.date_encaissement, e.created_at,
  e.commission_brute, e.commission_nette, e.montant_dossier,
  e.part_cabinet, e.part_maxine, e.part_thelo, e.part_pool_plus, e.pool_total,
  e.rem_consultant, e.rem_apporteur_ext,
  CASE
    WHEN COALESCE(TRIM(COALESCE(e.client_prenom, '') || ' ' || COALESCE(e.client_nom, '')), '') = ''
      THEN COALESCE(e.label, '(client ?)')
    ELSE
      TRIM(COALESCE(e.client_prenom, '') || ' ' || COALESCE(e.client_nom, ''))
        || CASE
             WHEN e.produit_nom IS NOT NULL AND UPPER(e.produit_nom) <> 'SCPI' THEN ' — ' || e.produit_nom
             WHEN e.compagnie_nom IS NOT NULL THEN ' — ' || e.compagnie_nom
             WHEN e.produit_nom IS NOT NULL THEN ' — ' || e.produit_nom
             ELSE ''
           END
        || CASE WHEN COALESCE(e.label, '') ILIKE '%encours%' THEN ' (encours)' ELSE '' END
  END AS label,
  'auto'::text AS source_type,
  -- ★ NEW : trace V4
  e.applied_rule_key
FROM public.encaissements e
WHERE e.is_historique = FALSE

UNION ALL

-- ─── Source 2 : lignes V2 (lots validés ou comptabilisés) ───
SELECT
  l.id, l.dossier_id,
  d.client_nom, d.client_prenom, d.client_pays,
  d.consultant_id, d.consultant_nom, d.consultant_prenom,
  d.produit_nom, d.compagnie_nom,
  a.apporteur_id, d.apporteur_ext_nom,
  a.taux_apporteur_ext_snapshot::numeric AS taux_apporteur_ext,
  EXTRACT(year FROM b.date_reception)::int AS annee,
  CASE EXTRACT(month FROM b.date_reception)::int
    WHEN 1 THEN 'JANVIER'  WHEN 2 THEN 'FEVRIER'   WHEN 3 THEN 'MARS'
    WHEN 4 THEN 'AVRIL'    WHEN 5 THEN 'MAI'       WHEN 6 THEN 'JUIN'
    WHEN 7 THEN 'JUILLET'  WHEN 8 THEN 'AOUT'      WHEN 9 THEN 'SEPTEMBRE'
    WHEN 10 THEN 'OCTOBRE' WHEN 11 THEN 'NOVEMBRE' WHEN 12 THEN 'DECEMBRE'
  END AS mois,
  b.date_reception::date AS date_encaissement,
  l.created_at,
  a.commission_brute_snapshot::numeric AS commission_brute,
  a.commission_nette_snapshot::numeric AS commission_nette,
  d.montant::numeric AS montant_dossier,
  (a.part_cabinet_montant + a.part_cabinet_prededuction_montant)::numeric AS part_cabinet,
  a.part_maxine_montant::numeric AS part_maxine,
  a.part_thelo_montant::numeric AS part_thelo,
  a.part_pool_plus_montant::numeric AS part_pool_plus,
  (a.part_pool_plus_montant + a.part_thelo_montant + a.part_maxine_montant)::numeric AS pool_total,
  (a.part_consultant_montant + a.part_stephane_montant)::numeric AS rem_consultant,
  a.rem_apporteur_ext_montant::numeric AS rem_apporteur_ext,
  CASE
    WHEN COALESCE(TRIM(COALESCE(d.client_prenom, '') || ' ' || COALESCE(d.client_nom, '')), '') = ''
      THEN '(client ?)'
    ELSE
      TRIM(COALESCE(d.client_prenom, '') || ' ' || COALESCE(d.client_nom, ''))
        || CASE
             WHEN d.produit_nom IS NOT NULL AND UPPER(d.produit_nom) <> 'SCPI' THEN ' — ' || d.produit_nom
             WHEN d.compagnie_nom IS NOT NULL THEN ' — ' || d.compagnie_nom
             WHEN d.produit_nom IS NOT NULL THEN ' — ' || d.produit_nom
             ELSE ''
           END
        || CASE WHEN l.type_commission = 'encours' THEN ' (encours)' ELSE '' END
  END AS label,
  'encours_v2'::text AS source_type,
  -- ★ NEW : applied_rule_key recoupé via commissions du dossier
  --   La rule_key est figée au moment du calcul commission, donc une seule
  --   par dossier (pas par ligne d'encaissement). On rapatrie celle de la
  --   commission liée. Si pas de commission ou pas backfillée → NULL.
  (SELECT c.applied_rule_key
     FROM public.commissions c
    WHERE c.dossier_id = l.dossier_id
    LIMIT 1) AS applied_rule_key
FROM public.encaissement_lines l
JOIN public.encaissement_batches b ON b.id = l.batch_id
JOIN public.encaissement_line_allocations a ON a.encaissement_line_id = l.id
JOIN public.v_dossiers_complets d ON d.id = l.dossier_id
WHERE b.statut IN ('valide', 'comptabilise')
  AND l.statut_rapprochement IN ('rapproche_auto', 'rapproche_manuel')
  AND d.is_historique = FALSE;

ALTER VIEW public.v_encaissements_unified SET (security_invoker = true);

COMMIT;

-- =========================================================================
-- Sanity checks (à exécuter après migration)
-- =========================================================================
-- 1) La colonne est bien exposée :
--    SELECT column_name FROM information_schema.columns
--      WHERE table_schema='public' AND table_name='v_encaissements_unified'
--        AND column_name='applied_rule_key';
--    → 1 ligne attendue
--
-- 2) Distribution V4 vs legacy :
--    SELECT applied_rule_key IS NOT NULL AS v4, count(*)
--      FROM public.v_encaissements_unified
--     GROUP BY applied_rule_key IS NOT NULL;
--
-- 3) Top legacy à investiguer (annee 2026 sans rule_key) :
--    SELECT mois, label, consultant_prenom, consultant_nom, commission_brute
--      FROM public.v_encaissements_unified
--     WHERE applied_rule_key IS NULL AND annee = 2026
--     ORDER BY mois;
