-- =========================================================================
-- fix-client-pj-kyc-signe-check.sql — 2026-04-21 (retour Maxine v2.3)
--
-- Contexte :
--   · Après signature KYC consultant (endpoint /api/kyc/apply-proposition),
--     le PDF est correctement stocké dans le bucket `kyc-documents` ET le
--     champ `clients.kyc_pdf_storage_path` est mis à jour.
--   · MAIS l'archivage complémentaire « pièce jointe CRM » (bucket
--     `client-pj` + row `client_pj` avec `type_document='kyc_signe'`)
--     échoue silencieusement — le helper `generateAndStoreKycPdf` logge un
--     warning et retourne `pjArchived: false` sans propager l'erreur.
--
-- Cause racine :
--   La contrainte CHECK `client_pj_type_document_check` (créée avec la
--   table client_pj hors repo, directement dans Supabase) autorise
--   seulement : piece_identite, rib, justificatif_domicile,
--   justificatif_origine_fonds, justificatif_disponibilite_fonds, nif,
--   contrat, bulletin_souscription, reglementaire, autre.
--
--   Lors du chantier #2 (edacca2 feat(kyc): email client + archivage PJ),
--   on a ajouté `kyc_signe` dans le dropdown frontend (PJ_TYPES dans
--   `src/components/clients/pieces-jointes.tsx`) et dans l'INSERT côté
--   helper, mais on a oublié d'étendre la contrainte côté DB. D'où :
--
--     ERROR 23514: new row violates check constraint
--                  "client_pj_type_document_check"
--
--   Ce CHECK est catché par le try/catch best-effort dans
--   `src/lib/kyc-pdf-storage.ts` — aucune 500, pas d'error message, juste
--   un warning serveur `[kyc-pdf-storage] client_pj insert failed: …`.
--
-- Fix :
--   DROP + CREATE la contrainte avec `kyc_signe` ajouté, au même endroit
--   que les autres valeurs KYC/réglementaires (après `reglementaire`).
--   Idempotent : DROP IF EXISTS + recréation.
--
-- À exécuter : Supabase Dashboard → SQL Editor → Run.
--
-- Vérif post-fix :
--   SELECT type_document, COUNT(*) FROM client_pj GROUP BY 1 ORDER BY 1;
--   -- puis retenter une signature KYC et vérifier qu'une ligne
--   -- type_document='kyc_signe' apparaît bien.
-- =========================================================================

ALTER TABLE public.client_pj
  DROP CONSTRAINT IF EXISTS client_pj_type_document_check;

ALTER TABLE public.client_pj
  ADD CONSTRAINT client_pj_type_document_check
  CHECK (type_document = ANY (ARRAY[
    'piece_identite'::text,
    'rib'::text,
    'justificatif_domicile'::text,
    'justificatif_origine_fonds'::text,
    'justificatif_disponibilite_fonds'::text,
    'nif'::text,
    'contrat'::text,
    'bulletin_souscription'::text,
    'reglementaire'::text,
    'kyc_signe'::text,
    'autre'::text
  ]));

-- Smoke test : la contrainte accepte désormais kyc_signe.
-- (On ne fait pas d'INSERT réel ici pour ne pas polluer la table — le
--  test se fait via le flow complet post-migration.)
