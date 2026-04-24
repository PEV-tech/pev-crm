-- Diagnostic préalable à la dissociation des 3 couples listés dans le
-- plan de corrections 2026-04-24 (Étape 3 point 3.3).
--
-- Cibles :
--   - Dimitri Muringer / Magaelle Belise
--   - Nicolas Billeret / Blandine Billeret
--   - Elsa Mourad / Benjamin Mourad
--
-- Read-only. À jouer en Supabase SQL editor AVANT le script de
-- dissociation. Les UUID retournés serviront à compléter
-- `dissociate-3-couples-2026-04-24.sql`.

-- ---------------------------------------------------------------
-- 1) Fiches existantes contenant l'un des 6 prénoms/noms.
--    Repère à la fois les fiches jointes ("Dimitri & Magaelle ...")
--    et les éventuelles fiches solo déjà saisies.
-- ---------------------------------------------------------------
SELECT id, prenom, nom, email, created_at, consultant_id,
       co_titulaire_id, representant_legal_id, type_personne,
       kyc_signed_at IS NOT NULL AS kyc_signe
FROM   public.clients
WHERE  prenom ILIKE '%Dimitri%'   OR nom ILIKE '%Muringer%'
   OR  prenom ILIKE '%Magaelle%'  OR nom ILIKE '%Belise%'
   OR  prenom ILIKE '%Nicolas%'   OR nom ILIKE '%Billeret%'
   OR  prenom ILIKE '%Blandine%'  -- Billeret déjà capturé ci-dessus
   OR  prenom ILIKE '%Elsa%'      OR nom ILIKE '%Mourad%'
   OR  prenom ILIKE '%Benjamin%'  -- Mourad déjà capturé ci-dessus
ORDER  BY created_at;

-- ---------------------------------------------------------------
-- 2) Repérer spécifiquement les fiches JOINTES (présence d'un '&')
--    parmi les cibles.
-- ---------------------------------------------------------------
SELECT id, prenom, nom, created_at
FROM   public.clients
WHERE  (prenom ILIKE '%&%' OR nom ILIKE '%&%')
  AND  (
        nom ILIKE '%Muringer%' OR nom ILIKE '%Belise%'
     OR nom ILIKE '%Billeret%'
     OR nom ILIKE '%Mourad%'
  )
ORDER  BY nom, prenom;

-- ---------------------------------------------------------------
-- 3) Inventaire FK pour une fiche donnée. À copier-coller pour
--    chaque UUID de fiche jointe trouvée au (1) ou (2).
-- ---------------------------------------------------------------

-- Remplacer <CLIENT_ID> par l'UUID puis lancer ce bloc.
/*
WITH target AS (SELECT '<CLIENT_ID>'::uuid AS id)
SELECT 'dossiers'                    AS child, count(*) FROM public.dossiers                    d WHERE d.client_id          = (SELECT id FROM target)
UNION ALL
SELECT 'dossiers_cotit'              ,          count(*) FROM public.dossiers                    d WHERE d.co_titulaire_id     = (SELECT id FROM target)
UNION ALL
SELECT 'client_pj'                   ,          count(*) FROM public.client_pj                   p WHERE p.client_id          = (SELECT id FROM target)
UNION ALL
SELECT 'client_commentaires'         ,          count(*) FROM public.client_commentaires         c WHERE c.client_id          = (SELECT id FROM target)
UNION ALL
SELECT 'rendez_vous'                 ,          count(*) FROM public.rendez_vous                 r WHERE r.client_id          = (SELECT id FROM target)
UNION ALL
SELECT 'relances'                    ,          count(*) FROM public.relances                    r WHERE r.client_id          = (SELECT id FROM target)
UNION ALL
SELECT 'kyc_propositions'            ,          count(*) FROM public.kyc_propositions            k WHERE k.client_id          = (SELECT id FROM target)
UNION ALL
SELECT 'client_relations (as 1)'     ,          count(*) FROM public.client_relations            r WHERE r.client_id_1        = (SELECT id FROM target)
UNION ALL
SELECT 'client_relations (as 2)'     ,          count(*) FROM public.client_relations            r WHERE r.client_id_2        = (SELECT id FROM target)
UNION ALL
SELECT 'co_titulaire_refs (autres)'  ,          count(*) FROM public.clients                     c WHERE c.co_titulaire_id    = (SELECT id FROM target)
UNION ALL
SELECT 'representant_legal_refs'     ,          count(*) FROM public.clients                     c WHERE c.representant_legal_id = (SELECT id FROM target);
*/

-- ---------------------------------------------------------------
-- 4) Cas "couple avec 2 fiches séparées déjà créées mais non liées"
--    (scénario alternatif à la fiche jointe). Retourne les paires
--    candidates avec leur co_titulaire_id actuel.
-- ---------------------------------------------------------------
SELECT a.id AS id_a, a.prenom AS prenom_a, a.nom AS nom_a, a.co_titulaire_id AS cotit_a,
       b.id AS id_b, b.prenom AS prenom_b, b.nom AS nom_b, b.co_titulaire_id AS cotit_b
FROM   public.clients a
JOIN   public.clients b
       ON  b.nom = a.nom
       AND b.id  <> a.id
WHERE  a.nom IN ('MURINGER','BELISE','BILLERET','MOURAD')
   OR  a.nom ILIKE ANY (ARRAY['%Muringer%','%Belise%','%Billeret%','%Mourad%'])
ORDER  BY a.nom, a.prenom;
