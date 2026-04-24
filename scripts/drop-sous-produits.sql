-- =====================================================
-- Dette 2026-04-24 : drop sous_produits dormante
-- Appliqué en prod via SQL editor Supabase le 2026-04-24
-- =====================================================
-- Contexte : la table `sous_produits` introduite en PR #22 s'est avérée
-- inutile après découverte que le "vrai" produit au sens métier est déjà
-- stocké dans `taux_produit_compagnie.description` (ACTIVIMMO, ODYSSEY,
-- LIFE, PSSIV...). La FK dossier a été remplacée par
-- `dossier.taux_produit_compagnie_id` (voir add-dossier-taux-produit-compagnie-fk.sql).
--
-- Ce script retire proprement la colonne et la table devenues obsolètes.
-- Aucune donnée applicative n'est perdue : aucune ligne n'avait été
-- saisie dans sous_produits (0 rows).
-- =====================================================

-- 1. Retirer la colonne FK dossier.sous_produit_id
ALTER TABLE public.dossiers DROP COLUMN IF EXISTS sous_produit_id;

-- 2. Dropper la table sous_produits (avec ses policies RLS)
DROP TABLE IF EXISTS public.sous_produits;
