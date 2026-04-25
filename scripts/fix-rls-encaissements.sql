-- =============================================================================
-- fix-rls-encaissements.sql — RLS sur `encaissements` (P0 sécurité V1)
-- =============================================================================
--
-- Date    : 2026-04-21 (créé) / 2026-04-25 (réécrit)
-- Origine : audit-rls-coverage.sql Rapport 1 — `encaissements` était la seule
--           table public.* avec RLS désactivée. Table financière (montants
--           d'encaissement client → consultant) lisible par n'importe quel
--           utilisateur authentifié via l'anon key. Bloquant V1.
--
-- ⚠️  Réécrit 2026-04-25 :
--   La V1 du script joignait sur `encaissements.client_id`, colonne
--   INEXISTANTE. La relation passe en réalité par `dossier_id` (UNIQUE,
--   one-to-one) et la table expose elle-même un `consultant_id` non null
--   pour les lignes en provenance du flux historique. On utilise donc :
--     1. encaissements.consultant_id quand renseigné (chemin rapide)
--     2. fallback via dossier → clients.consultant_id pour les lignes
--        legacy où consultant_id est null.
--   Documenté dans STATUS.md §Backlog priorisé item 9.
--
-- Modèle d'accès (calqué sur dossiers / clients) :
--   - SELECT : consultant propriétaire (direct ou via le dossier), managers,
--              back-office.
--   - INSERT / UPDATE : idem (empêche un consultant d'encaisser sur un
--                       dossier qui n'est pas le sien).
--   - DELETE : managers uniquement (un encaissement supprimé = écart compta).
--
-- Idempotent (DROP POLICY IF EXISTS + CREATE).
-- =============================================================================

BEGIN;

ALTER TABLE public.encaissements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encaissements FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- SELECT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS encaissements_select ON public.encaissements;
CREATE POLICY encaissements_select ON public.encaissements
  FOR SELECT TO public
  USING (
    public.is_manager()
    OR public.is_back_office()
    OR consultant_id = public.get_current_consultant_id()
    OR EXISTS (
      SELECT 1
        FROM public.dossiers d
        JOIN public.clients  c ON c.id = d.client_id
       WHERE d.id = encaissements.dossier_id
         AND c.consultant_id = public.get_current_consultant_id()
    )
  );

-- ---------------------------------------------------------------------------
-- INSERT — empêche un consultant d'écrire sur un dossier qui n'est pas le sien
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS encaissements_insert ON public.encaissements;
CREATE POLICY encaissements_insert ON public.encaissements
  FOR INSERT TO public
  WITH CHECK (
    public.is_manager()
    OR public.is_back_office()
    OR consultant_id = public.get_current_consultant_id()
    OR EXISTS (
      SELECT 1
        FROM public.dossiers d
        JOIN public.clients  c ON c.id = d.client_id
       WHERE d.id = encaissements.dossier_id
         AND c.consultant_id = public.get_current_consultant_id()
    )
  );

-- ---------------------------------------------------------------------------
-- UPDATE — USING contrôle la ligne lue, WITH CHECK la ligne écrite
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS encaissements_update ON public.encaissements;
CREATE POLICY encaissements_update ON public.encaissements
  FOR UPDATE TO public
  USING (
    public.is_manager()
    OR public.is_back_office()
    OR consultant_id = public.get_current_consultant_id()
    OR EXISTS (
      SELECT 1
        FROM public.dossiers d
        JOIN public.clients  c ON c.id = d.client_id
       WHERE d.id = encaissements.dossier_id
         AND c.consultant_id = public.get_current_consultant_id()
    )
  )
  WITH CHECK (
    public.is_manager()
    OR public.is_back_office()
    OR consultant_id = public.get_current_consultant_id()
    OR EXISTS (
      SELECT 1
        FROM public.dossiers d
        JOIN public.clients  c ON c.id = d.client_id
       WHERE d.id = encaissements.dossier_id
         AND c.consultant_id = public.get_current_consultant_id()
    )
  );

-- ---------------------------------------------------------------------------
-- DELETE — managers uniquement
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS encaissements_delete ON public.encaissements;
CREATE POLICY encaissements_delete ON public.encaissements
  FOR DELETE TO public
  USING (public.is_manager());

COMMIT;

-- =============================================================================
-- Smoke test après apply (à exécuter dans Supabase SQL editor)
-- =============================================================================
--
-- 1. RLS activée + forcée :
--    SELECT relname, relrowsecurity, relforcerowsecurity
--      FROM pg_class WHERE relname = 'encaissements';
--    → attendu : encaissements | t | t
--
-- 2. Policies présentes :
--    SELECT policyname, cmd FROM pg_policies WHERE tablename = 'encaissements';
--    → attendu : 4 lignes (encaissements_{select,insert,update,delete})
--
-- 3. Vérification fonctionnelle :
--    a. Se connecter en tant que consultant lambda → /dashboard/encaissements
--       doit n'afficher QUE les encaissements de ses propres clients/dossiers.
--    b. Se connecter en tant que manager → tous les encaissements remontent.
--    c. Tenter un INSERT direct depuis l'anon key sur un dossier d'un autre
--       consultant → doit échouer en RLS violation.
--
-- 4. Mise à jour du baseline :
--    Réexécuter scripts/rls-baseline.sql et confirmer que `encaissements`
--    est désormais en RLS_ENABLED dans le rapport.
-- =============================================================================
