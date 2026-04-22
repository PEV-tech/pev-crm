-- =====================================================
-- FEATURE : corrections étape 1 (création fiche client) — frictions KYC
-- Date : 2026-04-22
-- Context : audit KYC 2026-04-22 — le formulaire `nouveau client` et la
--           fiche détail stockent partiellement les informations du template
--           KYC Ethique et Patrimoine (Word). Deux colonnes manquent pour
--           pouvoir (a) saisir un code postal distinct de la ville et (b)
--           capturer le montant du loyer quand le client est locataire.
--
--           La colonne `titre` (M/Mme) existe déjà (cf. add-kyc-fields.sql).
--           Aucun renommage ou split du champ `adresse` existant n'est fait
--           ici : on garde `adresse` pour la rue et on ajoute `code_postal`
--           à côté, pour éviter toute backfill destructive sur les 1800+
--           clients existants.
-- =====================================================
--
-- Changements :
-- 1. clients.code_postal TEXT nullable — code postal (5 chiffres FR par
--    défaut, format libre pour l'international).
-- 2. clients.montant_loyer NUMERIC(10,2) nullable — loyer mensuel TTC quand
--    proprietaire_locataire = 'locataire'. NULL si propriétaire ou non
--    renseigné. Permet le calcul du taux d'endettement (chantier CDC #3)
--    sans avoir à charger `emprunts` + charges à part.
--
-- RLS : les deux colonnes héritent des policies existantes sur clients.
-- Aucune policy ne référence ces colonnes, donc ADD COLUMN n'affecte rien.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS (x2).
-- =====================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS code_postal TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS montant_loyer NUMERIC(10, 2);

-- Smoke test :
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'clients'
--   AND column_name IN ('code_postal', 'montant_loyer');
