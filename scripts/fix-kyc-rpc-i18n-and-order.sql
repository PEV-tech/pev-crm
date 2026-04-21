-- =====================================================================
-- Migration : durcissement RPC KYC (i18n FR, ordre de validation,
--             fuite timestamp, propagation statut_kyc)
-- Date        : 2026-04-21
-- Auteur      : Maxine — suite aux tests E2E du 2026-04-21 (TEST TEST)
-- Description :
--   Cette migration corrige quatre anomalies identifiées dans les tests
--   post-E2E du workflow KYC :
--
--   1) Messages d'erreur mixés FR / EN : la route Next.js parle français
--      ("Nom du signataire requis", "Non authentifié") alors que les
--      EXCEPTIONs des RPCs Postgres sont en anglais. Un client voit donc
--      potentiellement "Signer name required" sur un écran autrement FR.
--      → Tous les RAISE EXCEPTION passent en français.
--
--   2) Ordre des validations dans `kyc_sign_by_token` : signer_name et
--      consents étaient validés AVANT la lookup du token. Conséquence :
--      un appelant pouvait distinguer "token existant mais signer trop
--      court" d'un "token inexistant" → léger canal latéral d'énumération.
--      → On fait la lookup du token d'abord (shape puis DB), puis on
--        vérifie "déjà signé", puis seulement les champs de formulaire.
--
--   3) Fuite d'info mineure : le message "KYC already signed on <ts>"
--      expose un timestamp DB à la microseconde via un endpoint public.
--      → Message neutre : "Ce dossier a déjà été signé."
--
--   4) Le signing public mettait à jour `kyc_signed_at` mais ne flippait
--      pas `statut_kyc`. Conséquence : sur la fiche consultant la jauge
--      "Conformité" (0/6) restait à 0 après signature KYC complète car
--      elle check `statut_kyc === 'oui'`.
--      → Si la signature est complète (completion_rate >= 100) on force
--        statut_kyc = 'oui'. Sinon on met 'en_cours' (ni 'non' ni 'oui').
--
-- Idempotent  : OUI (CREATE OR REPLACE). Aucune donnée existante
--               n'est modifiée, seule la logique future change.
-- Prérequis   : add-kyc-link-flow.sql + fix-kyc-generate-token-pgcrypto.sql.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. kyc_generate_token — messages FR + gen_random_bytes schema-qualifié
--    (fix pgcrypto search_path conservé depuis 2ca7ba5).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kyc_generate_token(p_client_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  PERFORM 1 FROM clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client introuvable';
  END IF;

  new_token := encode(extensions.gen_random_bytes(16), 'hex');

  UPDATE clients
     SET kyc_token            = new_token,
         kyc_token_created_at = NOW()
   WHERE id = p_client_id;

  RETURN new_token;
END;
$$;

REVOKE ALL ON FUNCTION public.kyc_generate_token(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.kyc_generate_token(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. kyc_sign_by_token — FR, ordre corrigé, message "déjà signé" neutre,
--    propagation de statut_kyc.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kyc_sign_by_token(
  p_token              TEXT,
  p_signer_name        TEXT,
  p_completion_rate    SMALLINT,
  p_missing_fields     JSONB,
  p_consent_incomplete BOOLEAN,
  p_consent_accuracy   BOOLEAN,
  p_signer_ip          TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id        UUID;
  already_signed   TIMESTAMPTZ;
  new_statut_kyc   TEXT;
BEGIN
  -- --- Étape 1 : lookup du token AVANT toute validation de formulaire.
  --     Même message pour "mal formé" et "introuvable" → pas de canal
  --     latéral exploitable pour distinguer les deux cas.
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'Lien invalide ou expiré';
  END IF;

  SELECT id, kyc_signed_at INTO target_id, already_signed
  FROM   clients
  WHERE  kyc_token = p_token
  LIMIT  1;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'Lien invalide ou expiré';
  END IF;

  -- --- Étape 2 : état du dossier. Message neutre, sans timestamp.
  IF already_signed IS NOT NULL THEN
    RAISE EXCEPTION 'Ce dossier a déjà été signé.';
  END IF;

  -- --- Étape 3 : validations de formulaire (en dernier, après qu'on a
  --     établi que le token est valide et la ressource signable).
  IF p_signer_name IS NULL OR length(trim(p_signer_name)) < 2 THEN
    RAISE EXCEPTION 'Nom du signataire requis';
  END IF;

  IF p_consent_accuracy IS NOT TRUE THEN
    RAISE EXCEPTION 'Vous devez certifier l''exactitude des informations';
  END IF;

  IF p_completion_rate < 100 AND p_consent_incomplete IS NOT TRUE THEN
    RAISE EXCEPTION 'Consentement requis pour signer un KYC incomplet';
  END IF;

  -- --- Étape 4 : mise à jour. statut_kyc propagé pour que la jauge
  --     "Conformité" de la fiche consultant reflète l'état réel.
  IF p_completion_rate >= 100 THEN
    new_statut_kyc := 'oui';
  ELSE
    new_statut_kyc := 'en_cours';
  END IF;

  UPDATE clients
     SET kyc_signer_name         = trim(p_signer_name),
         kyc_signed_at           = NOW(),
         kyc_signer_ip           = p_signer_ip,
         kyc_completion_rate     = p_completion_rate,
         kyc_missing_fields      = p_missing_fields,
         kyc_incomplete_signed   = (p_completion_rate < 100),
         kyc_consent_incomplete  = COALESCE(p_consent_incomplete, FALSE),
         kyc_consent_accuracy    = p_consent_accuracy,
         statut_kyc              = new_statut_kyc
   WHERE id = target_id;

  RETURN jsonb_build_object(
    'client_id',     target_id,
    'signed_at',     NOW(),
    'signer_name',   trim(p_signer_name),
    'completion',    p_completion_rate,
    'incomplete',    (p_completion_rate < 100),
    'statut_kyc',    new_statut_kyc
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kyc_sign_by_token(TEXT, TEXT, SMALLINT, JSONB, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.kyc_sign_by_token(TEXT, TEXT, SMALLINT, JSONB, BOOLEAN, BOOLEAN, TEXT) TO anon, authenticated;

COMMIT;
