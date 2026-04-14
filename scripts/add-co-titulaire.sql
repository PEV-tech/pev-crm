-- Add co_titulaire_id column to dossiers table
-- This allows joint operations (opérations conjointes) for couples (mariés, pacsés, concubins)

-- 1. Add the column
ALTER TABLE dossiers
ADD COLUMN IF NOT EXISTS co_titulaire_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- 2. Recreate the v_dossiers_complets view to include co-titulaire info
CREATE OR REPLACE VIEW v_dossiers_complets AS
SELECT
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
  d.apporteur_id,
  cl.id AS client_id,
  cl.nom AS client_nom,
  cl.prenom AS client_prenom,
  cl.email AS client_email,
  cl.telephone AS client_telephone,
  cl.pays AS client_pays,
  cl.ville AS client_ville,
  cl.statut_kyc,
  cl.der, cl.pi, (cl.der AND cl.pi) AS preco, cl.lm, cl.rm,
  d.co_titulaire_id,
  cot.nom AS co_titulaire_nom,
  cot.prenom AS co_titulaire_prenom,
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
LEFT JOIN clients cot ON cot.id = d.co_titulaire_id
LEFT JOIN consultants co ON co.id = d.consultant_id
LEFT JOIN produits p ON p.id = d.produit_id
LEFT JOIN compagnies cp ON cp.id = d.compagnie_id
LEFT JOIN commissions cm ON cm.dossier_id = d.id
LEFT JOIN factures f ON f.dossier_id = d.id;

-- 3. Add RLS policy for co_titulaire_id access (same as client_id)
-- The existing RLS policies on dossiers already handle row-level access
-- No additional policy needed since co_titulaire_id is just a reference column
