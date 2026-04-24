-- =====================================================
-- Migration 2026-04-24 : FK dossier → taux_produit_compagnie
-- Appliqué en prod via SQL editor Supabase le 2026-04-24
-- =====================================================
-- Contexte : le "vrai produit" au sens métier (ACTIVIMMO, ODYSSEY 2024,
-- LIFE, PSSIV...) est stocké dans `taux_produit_compagnie.description`.
-- Plusieurs lignes peuvent exister pour un même couple (produit × compagnie)
-- — ex: ALDERAN offre ACTIVIMMO et COMETE, tous deux catégorie SCPI.
-- `dossier.produit_id` + `dossier.compagnie_id` ne suffisent donc pas
-- à identifier le produit spécifique choisi par le client.
--
-- Cette migration ajoute un FK `dossier.taux_produit_compagnie_id` vers
-- la ligne exacte du catalogue. Nullable pour back-compat avec l'existant.
-- =====================================================

ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS taux_produit_compagnie_id UUID
  REFERENCES public.taux_produit_compagnie(id);

CREATE INDEX IF NOT EXISTS idx_dossiers_taux_produit_compagnie
  ON public.dossiers (taux_produit_compagnie_id);
