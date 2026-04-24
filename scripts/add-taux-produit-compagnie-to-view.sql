-- =====================================================
-- ADD taux_produit_compagnie_id TO v_dossiers_complets
-- Date: 2026-04-24
--
-- Contexte : PR #25 (fix étape 2 part 2b) a ajouté la FK
-- `dossiers.taux_produit_compagnie_id` pour pointer sur la ligne
-- exacte de `taux_produit_compagnie` (ACTIVIMMO, ODYSSEY 2024, etc.)
-- qui porte le "vrai" nom commercial du produit dans sa colonne
-- `description`. Cette colonne n'a jamais été exposée par
-- `v_dossiers_complets`, donc le front fait un second fetch sur
-- `dossiers` pour la récupérer (workaround dans
-- dossier-detail-wrapper.tsx).
--
-- Ce script reprend la recréation consolidée de 2026-04-21
-- (recreate-v-dossiers-complets-full.sql) et y ajoute deux
-- colonnes :
--   · taux_produit_compagnie_id  (la FK)
--   · taux_produit_compagnie_description  (le vrai nom commercial,
--     évite un lookup côté client)
--
-- Idempotent : DROP VIEW IF EXISTS avant CREATE. À appliquer via
-- le SQL editor Supabase ; régénérer ensuite `src/types/database.ts`
-- pour que le front puisse supprimer le second fetch.
-- =====================================================

-- On doit DROP la vue dépendante d'abord
DROP VIEW IF EXISTS v_dossiers_remunerations;
DROP VIEW IF EXISTS v_dossiers_complets;

-- =====================================================
-- v_dossiers_complets (source de vérité dossier enrichi)
-- =====================================================
CREATE VIEW v_dossiers_complets AS
SELECT DISTINCT ON (d.id)
  -- Dossier
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
  d.co_titulaire_id,
  d.taux_produit_compagnie_id,
  -- Client principal
  cl.id AS client_id,
  cl.nom AS client_nom,
  cl.prenom AS client_prenom,
  cl.email AS client_email,
  cl.telephone AS client_telephone,
  cl.pays AS client_pays,
  cl.ville AS client_ville,
  cl.statut_kyc,
  cl.der,
  cl.pi,
  (cl.der AND cl.pi) AS preco,
  cl.lm,
  cl.rm,
  -- Co-titulaire (join facultatif)
  cot.nom AS co_titulaire_nom,
  cot.prenom AS co_titulaire_prenom,
  -- Consultant
  co.id AS consultant_id,
  co.nom AS consultant_nom,
  co.prenom AS consultant_prenom,
  co.zone AS consultant_zone,
  co.taux_remuneration,
  -- Produit / Compagnie
  p.nom AS produit_nom,
  p.categorie AS produit_categorie,
  cp.nom AS compagnie_nom,
  -- Taux produit x compagnie (description = vrai nom commercial)
  tpc.description AS taux_produit_compagnie_description,
  -- Commissions
  cm.taux_commission,
  cm.taux_gestion,
  cm.commission_brute,
  cm.rem_apporteur,
  cm.rem_apporteur_ext,
  cm.rem_support,
  cm.part_cabinet,
  cm.pct_cabinet,
  -- Facturation
  f.facturee,
  f.payee,
  f.date_facture
FROM dossiers d
LEFT JOIN clients cl ON cl.id = d.client_id
LEFT JOIN clients cot ON cot.id = d.co_titulaire_id
LEFT JOIN consultants co ON co.id = d.consultant_id
LEFT JOIN produits p ON p.id = d.produit_id
LEFT JOIN compagnies cp ON cp.id = d.compagnie_id
LEFT JOIN taux_produit_compagnie tpc ON tpc.id = d.taux_produit_compagnie_id
LEFT JOIN commissions cm ON cm.dossier_id = d.id
LEFT JOIN factures f ON f.dossier_id = d.id
ORDER BY d.id, cm.commission_brute DESC NULLS LAST, f.date_facture DESC NULLS LAST;

ALTER VIEW v_dossiers_complets SET (security_invoker = true);

-- =====================================================
-- v_dossiers_remunerations (Pool-masking pour les non-managers)
-- Forward les nouveaux champs taux_produit_compagnie_*.
-- =====================================================
CREATE VIEW v_dossiers_remunerations AS
SELECT
  id,
  client_id,
  statut,
  montant,
  financement,
  commentaire,
  date_operation,
  date_entree_en_relation,
  date_signature,
  mode_detention,
  apporteur_label,
  referent,
  has_apporteur_ext,
  apporteur_ext_nom,
  taux_apporteur_ext,
  apporteur_id,
  co_titulaire_id,
  co_titulaire_nom,
  co_titulaire_prenom,
  taux_produit_compagnie_id,
  taux_produit_compagnie_description,
  client_nom,
  client_prenom,
  client_pays,
  client_ville,
  client_email,
  client_telephone,
  statut_kyc,
  der,
  pi,
  preco,
  lm,
  rm,
  CASE
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs']::text[])) AND NOT is_manager()
    THEN 'Pool'::varchar
    ELSE consultant_nom
  END AS consultant_nom,
  CASE
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs']::text[])) AND NOT is_manager()
    THEN 'Pool'::varchar
    ELSE consultant_prenom
  END AS consultant_prenom,
  consultant_zone,
  taux_remuneration,
  produit_nom,
  produit_categorie,
  compagnie_nom,
  taux_commission,
  taux_gestion,
  commission_brute,
  CASE
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs']::text[])) AND NOT is_manager()
    THEN NULL::numeric
    ELSE rem_apporteur
  END AS rem_apporteur,
  rem_apporteur_ext,
  rem_support,
  part_cabinet,
  pct_cabinet,
  facturee,
  payee,
  date_facture
FROM v_dossiers_complets d;

ALTER VIEW v_dossiers_remunerations SET (security_invoker = true);

-- =====================================================
-- Smoke test
-- =====================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'v_dossiers_complets'
--   AND column_name IN ('taux_produit_compagnie_id', 'taux_produit_compagnie_description');
-- Doit retourner 2 lignes.
