-- Backfill: reprise de `date_entree_en_relation` sur les dossiers
-- depuis la fiche client associée.
-- Date: 2026-04-24
-- Référence: Corrections app Étape 4 point 4.1 (plan 2026-04-24)
--
-- Contexte :
--   Le formulaire `/dossiers/nouveau` n'envoyait PAS le champ
--   `date_entree_en_relation` dans le payload dossier avant ce fix
--   (corrigé côté code dans le même commit). Conséquence : les dossiers
--   créés depuis cette route ont `date_entree_en_relation = NULL`
--   même quand la fiche client associée porte une date valide.
--
--   Ce script backfille les dossiers existants en recopiant la date
--   depuis `clients.date_entree_relation` (attention à la nomenclature :
--   le champ côté clients n'a pas le « en » — cf. add-client-standalone-fields.sql).
--
-- Idempotent : WHERE date_entree_en_relation IS NULL garantit que les
--   dossiers déjà renseignés ne sont pas écrasés.
--
-- Reversible : snapshot optionnel avant UPDATE (cf commentaire ci-dessous).

-- Optionnel : snapshot avant (décommenter pour audit)
-- CREATE TEMP TABLE dossiers_backup_4_1 AS
-- SELECT id, date_entree_en_relation FROM dossiers;

UPDATE dossiers d
SET date_entree_en_relation = c.date_entree_relation
FROM clients c
WHERE d.client_id = c.id
  AND d.date_entree_en_relation IS NULL
  AND c.date_entree_relation IS NOT NULL;

-- Smoke tests :
-- 1. Combien de dossiers ont été backfillés ?
--    (Exécuter AVANT le UPDATE pour avoir le count attendu)
-- SELECT COUNT(*) FROM dossiers d
-- JOIN clients c ON c.id = d.client_id
-- WHERE d.date_entree_en_relation IS NULL
--   AND c.date_entree_relation IS NOT NULL;
--
-- 2. Après UPDATE, vérifier que tout est cohérent :
-- SELECT COUNT(*) FILTER (WHERE d.date_entree_en_relation IS NULL) AS dossiers_sans_date,
--        COUNT(*) FILTER (WHERE c.date_entree_relation IS NULL) AS clients_sans_date
-- FROM dossiers d
-- LEFT JOIN clients c ON c.id = d.client_id;
