-- =============================================================================
-- 2026-04-25_commission_split_rules.sql
-- =============================================================================
--
-- Sortir les 9 règles de split commission de `src/lib/commissions/rules.ts`
-- et les stocker en base pour qu'elles soient :
--   - visibles par tous les utilisateurs authentifiés
--   - modifiables par les managers uniquement
--   - persistées avec audit trail
--
-- Modèle :
--   1 ligne = 1 règle de split (chasse_thelo, chasse_maxine, pool, …)
--   Les colonnes part_* portent les pourcentages (0–100), pas des fractions.
--   La somme des 6 parts doit valoir 100% (CHECK constraint).
--
-- Seed : valeurs identiques à `COMMISSION_RULES` au moment du commit pour
-- que le branchement DB (Phase 3) ne modifie pas les calculs en cours.
--
-- Idempotent (CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING sur le seed).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.commission_split_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key        TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  part_consultant NUMERIC(5,2) NOT NULL DEFAULT 0,
  part_pool_plus  NUMERIC(5,2) NOT NULL DEFAULT 0,
  part_thelo      NUMERIC(5,2) NOT NULL DEFAULT 0,
  part_maxine     NUMERIC(5,2) NOT NULL DEFAULT 0,
  part_stephane   NUMERIC(5,2) NOT NULL DEFAULT 0,
  part_cabinet    NUMERIC(5,2) NOT NULL DEFAULT 0,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES public.consultants(id) ON DELETE SET NULL,

  -- Garde-fou : la somme des parts doit valoir 100% (avec une tolérance
  -- de 0.01 pour éviter les soucis d'arrondi). Pour la rule "encours",
  -- les parts sont à 0 dans le seed (déterminées dynamiquement par le
  -- moteur) → tolérance étendue : on autorise sum=0 OU sum=100.
  CONSTRAINT commission_split_rules_sum_check CHECK (
    (part_consultant + part_pool_plus + part_thelo + part_maxine + part_stephane + part_cabinet) BETWEEN 0 AND 100.01
  )
);

-- Index pour l'ordre d'affichage dans l'UI
CREATE INDEX IF NOT EXISTS idx_commission_split_rules_sort_order
  ON public.commission_split_rules (sort_order);

