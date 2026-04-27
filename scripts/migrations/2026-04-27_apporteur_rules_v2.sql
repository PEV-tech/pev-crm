-- =============================================================================
-- 2026-04-27_apporteur_rules_v2.sql
-- =============================================================================
--
-- Apporteur d'affaires V2 — règles de rémunération produit-aware.
--
-- Driver : onboarding Yoann Pouliquen (1% SCPI / 25% frais entrée PE / 6 mois
-- encours CAV-CAPI). Le modèle V1 (`apporteurs.taux_commission` scalaire)
-- ne sait pas distinguer SCPI vs PE vs encours.
--
-- Cette migration ajoute :
--   1. `compagnies.encours_periodicite`        — mensuel|trimestriel (gap actuel)
--   2. `apporteur_compensation_rules`          — règles par (apporteur, catégorie)
--   3. `commissions.rem_apporteur_entry`       — part apporteur sur frais entrée
--   4. `commissions.rem_apporteur_encours_oneshot` — part apporteur sur encours one-shot
--
-- Catégories produit utilisées : SCPI, PE, CAV_CAPI (clés canoniques du
-- codebase, cf. `normalizeCategorieForDefaults` dans default-grilles.ts).
-- "LUX" et "CAV LUX" / "CAPI LUX" sont normalisés vers CAV_CAPI — la règle
-- 6-mois s'applique donc à tous les contrats CAV/CAPI quelle que soit leur
-- domiciliation.
--
-- Rétro-compat : `apporteurs.taux_commission` reste actif comme fallback
-- pour les apporteurs V1 sans règles produit définies.
--
-- Idempotent (CREATE/ADD COLUMN IF NOT EXISTS).
-- Pas de seed — les règles Yoann seront créées via l'UI Paramètres dans
-- la PR suivante (Phase 4).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Périodicité encours sur la compagnie (mensuel|trimestriel)
-- =============================================================================
-- Default = trimestriel (cas majoritaire actuel) → ne casse pas l'existant.
-- À renseigner manuellement par Maxine dans l'UI Catalogue (Phase 5) pour
-- les compagnies CAV/CAPI dont l'encours est facturé mensuellement.
ALTER TABLE public.compagnies
  ADD COLUMN IF NOT EXISTS encours_periodicite TEXT
    DEFAULT 'trimestriel'
    CHECK (encours_periodicite IN ('mensuel', 'trimestriel'));

COMMENT ON COLUMN public.compagnies.encours_periodicite IS
  'Périodicité de la rémunération sur encours (mensuel|trimestriel). Uniforme par compagnie. Utilisé pour calculer le "6 mois encours one-shot" apporteur (×6 si mensuel, ×2 si trimestriel).';


