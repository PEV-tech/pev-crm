-- PEV CRM — Baseline RLS / policies / helper functions
--
-- Ce script NE modifie RIEN. Il lit l'état des RLS en prod et produit
-- des sorties lisibles pour :
--   1. figer un baseline reproductible (copier-coller dans une revue),
--   2. comparer deux environnements (staging vs prod) en diff textuel,
--   3. détecter une dérive (une policy disparue, une table qui a perdu
--      RLS après un ALTER TABLE, etc.).
--
-- Usage :
--   Supabase Dashboard → SQL Editor → coller ce fichier → Run.
--   Copier la sortie des 4 requêtes dans un gist ou un fichier daté :
--     ops/rls-baseline-YYYY-MM-DD.txt
--
-- Référence : audit-rls-coverage.sql (qui est diagnostique), ce
-- fichier-ci est le pendant snapshot/baseline.

-- ───────────────────────────────────────────────────────────────────
-- 1) État RLS de toutes les tables public.*
--    Attendu : rls_enabled = true ET rls_forced = true partout,
--    sauf justification explicite (aucune à date — encaissements
--    reste un TODO, cf. fix-rls-encaissements.sql et SECURITY_AUDIT §2).
-- ───────────────────────────────────────────────────────────────────

SELECT
  n.nspname                              AS schema,
  c.relname                              AS table_name,
  c.relrowsecurity                       AS rls_enabled,
  c.relforcerowsecurity                  AS rls_forced,
  (SELECT COUNT(*) FROM pg_policies p
    WHERE p.schemaname = n.nspname
      AND p.tablename  = c.relname)      AS nb_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'   -- tables ordinaires (pas les vues)
ORDER BY c.relname;

-- ───────────────────────────────────────────────────────────────────
-- 2) Liste détaillée des policies
--    Utile pour diff entre deux envs. Les colonnes qual/with_check
--    contiennent l'expression SQL de la clause USING / WITH CHECK.
-- ───────────────────────────────────────────────────────────────────

SELECT
  schemaname,
  tablename,
  policyname,
  cmd                  AS command,
  roles,
  qual                 AS using_expr,
  with_check           AS check_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ───────────────────────────────────────────────────────────────────
-- 3) Helper functions utilisées dans les policies
--    On vérifie leur existence et leur signature. Les policies RLS
--    reposent sur : is_manager(), is_back_office(),
--    get_current_consultant_id(). Si l'une disparaît ou change de
--    signature, des policies vont silently renvoyer faux partout.
-- ───────────────────────────────────────────────────────────────────

SELECT
  n.nspname                         AS schema,
  p.proname                         AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid)     AS returns,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
  l.lanname                         AS language
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language  l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname IN (
    'is_manager',
    'is_back_office',
    'get_current_consultant_id',
    'get_current_user_role'
  )
ORDER BY p.proname;

-- ───────────────────────────────────────────────────────────────────
-- 4) Permissions des rôles Supabase par défaut
--    anon / authenticated / service_role : doivent avoir USAGE sur
--    public, SELECT sur les tables où RLS le permet, pas de GRANT
--    global INSERT/UPDATE/DELETE sauf via RLS.
-- ───────────────────────────────────────────────────────────────────

SELECT
  grantee,
  table_schema,
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee, table_schema, table_name
ORDER BY table_name, grantee;

-- ───────────────────────────────────────────────────────────────────
-- 5) Check final : lignes "rouges" à flagger
--    Toute sortie de cette requête = déviation par rapport au baseline
--    attendu. À intégrer dans un job planifié (Supabase cron) plus
--    tard pour alerter sur les dérives.
-- ───────────────────────────────────────────────────────────────────

WITH table_rls AS (
  SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    (SELECT COUNT(*) FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS nb_policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
)
SELECT
  table_name,
  rls_enabled,
  rls_forced,
  nb_policies,
  CASE
    WHEN NOT rls_enabled         THEN 'RLS_DISABLED'
    WHEN NOT rls_forced          THEN 'RLS_NOT_FORCED'
    WHEN nb_policies = 0         THEN 'NO_POLICIES'
    ELSE 'OK'
  END AS status
FROM table_rls
WHERE NOT rls_enabled
   OR NOT rls_forced
   OR nb_policies = 0
ORDER BY table_name;

-- Interprétation :
--   - RLS_DISABLED        : RLS non activée → lecture/écriture libre pour l'anon key.
--                           C'est le cas aujourd'hui de encaissements (cf. fix-rls-encaissements.sql).
--   - RLS_NOT_FORCED      : le owner de la table (postgres) contourne les policies.
--                           Acceptable pour des tables purement admin, à éviter sinon.
--   - NO_POLICIES         : RLS activée mais aucune policy → tout refusé en lecture.
--                           Souvent intentionnel sur une table d'audit write-only,
--                           mais à vérifier.
--
-- Baseline attendu 2026-04-21 (à mettre à jour après chaque rotation) :
--   - encaissements → RLS_DISABLED (TODO V1, cf. fix-rls-encaissements.sql)
--   - reste → OK
