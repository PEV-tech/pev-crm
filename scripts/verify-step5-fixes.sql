-- Vérification post-migration Étape 5 — retour à la normale à l'échelle
-- Date: 2026-04-24
-- Référence: Corrections app Étape 5 (plan 2026-04-24)
--
-- Usage :
--   À exécuter APRÈS avoir joué dans l'ordre :
--     1. add-taux-entree-encours.sql    (5.5 + 5.6 seed)
--     2. add-trigger-commissions-auto.sql (5.1 + backfill)
--
--   Le script relance les mêmes requêtes que `diagnose-step5-volume.sql`
--   et attend des volumes ≈ 0. Chaque bloc affiche un "check" avec le
--   résultat attendu pour que tu valides d'un coup d'œil.
--
--   Read-only.

-- ==============================================================
-- 1. Point 5.1 — Plus aucun dossier sans ligne commissions
-- ==============================================================
SELECT
  CASE WHEN COUNT(*) = 0 THEN 'OK ✓' ELSE 'REGRESSION ❌' END AS check_51,
  COUNT(*)::INT                                              AS dossiers_sans_commissions,
  'Attendu : 0'                                              AS attendu
FROM   dossiers d
LEFT JOIN commissions c ON c.dossier_id = d.id
WHERE  c.dossier_id IS NULL;

-- Les 3 cas cités doivent avoir taux + brute renseignés
SELECT
  LEFT(d.id::TEXT, 8) AS short_id,
  d.montant,
  c.taux_commission,
  c.commission_brute,
  CASE
    WHEN c.dossier_id IS NULL THEN 'REGRESSION ❌ commissions absent'
    WHEN c.taux_commission IS NULL AND c.commission_brute = 0 THEN 'ATTENTION ⚠ pas de taux calculable'
    ELSE 'OK ✓'
  END AS statut_check
FROM   dossiers d
LEFT JOIN commissions c ON c.dossier_id = d.id
WHERE  UPPER(LEFT(d.id::TEXT, 8)) IN ('2A312B54','9816C1CF','FE8AFA25');

-- Échantillon Marion Freret
SELECT
  LEFT(d.id::TEXT, 8) AS short_id,
  d.statut,
  d.montant,
  c.taux_commission,
  c.commission_brute
FROM   consultants co
JOIN   dossiers    d  ON d.consultant_id = co.id
LEFT JOIN commissions c ON c.dossier_id = d.id
WHERE  co.prenom ILIKE 'marion' AND co.nom ILIKE 'freret'
ORDER BY d.date_operation DESC NULLS LAST
LIMIT 10;

