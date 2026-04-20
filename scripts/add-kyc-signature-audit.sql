-- =====================================================
-- FEATURE : KYC signature audit trail (traçabilité obligatoire)
-- Date : 2026-04-20
-- Context : Conformité ACPR / DDA. Lorsqu'un client signe son KYC avec des
--           informations incomplètes, on doit prouver :
--           (1) que le client a été informé,
--           (2) qu'il a choisi de signer malgré tout,
--           (3) que le conseiller a recommandé de compléter.
--
-- Approche : on stocke l'audit de la signature directement sur la fiche client.
-- La colonne `kyc_date_signature` existe déjà (date simple) — on la conserve
-- pour la compat et on ajoute les colonnes d'audit autour.
-- =====================================================
--
-- Nouvelles colonnes sur clients :
--   - kyc_signer_name : nom tel que saisi par le signataire (peut différer
--     de clients.nom — ex: signature par le représentant légal d'une PM)
--   - kyc_signed_at : timestamptz de la signature (plus précis que la date)
--   - kyc_signer_ip : adresse IP capturée au moment de la signature
--   - kyc_completion_rate : pourcentage de complétude (0–100) au moment de
--     la signature, calculé côté applicatif
--   - kyc_missing_fields : jsonb des champs manquants au moment de la
--     signature — array de clés (ex: ["date_naissance", "profession", ...])
--   - kyc_incomplete_signed : boolean dérivé — true si le client a signé
--     avec complétude < 100%. Permet les index/filtres rapides pour les
--     alertes consultant.
--   - kyc_consent_incomplete : boolean — case "Je confirme vouloir signer
--     un KYC incomplet" cochée explicitement par le signataire.
--   - kyc_consent_accuracy : boolean — case "Je certifie que les
--     informations fournies sont exactes" cochée explicitement.
--
-- Les deux booléens de consentement sont redondants avec
-- `kyc_incomplete_signed` (puisque la signature incomplète est impossible
-- sans ces cases) mais on les stocke séparément pour avoir un enregistrement
-- littéral du consentement en cas de contrôle / litige.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- =====================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_signer_name TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_signed_at TIMESTAMPTZ;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_signer_ip TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_completion_rate SMALLINT
    CHECK (kyc_completion_rate IS NULL OR (kyc_completion_rate >= 0 AND kyc_completion_rate <= 100));

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_missing_fields JSONB;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_incomplete_signed BOOLEAN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_consent_incomplete BOOLEAN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_consent_accuracy BOOLEAN;

-- Index partiel pour les requêtes "KYC incomplets signés ces 30 jours" côté
-- dashboard consultant. Un index partiel reste très léger : seules les lignes
-- `kyc_incomplete_signed = true` sont indexées (cas minoritaire attendu).
CREATE INDEX IF NOT EXISTS idx_clients_kyc_incomplete_signed
  ON clients(kyc_signed_at DESC)
  WHERE kyc_incomplete_signed = true;

-- Smoke test :
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'clients'
--   AND column_name IN ('kyc_signer_name', 'kyc_signed_at', 'kyc_signer_ip',
--                       'kyc_completion_rate', 'kyc_missing_fields',
--                       'kyc_incomplete_signed', 'kyc_consent_incomplete',
--                       'kyc_consent_accuracy')
-- ORDER BY column_name;