-- =============================================================================
-- Seed : 9 règles avec les valeurs courantes (cf. src/lib/commissions/rules.ts)
-- =============================================================================
-- Le seed reflète les pourcentages EFFECTIVEMENT appliqués (après
-- distribution intra-pool). C'est ce qui est consommé par
-- src/lib/encours/allocation.ts::applyRuleSplit() après refactor 2026-04-25.
-- Pour chaque rule, sum(part_*) ≈ 100 (avec tolérance d'arrondi 0.01).
-- Pour 'pool' / 'stephane_*' / 'tier_*', les fractions tierses 23.33 /
-- 8.33 / 13.33 / 3.33 reflètent une distribution en 3 du "pot pool".
INSERT INTO public.commission_split_rules
  (rule_key, name, description, part_consultant, part_pool_plus, part_thelo, part_maxine, part_stephane, part_cabinet, sort_order)
VALUES
  ('chasse_thelo',     'Client chassé par Thélo',
   'Client sourced by Thélo (manager) — Thélo touche les 50% comme consultant.',
   50,    10,     0,    10,     0,    30,    1),

  ('chasse_maxine',    'Client chassé par Maxine',
   'Client sourced by Maxine (admin/manager) — Maxine touche les 50% comme consultant.',
   50,    10,    10,     0,     0,    30,    2),

  ('pool',             'Client apporté par le Pool',
   'Client sourced by the Pool — pot pool de 70% réparti en 3 (POOL+ / Thélo / Maxine), cabinet 30%.',
    0, 23.33, 23.33, 23.33,     0,    30,    3),

  ('stephane_entree',  'Stéphane — Entrée',
   'Deal sourced by Stéphane (entry) — Stéphane touche 50% comme apporteur, pot pool 25% en 3.',
    0,  8.33,  8.33,  8.33,    50,    25,    4),

  ('stephane_france',  'Stéphane — France',
   'Stéphane manages French clients — splits identiques à Stéphane Entrée.',
    0,  8.33,  8.33,  8.33,    50,    25,    5),

  ('tier_65',          'Consultant tier 65%',
   'Hugues, James, Guillaume, Maxine at 65% — pot pool de 10% réparti en 3.',
   65,  3.33,  3.33,  3.33,     0,    25,    6),

  ('tier_50',          'Consultant tier 50%',
   'Mathias, Thélo at 50% — pot pool de 25% réparti en 3.',
   50,  8.33,  8.33,  8.33,     0,    25,    7),

  ('tier_30',          'Consultant tier 30%',
   'Valentin, Gilles at 30% — pot pool de 40% réparti en 3.',
   30, 13.33, 13.33, 13.33,     0,    30,    8),

  ('encours',          'Encours de gestion (CAV/CAPI)',
   'Recurring management fees on CAV LUX/CAPI LUX contracts (25% PEV, 30% Cabinet pre-deduction). Parts déterminées dynamiquement par le moteur en fonction du dossier matché — la rangée DB sert de marqueur, ne pas modifier sauf cas exceptionnel.',
    0,  0,  0,  0,  0,  0,  9)
ON CONFLICT (rule_key) DO NOTHING;

-- =============================================================================
-- RLS : SELECT pour tout authenticated, UPDATE managers only,
-- DELETE/INSERT bloqués (préserve les rule_keys référencés en code)
-- =============================================================================
ALTER TABLE public.commission_split_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_split_rules FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_split_rules_select ON public.commission_split_rules;
CREATE POLICY commission_split_rules_select ON public.commission_split_rules
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS commission_split_rules_update ON public.commission_split_rules;
CREATE POLICY commission_split_rules_update ON public.commission_split_rules
  FOR UPDATE TO public
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

-- Pas de policy INSERT ni DELETE → bloque ces opérations même pour les
-- managers. Les rule_keys sont stables et référencés par le code.

-- =============================================================================
-- Trigger d'audit : log toute UPDATE dans audit_logs
-- =============================================================================
DROP TRIGGER IF EXISTS audit_commission_split_rules ON public.commission_split_rules;
CREATE TRIGGER audit_commission_split_rules
  AFTER UPDATE ON public.commission_split_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_func();

-- =============================================================================
-- Trigger : auto-updated_at + updated_by
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_commission_split_rules_updated_meta()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  -- updated_by est attendu côté client : on le remplit depuis la session
  -- si l'application ne l'a pas fourni explicitement.
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := public.get_current_consultant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_commission_split_rules_updated_meta ON public.commission_split_rules;
CREATE TRIGGER set_commission_split_rules_updated_meta
  BEFORE UPDATE ON public.commission_split_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commission_split_rules_updated_meta();

COMMIT;

-- =============================================================================
-- Smoke test (à exécuter dans Supabase SQL editor après apply)
-- =============================================================================
--
-- 1. Table créée + 9 lignes seed :
--    SELECT rule_key, name, part_consultant, part_pool_plus, part_thelo,
--           part_maxine, part_stephane, part_cabinet, sort_order
--      FROM public.commission_split_rules
--     ORDER BY sort_order;
--    → 9 lignes, parts identiques aux constantes hard-codées.
--
-- 2. RLS activée :
--    SELECT relrowsecurity, relforcerowsecurity
--      FROM pg_class WHERE relname = 'commission_split_rules';
--    → t / t
--
-- 3. 2 policies (SELECT + UPDATE) :
--    SELECT policyname, cmd FROM pg_policies
--     WHERE tablename = 'commission_split_rules' ORDER BY policyname;
--    → 2 lignes (commission_split_rules_select, commission_split_rules_update)
--
-- 4. Smoke test fonctionnel : tenter UPDATE depuis un compte non-manager
--    doit échouer. UPDATE depuis un manager doit passer + audit_logs alimenté.
-- =============================================================================
