-- Diagnostic des fiches jointes « & » avant dissociation.
-- Read-only. Cible : Matthieu Dumont & Caroline Pénard en premier lieu,
-- mais généralisé à toute fiche dont le nom ou prénom contient '&'.

-- 1) Repérer les fiches candidates
SELECT id, prenom, nom, email, created_at, consultant_id,
       co_titulaire_id, representant_legal_id, type_personne,
       kyc_signed_at IS NOT NULL AS kyc_signe
FROM   public.clients
WHERE  prenom ILIKE '%&%' OR nom ILIKE '%&%'
ORDER  BY created_at;

-- 2) Pour chaque fiche candidate, inventaire des enfants FK
-- Remplacer <CLIENT_ID> par l'UUID retourné au (1).

/*
WITH target AS (SELECT '<CLIENT_ID>'::uuid AS id)
SELECT 'dossiers'            AS child, count(*) FROM public.dossiers            d WHERE d.client_id = (SELECT id FROM target)
UNION ALL
SELECT 'client_pj'           ,         count(*) FROM public.client_pj           p WHERE p.client_id = (SELECT id FROM target)
UNION ALL
SELECT 'client_commentaires' ,         count(*) FROM public.client_commentaires c WHERE c.client_id = (SELECT id FROM target)
UNION ALL
SELECT 'rendez_vous'         ,         count(*) FROM public.rendez_vous         r WHERE r.client_id = (SELECT id FROM target)
UNION ALL
SELECT 'kyc_propositions'    ,         count(*) FROM public.kyc_propositions    k WHERE k.client_id = (SELECT id FROM target)
UNION ALL
SELECT 'client_relations_1'  ,         count(*) FROM public.client_relations    r WHERE r.client_id_1 = (SELECT id FROM target)
UNION ALL
SELECT 'client_relations_2'  ,         count(*) FROM public.client_relations    r WHERE r.client_id_2 = (SELECT id FROM target)
UNION ALL
SELECT 'co_titulaire_ref'    ,         count(*) FROM public.clients             c WHERE c.co_titulaire_id = (SELECT id FROM target);
*/

-- 3) Plan de dissociation Dumont & Pénard (à adapter après diagnostic)
--
-- Option A (fiche joint vide d'activité) :
--   - Créer deux nouvelles fiches autonomes "Matthieu Dumont" + "Caroline Pénard"
--   - Lier via client_relations (type 'mariage' ou 'couple')
--   - DELETE de la fiche jointe (sera cascade sur PJ/commentaires/RDV une fois
--     fix-client-fk-cascades.sql appliqué)
--
-- Option B (fiche jointe avec dossiers attachés) :
--   - Créer deux nouvelles fiches autonomes
--   - Pour chaque dossier : UPDATE dossiers SET client_id = <fiche_principale_id>
--     et éventuellement co_titulaire_id = <fiche_conjoint_id>
--   - Puis DELETE de la fiche jointe
--
-- Ne pas exécuter en batch : dissocier manuellement par UUID, un couple à la fois.
