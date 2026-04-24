-- Migration: Ajouter la section "Patrimoine professionnel" au KYC client
-- Date: 2026-04-24
-- Référence: Corrections app Étape 1 point 1.6 (plan 2026-04-24)
-- Description:
--   Ajoute une colonne JSONB `patrimoine_professionnel` sur `clients` pour
--   stocker les actifs professionnels du client (locaux, BFR, trésorerie,
--   outils/machines, véhicule, autre). Distingue Immobilier pro vs
--   Financier pro via `categorie`. Structure cohérente avec les autres
--   colonnes patrimoine JSONB (patrimoine_immobilier, patrimoine_divers).
--
-- Structure des lignes (documentée aussi dans src/components/clients/kyc-section.tsx
-- via l'interface PatrimoineProRow) :
--   {
--     "categorie": "immo_pro" | "financier_pro",
--     "sous_categorie": "locaux" | "bfr" | "tresorerie" | "outils_machines" | "vehicule" | "autre",
--     "designation": "<libellé libre, ex: Entrepôt 12 rue X>",
--     "valeur": <nombre>,
--     "description": "<commentaire optionnel>",
--     "detenteur_type": "client" | "co_titulaire" | "joint",
--     "co_titulaire_client_id": "<uuid ou null>"
--   }
--
-- Reversible : ALTER TABLE clients DROP COLUMN patrimoine_professionnel;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS patrimoine_professionnel JSONB;

COMMENT ON COLUMN clients.patrimoine_professionnel IS
  'Patrimoine professionnel du client (JSONB array). Catégories : immo_pro / financier_pro. Sous-catégories : locaux, bfr, tresorerie, outils_machines, vehicule, autre. Ajouté 2026-04-24 (point 1.6 corrections app).';

-- Refresh de la vue `v_clients_secure` n'est pas nécessaire : elle whitelist les
-- colonnes explicitement (cf scripts/v_clients_secure.sql). Ajouter la colonne
-- dans la vue si on veut exposer `patrimoine_professionnel` côté front via la vue
-- plutôt que via la table directe (pour l'instant les JSONB patrimoine sont lus
-- directement sur `clients` donc pas d'action requise ici).
