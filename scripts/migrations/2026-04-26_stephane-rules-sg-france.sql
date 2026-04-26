-- =============================================================================
-- 2026-04-26 — Refonte rémunération Stéphane (SG vs France)
-- =============================================================================
--
-- Décision Maxine 2026-04-26 :
--   · Stéphane = consultant principal (dossier.consultant_id)
--   · Cas SG : compagnie commence par 'SG' OU produit contient 'ABF' / 'TRILAKE'
--             → Stéphane prend 100%, aucun split.
--   · Sinon (France hors SG) : Stéphane 15%, pot pool 25% en 3 (8.33 chacun),
--             cabinet 60%.
--
-- Avant ce changement, `stephane_france` (rule legacy) avait Stéphane 50% +
-- pool 25% + cabinet 25%, et il n'y avait pas de distinction SG.
--
-- Appliqué en prod 2026-04-26 via Supabase SQL editor (Chrome MCP).
-- =============================================================================

BEGIN;

-- 1. Modifier la grille stephane_france aux nouvelles valeurs
UPDATE public.commission_split_rules
   SET part_consultant = 15.00,
       part_pool_plus  = 8.33,
       part_thelo      = 8.33,
       part_maxine     = 8.33,
       part_stephane   = 0,
       part_cabinet    = 60.00,
       description     = 'Opération France hors SG/ABF/TRILAKE (consultant Stéphane) — 15% Stéphane, pot pool 25% en 3, cabinet 60%.'
 WHERE rule_key = 'stephane_france';

-- 2. Ajouter la rule stephane_sg pour SG/ABF/TRILAKE (Stéphane 100%)
INSERT INTO public.commission_split_rules
  (rule_key, name, description, part_consultant, part_pool_plus, part_thelo, part_maxine, part_stephane, part_cabinet, sort_order)
VALUES
  ('stephane_sg',
   'Stéphane — Opération SG/ABF/TRILAKE',
   'Compagnie commençant par SG OU produit contenant ABF/TRILAKE (consultant principal = Stéphane). Stéphane prend 100%, aucun split.',
   100, 0, 0, 0, 0, 0, 10)
ON CONFLICT (rule_key) DO UPDATE SET
  part_consultant = EXCLUDED.part_consultant,
  part_pool_plus  = EXCLUDED.part_pool_plus,
  part_thelo      = EXCLUDED.part_thelo,
  part_maxine     = EXCLUDED.part_maxine,
  part_stephane   = EXCLUDED.part_stephane,
  part_cabinet    = EXCLUDED.part_cabinet,
  description     = EXCLUDED.description;

-- 3. Refacto fn_determine_rule_key — ajout de p_compagnie_nom + p_produit_nom
--    optionnels pour le matching SG/ABF/TRILAKE quand consultant = Stéphane.
CREATE OR REPLACE FUNCTION public.fn_determine_rule_key(
  p_consultant_prenom TEXT,
  p_consultant_nom TEXT,
  p_consultant_taux_remuneration NUMERIC,
  p_apporteur_label TEXT,
  p_compagnie_nom TEXT DEFAULT NULL,
  p_produit_nom TEXT DEFAULT NULL
) RETURNS TEXT AS $func$
DECLARE
  v_apporteur TEXT;
  v_compagnie TEXT;
  v_produit TEXT;
BEGIN
  -- POOL fictif → pool direct
  IF UPPER(TRIM(COALESCE(p_consultant_prenom, ''))) = 'POOL'
     OR UPPER(TRIM(COALESCE(p_consultant_nom, ''))) = 'POOL' THEN
    RETURN 'pool';
  END IF;

  -- 2026-04-26 : Stéphane consultant principal
  IF UPPER(TRIM(COALESCE(p_consultant_prenom, ''))) IN ('STÉPHANE', 'STEPHANE') THEN
    v_compagnie := UPPER(COALESCE(p_compagnie_nom, ''));
    v_produit := UPPER(COALESCE(p_produit_nom, ''));
    IF v_compagnie LIKE 'SG%'
       OR v_produit LIKE '%ABF%'
       OR v_produit LIKE '%TRILAKE%' THEN
      RETURN 'stephane_sg';
    ELSE
      RETURN 'stephane_france';
    END IF;
  END IF;

  -- Apporteur-based (autres consultants avec apport explicite)
  IF p_apporteur_label IS NOT NULL THEN
    v_apporteur := TRIM(p_apporteur_label);
    IF v_apporteur = 'Thélo' THEN RETURN 'chasse_thelo'; END IF;
    IF v_apporteur = 'Maxine' THEN RETURN 'chasse_maxine'; END IF;
    IF v_apporteur = 'Stéphane' THEN RETURN 'stephane_france'; END IF;
    IF LOWER(v_apporteur) LIKE '%pool%' THEN RETURN 'pool'; END IF;
  END IF;

  -- Tier-based (taux_remuneration)
  IF p_consultant_taux_remuneration = 0.65 THEN RETURN 'tier_65'; END IF;
  IF p_consultant_taux_remuneration = 0.5  THEN RETURN 'tier_50'; END IF;
  IF p_consultant_taux_remuneration = 0.3  THEN RETURN 'tier_30'; END IF;

  RETURN 'tier_50';
END;
$func$ LANGUAGE plpgsql IMMUTABLE;

COMMIT;

-- =============================================================================
-- TODO post-déploiement (non bloquant) :
--   recompute_commission_v4(dossier_id) et recompute_encaissement_v4(enc_id)
--   appellent encore fn_determine_rule_key SANS p_compagnie_nom + p_produit_nom.
--   Conséquence : un re-backfill manuel d'une commission Stéphane sur un
--   produit SG/ABF/TRILAKE retombera sur 'stephane_france' au lieu de
--   'stephane_sg'.
--
--   Le flow normal (dossier-detail-wrapper.tsx → computeCommissionEntreeSplits)
--   passe correctement les 2 args ✓.
--   Le flow encours validation (allocation.ts → determineRuleFromArray) aussi ✓.
--
--   À corriger plus tard si on relance un backfill V4 : enrichir les RPC
--   recompute_*_v4 pour JOIN compagnies + produits et passer les 2 args.
-- =============================================================================
