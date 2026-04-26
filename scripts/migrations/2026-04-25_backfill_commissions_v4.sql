-- =============================================================================
-- 2026-04-25_backfill_commissions_v4.sql
-- =============================================================================
--
-- Backfill V4 — Recalcule les splits des commissions et encaissements 2026
-- existants en utilisant la grille DB `commission_split_rules`.
--
-- À appliquer APRÈS scripts/migrations/2026-04-25_commissions_split_columns.sql.
--
-- ⚠️  Modifie des valeurs financières en production. À exécuter uniquement
-- après validation Maxine. Idempotent : peut être rejoué sans risque.
--
-- Périmètre : commissions des dossiers dont date_operation est en 2026
-- (à ajuster si besoin). Les commissions historiques (2025 et avant) ne
-- sont pas touchées sauf si on étend l'année cible.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Fonction utilitaire : détermine le rule_key (chasse_thelo, tier_65, etc.)
--    pour un (consultant, dossier) donné. Mirror PL/pgSQL de
--    src/lib/commissions/rules.ts::determineRuleKey().
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_determine_rule_key(
  p_consultant_prenom TEXT,
  p_consultant_nom TEXT,
  p_consultant_taux_remuneration NUMERIC,
  p_apporteur_label TEXT
) RETURNS TEXT AS $$
DECLARE
  v_apporteur TEXT;
BEGIN
  -- POOL fictif → règle 'pool' direct
  IF UPPER(TRIM(COALESCE(p_consultant_prenom, ''))) = 'POOL'
     OR UPPER(TRIM(COALESCE(p_consultant_nom, ''))) = 'POOL' THEN
    RETURN 'pool';
  END IF;

  -- Apporteur-based : chasse_thelo, chasse_maxine, stephane_entree, pool
  IF p_apporteur_label IS NOT NULL THEN
    v_apporteur := TRIM(p_apporteur_label);
    IF v_apporteur = 'Thélo' THEN RETURN 'chasse_thelo'; END IF;
    IF v_apporteur = 'Maxine' THEN RETURN 'chasse_maxine'; END IF;
    IF v_apporteur = 'Stéphane' THEN RETURN 'stephane_entree'; END IF;
    IF LOWER(v_apporteur) LIKE '%pool%' THEN RETURN 'pool'; END IF;
  END IF;

  -- Tier-based selon taux_remuneration
  IF p_consultant_taux_remuneration = 0.65 THEN RETURN 'tier_65'; END IF;
  IF p_consultant_taux_remuneration = 0.5  THEN RETURN 'tier_50'; END IF;
  IF p_consultant_taux_remuneration = 0.3  THEN RETURN 'tier_30'; END IF;

  -- Fallback : tier_50
  RETURN 'tier_50';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- 2. Fonction recompute_commission_v4(dossier_id) :
--    Pour un dossier donné, calcule les 6 splits et met à jour la
--    commission associée. UPDATE only (pas d'INSERT — la commission doit
--    déjà exister, ce qui est le cas pour tous les dossiers finalisés).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recompute_commission_v4(p_dossier_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_consultant RECORD;
  v_dossier RECORD;
  v_commission RECORD;
  v_rule RECORD;
  v_rule_key TEXT;
  v_commission_nette NUMERIC;
  v_part_consultant NUMERIC;
  v_part_pool_plus NUMERIC;
  v_part_thelo NUMERIC;
  v_part_maxine NUMERIC;
  v_part_stephane NUMERIC;
  v_part_cabinet NUMERIC;
  v_snapshot JSONB;
BEGIN
  -- Charge dossier + consultant + commission
  SELECT * INTO v_dossier FROM public.dossiers WHERE id = p_dossier_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Dossier introuvable');
  END IF;

  SELECT * INTO v_consultant FROM public.consultants WHERE id = v_dossier.consultant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Consultant introuvable');
  END IF;

  SELECT * INTO v_commission FROM public.commissions WHERE dossier_id = p_dossier_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'skip', 'message', 'Pas de commission');
  END IF;

  -- Détermine le rule_key + charge la rule depuis commission_split_rules
  v_rule_key := public.fn_determine_rule_key(
    v_consultant.prenom, v_consultant.nom, v_consultant.taux_remuneration,
    v_dossier.apporteur_label
  );

  SELECT * INTO v_rule FROM public.commission_split_rules WHERE rule_key = v_rule_key;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Rule ' || v_rule_key || ' introuvable');
  END IF;

  -- Calcule les 6 parts sur commission_nette
  v_commission_nette := COALESCE(v_commission.commission_brute, 0) - COALESCE(v_commission.rem_apporteur_ext, 0);
  v_part_consultant := ROUND(v_commission_nette * (v_rule.part_consultant / 100), 2);
  v_part_pool_plus  := ROUND(v_commission_nette * (v_rule.part_pool_plus  / 100), 2);
  v_part_thelo      := ROUND(v_commission_nette * (v_rule.part_thelo      / 100), 2);
  v_part_maxine     := ROUND(v_commission_nette * (v_rule.part_maxine     / 100), 2);
  v_part_stephane   := ROUND(v_commission_nette * (v_rule.part_stephane   / 100), 2);
  v_part_cabinet    := ROUND(v_commission_nette * (v_rule.part_cabinet    / 100), 2);

  v_snapshot := jsonb_build_object(
    'rule_id', v_rule.sort_order,
    'rule_name', v_rule.name,
    'split', jsonb_build_object(
      'part_consultant', v_rule.part_consultant,
      'part_pool_plus',  v_rule.part_pool_plus,
      'part_thelo',      v_rule.part_thelo,
      'part_maxine',     v_rule.part_maxine,
      'part_stephane',   v_rule.part_stephane,
      'part_cabinet',    v_rule.part_cabinet
    )
  );

  -- UPDATE de la commission avec les 6 parts + rule_key + snapshot
  UPDATE public.commissions SET
    rem_apporteur          = v_part_consultant,
    part_consultant        = v_part_consultant,
    part_pool_plus         = v_part_pool_plus,
    part_thelo             = v_part_thelo,
    part_maxine            = v_part_maxine,
    part_stephane          = v_part_stephane,
    part_cabinet           = v_part_cabinet,
    pct_cabinet            = CASE WHEN v_commission.commission_brute > 0
                                  THEN v_part_cabinet / v_commission.commission_brute
                                  ELSE 0 END,
    applied_rule_key       = v_rule_key,
    applied_split_snapshot = v_snapshot
  WHERE dossier_id = p_dossier_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'rule_key', v_rule_key,
    'commission_nette', v_commission_nette,
    'parts', jsonb_build_object(
      'consultant', v_part_consultant,
      'pool_plus',  v_part_pool_plus,
      'thelo',      v_part_thelo,
      'maxine',     v_part_maxine,
      'stephane',   v_part_stephane,
      'cabinet',    v_part_cabinet
    )
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- =============================================================================
-- 3. Backfill commissions 2026 — itère sur tous les dossiers 2026 avec
--    commission existante et recompute via recompute_commission_v4.
-- =============================================================================
DO $$
DECLARE
  v_dossier_id UUID;
  v_count INTEGER := 0;
  v_errors INTEGER := 0;
  v_result JSONB;
