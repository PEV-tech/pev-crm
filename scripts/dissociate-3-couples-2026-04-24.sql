-- Dissociation des 3 couples (plan de corrections 2026-04-24, point 3.3).
--
-- Arbitrage Maxine : 2 fiches indépendantes + lien co_titulaire.
--
-- Couples cibles :
--   (A) Dimitri Muringer / Magaelle Belise
--   (B) Nicolas Billeret / Blandine Billeret
--   (C) Elsa Mourad       / Benjamin Mourad
--
-- ⚠️ Avant de jouer ce script :
--   1. Exécuter `diagnose-3-couples-2026-04-24.sql` pour récupérer les
--      UUID de chaque fiche (jointe ou solo).
--   2. Pour chaque couple, déterminer le scénario :
--        (S1) Une seule fiche jointe existe  → créer 2 fiches solo.
--        (S2) Deux fiches solo existent      → juste lier via
--             co_titulaire_id et insérer une client_relations.
--        (S3) Mixte (1 fiche solo + mentions "& X" dans un nom) →
--             reprendre S1 avec réutilisation de la fiche solo comme
--             titulaire principal.
--   3. Compléter la section « PARAMÈTRES » en haut du bloc BEGIN ci-dessous.
--   4. Lancer le bloc dans un seul SQL editor (transaction). Jouer les
--      3 couples UN PAR UN (pas tous d'un coup) pour faciliter le
--      rollback si un couple pose problème.
--
-- ⚠️ Ce script est un TEMPLATE — les UUID '??-??-??' sont des
-- placeholders. Ne pas exécuter tel quel.

-- =====================================================
-- COUPLE A — Dimitri Muringer / Magaelle Belise (scénario S1 type)
-- =====================================================
BEGIN;

-- PARAMÈTRES (à renseigner après diagnostic) --------------------
-- Si scénario S1 : UUID de la fiche jointe. Si S2 : laisser NULL.
-- \set joint_id_a  '<UUID DE LA FICHE JOINTE>'
-- \set solo_id_dimitri  '<UUID FICHE DIMITRI SI DÉJÀ EXISTE (S2), sinon NULL>'
-- \set solo_id_magaelle '<UUID FICHE MAGAELLE SI DÉJÀ EXISTE (S2), sinon NULL>'
----------------------------------------------------------------

-- Étape 1 : récupérer le consultant_id de la fiche jointe (ou d'une
-- des fiches solo si S2) pour le réappliquer aux nouvelles fiches.
-- Étape 2 : créer la fiche Dimitri MURINGER (si pas déjà solo S2).
-- Étape 3 : créer la fiche Magaelle BELISE (si pas déjà solo S2).
-- Étape 4 : UPDATE dossiers : client_id = dimitri_id, co_titulaire_id = magaelle_id.
-- Étape 5 : INSERT client_relations (type='mariage' ou 'pacs' selon situation).
-- Étape 6 : DELETE fiche jointe (seulement si S1 et enfants FK=0 après
--            réaffectation). Sinon commit et ticketer les enfants
--            restants pour traitement manuel.

-- Exemple d'implémentation S1 — à adapter aux UUID réels :
/*
WITH src AS (
  SELECT id, consultant_id
  FROM   public.clients
  WHERE  id = '<UUID_JOINT_A>'::uuid
),
new_dimitri AS (
  INSERT INTO public.clients (prenom, nom, type_personne, consultant_id, created_at)
  SELECT 'Dimitri', 'MURINGER', 'physique', src.consultant_id, now()
  FROM   src
  RETURNING id
),
new_magaelle AS (
  INSERT INTO public.clients (prenom, nom, type_personne, consultant_id, created_at)
  SELECT 'Magaelle', 'BELISE', 'physique', src.consultant_id, now()
  FROM   src
  RETURNING id
),
reassign_dossiers AS (
  UPDATE public.dossiers d
     SET client_id       = (SELECT id FROM new_dimitri),
         co_titulaire_id = (SELECT id FROM new_magaelle)
   WHERE d.client_id = (SELECT id FROM src)
   RETURNING d.id
),
link_cotit AS (
  -- Lier aussi au niveau clients (co_titulaire_id mutuel).
  UPDATE public.clients
     SET co_titulaire_id = CASE id
       WHEN (SELECT id FROM new_dimitri)  THEN (SELECT id FROM new_magaelle)
       WHEN (SELECT id FROM new_magaelle) THEN (SELECT id FROM new_dimitri)
     END
   WHERE id IN ((SELECT id FROM new_dimitri), (SELECT id FROM new_magaelle))
   RETURNING id
)
INSERT INTO public.client_relations (client_id_1, client_id_2, type_relation)
SELECT (SELECT id FROM new_dimitri), (SELECT id FROM new_magaelle), 'mariage';

-- Sanity check avant DELETE : vérifier 0 dossier résiduel sur la fiche jointe.
-- SELECT count(*) FROM public.dossiers WHERE client_id = '<UUID_JOINT_A>'::uuid;
-- Si =0, OK. Sinon ROLLBACK et enquêter.

DELETE FROM public.clients WHERE id = '<UUID_JOINT_A>'::uuid;
*/

-- Si tout est OK :
-- COMMIT;
-- Sinon :
-- ROLLBACK;

-- =====================================================
-- COUPLE B — Nicolas Billeret / Blandine Billeret
-- =====================================================
-- Identique au template ci-dessus. Noms à injecter :
--   Nicolas BILLERET / Blandine BILLERET
-- Relation : 'mariage' (à confirmer — la situation matrimoniale de la
-- fiche jointe peut renseigner, sinon arbitrage Max).

-- =====================================================
-- COUPLE C — Elsa Mourad / Benjamin Mourad
-- =====================================================
-- Identique au template. Noms : Elsa MOURAD / Benjamin MOURAD.

-- =====================================================
-- Contrôles post-dissociation (à exécuter après les 3 COMMIT) :
-- =====================================================
-- 1) Aucune fiche "& " résiduelle parmi les noms cibles :
--    SELECT count(*) FROM public.clients
--    WHERE (prenom ILIKE '%&%' OR nom ILIKE '%&%')
--      AND (nom ILIKE '%Muringer%' OR nom ILIKE '%Belise%'
--           OR nom ILIKE '%Billeret%' OR nom ILIKE '%Mourad%');
--    Attendu : 0.
--
-- 2) Chaque personne a bien une fiche unique :
--    SELECT prenom, nom, count(*) FROM public.clients
--    WHERE (prenom, nom) IN (
--      ('Dimitri','MURINGER'), ('Magaelle','BELISE'),
--      ('Nicolas','BILLERET'), ('Blandine','BILLERET'),
--      ('Elsa','MOURAD'), ('Benjamin','MOURAD'))
--    GROUP BY prenom, nom;
--    Attendu : 1 ligne par personne, count=1.
--
-- 3) Lien co_titulaire bidirectionnel :
--    SELECT c.prenom, c.nom, cot.prenom AS cotit_prenom, cot.nom AS cotit_nom
--    FROM public.clients c
--    LEFT JOIN public.clients cot ON cot.id = c.co_titulaire_id
--    WHERE (c.prenom, c.nom) IN (
--      ('Dimitri','MURINGER'), ('Magaelle','BELISE'),
--      ('Nicolas','BILLERET'), ('Blandine','BILLERET'),
--      ('Elsa','MOURAD'), ('Benjamin','MOURAD'));
--    Attendu : chaque personne pointe vers son conjoint, et vice-versa.
--
-- 4) Dossiers réaffectés :
--    SELECT d.id, d.client_id, d.co_titulaire_id, c.prenom, c.nom
--    FROM public.dossiers d
--    JOIN public.clients c ON c.id = d.client_id
--    WHERE c.nom IN ('MURINGER','BELISE','BILLERET','MOURAD');
--    Attendu : chaque dossier a un client_id + co_titulaire_id cohérents.
--
-- 5) client_relations présente :
--    SELECT r.* FROM public.client_relations r
--    JOIN public.clients c1 ON c1.id = r.client_id_1
--    WHERE c1.nom IN ('MURINGER','BILLERET','MOURAD');
--    Attendu : 3 lignes, type='mariage' (ou 'pacs' selon arbitrage).

-- =====================================================
-- ROLLBACK d'urgence (à décommenter en cas de problème) :
-- =====================================================
-- Si les fiches jointes ont été supprimées, PAS de rollback simple.
-- Il faut :
--   - Récupérer les UUID via le backup Supabase point-in-time
--   - OU recréer manuellement la fiche jointe (prénom/nom + consultant_id)
--   - Puis UPDATE dossiers SET client_id = <uuid_joint_recréée>
-- C'est pour ça qu'on joue COUPLE par COUPLE avec COMMIT intermédiaire.