-- =============================================================================
-- 2. Table apporteur_compensation_rules
-- =============================================================================
-- 1 ligne = 1 règle de rémunération apporteur pour une catégorie produit.
-- Yoann aura 3 lignes : SCPI/entry_pct_montant=1, PE/entry_pct_frais=25,
-- CAV_CAPI/encours_oneshot_months=6.
--
-- rule_type :
--   - entry_pct_montant      → assiette = dossier.montant
--                              (ex. SCPI 1% : 300k × 1% = 3 000 €)
--   - entry_pct_frais        → assiette = montant × frais_entree_catalogue
--                              (ex. PE 25% : 100k × 5% × 25% = 1 250 €)
--   - encours_oneshot_months → assiette = montant × frais_encours_catalogue × N
--                              (N = 6 si mensuel, 2 si trimestriel,
--                               lu sur compagnies.encours_periodicite)
CREATE TABLE IF NOT EXISTS public.apporteur_compensation_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apporteur_id      UUID NOT NULL REFERENCES public.apporteurs(id) ON DELETE CASCADE,
  product_category  TEXT NOT NULL
    CHECK (product_category IN ('SCPI', 'PE', 'CAV_CAPI')),
  rule_type         TEXT NOT NULL
    CHECK (rule_type IN ('entry_pct_montant', 'entry_pct_frais', 'encours_oneshot_months')),
  rate_pct          NUMERIC(6,3),  -- pour entry_pct_* : 1.000 (SCPI), 25.000 (PE)
  encours_months    SMALLINT,      -- pour encours_oneshot_months : 6
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID REFERENCES public.consultants(id) ON DELETE SET NULL,

  -- Une seule règle par (apporteur, catégorie). Si l'apporteur veut deux
  -- règles sur la même catégorie (rare : entry+encours sur PE par ex.),
  -- les exprimer comme deux règles distinctes via une catégorie virtuelle —
  -- pour l'instant on garde le modèle 1 règle = 1 catégorie.
  UNIQUE (apporteur_id, product_category),

  -- Cohérence : rate_pct requis pour entry_pct_*, encours_months requis pour encours_oneshot_months
  CONSTRAINT apporteur_rules_params_check CHECK (
    (rule_type IN ('entry_pct_montant', 'entry_pct_frais') AND rate_pct IS NOT NULL AND encours_months IS NULL)
    OR
    (rule_type = 'encours_oneshot_months' AND encours_months IS NOT NULL AND rate_pct IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_apporteur_rules_apporteur
  ON public.apporteur_compensation_rules (apporteur_id) WHERE active;

COMMENT ON TABLE public.apporteur_compensation_rules IS
  'Règles de rémunération apporteur par catégorie produit (V2, 2026-04-27). Remplace progressivement apporteurs.taux_commission (qui reste comme fallback).';
COMMENT ON COLUMN public.apporteur_compensation_rules.rule_type IS
  'entry_pct_montant : % du montant souscrit (SCPI). entry_pct_frais : % des frais d''entrée (PE). encours_oneshot_months : N mois d''encours one-shot (CAV_CAPI).';
COMMENT ON COLUMN public.apporteur_compensation_rules.rate_pct IS
  'Taux en %, ex. 1.000 ou 25.000. NULL si rule_type = encours_oneshot_months.';
COMMENT ON COLUMN public.apporteur_compensation_rules.encours_months IS
  'Nombre de mois d''encours one-shot (typiquement 6). NULL si rule_type = entry_pct_*.';


-- =============================================================================
-- 3. Trigger auto-updated_at + updated_by (pattern commission_split_rules)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_apporteur_rules_updated_meta()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := public.get_current_consultant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_apporteur_rules_updated_meta ON public.apporteur_compensation_rules;
CREATE TRIGGER set_apporteur_rules_updated_meta
  BEFORE INSERT OR UPDATE ON public.apporteur_compensation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_apporteur_rules_updated_meta();


-- =============================================================================
-- 4. RLS — alignée sur apporteurs (lecture authenticated, mutations
--    managers/back-office, DELETE managers only)
-- =============================================================================
ALTER TABLE public.apporteur_compensation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apporteur_compensation_rules FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apporteur_rules_select ON public.apporteur_compensation_rules;
CREATE POLICY apporteur_rules_select ON public.apporteur_compensation_rules
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS apporteur_rules_insert ON public.apporteur_compensation_rules;
CREATE POLICY apporteur_rules_insert ON public.apporteur_compensation_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() OR public.is_back_office());

DROP POLICY IF EXISTS apporteur_rules_update ON public.apporteur_compensation_rules;
CREATE POLICY apporteur_rules_update ON public.apporteur_compensation_rules
  FOR UPDATE TO authenticated
  USING (public.is_manager() OR public.is_back_office())
  WITH CHECK (public.is_manager() OR public.is_back_office());

DROP POLICY IF EXISTS apporteur_rules_delete ON public.apporteur_compensation_rules;
CREATE POLICY apporteur_rules_delete ON public.apporteur_compensation_rules
  FOR DELETE TO authenticated
  USING (public.is_manager());


-- =============================================================================
-- 5. Audit trigger (log INSERT/UPDATE/DELETE dans audit_logs)
-- =============================================================================
DROP TRIGGER IF EXISTS audit_apporteur_compensation_rules ON public.apporteur_compensation_rules;
CREATE TRIGGER audit_apporteur_compensation_rules
  AFTER INSERT OR UPDATE OR DELETE ON public.apporteur_compensation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_func();


-- =============================================================================
-- 6. Colonnes commissions — split apporteur granulaire
-- =============================================================================
-- Aujourd'hui `rem_apporteur_ext` = somme à plat. On la garde pour
-- rétro-compat et on ajoute deux colonnes pour la traçabilité du calcul V2.
-- Convention :
--   rem_apporteur_ext = rem_apporteur_entry + rem_apporteur_encours_oneshot
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS rem_apporteur_entry            NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rem_apporteur_encours_oneshot  NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN public.commissions.rem_apporteur_entry IS
  'V2 (2026-04-27) — Part apporteur sur frais d''entrée (SCPI entry_pct_montant ou PE entry_pct_frais). Composante de rem_apporteur_ext.';
COMMENT ON COLUMN public.commissions.rem_apporteur_encours_oneshot IS
  'V2 (2026-04-27) — Part apporteur one-shot sur N mois d''encours (CAV_CAPI). Composante de rem_apporteur_ext. Versée à la souscription, n''impacte pas l''allocation encours périodique.';

COMMIT;


-- =============================================================================
-- Smoke test (à exécuter dans Supabase SQL editor après apply)
-- =============================================================================
--
-- 1. Colonne compagnies.encours_periodicite ajoutée :
--    SELECT column_name, data_type, column_default
--      FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='compagnies'
--       AND column_name='encours_periodicite';
--    → 1 ligne, default 'trimestriel'
--
-- 2. Table apporteur_compensation_rules créée :
--    SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='apporteur_compensation_rules'
--     ORDER BY ordinal_position;
--    → 9 lignes (id, apporteur_id, product_category, rule_type, rate_pct,
--      encours_months, active, created_at, updated_at, updated_by)
--
-- 3. RLS active :
--    SELECT relrowsecurity, relforcerowsecurity FROM pg_class
--     WHERE relname = 'apporteur_compensation_rules';
--    → t / t
--
-- 4. 4 policies :
--    SELECT policyname, cmd FROM pg_policies
--     WHERE tablename='apporteur_compensation_rules' ORDER BY policyname;
--    → apporteur_rules_select / insert / update / delete
--
-- 5. Colonnes commissions ajoutées :
--    SELECT column_name FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='commissions'
--       AND column_name IN ('rem_apporteur_entry','rem_apporteur_encours_oneshot');
--    → 2 lignes
--
-- 6. CHECK constraints :
--    -- INSERT entry_pct_montant SANS rate_pct doit ÉCHOUER
--    INSERT INTO apporteur_compensation_rules
--      (apporteur_id, product_category, rule_type)
--      SELECT id, 'SCPI', 'entry_pct_montant' FROM apporteurs LIMIT 1;
--    → ERREUR (apporteur_rules_params_check)
--
--    -- INSERT encours_oneshot_months SANS encours_months doit ÉCHOUER
--    INSERT INTO apporteur_compensation_rules
--      (apporteur_id, product_category, rule_type)
--      SELECT id, 'CAV_CAPI', 'encours_oneshot_months' FROM apporteurs LIMIT 1;
--    → ERREUR (apporteur_rules_params_check)
--
-- 7. Préparation Yoann (à exécuter manuellement après création apporteur Yoann) :
--    INSERT INTO apporteur_compensation_rules (apporteur_id, product_category, rule_type, rate_pct)
--      SELECT id, 'SCPI', 'entry_pct_montant', 1.000
--        FROM apporteurs WHERE nom='POULIQUEN' AND prenom='Yoann';
--    INSERT INTO apporteur_compensation_rules (apporteur_id, product_category, rule_type, rate_pct)
--      SELECT id, 'PE', 'entry_pct_frais', 25.000
--        FROM apporteurs WHERE nom='POULIQUEN' AND prenom='Yoann';
--    INSERT INTO apporteur_compensation_rules (apporteur_id, product_category, rule_type, encours_months)
--      SELECT id, 'CAV_CAPI', 'encours_oneshot_months', 6
--        FROM apporteurs WHERE nom='POULIQUEN' AND prenom='Yoann';
-- =============================================================================
--
-- POST-APPLY CHECKLIST (côté repo, après apply Supabase)
-- =============================================================================
--
-- 1. Régénérer les types Supabase :
--      npx supabase gen types typescript --project-id <PROJECT_ID> \
--        > src/types/database.ts
--
-- 2. Re-append les aliases custom à la fin de src/types/database.ts (la regen
--    écrase tout après `as const`). Snippet à ré-ajouter :
--
--      export type ApporteurCompensationRule       = Database["public"]["Tables"]["apporteur_compensation_rules"]["Row"]
--      export type ApporteurCompensationRuleInsert = Database["public"]["Tables"]["apporteur_compensation_rules"]["Insert"]
--      export type ApporteurCompensationRuleUpdate = Database["public"]["Tables"]["apporteur_compensation_rules"]["Update"]
--
--    + ré-appliquer TOUS les autres aliases existants (RoleType, Consultant,
--      Client, Compagnie, Apporteur, etc.) — voir lignes 2840–2920 du fichier
--      avant regen pour le diff complet.
--
-- 3. npm run db:introspect (refresh Drizzle introspection-only types)
--
-- 4. npm run typecheck — doit passer sans erreur
-- =============================================================================

