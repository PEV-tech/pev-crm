-- =====================================================
-- Migration 2026-04-24 : référentiel sous_produits
-- Appliqué en prod via SQL editor Supabase le 2026-04-24
-- =====================================================
-- Contexte : l'ancien modèle `produits` mélange catégorie et produit
-- (ex: produit.nom = "SCPI" = produit.categorie). Les "vrais" sous-produits
-- (REASON, PRIMOVIE, ACTIVIMMO...) distribués par une compagnie ne sont
-- stockés nulle part. Cette migration introduit une table référentielle
-- `sous_produits` rattachée au couple (produit × compagnie) et ajoute un
-- FK nullable sur `dossiers.sous_produit_id` pour back-compat.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sous_produits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id   UUID NOT NULL REFERENCES public.produits(id) ON DELETE RESTRICT,
  compagnie_id UUID NOT NULL REFERENCES public.compagnies(id) ON DELETE RESTRICT,
  nom          TEXT NOT NULL,
  actif        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (produit_id, compagnie_id, nom)
);

CREATE INDEX IF NOT EXISTS idx_sous_produits_couple
  ON public.sous_produits (produit_id, compagnie_id);

-- FK nullable sur dossiers : les dossiers existants ne sont pas cassés.
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS sous_produit_id UUID REFERENCES public.sous_produits(id);

CREATE INDEX IF NOT EXISTS idx_dossiers_sous_produit
  ON public.dossiers (sous_produit_id);

-- RLS : lecture pour tout consultant authentifié, CRUD réservé manager/back_office
ALTER TABLE public.sous_produits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sous_produits_select ON public.sous_produits;
CREATE POLICY sous_produits_select ON public.sous_produits
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS sous_produits_insert ON public.sous_produits;
CREATE POLICY sous_produits_insert ON public.sous_produits
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.consultants WHERE id = auth.uid() AND role IN ('manager','back_office'))
  );

DROP POLICY IF EXISTS sous_produits_update ON public.sous_produits;
CREATE POLICY sous_produits_update ON public.sous_produits
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.consultants WHERE id = auth.uid() AND role IN ('manager','back_office'))
  );

DROP POLICY IF EXISTS sous_produits_delete ON public.sous_produits;
CREATE POLICY sous_produits_delete ON public.sous_produits
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.consultants WHERE id = auth.uid() AND role IN ('manager','back_office'))
  );
