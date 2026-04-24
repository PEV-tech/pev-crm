-- Migration: ajout colonne clients.charges_residence_principale
-- Date: 2026-04-24
-- Context: retour Maxine — le formulaire KYC portail collecte déjà le montant
--          de loyer quand le client est locataire, mais ne demande rien quand
--          il est propriétaire. Or la charge mensuelle de résidence principale
--          (remboursement crédit + charges de copropriété + taxe foncière
--          mensualisée) est une donnée clé pour l'analyse d'endettement et
--          le conseil patrimonial. On ajoute un champ miroir conditionnel
--          sur « Propriétaire », même logique que montant_loyer côté locataire.
--
-- À exécuter dans l'éditeur SQL Supabase.
-- Rollback: voir section ROLLBACK en bas.

BEGIN;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS charges_residence_principale numeric(14,2) NULL;

COMMENT ON COLUMN public.clients.charges_residence_principale IS
  'Charges mensuelles de résidence principale si propriétaire (crédit + charges copropriété + taxe foncière mensualisée, €). Champ miroir de montant_loyer côté locataire. NULL si locataire ou non renseigné.';

COMMIT;

-- =========================================================
-- ROLLBACK (ne pas exécuter en régime nominal)
-- =========================================================
-- BEGIN;
--   ALTER TABLE public.clients DROP COLUMN IF EXISTS charges_residence_principale;
-- COMMIT;