BEGIN
  FOR v_dossier_id IN
    SELECT d.id
      FROM public.dossiers d
      JOIN public.commissions c ON c.dossier_id = d.id
     WHERE EXTRACT(YEAR FROM d.date_operation) = 2026
       AND c.commission_brute > 0
  LOOP
    v_result := public.recompute_commission_v4(v_dossier_id);
    IF v_result->>'status' = 'ok' THEN
      v_count := v_count + 1;
    ELSE
      v_errors := v_errors + 1;
      RAISE NOTICE 'Backfill error pour dossier %: %', v_dossier_id, v_result;
    END IF;
  END LOOP;
  RAISE NOTICE 'Backfill commissions 2026 : % succès, % erreurs', v_count, v_errors;
END $$;

-- =============================================================================
-- 4. Backfill encaissements 2026 — pour chaque encaissement 2026 dont la
--    commission a maintenant un applied_rule_key V4, recopie les nouvelles
--    parts vers encaissements.
-- =============================================================================
UPDATE public.encaissements e SET
  rem_consultant   = c.part_consultant,
  part_cabinet     = c.part_cabinet,
  part_pool_plus   = c.part_pool_plus,
  part_thelo       = c.part_thelo,
  part_maxine      = c.part_maxine,
  part_stephane    = c.part_stephane,
  pool_total       = COALESCE(c.part_pool_plus,0) + COALESCE(c.part_thelo,0) + COALESCE(c.part_maxine,0),
  applied_rule_key = c.applied_rule_key
FROM public.commissions c
WHERE e.dossier_id = c.dossier_id
  AND e.annee = 2026
  AND c.applied_rule_key IS NOT NULL;

COMMIT;

-- =============================================================================
-- Smoke tests (à exécuter dans Supabase SQL editor)
-- =============================================================================
--
-- 1. Combien de commissions 2026 ont été backfillées :
--    SELECT count(*) AS total_2026,
--           count(c.applied_rule_key) AS backfilled
--      FROM public.commissions c
--      JOIN public.dossiers d ON d.id = c.dossier_id
--     WHERE EXTRACT(YEAR FROM d.date_operation) = 2026
--       AND c.commission_brute > 0;
--    → backfilled = total_2026 (sauf cas particuliers à investiguer)
--
-- 2. Distribution par rule_key :
--    SELECT applied_rule_key, count(*),
--           ROUND(SUM(part_consultant)::numeric, 0) AS sum_consultant,
--           ROUND(SUM(part_cabinet)::numeric, 0)    AS sum_cabinet,
--           ROUND(SUM(part_pool_plus + part_thelo + part_maxine)::numeric, 0) AS sum_pool
--      FROM public.commissions c
--      JOIN public.dossiers d ON d.id = c.dossier_id
--     WHERE EXTRACT(YEAR FROM d.date_operation) = 2026
--     GROUP BY applied_rule_key
--     ORDER BY applied_rule_key;
--
-- 3. Encaissements 2026 mis à jour :
--    SELECT count(*) AS total_encaissements_2026,
--           count(applied_rule_key) AS backfilled
--      FROM public.encaissements
--     WHERE annee = 2026;
--    → backfilled doit valoir total - (encaissements dont la commission
--      n'a pas pu être backfillée).
--
-- 4. Rejouer le backfill (idempotent) — sûr de répéter :
--    BEGIN;
--    DO $$ DECLARE v_id UUID; BEGIN
--      FOR v_id IN SELECT id FROM dossiers WHERE EXTRACT(YEAR FROM date_operation) = 2026 LOOP
--        PERFORM public.recompute_commission_v4(v_id);
--      END LOOP;
--    END $$;
--    -- + le UPDATE encaissements ci-dessus
--    COMMIT;
-- =============================================================================
