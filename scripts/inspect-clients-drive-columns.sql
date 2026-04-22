-- Diagnostic du doublon drive_url / google_drive_url.
--
-- Le code front (src/app/dashboard/clients/[id]/page.tsx) utilise exclusivement
-- `google_drive_url`. Le script p3-evolutions.sql L104 a créé
-- `google_drive_url` en 2026-04-10.
-- Cependant src/types/database.ts (régénéré 2026-04-20) expose AUSSI une colonne
-- `drive_url` → celle-ci a été créée à la main dans le Table Editor Supabase,
-- sans script.
--
-- Cause probable du bug « lien Google Drive non enregistré après reload » :
--   - une ancienne version du front écrivait sur `drive_url`
--   - la version actuelle écrit sur `google_drive_url` mais lit peut-être
--     depuis `drive_url` selon la requête / le cache / un trigger.
--
-- Ce script est read-only.

-- 1. Confirmer la présence des deux colonnes
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'clients'
  AND  column_name  IN ('drive_url', 'google_drive_url');

-- 2. Mesurer la divergence sur les lignes existantes
SELECT
  COUNT(*)                                                AS total_clients,
  COUNT(drive_url)                                        AS drive_url_non_null,
  COUNT(google_drive_url)                                 AS google_drive_url_non_null,
  COUNT(*) FILTER (WHERE drive_url IS DISTINCT FROM google_drive_url
                     AND drive_url IS NOT NULL
                     AND google_drive_url IS NOT NULL)    AS both_set_and_differ,
  COUNT(*) FILTER (WHERE drive_url IS NOT NULL
                     AND google_drive_url IS NULL)        AS only_old_col_set,
  COUNT(*) FILTER (WHERE drive_url IS NULL
                     AND google_drive_url IS NOT NULL)    AS only_new_col_set
FROM   public.clients;

-- 3. Lister les lignes problématiques (si pertinent)
SELECT id, prenom, nom, drive_url, google_drive_url
FROM   public.clients
WHERE  drive_url IS NOT NULL
   OR  google_drive_url IS NOT NULL
ORDER  BY COALESCE(updated_at, created_at) DESC
LIMIT  50;
