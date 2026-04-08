-- =====================================================
-- P1 EVOLUTIONS: #3 Ville, #4 Non abouti, #5 Dates, #6 Mode détention
-- Date: 2026-04-08
-- =====================================================

-- =====================================================
-- #3 — Ajout du champ Ville sur la table clients
-- =====================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ville TEXT;

-- =====================================================
-- #4 — Ajout du statut "non_abouti" à l'enum statut_dossier_type
-- =====================================================
ALTER TYPE statut_dossier_type ADD VALUE IF NOT EXISTS 'non_abouti';

-- =====================================================
-- #5 — Ajout des dates clés sur la table dossiers
-- =====================================================
-- date_entree_en_relation : date d'entrée en relation avec le client
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS date_entree_en_relation DATE;
-- date_signature : date de signature du contrat
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS date_signature DATE;
-- Note: date_operation existe déjà

-- =====================================================
-- #6 — Ajout du mode de détention (enum + colonne)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mode_detention_type') THEN
    CREATE TYPE mode_detention_type AS ENUM ('PP', 'NP', 'US');
  END IF;
END
$$;

ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS mode_detention mode_detention_type;

-- =====================================================
-- Mise à jour de la vue v_dossiers_complets
-- Ajout: ville, mode_detention, date_entree_en_relation, date_signature
-- Note: DROP requis car ajout de nouvelles colonnes change l'ordre
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
  cl.id AS client_id,
  cl.nom AS client_nom,
  cl.prenom AS client_prenom,
  cl.email AS client_email,
  cl.telephone AS client_telephone,
  cl.pays AS client_pays,
  cl.ville AS client_ville,
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

ALTER VIEW v_dossiers_complets SET (security_invoker = true);

-- =====================================================
-- Recréer la vue v_dossiers_remunerations (dépend de v_dossiers_complets)
-- Masque les noms des consultants pool pour les non-managers
-- =====================================================
CREATE VIEW v_dossiers_remunerations AS
SELECT
  id, client_id, statut, montant, financement, commentaire,
  date_operation, date_entree_en_relation, date_signature, mode_detention,
  apporteur_label, referent,
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
  rem_support, part_cabinet, pct_cabinet,
  facturee, payee, date_facture
FROM v_dossiers_complets d;

ALTER VIEW v_dossiers_remunerations SET (security_invoker = true);

-- =====================================================
-- Exclure les dossiers "non_abouti" de la vue pipeline
-- =====================================================
CREATE OR REPLACE VIEW v_pipeline_par_consultant AS
SELECT
  co.prenom || ' ' || co.nom AS consultant,
  p.nom AS produit,
  d.financement,
  SUM(d.montant) AS total_montant,
  COUNT(*) AS nb_dossiers
FROM dossiers d
LEFT JOIN consultants co ON co.id = d.consultant_id
LEFT JOIN produits p ON p.id = d.produit_id
WHERE d.statut IN ('prospect', 'client_en_cours')
GROUP BY co.prenom, co.nom, p.nom, d.financement;

-- =====================================================
-- Exclure les dossiers "non_abouti" de la vue collecte
-- =====================================================
CREATE OR REPLACE VIEW v_collecte_par_consultant AS
SELECT
  co.prenom || ' ' || co.nom AS consultant,
  p.nom AS produit,
  d.financement,
  SUM(d.montant) AS total_montant,
  COUNT(*) AS nb_dossiers,
  SUM(cm.commission_brute) AS total_commissions
FROM dossiers d
LEFT JOIN consultants co ON co.id = d.consultant_id
LEFT JOIN produits p ON p.id = d.produit_id
LEFT JOIN commissions cm ON cm.dossier_id = d.id
WHERE d.statut = 'client_finalise'
GROUP BY co.prenom, co.nom, p.nom, d.financement;
