-- RLS sur `encaissements` — finding de l'audit SECURITY_AUDIT.md.
--
-- Contexte (audit-rls-coverage.sql, Rapport 1, 2026-04-21) :
--   `encaissements` était la seule table `public.*` avec RLS désactivée.
--   C'est une table financière (montants d'encaissement client → consultant)
--   accessible à n'importe quel utilisateur authentifié via l'anon key.
--
-- Modèle de données attendu (à vérifier avant apply) :
--   encaissements.client_id    → public.clients(id)
--   encaissements.consultant_id (optionnel, redondant avec clients.consultant_id)
--
-- Règles d'accès (calquées sur dossiers) :
--   - SELECT : consultant propriétaire du client, managers, back-office.
--   - INSERT / UPDATE : idem.
--   - DELETE : managers uniquement (traçabilité financière).
--
-- Le filtrage passe par JOIN sur clients.consultant_id pour éviter de
-- dupliquer la règle sur chaque table et rester cohérent avec les
-- dossiers (même propriétaire métier).

BEGIN;

ALTER TABLE public.encaissements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encaissements FORCE  ROW LEVEL SECURITY;

-- SELECT : propriétaire du client OU manager OU back-office
DROP POLICY IF EXISTS encaissements_select ON public.encaissements;
CREATE POLICY encaissements_select ON public.encaissements
  FOR SELECT TO public
  USING (
    is_manager()
    OR is_back_office()
    OR EXISTS (
      SELECT 1 FROM public.clients c
       WHERE c.id = encaissements.client_id
         AND c.consultant_id = get_current_consultant_id()
    )
  );

-- INSERT : idem — empêche un consultant d'encaisser sur un client qui
--          n'est pas le sien.
DROP POLICY IF EXISTS encaissements_insert ON public.encaissements;
CREATE POLICY encaissements_insert ON public.encaissements
  FOR INSERT TO public
  WITH CHECK (
    is_manager()
    OR is_back_office()
    OR EXISTS (
      SELECT 1 FROM public.clients c
       WHERE c.id = encaissements.client_id
         AND c.consultant_id = get_current_consultant_id()
    )
  );

-- UPDATE : idem. USING contrôle la ligne lue, WITH CHECK la ligne écrite.
DROP POLICY IF EXISTS encaissements_update ON public.encaissements;
CREATE POLICY encaissements_update ON public.encaissements
  FOR UPDATE TO public
  USING (
    is_manager()
    OR is_back_office()
    OR EXISTS (
      SELECT 1 FROM public.clients c
       WHERE c.id = encaissements.client_id
         AND c.consultant_id = get_current_consultant_id()
    )
  )
  WITH CHECK (
    is_manager()
    OR is_back_office()
    OR EXISTS (
      SELECT 1 FROM public.clients c
       WHERE c.id = encaissements.client_id
         AND c.consultant_id = get_current_consultant_id()
    )
  );

-- DELETE : managers uniquement. Un encaissement supprimé = écart compta.
DROP POLICY IF EXISTS encaissements_delete ON public.encaissements;
CREATE POLICY encaissements_delete ON public.encaissements
  FOR DELETE TO public
  USING (is_manager());

COMMIT;

-- Smoke test après apply :
--   SELECT relname, relrowsecurity, relforcerowsecurity
--   FROM   pg_class WHERE relname = 'encaissements';
--   → attendu : t / t
--
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'encaissements';
--   → attendu : 4 policies (select / insert / update / delete).
--
-- Vérification front : se connecter en tant que consultant, lister
-- ses encaissements via `/dashboard/encaissements`, vérifier qu'il ne
-- voit que les siens. Idem en tant que manager : tout doit remonter.
