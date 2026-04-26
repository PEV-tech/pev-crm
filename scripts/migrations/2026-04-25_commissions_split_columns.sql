-- =============================================================================
-- 2026-04-25_commissions_split_columns.sql
-- =============================================================================
--
-- V4 — Brancher la commission entrée sur la grille DB `commission_split_rules`.
--
-- Aujourd'hui, la table `commissions` ne stocke que :
--   - rem_apporteur (= part consultant)
--   - part_cabinet (= commission_nette - rem_apporteur, gonflée artificiellement
--     car ne tient pas compte du pot pool/thélo/maxine/stéphane)
--
-- Après cette migration, on stocke les 6 parts effectives + le rule_key
-- snapshoté + un snapshot JSON du split appliqué (traçabilité).
--
-- Idempotent (ADD COLUMN IF NOT EXISTS).
-- =============================================================================

BEGIN;

-- 1. Colonnes part_* manquantes (part_cabinet existe déjà)
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS part_consultant NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS part_pool_plus  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS part_thelo      NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS part_maxine     NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS part_stephane   NUMERIC(15,2);

-- 2. Snapshot du rule_key + split appliqué pour la traçabilité (audit)
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS applied_rule_key      TEXT,
  ADD COLUMN IF NOT EXISTS applied_split_snapshot JSONB;

-- 3. Commentaires de documentation
COMMENT ON COLUMN public.commissions.part_consultant IS 'V4 (2026-04-25) — Part consultant en EUR (= rem_apporteur, doublonné pour homogénéité avec part_*)';
COMMENT ON COLUMN public.commissions.part_pool_plus  IS 'V4 (2026-04-25) — Part POOL+ en EUR (1/3 du pot pool)';
COMMENT ON COLUMN public.commissions.part_thelo      IS 'V4 (2026-04-25) — Part Thélo en EUR (1/3 du pot pool ou direct si chasse_maxine)';
COMMENT ON COLUMN public.commissions.part_maxine     IS 'V4 (2026-04-25) — Part Maxine en EUR (1/3 du pot pool ou direct si chasse_thelo)';
COMMENT ON COLUMN public.commissions.part_stephane   IS 'V4 (2026-04-25) — Part Stéphane en EUR (rules stephane_entree / stephane_france uniquement)';
COMMENT ON COLUMN public.commissions.applied_rule_key IS 'V4 (2026-04-25) — rule_key utilisé au moment du calcul (chasse_thelo, chasse_maxine, pool, stephane_*, tier_65/50/30, encours). Snapshot historique.';
COMMENT ON COLUMN public.commissions.applied_split_snapshot IS 'V4 (2026-04-25) — JSON snapshot du split appliqué (rule_id, rule_name, split breakdown). Traçabilité ACPR — la grille DB peut évoluer, ce champ fige ce qui a été utilisé.';

-- 4. Index sur applied_rule_key pour les analyses (ex. combien de dossiers
--    en chasse_maxine ce trimestre)
CREATE INDEX IF NOT EXISTS idx_commissions_applied_rule_key
  ON public.commissions (applied_rule_key)
  WHERE applied_rule_key IS NOT NULL;

-- =============================================================================
-- 5. Étendre `encaissements` (alimentée par trigger fn_create_encaissement
--    quand une facture passe payée). Manquait part_stephane et un snapshot
--    du rule_key utilisé.
-- =============================================================================
ALTER TABLE public.encaissements
  ADD COLUMN IF NOT EXISTS part_stephane         NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_rule_key      TEXT;

COMMENT ON COLUMN public.encaissements.part_stephane     IS 'V4 (2026-04-25) — Part Stéphane en EUR (rules stephane_entree / stephane_france uniquement)';
COMMENT ON COLUMN public.encaissements.applied_rule_key  IS 'V4 (2026-04-25) — rule_key snapshot recopié depuis commissions.applied_rule_key';

