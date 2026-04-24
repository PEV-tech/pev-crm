-- Diagnostic pré-migration Étape 5 — volume des dossiers touchés
-- Date: 2026-04-24
-- Référence: Corrections app Étape 5 (plan 2026-04-24)
--
-- Objectif :
--   Les cas cités par Maxine (Marion Freret, 2A312B54, 9816C1CF,
--   FE8AFA25, Paul Taurignan) sont des EXEMPLES. Ce script mesure le
--   volume réel de dossiers touchés par chaque symptôme, pour qu'on
--   sache avant de jouer les fixes si le problème est marginal ou
--   généralisé. Read-only, pas d'effet de bord.
--
-- Usage :
--   psql / Supabase SQL editor → exécuter bloc par bloc.
--   Comparer ensuite avec `verify-step5-fixes.sql` joué post-migration.
--
-- ==============================================================
-- 0. Référence totale
-- ==============================================================
SELECT 'Total dossiers en base'                AS metrique, COUNT(*)::INT AS volume FROM dossiers
UNION ALL
SELECT 'Total couples produit×compagnie actifs',    COUNT(*)::INT FROM taux_produit_compagnie WHERE COALESCE(actif, true) = true
UNION ALL
SELECT 'Total compagnies distinctes',               COUNT(DISTINCT compagnie_id)::INT FROM taux_produit_compagnie WHERE COALESCE(actif, true) = true;

-- ==============================================================
-- 1. Point 5.1 — Dossiers sans ligne `commissions` associée
-- ==============================================================
-- Symptôme : "détail commission absent" dans l'UI dossier détail.
-- Cause : aucun trigger AFTER INSERT sur dossiers, donc les dossiers
-- jamais édités côté commissions n'ont pas de ligne.
--
-- Volume attendu : potentiellement élevé (tous les dossiers créés
-- depuis le début sans édition manuelle des taux).
SELECT
  'Dossiers sans ligne commissions'                          AS metrique,
  COUNT(*)::INT                                              AS volume,
  ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM dossiers), 0), 1) AS pct_du_total
FROM   dossiers d
LEFT JOIN commissions c ON c.dossier_id = d.id
WHERE  c.dossier_id IS NULL;

-- Détail par statut pour comprendre l'étendue (prospects + en_cours
-- sont les plus préoccupants car ils bloquent la visibilité de la
-- rémunération à venir).
SELECT
  d.statut                                                   AS statut,
  COUNT(*) FILTER (WHERE c.dossier_id IS NULL)::INT           AS dossiers_sans_commissions,
  COUNT(*)::INT                                              AS total_par_statut
FROM   dossiers d
LEFT JOIN commissions c ON c.dossier_id = d.id
GROUP BY d.statut
ORDER BY d.statut;

-- Exemples concrets (ids courts) cités par Maxine
SELECT
  LEFT(d.id::TEXT, 8) AS short_id,
  d.statut,
  d.montant,
  c.dossier_id IS NULL AS commission_absente,
  c.taux_commission,
  c.commission_brute
FROM   dossiers d
LEFT JOIN commissions c ON c.dossier_id = d.id
WHERE  UPPER(LEFT(d.id::TEXT, 8)) IN ('2A312B54','9816C1CF','FE8AFA25');

-- ==============================================================
-- 2. Point 5.3 — Clients avec dossiers mais pipeline 0 € (en_cours)
-- ==============================================================
-- Symptôme : "pipeline à 0 alors qu'il y a des dossiers".
-- Cause probable : dossiers en statut 'prospect' uniquement → la
-- convention PEV réserve "pipeline" à client_en_cours. L'UI a été
-- clarifiée (point 5.3 code) pour afficher les prospects en sous-ligne.
-- On mesure ici combien de clients sont touchés.
SELECT
  'Clients avec dossiers prospect mais aucun en_cours'       AS metrique,
  COUNT(DISTINCT client_id)::INT                             AS volume
FROM   dossiers
WHERE  client_id IN (
  SELECT client_id FROM dossiers WHERE statut = 'prospect' AND client_id IS NOT NULL
)
AND    client_id NOT IN (
  SELECT client_id FROM dossiers WHERE statut = 'client_en_cours' AND client_id IS NOT NULL
)
AND    client_id IS NOT NULL;

-- Cas spécifique Marion Freret (si fiche client)
SELECT
  cl.id, cl.prenom, cl.nom,
  COUNT(d.id) FILTER (WHERE d.statut = 'prospect')        AS n_prospect,
  COUNT(d.id) FILTER (WHERE d.statut = 'client_en_cours') AS n_en_cours,
  COUNT(d.id) FILTER (WHERE d.statut = 'client_finalise') AS n_finalise
