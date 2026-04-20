-- =====================================================
-- FEATURE : permettre la creation de clients "standalone" (sans dossier)
-- Date : 2026-04-20
-- Context : CDC Ethique Patrimoine — "Nouveau client" doit pouvoir exister
--           sans projet (dossier) rattache. Le consultant proprietaire et la
--           date d'entree en relation etaient jusqu'a present derivees du
--           premier dossier cree ; on les remonte au niveau client pour que
--           "Ma Clientele" puisse lister les clients orphelins.
-- =====================================================
--
-- Changements :
-- 1. clients.consultant_id : FK -> consultants(id), nullable (pour la retro-
--    compatibilite avec les 1800+ clients existants dont le consultant se
--    deduit via les dossiers). A terme, backfill puis NOT NULL.
-- 2. clients.date_entree_relation : DATE nullable. Pour les clients deja en
--    base, restera NULL et sera eventuellement backfillee par la date du
--    premier dossier (hors scope de ce script).
-- 3. Index sur consultant_id pour les requetes "mes clients" efficaces.
--
-- RLS : les policies existantes sur clients utilisent deja is_manager() /
-- is_back_office() et un filtre par dossiers.consultant_id. Comme la colonne
-- consultant_id n'existait pas au niveau client, aucune policy actuelle ne la
-- reference, donc ajouter la colonne ne casse rien. Le frontend pourra lire
-- librement ; les policies seront eventuellement etendues dans un fix-rls-*
-- script dedie (hors scope ici).
--
-- Idempotent : ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- =====================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES consultants(id) ON DELETE SET NULL;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS date_entree_relation DATE;

CREATE INDEX IF NOT EXISTS idx_clients_consultant_id ON clients(consultant_id);

-- Smoke test :
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'clients'
--   AND column_name IN ('consultant_id', 'date_entree_relation');
