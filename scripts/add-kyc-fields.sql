-- Migration: Add KYC fields to clients table
-- Date: 2026-04-16
-- Description: Add comprehensive KYC (Know Your Customer) fields for wealth management compliance
-- All new columns are nullable to ensure no breaking changes

-- État civil fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS titre VARCHAR;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nom_jeune_fille VARCHAR;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_naissance DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lieu_naissance VARCHAR;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nationalite VARCHAR;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS residence_fiscale VARCHAR;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nif VARCHAR;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS adresse TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS proprietaire_locataire VARCHAR;

-- Situation familiale fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS situation_matrimoniale VARCHAR;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS regime_matrimonial VARCHAR;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nombre_enfants INTEGER;
-- 2026-04-25 : initialement TEXT (saisie libre type "11 ans, 15 ans"),
-- migré en JSONB array (sous-fiches structurées par enfant — voir
-- migrate-enfants-details-to-jsonb.sql). Sur une base fraîche, on crée
-- directement en JSONB.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS enfants_details JSONB;

-- Situation professionnelle fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS profession VARCHAR;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS statut_professionnel VARCHAR;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS employeur VARCHAR;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_debut_emploi VARCHAR;

-- Revenus fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS revenus_pro_net NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS revenus_fonciers NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS autres_revenus NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_revenus_annuel NUMERIC;

-- Patrimoine fields (JSONB arrays)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS patrimoine_immobilier JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS produits_financiers JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS patrimoine_divers JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS emprunts JSONB;

-- Fiscalité fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS impot_revenu_n NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS impot_revenu_n1 NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS impot_revenu_n2 NUMERIC;

-- Objectifs field
ALTER TABLE clients ADD COLUMN IF NOT EXISTS objectifs_client TEXT;

-- KYC metadata
ALTER TABLE clients ADD COLUMN IF NOT EXISTS kyc_date_signature DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS kyc_uploaded_at TIMESTAMPTZ;
