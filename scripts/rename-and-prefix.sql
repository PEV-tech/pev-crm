-- =====================================================
-- PEV CRM — Cahier des charges: all DB changes
-- À exécuter dans Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. Renommages produits & compagnies
-- =====================================================

-- Renommer les produits
UPDATE produits SET nom = 'Trilake' WHERE nom = 'Namara';

-- Renommer les compagnies
UPDATE compagnies SET nom = 'CEDRUS' WHERE nom = 'C&P';

-- Ajouter les préfixes de catégorie aux compagnies
-- SCPI
UPDATE compagnies SET nom = 'SCPI-' || nom WHERE nom IN ('Alderan', 'MNK', 'Corum', 'Arkea') AND nom NOT LIKE 'SCPI-%';

-- PE
UPDATE compagnies SET nom = 'PE-' || nom WHERE nom IN ('CEDRUS', 'Evergreen', 'Private Corner', 'Entrepreneur Invest', 'Swisslife', 'Opale', 'Altaroc', 'Trail', 'Archinvest') AND nom NOT LIKE 'PE-%';

-- Girardin
UPDATE compagnies SET nom = 'Girardin-' || nom WHERE nom IN ('Girardin') AND nom NOT LIKE 'Girardin-%';

-- LUX (assureurs luxembourgeois)
UPDATE compagnies SET nom = 'LUX-' || nom WHERE nom IN ('Vitis', 'Utmost', 'OneLife') AND nom NOT LIKE 'LUX-%';

-- =====================================================
-- 2. Ajouter client_email & client_telephone à la vue v_dossiers_complets
-- =====================================================

CREATE OR REPLACE VIEW v_dossiers_complets AS
SELECT
  d.id,
  d.client_id,
  d.consultant_id,
  d.produit_id,
  d.compagnie_id,
  d.montant,
  d.financement,
  d.statut,
  d.date_operation,
  d.commentaire,
  d.apporteur_id,
  d.apporteur_label,
  d.created_at,
  d.updated_at,
  cl.nom AS client_nom,
  cl.prenom AS client_prenom,
  cl.pays AS client_pays,
  cl.email AS client_email,
  cl.telephone AS client_telephone,
  cl.statut_kyc,
  cl.der,
  cl.pi,
  cl.lm,
  cl.rm,
  co.nom AS consultant_nom,
  co.prenom AS consultant_prenom,
  co.zone AS consultant_zone,
  co.role AS consultant_role,
  co.taux_remuneration AS consultant_taux,
  co.is_pool_member AS consultant_is_pool,
  p.nom AS produit_nom,
  p.categorie AS produit_categorie,
  cmp.nom AS compagnie_nom,
  cmp.taux_defaut AS compagnie_taux_defaut,
  cm.taux_commission,
  cm.commission_brute,
  cm.rem_apporteur,
  cm.rem_apporteur_ext,
  cm.rem_support,
  cm.part_cabinet,
  cm.pct_cabinet,
  cm.referent,
  f.id AS facture_id,
  f.facturee,
  f.payee,
  f.date_facture,
  f.date_paiement,
  -- Compliance preco (derived from DER + PI)
  CASE WHEN cl.der = true AND cl.pi = true THEN true ELSE false END AS preco
FROM dossiers d
LEFT JOIN clients cl ON d.client_id = cl.id
LEFT JOIN consultants co ON d.consultant_id = co.id
LEFT JOIN produits p ON d.produit_id = p.id
LEFT JOIN compagnies cmp ON d.compagnie_id = cmp.id
LEFT JOIN commissions cm ON cm.dossier_id = d.id
LEFT JOIN factures f ON f.dossier_id = d.id;

-- Grant access
GRANT SELECT ON v_dossiers_complets TO authenticated;
GRANT SELECT ON v_dossiers_complets TO anon;

-- =====================================================
-- 3. Verify results
-- =====================================================

SELECT id, nom FROM compagnies ORDER BY nom;
SELECT id, nom FROM produits ORDER BY nom;
SELECT column_name FROM information_schema.columns WHERE table_name = 'v_dossiers_complets' AND column_name IN ('client_email', 'client_telephone');
