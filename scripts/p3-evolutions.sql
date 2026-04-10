-- =====================================================
-- P3 EVOLUTIONS: Fix duplicate rows, Drive link, SG category,
--   compagnies cleanup, numero_compte → dossier, prospect default
-- Date: 2026-04-10
-- =====================================================

-- =====================================================
-- #1 — Fix duplicate rows in v_dossiers_complets
-- Root cause: LEFT JOIN on commissions/factures can produce
-- multiple rows per dossier. Use DISTINCT ON to deduplicate.
-- =====================================================
DROP VIEW IF EXISTS v_dossiers_remunerations;
DROP VIEW IF EXISTS v_dossiers_complets;

CREATE VIEW v_dossiers_complets AS
SELECT DISTINCT ON (d.id)
  d.id,
  d.statut,
  d.montant,
  d.financement,
  d.commentaire,
  d.date_operation,
  d.date_entree_en_relation,
  d.date_signature,
  d.mode_detention,
  d.apporteur_label,
  d.referent,
  d.has_apporteur_ext,
  d.apporteur_ext_nom,
  d.taux_apporteur_ext,
  cl.id AS client_id,
  cl.nom AS client_nom,
  cl.prenom AS client_prenom,
  cl.email AS client_email,
  cl.telephone AS client_telephone,
  cl.pays AS client_pays,
  cl.ville AS client_ville,
  cl.statut_kyc,
  cl.der, cl.pi, cl.preco, cl.lm, cl.rm,
  co.id AS consultant_id,
  co.nom AS consultant_nom,
  co.prenom AS consultant_prenom,
  co.zone AS consultant_zone,
  co.taux_remuneration,
  p.nom AS produit_nom,
  p.categorie AS produit_categorie,
  cp.nom AS compagnie_nom,
  cm.taux_commission,
  cm.taux_gestion,
  cm.commission_brute,
  cm.rem_apporteur,
  cm.rem_apporteur_ext,
  cm.rem_support,
  cm.part_cabinet,
  cm.pct_cabinet,
  f.facturee,
  f.payee,
  f.date_facture
FROM dossiers d
LEFT JOIN clients cl ON cl.id = d.client_id
LEFT JOIN consultants co ON co.id = d.consultant_id
LEFT JOIN produits p ON p.id = d.produit_id
LEFT JOIN compagnies cp ON cp.id = d.compagnie_id
LEFT JOIN commissions cm ON cm.dossier_id = d.id
LEFT JOIN factures f ON f.dossier_id = d.id
ORDER BY d.id, cm.commission_brute DESC NULLS LAST, f.date_facture DESC NULLS LAST;

ALTER VIEW v_dossiers_complets SET (security_invoker = true);

-- Recreate v_dossiers_remunerations
CREATE VIEW v_dossiers_remunerations AS
SELECT
  id, client_id, statut, montant, financement, commentaire,
  date_operation, date_entree_en_relation, date_signature, mode_detention,
  apporteur_label, referent,
  has_apporteur_ext, apporteur_ext_nom, taux_apporteur_ext,
  client_nom, client_prenom, client_pays, client_ville,
  client_email, client_telephone,
  statut_kyc, der, pi, preco, lm, rm,
  CASE
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs']::text[])) AND NOT is_manager()
    THEN 'Pool'::varchar ELSE consultant_nom
  END AS consultant_nom,
  CASE
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs']::text[])) AND NOT is_manager()
    THEN 'Pool'::varchar ELSE consultant_prenom
  END AS consultant_prenom,
  consultant_zone, taux_remuneration,
  produit_nom, produit_categorie, compagnie_nom,
  taux_commission, taux_gestion, commission_brute,
  CASE
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs']::text[])) AND NOT is_manager()
    THEN NULL::numeric ELSE rem_apporteur
  END AS rem_apporteur,
  rem_apporteur_ext, rem_support, part_cabinet, pct_cabinet,
  facturee, payee, date_facture
FROM v_dossiers_complets d;

ALTER VIEW v_dossiers_remunerations SET (security_invoker = true);

-- =====================================================
-- #2 — Add google_drive_url column to clients table
-- =====================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_drive_url TEXT;

-- =====================================================
-- #3 — Fix SG-EG and SG-TRILAKE product categories
-- They should be 'SG' not 'CAV'
-- =====================================================
UPDATE produits SET categorie = 'SG'
WHERE nom ILIKE '%SG%' AND categorie != 'SG';

-- =====================================================
-- #4 — Compagnies cleanup
-- C&P → cedrus, trail → trail capital, remove Evergreen & namara
-- =====================================================

-- First update dossiers referencing old compagnies to new ones
-- C&P → cedrus
UPDATE dossiers SET compagnie_id = (
  SELECT id FROM compagnies WHERE nom ILIKE '%cedrus%' LIMIT 1
) WHERE compagnie_id IN (
  SELECT id FROM compagnies WHERE nom ILIKE '%C&P%' OR nom ILIKE '%C & P%'
) AND EXISTS (SELECT 1 FROM compagnies WHERE nom ILIKE '%cedrus%');

-- trail → trail capital (rename)
UPDATE compagnies SET nom = 'TRAIL CAPITAL'
WHERE nom ILIKE '%trail%' AND nom NOT ILIKE '%trail capital%';

-- Insert cedrus if not exists, before deleting C&P
INSERT INTO compagnies (nom)
SELECT 'CEDRUS' WHERE NOT EXISTS (SELECT 1 FROM compagnies WHERE nom ILIKE '%cedrus%');

-- Delete old compagnies (only if no dossiers reference them)
DELETE FROM compagnies WHERE nom ILIKE '%C&P%' OR nom ILIKE '%C & P%'
  AND id NOT IN (SELECT DISTINCT compagnie_id FROM dossiers WHERE compagnie_id IS NOT NULL);
DELETE FROM compagnies WHERE nom ILIKE '%evergreen%'
  AND id NOT IN (SELECT DISTINCT compagnie_id FROM dossiers WHERE compagnie_id IS NOT NULL);
DELETE FROM compagnies WHERE nom ILIKE '%namara%'
  AND id NOT IN (SELECT DISTINCT compagnie_id FROM dossiers WHERE compagnie_id IS NOT NULL);

-- =====================================================
-- #5 — Deduplicate commissions (multiple entries per dossier)
-- Keep only the row with the highest commission_brute for each dossier
-- =====================================================
DELETE FROM commissions
WHERE id NOT IN (
  SELECT DISTINCT ON (dossier_id) id
  FROM commissions
  ORDER BY dossier_id, commission_brute DESC NULLS LAST
);

-- =====================================================
-- #6 — Deduplicate factures (multiple entries per dossier)
-- Keep only the most recent facture for each dossier
-- =====================================================
DELETE FROM factures
WHERE id NOT IN (
  SELECT DISTINCT ON (dossier_id) id
  FROM factures
  ORDER BY dossier_id, date_facture DESC NULLS LAST
);

-- =====================================================
-- #7 — Add unique constraint to prevent future duplicates
-- =====================================================
-- Only add if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commissions_dossier_id_unique'
  ) THEN
    ALTER TABLE commissions ADD CONSTRAINT commissions_dossier_id_unique UNIQUE (dossier_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'factures_dossier_id_unique'
  ) THEN
    ALTER TABLE factures ADD CONSTRAINT factures_dossier_id_unique UNIQUE (dossier_id);
  END IF;
END $$;