-- ==============================================================
-- 2. Point 5.3 — Clients avec prospects sans en_cours
-- ==============================================================
-- Pas de rollback attendu ici (c'est structurel côté UI, pas DB).
-- On vérifie juste que la fiche Marion Freret remonte bien ses prospects
-- si elle est ELLE-MÊME un client (cas signalé).
SELECT
  cl.id, cl.prenom, cl.nom,
  COUNT(d.id) FILTER (WHERE d.statut = 'prospect')        AS n_prospect,
  COUNT(d.id) FILTER (WHERE d.statut = 'client_en_cours') AS n_en_cours,
  COALESCE(SUM(d.montant) FILTER (WHERE d.statut = 'prospect'), 0)        AS pipeline_prospect,
  COALESCE(SUM(d.montant) FILTER (WHERE d.statut = 'client_en_cours'), 0) AS pipeline_en_cours
FROM   clients cl
LEFT JOIN dossiers d ON d.client_id = cl.id
WHERE  cl.prenom ILIKE 'marion' AND cl.nom ILIKE 'freret'
GROUP BY cl.id, cl.prenom, cl.nom;

-- ==============================================================
-- 3. Point 5.5 — frais_encours renseigné sur tous les couples PE/CAV/CAPI
-- ==============================================================
SELECT
  CASE WHEN COUNT(*) = 0 THEN 'OK ✓' ELSE 'REGRESSION ❌' END AS check_55,
  COUNT(*)::INT                                              AS couples_sans_encours,
  'Attendu : 0'                                              AS attendu
FROM   taux_produit_compagnie tpc
JOIN   produits p ON p.id = tpc.produit_id
WHERE  COALESCE(tpc.actif, true) = true
  AND  (
        p.categorie ILIKE 'PE' OR p.categorie ILIKE '%private equity%'
     OR p.categorie ILIKE '%CAV%' OR p.categorie ILIKE '%CAPI%'
  )
  AND  tpc.frais_encours IS NULL;

-- Vérif cas Cedrus : 1 % (override) et pas 0,7 % (default PE)
SELECT
  c.nom AS compagnie,
  p.nom AS produit,
  p.categorie,
  tpc.frais_entree,
  tpc.frais_encours,
  CASE
    WHEN c.nom ILIKE '%cedrus%' AND tpc.frais_encours = 0.01 THEN 'OK ✓ Cedrus 1%'
    WHEN c.nom ILIKE '%cedrus%' AND tpc.frais_encours <> 0.01 THEN 'REGRESSION ❌ Cedrus doit être à 1%'
    ELSE 'n/a'
  END AS check_cedrus
FROM   taux_produit_compagnie tpc
JOIN   compagnies c ON c.id = tpc.compagnie_id
JOIN   produits   p ON p.id = tpc.produit_id
WHERE  c.nom ILIKE '%cedrus%';

-- ==============================================================
-- 4. Point 5.6 — Dossiers avec catégorie SCPI/PE/CAV-CAPI ont bien
--    un taux_commission > 0 (soit custom, soit via default grille).
-- ==============================================================
-- Après le backfill 5.1, tous les dossiers ont une ligne commissions.
-- Les dossiers dont la catégorie matche un default doivent avoir
-- taux_commission > 0 (sauf cas montant=0 ou absence totale de config).
SELECT
  'Dossiers avec catégorie SCPI/PE/CAV-CAPI et taux_commission NULL ou 0' AS metrique,
  COUNT(*)::INT                                                           AS volume,
  CASE WHEN COUNT(*) = 0 THEN 'OK ✓' ELSE 'ATTENTION ⚠ à investiguer' END AS check_56
FROM   dossiers d
LEFT JOIN commissions c ON c.dossier_id = d.id
LEFT JOIN produits p ON p.id = d.produit_id
WHERE  (
        p.categorie ILIKE 'SCPI'
     OR p.categorie ILIKE 'PE'
     OR p.categorie ILIKE '%private equity%'
     OR p.categorie ILIKE '%CAV%'
     OR p.categorie ILIKE '%CAPI%'
  )
  AND  (c.taux_commission IS NULL OR c.taux_commission = 0)
  AND  COALESCE(d.montant, 0) > 0;

-- ==============================================================
-- 5. Synthèse finale — vue d'oiseau pour Maxine
-- ==============================================================
SELECT
  'Dossiers total'                                           AS metrique,
  COUNT(*)::INT                                              AS valeur
FROM   dossiers
UNION ALL
SELECT 'Avec ligne commissions',
       (SELECT COUNT(*)::INT FROM dossiers d JOIN commissions c ON c.dossier_id = d.id)
UNION ALL
SELECT 'Sans ligne commissions (doit être 0)',
       (SELECT COUNT(*)::INT FROM dossiers d LEFT JOIN commissions c ON c.dossier_id = d.id WHERE c.dossier_id IS NULL)
UNION ALL
SELECT 'Avec taux_commission > 0',
       (SELECT COUNT(*)::INT FROM dossiers d JOIN commissions c ON c.dossier_id = d.id WHERE c.taux_commission > 0)
UNION ALL
SELECT 'Avec commission_brute > 0',
       (SELECT COUNT(*)::INT FROM dossiers d JOIN commissions c ON c.dossier_id = d.id WHERE c.commission_brute > 0);
