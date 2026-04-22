-- Audit RLS / Storage / exposition des données.
-- Read-only. À exécuter dans le SQL editor Supabase.
-- Sortie : 5 rapports à capturer dans docs/SECURITY_AUDIT.md.

-- ============================================================================
-- RAPPORT 1 : tables avec RLS désactivée
-- ============================================================================
-- Toute table listée ci-dessous est un potentiel trou de sécurité : les
-- données y sont accessibles à tout utilisateur authentifié via anon key,
-- sans filtrage par rôle ni propriétaire.

SELECT
  n.nspname       AS schema,
  c.relname       AS table,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  c.relkind = 'r'
  AND  n.nspname = 'public'
  AND  NOT c.relrowsecurity
ORDER  BY c.relname;

-- ============================================================================
-- RAPPORT 2 : tables avec RLS mais sans aucune policy
-- ============================================================================
-- Une table avec RLS activée sans policy = inaccessible en lecture/écriture
-- (sauf service_role). À corriger ou retirer la table.

WITH rls_tables AS (
  SELECT n.nspname || '.' || c.relname AS qname, c.oid
  FROM   pg_class c
  JOIN   pg_namespace n ON n.oid = c.relnamespace
  WHERE  c.relkind = 'r' AND n.nspname = 'public' AND c.relrowsecurity
)
SELECT rt.qname AS table
FROM   rls_tables rt
LEFT   JOIN pg_policies p
       ON p.schemaname = split_part(rt.qname, '.', 1)
      AND p.tablename  = split_part(rt.qname, '.', 2)
WHERE  p.policyname IS NULL;

-- ============================================================================
-- RAPPORT 3 : policies actives par table
-- ============================================================================
-- Revue qualitative : pour chaque table, lister ses policies avec qual+check.
-- Cibler : (a) clients, (b) dossiers, (c) commissions, (d) factures,
--         (e) encaissements, (f) client_pj, (g) audit_logs

SELECT tablename, policyname, cmd, roles, qual, with_check
FROM   pg_policies
WHERE  schemaname = 'public'
ORDER  BY tablename, cmd, policyname;

-- ============================================================================
-- RAPPORT 4 : buckets storage et leurs policies
-- ============================================================================
-- Cible : kyc-documents, client-pj (ou équivalent), templates.
-- Attendu :
--   - kyc-documents : public=false, policies INSERT/UPDATE service_role,
--     SELECT authenticated (lien signé), DELETE via is_manager().
--   - tout bucket avec public=true sans raison métier claire est un risque.

SELECT id AS bucket, public, file_size_limit, allowed_mime_types, created_at
FROM   storage.buckets
ORDER  BY created_at;

SELECT b.id AS bucket, p.name AS policy, p.command, p.definition
FROM   storage.buckets b
LEFT   JOIN storage.policies p ON p.bucket_id = b.id
ORDER  BY b.id, p.command;

-- ============================================================================
-- RAPPORT 5 : RPC accessibles à public/anon/authenticated
-- ============================================================================
-- Toute RPC SECURITY DEFINER sans search_path figé = risque injection.
-- Toute RPC accessible à `anon` = porte d'entrée sans auth.

SELECT p.proname                                  AS function,
       pg_get_function_arguments(p.oid)           AS args,
       p.prosecdef                                AS security_definer,
       array_to_string(p.proconfig, ',')          AS config,
       array_to_string(ARRAY(
         SELECT grantee || '=' || privilege_type
         FROM   information_schema.routine_privileges rp
         WHERE  rp.routine_name = p.proname
       ), '; ')                                   AS grants
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
  AND  p.prokind = 'f'
ORDER  BY p.proname;