FROM   clients cl
LEFT JOIN dossiers d ON d.client_id = cl.id
WHERE  cl.prenom ILIKE 'marion' AND cl.nom ILIKE 'freret'
GROUP BY cl.id, cl.prenom, cl.nom;

-- ==============================================================
-- 3. Point 5.5 — Couples produit×compagnie sans frais_encours
-- ==============================================================
-- NOTE : cette requête fonctionne seulement APRÈS que la migration
-- `add-taux-entree-encours.sql` a ajouté les colonnes. Avant la
-- migration, elle retourne une erreur "column does not exist".
SELECT
  'Couples produit×compagnie PE/CAV/CAPI sans frais_encours' AS metrique,
  COUNT(*)::INT                                              AS volume
FROM   taux_produit_compagnie tpc
JOIN   produits p ON p.id = tpc.produit_id
WHERE  COALESCE(tpc.actif, true) = true
  AND  (
        p.categorie ILIKE 'PE' OR p.categorie ILIKE '%private equity%'
     OR p.categorie ILIKE '%CAV%' OR p.categorie ILIKE '%CAPI%'
  )
  AND  tpc.frais_encours IS NULL;

-- Détail par compagnie + catégorie
SELECT
  c.nom                                                      AS compagnie,
  p.categorie                                                AS categorie,
  p.nom                                                      AS produit,
  tpc.taux                                                   AS taux_historique,
  tpc.frais_entree,
  tpc.frais_encours
FROM   taux_produit_compagnie tpc
JOIN   compagnies c ON c.id = tpc.compagnie_id
JOIN   produits p   ON p.id = tpc.produit_id
WHERE  COALESCE(tpc.actif, true) = true
  AND  (
        p.categorie ILIKE 'PE' OR p.categorie ILIKE '%private equity%'
     OR p.categorie ILIKE '%CAV%' OR p.categorie ILIKE '%CAPI%'
  )
  AND  tpc.frais_encours IS NULL
ORDER BY c.nom, p.nom;

-- ==============================================================
-- 4. Point 5.6 — Dossiers sans taux paramétré ET sans default
--     applicable (SCPI/PE/CAV-CAPI). Ceux-là restaient à 0.
-- ==============================================================
SELECT
  'Dossiers potentiellement à 0 sans fallback grille'        AS metrique,
  COUNT(*)::INT                                              AS volume,
  ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM dossiers), 0), 1) AS pct_du_total
FROM   dossiers d
LEFT JOIN taux_produit_compagnie tpc
       ON tpc.produit_id   = d.produit_id
      AND tpc.compagnie_id = d.compagnie_id
      AND COALESCE(tpc.actif, true) = true
LEFT JOIN produits p ON p.id = d.produit_id
WHERE  tpc.id IS NULL
  AND  (
        p.categorie IS NULL
     OR NOT (
          p.categorie ILIKE 'SCPI'
       OR p.categorie ILIKE 'PE'
       OR p.categorie ILIKE '%private equity%'
       OR p.categorie ILIKE '%CAV%'
       OR p.categorie ILIKE '%CAPI%'
     )
  );

-- Même requête mais INCLUSIVE : combien bénéficieront des defaults 5.6 ?
SELECT
  'Dossiers sans taux précis MAIS catégorie défaut OK'       AS metrique,
  COUNT(*)::INT                                              AS volume
FROM   dossiers d
LEFT JOIN taux_produit_compagnie tpc
       ON tpc.produit_id   = d.produit_id
      AND tpc.compagnie_id = d.compagnie_id
      AND COALESCE(tpc.actif, true) = true
LEFT JOIN produits p ON p.id = d.produit_id
WHERE  tpc.id IS NULL
  AND  (
        p.categorie ILIKE 'SCPI'
     OR p.categorie ILIKE 'PE'
     OR p.categorie ILIKE '%private equity%'
     OR p.categorie ILIKE '%CAV%'
     OR p.categorie ILIKE '%CAPI%'
  );

-- ==============================================================
-- 5. Point 5.2 — pas un bug data, pas de volume à mesurer
--   (pagination UI, fix purement front)
-- ==============================================================
-- Rien à mesurer côté DB.

-- ==============================================================
-- Synthèse à imprimer manuellement après exécution :
--   · 5.1 : N dossiers sans commissions, M %
--   · 5.3 : X clients avec prospects mais 0 en_cours
--   · 5.5 : Y couples produit×compagnie sans frais_encours
--   · 5.6 : Z dossiers sans taux mais catégorie connue (qui bénéficieront
--           des defaults) + W dossiers sans taux NI catégorie connue
--           (ceux-là resteront à 0, à saisir manuellement côté UI)
-- ==============================================================
