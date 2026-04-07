-- Add taux_gestion column to commissions table
-- This allows consultants to customize the management fee rate per dossier

ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS taux_gestion DECIMAL(6,5);

-- Recreate the v_dossiers_complets view to include taux_gestion
CREATE OR REPLACE VIEW v_dossiers_complets AS
SELECT
  d.id,
  d.statut,
  d.montant,
  d.financement,
  d.commentaire,
  d.date_operation,
  d.apporteur_label,
  d.referent,
  cl.id AS client_id,
  cl.nom AS client_nom,
  cl.prenom AS client_prenom,
  cl.email AS client_email,
  cl.telephone AS client_telephone,
  cl.pays AS client_pays,
  cl.statut_kyc,
  cl.der, cl.pi, (cl.der AND cl.pi) AS preco, cl.lm, cl.rm,
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
LEFT JOIN factures f ON f.dossier_id = d.id;
