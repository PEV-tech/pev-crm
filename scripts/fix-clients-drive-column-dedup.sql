-- Déduplication de la colonne Drive sur clients.
--
-- Diagnostic 2026-04-21 (inspect-clients-drive-columns.sql) :
--   total_clients            = N (à recapturer juste avant l'apply)
--   drive_url_non_null       = 0
--   google_drive_url_non_null = 1
--   both_set_and_differ      = 0
--   only_old_col_set         = 0
--
-- Conclusion : aucune donnée à backfiller. L'ancienne colonne drive_url
-- (créée à la main dans le Table Editor Supabase, sans script) est 100 %
-- vide. On peut la DROP sans risque.
--
-- Le bug « lien Google Drive non enregistré après reload » n'était PAS dû
-- au doublon mais au trigger d'audit qui avalait les UPDATE clients
-- (corrigé 2026-04-20 via fix-audit-trigger-table-name.sql).
--
-- Ce script est néanmoins utile pour supprimer la colonne fantôme qui
-- pollue les types TypeScript et crée une ambiguïté structurelle.
--
-- ATTENTION : re-lancer inspect-clients-drive-columns.sql juste avant
-- l'apply pour confirmer que drive_url_non_null est bien à 0. Si ce n'est
-- plus le cas (quelqu'un a rescribé sur l'ancienne colonne via l'API),
-- basculer sur l'ancienne stratégie backfill.

BEGIN;

-- Garde-fou : échouer si la colonne contient des données non migrées.
DO $$
DECLARE
  orphans int;
BEGIN
  SELECT COUNT(*) INTO orphans
  FROM   public.clients
  WHERE  drive_url IS NOT NULL
    AND  (google_drive_url IS NULL OR google_drive_url = '');

  IF orphans > 0 THEN
    RAISE EXCEPTION
      'drive_url contient % lignes non migrées vers google_drive_url — abort',
      orphans;
  END IF;
END $$;

ALTER TABLE public.clients DROP COLUMN IF EXISTS drive_url;

COMMENT ON COLUMN public.clients.google_drive_url IS
  'Lien Google Drive du client (ancienne colonne drive_url supprimée 2026-04-21).';

COMMIT;

-- Après apply, régénérer les types TypeScript :
--   npx supabase gen types typescript --project-id upupmfwwlwtznffodfmt \
--     > src/types/database.ts
-- Puis : npm run type-check
