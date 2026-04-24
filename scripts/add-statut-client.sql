-- Migration: Ajouter le statut client (actif / non abouti)
-- Date: 2026-04-24
-- Référence: Corrections app Étape 2 point 2.3 (plan 2026-04-24)
-- Description:
--   Ajoute une colonne `statut_client` sur `clients` pour distinguer :
--     - 'actif' : client en cours de suivi (défaut, valeur implicite si NULL)
--     - 'non_abouti' : client archivé par le consultant via le bouton
--       "Non abouti" sur sa fiche. Masqué par défaut des listes
--       (Dossiers, Ma clientèle). Réversible via bouton "Réactiver".
--
--   La règle métier "fiche client sans dossier = prospect" ne nécessite
--   PAS de colonne — elle est dérivée au runtime (clients sans ligne dans
--   `dossiers` remontent comme prospects dans la liste Dossiers).
--
--   Le statut_client est distinct du statut des dossiers (statut_dossier_type).
--   Un client "non_abouti" peut néanmoins avoir des dossiers historiques
--   conservés pour traçabilité.
--
-- Reversible : ALTER TABLE clients DROP COLUMN statut_client;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS statut_client TEXT
  DEFAULT 'actif'
  CHECK (statut_client IN ('actif', 'non_abouti'));

COMMENT ON COLUMN clients.statut_client IS
  'Statut client : actif (défaut) ou non_abouti (archivé via bouton "Non abouti" sur fiche client). Masqué par défaut des listes quand non_abouti. Ajouté 2026-04-24 (point 2.3 corrections app).';

-- Backfill : tout client existant est considéré actif (la DEFAULT s'applique
-- aux futurs INSERT, mais on force la valeur pour les rows existantes qui
-- pourraient avoir NULL si la contrainte DEFAULT ne s'applique pas rétroactivement).
UPDATE clients SET statut_client = 'actif' WHERE statut_client IS NULL;

-- Index partiel pour accélérer les requêtes qui filtrent les clients non_abouti
-- (la majorité des listes filtrent `statut_client = 'actif'` — l'index sur les
-- non_abouti seul est léger et couvre le cas "voir les archivés").
CREATE INDEX IF NOT EXISTS idx_clients_statut_non_abouti
  ON clients (id)
  WHERE statut_client = 'non_abouti';
