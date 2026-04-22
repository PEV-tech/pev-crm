-- Dissociation de la fiche jointe « DUMONT & PENARD ».
--
-- Contexte (diagnostic 2026-04-21 via diagnose-couple-clients.sql) :
--   UUID joint       : 45b3ecc6-fe6b-45a2-90f0-0bbcdb8683c0
--   Prénom / nom     : "Matthieu & Caroline" / "DUMONT & PENARD"
--   Créée            : 2026-03-28
--   Enfants FK       : 2 dossiers, 0 client_pj, 0 client_commentaires,
--                      0 rendez_vous, 0 relances, 0 kyc_propositions,
--                      0 client_relations.
--
-- Décision métier (Max, 2026-04-21) : Matthieu conserve les deux dossiers.
--
-- Stratégie :
--   1. Créer une nouvelle fiche solo « Matthieu DUMONT » en recopiant
--      le consultant_id de la fiche jointe (sinon violation RLS possible
--      après la réaffectation).
--   2. Réaffecter les 2 dossiers vers la nouvelle fiche Matthieu.
--   3. Supprimer la fiche jointe — safe, tous les autres enfants = 0.
--
-- Caroline Pénard : pas de fiche créée automatiquement. Elle n'a aucun
-- dossier en cours, donc autant attendre qu'un CGP la ressaisisse avec
-- les bons KYC. Créer une fiche vide « juste pour la trace » fausse les
-- stats clients et l'ajoute aux listes sans raison métier.
--
-- Sécurité : BEGIN + SELECT intermédiaire + COMMIT. Si la création de
-- Matthieu ou la réaffectation foirent, ROLLBACK.

BEGIN;

-- 1. Créer la fiche solo Matthieu
WITH src AS (
  SELECT consultant_id
  FROM   public.clients
  WHERE  id = '45b3ecc6-fe6b-45a2-90f0-0bbcdb8683c0'
),
inserted AS (
  INSERT INTO public.clients (prenom, nom, type_personne, consultant_id, created_at)
  SELECT 'Matthieu', 'DUMONT', 'physique', src.consultant_id, now()
  FROM   src
  RETURNING id
)
-- 2. Réaffecter les dossiers vers la nouvelle fiche
UPDATE public.dossiers d
   SET client_id = inserted.id
  FROM inserted
 WHERE d.client_id = '45b3ecc6-fe6b-45a2-90f0-0bbcdb8683c0';

-- 2b. Sanity check intermédiaire — à exécuter en SELECT avant COMMIT :
--   SELECT id, prenom, nom, client_id
--   FROM   public.dossiers
--   WHERE  client_id IN (
--     '45b3ecc6-fe6b-45a2-90f0-0bbcdb8683c0',
--     (SELECT id FROM public.clients WHERE prenom = 'Matthieu' AND nom = 'DUMONT' ORDER BY created_at DESC LIMIT 1)
--   );
--   → attendu : 0 dossier sur l'UUID joint, 2 sur la nouvelle fiche Matthieu.

-- 3. Supprimer la fiche jointe (safe, 0 autre enfant FK)
DELETE FROM public.clients
 WHERE id = '45b3ecc6-fe6b-45a2-90f0-0bbcdb8683c0';

COMMIT;

-- Smoke test final :
--   SELECT COUNT(*) FROM public.clients
--    WHERE id = '45b3ecc6-fe6b-45a2-90f0-0bbcdb8683c0';   -- 0
--   SELECT COUNT(*) FROM public.dossiers
--    WHERE client_id = '45b3ecc6-fe6b-45a2-90f0-0bbcdb8683c0';  -- 0
--   SELECT id, prenom, nom, created_at FROM public.clients
--    WHERE prenom = 'Matthieu' AND nom = 'DUMONT'
--    ORDER BY created_at DESC LIMIT 1;  -- la nouvelle fiche

-- Rappel front : si un CGP avait ouvert la fiche jointe en onglet,
-- un F5 donnera un 404. Prévenir Matthieu avant l'apply.
