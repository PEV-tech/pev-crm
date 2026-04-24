-- Migration: Consultant fictif POOL + migration des clients sans consultant
-- Date: 2026-04-24
-- Référence: Corrections app Étape 3 point 3.2 (plan 2026-04-24)
-- Arbitrage Maxine : consultant fictif POOL en DB plutôt que flag boolean.
--
-- Objet :
--   1. Crée un consultant "POOL" avec un id fixe pour référencement stable.
--   2. Migre les clients `consultant_id IS NULL` vers ce consultant.
--   3. Migre les dossiers orphelins également (sinon la logique de
--      commission ne s'applique pas correctement).
--   4. Met à jour `v_dossiers_remunerations` pour masquer aussi le
--      prénom "POOL" côté non-managers (cohérent avec Maxine/Thélo).
--
-- Règle métier :
--   Répartition 70 % (réparti Maxine / Thélo / Pool+) + 30 % cabinet
--   est déjà encodée dans `src/lib/commissions/rules.ts` (COMMISSION_RULES[2],
--   dite « Client apporté par le Pool »). La route de sélection de règle
--   (determineRule) doit être étendue pour reconnaître un consultant au
--   nom "POOL" (update appliqué dans le même PR).
--
-- Idempotent : ON CONFLICT DO NOTHING sur le consultant, UPDATE WHERE
--   consultant_id IS NULL sur les clients/dossiers (safe si re-joué).
--
-- Reversible : cf bloc ROLLBACK en bas du fichier, commenté.

BEGIN;

-- 1. Créer le consultant POOL avec un UUID fixe pour reproductibilité.
--    id = '00000000-0000-0000-0000-00000000p00l' (ne matche pas v4 mais
--    reste un UUID valide côté PG). Si on préfère un v4 généré, laisser
--    gen_random_uuid() et retrouver l'id via `WHERE prenom = 'POOL'`.
INSERT INTO consultants (id, prenom, nom, email, role, taux_remuneration, zone, actif)
VALUES (
  '00000000-0000-0000-0000-0000000000pl'::uuid,
  'POOL',
  'POOL',
  'pool@private-equity-valley.com',
  'consultant',
  0, -- pas de part consultant, répartition via rule 3
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Fallback : si le consultant existait déjà avec un autre id mais prenom='POOL',
-- on le capture dans une CTE pour les UPDATE suivants.
WITH pool_consultant AS (
  SELECT id FROM consultants
  WHERE prenom = 'POOL' AND nom = 'POOL'
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
)
-- 2. Rattacher les clients orphelins (consultant_id IS NULL) au POOL.
--    Les clients explicitement créés avec un consultant_id ne sont pas
--    touchés — seulement ceux qui sont entrés sans attribution.
UPDATE clients
SET consultant_id = (SELECT id FROM pool_consultant)
WHERE consultant_id IS NULL
  AND EXISTS (SELECT 1 FROM pool_consultant);

-- 3. Idem sur les dossiers orphelins (si présents — rare, mais possible
--    sur les anciens imports). Ne modifie pas les dossiers dont le client
--    a déjà un consultant_id (cascade déjà gérée au niveau client).
WITH pool_consultant AS (
  SELECT id FROM consultants
  WHERE prenom = 'POOL' AND nom = 'POOL'
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
)
UPDATE dossiers
SET consultant_id = (SELECT id FROM pool_consultant)
WHERE consultant_id IS NULL
  AND EXISTS (SELECT 1 FROM pool_consultant);

COMMIT;

-- =====================================================
-- Recréer `v_dossiers_remunerations` avec le masking étendu pour POOL.
-- (v_dossiers_complets reste inchangée — elle sert au manager et au
--  back-office qui voient les vrais noms.)
-- =====================================================
-- NOTE : cette recréation duplique le contenu de
-- `recreate-v-dossiers-complets-full.sql` — garder les deux scripts
-- synchronisés en cas de future évolution de la vue.
DROP VIEW IF EXISTS v_dossiers_remunerations;

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
  -- Point 3.2 (2026-04-24) : ajout de 'POOL' (prenom du consultant
  -- fictif) dans la liste des prénoms masqués pour les non-managers.
  CASE
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs','POOL']::text[])) AND NOT is_manager()
    THEN 'Pool'::varchar
    ELSE consultant_nom
  END AS consultant_nom,
  CASE
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs','POOL']::text[])) AND NOT is_manager()
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
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs','POOL']::text[])) AND NOT is_manager()
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
-- Smoke tests (commentés — à exécuter manuellement après migration)
-- =====================================================
-- SELECT id, prenom, nom FROM consultants WHERE prenom = 'POOL';
-- Doit retourner 1 ligne.
--
-- SELECT COUNT(*) FROM clients WHERE consultant_id IS NULL;
-- Doit retourner 0 après migration.
--
-- SELECT COUNT(*) FROM clients
-- WHERE consultant_id = (SELECT id FROM consultants WHERE prenom = 'POOL' LIMIT 1);
-- Doit retourner au moins N (le nombre de clients initialement NULL).
--
-- SELECT DISTINCT consultant_prenom FROM v_dossiers_remunerations WHERE consultant_prenom = 'Pool';
-- Doit exister côté non-manager seulement.

-- =====================================================
-- ROLLBACK (à décommenter pour annuler la migration)
-- =====================================================
-- BEGIN;
-- -- Remettre NULL sur les clients POOL (perd l'info "était POOL" mais
-- -- c'est l'état d'avant migration).
-- UPDATE clients SET consultant_id = NULL
-- WHERE consultant_id = (SELECT id FROM consultants WHERE prenom = 'POOL' LIMIT 1);
-- UPDATE dossiers SET consultant_id = NULL
-- WHERE consultant_id = (SELECT id FROM consultants WHERE prenom = 'POOL' LIMIT 1);
-- DELETE FROM consultants WHERE prenom = 'POOL' AND nom = 'POOL';
-- -- Puis re-jouer recreate-v-dossiers-complets-full.sql pour restaurer
-- -- la vue originale (sans 'POOL' dans le masking).
-- COMMIT;