-- =============================================================================
-- 6. Refacto fn_create_encaissement pour lire les colonnes V4 plutôt que
--    de recalculer le pool en mode legacy.
--
--    Avant V4 :
--      pool_total := commission_nette - rem_consultant - part_cabinet
--      part_maxine := pool_total / 3
--      ... (idem thélo, pool_plus)
--    Cette logique reposait sur l'hypothèse que TOUT ce qui n'est pas
--    consultant/cabinet est pool, divisé en 3 — incorrect pour les rules
--    stephane_entree, chasse_thelo, chasse_maxine où Maxine ou Thélo
--    touchent une part directe HORS pot pool.
--
--    Après V4 :
--      Lit directement commissions.part_consultant / part_pool_plus /
--      part_thelo / part_maxine / part_stephane / part_cabinet (calculés
--      par computeCommissionEntreeSplits côté front avec la grille DB).
--      Si la commission n'a pas encore les colonnes V4 (legacy), retombe
--      sur l'ancien calcul comme fallback.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_create_encaissement()
RETURNS TRIGGER AS $$
DECLARE
  v_dossier RECORD;
  v_commission RECORD;
  v_client RECORD;
  v_consultant RECORD;
  v_produit RECORD;
  v_compagnie RECORD;
  v_month_names TEXT[] := ARRAY['JANVIER','FEVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOUT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DECEMBRE'];
  v_mois TEXT;
  v_annee INTEGER;
  v_label TEXT;
  v_comm_brute NUMERIC;
  v_rem_apporteur_ext NUMERIC;
  v_comm_nette NUMERIC;
  v_rem_consultant NUMERIC;
  v_part_cabinet NUMERIC;
  v_part_pool_plus NUMERIC;
  v_part_thelo NUMERIC;
  v_part_maxine NUMERIC;
  v_part_stephane NUMERIC;
  v_pool_total NUMERIC;
  v_applied_rule_key TEXT;
  v_has_v4_split BOOLEAN;
BEGIN
  -- Only trigger when payee changes to 'oui'
  IF NEW.payee <> 'oui' THEN RETURN NEW; END IF;
  IF OLD IS NOT NULL AND OLD.payee = 'oui' THEN RETURN NEW; END IF;

  SELECT * INTO v_dossier FROM dossiers WHERE id = NEW.dossier_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_commission FROM commissions WHERE dossier_id = NEW.dossier_id;
  SELECT * INTO v_client     FROM clients     WHERE id = v_dossier.client_id;
  SELECT * INTO v_consultant FROM consultants WHERE id = v_dossier.consultant_id;
  SELECT nom INTO v_produit  FROM produits    WHERE id = v_dossier.produit_id;
  SELECT nom INTO v_compagnie FROM compagnies WHERE id = v_dossier.compagnie_id;

  v_mois := v_month_names[EXTRACT(MONTH FROM COALESCE(NEW.date_paiement, CURRENT_DATE))::INTEGER];
  v_annee := EXTRACT(YEAR FROM COALESCE(NEW.date_paiement, CURRENT_DATE))::INTEGER;

  v_label := TRIM(COALESCE(v_client.prenom, '') || ' ' || COALESCE(v_client.nom, ''));
  IF v_produit.nom IS NOT NULL THEN
    v_label := v_label || ' — ' || v_produit.nom;
  END IF;

  v_comm_brute        := COALESCE(v_commission.commission_brute, 0);
  v_rem_apporteur_ext := COALESCE(v_commission.rem_apporteur_ext, 0);
  v_comm_nette        := v_comm_brute - v_rem_apporteur_ext;
  v_rem_consultant    := COALESCE(v_commission.rem_apporteur, 0);
  v_part_cabinet      := COALESCE(v_commission.part_cabinet, 0);

  -- V4 : si applied_rule_key est rempli ET au moins une part_* V4 est
  -- non-null, on lit directement les colonnes (split DB-backed).
  v_applied_rule_key := COALESCE(v_commission.applied_rule_key, NULL);
  v_has_v4_split := v_applied_rule_key IS NOT NULL
    AND (v_commission.part_pool_plus IS NOT NULL
      OR v_commission.part_thelo IS NOT NULL
      OR v_commission.part_maxine IS NOT NULL
      OR v_commission.part_stephane IS NOT NULL);

  IF v_has_v4_split THEN
    v_part_pool_plus := COALESCE(v_commission.part_pool_plus, 0);
    v_part_thelo     := COALESCE(v_commission.part_thelo, 0);
    v_part_maxine    := COALESCE(v_commission.part_maxine, 0);
    v_part_stephane  := COALESCE(v_commission.part_stephane, 0);
    v_pool_total     := v_part_pool_plus + v_part_thelo + v_part_maxine;
  ELSE
    -- Legacy fallback : commissions historiques sans split V4.
    v_pool_total     := GREATEST(0, v_comm_nette - v_rem_consultant - v_part_cabinet);
    v_part_pool_plus := ROUND(v_pool_total / 3, 2);
    v_part_thelo     := v_part_pool_plus;
    v_part_maxine    := v_part_pool_plus;
    v_part_stephane  := 0;
  END IF;

  INSERT INTO encaissements (
    dossier_id, date_encaissement, mois, annee,
    label, client_nom, client_prenom, client_pays,
    produit_nom, compagnie_nom, montant_dossier,
    consultant_id, consultant_nom, consultant_prenom,
    apporteur_ext_nom, apporteur_id, taux_apporteur_ext,
    commission_brute, rem_apporteur_ext, commission_nette,
    rem_consultant, part_cabinet,
    pool_total, part_maxine, part_thelo, part_pool_plus, part_stephane,
    applied_rule_key
  ) VALUES (
    NEW.dossier_id,
    COALESCE(NEW.date_paiement, CURRENT_DATE),
    v_mois, v_annee,
    v_label,
    v_client.nom, v_client.prenom, v_client.pays,
    v_produit.nom, v_compagnie.nom,
    COALESCE(v_dossier.montant, 0),
    v_dossier.consultant_id,
    v_consultant.nom, v_consultant.prenom,
    v_dossier.apporteur_ext_nom,
    v_dossier.apporteur_id,
    COALESCE(v_dossier.taux_apporteur_ext, 0),
    v_comm_brute, v_rem_apporteur_ext, v_comm_nette,
    v_rem_consultant, v_part_cabinet,
    v_pool_total, v_part_maxine, v_part_thelo, v_part_pool_plus, v_part_stephane,
    v_applied_rule_key
  )
  ON CONFLICT (dossier_id) DO UPDATE SET
    date_encaissement = EXCLUDED.date_encaissement,
    mois = EXCLUDED.mois,
    annee = EXCLUDED.annee,
    label = EXCLUDED.label,
    commission_brute = EXCLUDED.commission_brute,
    rem_apporteur_ext = EXCLUDED.rem_apporteur_ext,
    commission_nette = EXCLUDED.commission_nette,
    rem_consultant = EXCLUDED.rem_consultant,
    part_cabinet = EXCLUDED.part_cabinet,
    pool_total = EXCLUDED.pool_total,
    part_maxine = EXCLUDED.part_maxine,
    part_thelo = EXCLUDED.part_thelo,
    part_pool_plus = EXCLUDED.part_pool_plus,
    part_stephane = EXCLUDED.part_stephane,
    applied_rule_key = EXCLUDED.applied_rule_key;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- =============================================================================
