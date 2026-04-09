-- =====================================================
-- P2 EVOLUTIONS: PRECO manual, CAPI LUX docs, Client relations
-- Date: 2026-04-09
-- =====================================================

-- =====================================================
-- #1 — PRECO is now a stored manual field on clients
-- (column already exists, just update the view to use it directly)
-- =====================================================
DROP VIEW IF EXISTS v_dossiers_remunerations;
DROP VIEW IF EXISTS v_dossiers_complets;

CREATE VIEW v_dossiers_complets AS
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
LEFT JOIN factures f ON f.dossier_id = d.id;

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
-- #2 — Document templates for CAPI LUX
-- =====================================================
INSERT INTO document_templates (produit_categorie, document_nom, obligatoire, sort_order)
VALUES
  ('CAPI LUX', 'Pièce d''identité (ID)', true, 1),
  ('CAPI LUX', 'BILAN', true, 2),
  ('CAPI LUX', 'RBE (Registre des Bénéficiaires Effectifs)', true, 3),
  ('CAPI LUX', 'RIB', true, 4),
  ('CAPI LUX', 'KBIS - 3 mois', true, 5),
  ('CAPI LUX', 'Justificatif origine des fonds', true, 6),
  ('CAPI LUX', 'Justificatif disponibilité des fonds', true, 7)
ON CONFLICT DO NOTHING;

-- =====================================================
-- #3 — Client relations table
-- =====================================================
CREATE TABLE IF NOT EXISTS client_relations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id_1 UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_id_2 UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type_relation TEXT NOT NULL CHECK (type_relation IN ('concubinage', 'marie', 'pacse', 'enfant', 'parent')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id_1, client_id_2)
);

ALTER TABLE client_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage relations"
  ON client_relations FOR ALL
  USING (auth.role() = 'authenticated');