-- IMPORTANT : recréer v_dossiers_complets pour exposer les nouvelles colonnes
-- =============================================================================
--
-- Le code front lit certains de ces champs via v_dossiers_complets (pour
-- les dashboards remunerations / encaissements). Tant que la vue n'est
-- pas mise à jour, les nouvelles colonnes seront NULL côté lecture même
-- après écriture.
--
-- À faire manuellement APRÈS apply de la présente migration : exécuter
-- scripts/recreate-v-dossiers-complets-full.sql après avoir ajouté
-- c.part_consultant, c.part_pool_plus, c.part_thelo, c.part_maxine,
-- c.part_stephane, c.applied_rule_key dans le SELECT de la vue.
--
-- Ou plus simplement, attendre que ce soit fait dans une PR ultérieure
-- (Phase 5). Tant que la vue n'est pas refresh, les dashboards
-- remunerations / encaissements continueront d'afficher uniquement
-- rem_apporteur et part_cabinet (lecture inchangée), mais les nouvelles
-- commissions stockeront bien les 6 parts en base (visible via SELECT
-- direct sur commissions).
-- =============================================================================

-- =============================================================================
-- Smoke test (à exécuter dans Supabase SQL editor après apply)
-- =============================================================================
--
-- 1. Colonnes ajoutées :
--    SELECT column_name, data_type, is_nullable
--      FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'commissions'
--       AND column_name IN ('part_consultant', 'part_pool_plus', 'part_thelo',
--                           'part_maxine', 'part_stephane',
--                           'applied_rule_key', 'applied_split_snapshot')
--     ORDER BY column_name;
--    → 7 lignes
--
-- 2. Valeurs actuelles (NULL pour les commissions historiques) :
--    SELECT count(*) AS total,
--           count(part_consultant) AS with_part_consultant,
--           count(applied_rule_key) AS with_rule_key
--      FROM public.commissions;
--    → with_part_consultant = 0, with_rule_key = 0 (avant tout calcul V4)
-- =============================================================================
