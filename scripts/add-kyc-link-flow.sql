-- =====================================================================
-- Migration : workflow KYC avec lien public et suivi d'envoi
-- Date        : 2026-04-21
-- Description : ajoute les colonnes de tracking (token public, dates
--               d'envoi/ouverture) et les fonctions RPC qui permettent
--               à un client non authentifié d'ouvrir/signer son KYC via
--               un lien privé. Les fonctions sont en SECURITY DEFINER
--               pour bypasser RLS sur clients tout en restreignant
--               précisément les colonnes exposées/modifiables.
-- Prérequis   : add-kyc-signature-audit.sql (colonnes kyc_signed_at,
--               kyc_incomplete_signed, etc.) déjà appliqué.
-- Idempotent  : OUI, utilise IF NOT EXISTS / CREATE OR REPLACE.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- 1. Colonnes de tracking
-- -------------------------------------------------------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_token              TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS kyc_token_created_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_sent_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_opened_at          TIMESTAMPTZ;

-- Index partiel : seuls les clients ayant un token sont indexés
-- (les autres ne sont jamais recherchés par token).
CREATE INDEX IF NOT EXISTS idx_clients_kyc_token
  ON clients (kyc_token)
  WHERE kyc_token IS NOT NULL;

-- -------------------------------------------------------------------
-- 2. RPC : génération/rotation du token (consultant authentifié)
--    Appelable par toute session auth.role() = 'authenticated'.
--    Ne fait rien si le client n'existe pas.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kyc_generate_token(p_client_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
  exists_flag BOOLEAN;
BEGIN
  -- Vérifier que l'appelant est bien authentifié (side-check ; l'API
  -- route fait déjà l'auth, mais double-défense).
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT TRUE INTO exists_flag FROM clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  -- Token aléatoire 32 hex = 128 bits ; très largement suffisant pour
  -- empêcher les collisions / bruteforce.
  new_token := encode(gen_random_bytes(16), 'hex');

  UPDATE clients
     SET kyc_token            = new_token,
         kyc_token_created_at = NOW()
   WHERE id = p_client_id;

  RETURN new_token;
END;
$$;

REVOKE ALL ON FUNCTION public.kyc_generate_token(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.kyc_generate_token(UUID) TO authenticated;

-- -------------------------------------------------------------------
-- 3. RPC : marque le KYC comme envoyé (consultant authentifié)
--    Appelée par l'UI quand le consultant clique "Envoyer par email"
--    ou "Copier le lien" pour la première fois.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kyc_mark_sent(p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE clients
     SET kyc_sent_at = COALESCE(kyc_sent_at, NOW())
   WHERE id = p_client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.kyc_mark_sent(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.kyc_mark_sent(UUID) TO authenticated;

-- -------------------------------------------------------------------
-- 4. RPC : lire les données d'un KYC par token (PUBLIC, anon inclus)
--    Retourne un sous-ensemble de colonnes strictement nécessaires à
--    l'affichage/signature côté client. N'expose pas commentaires
--    internes, consultant_id, notes privées, etc.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kyc_client_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_json JSONB;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
           'id',                       c.id,
           'nom',                      c.nom,
           'prenom',                   c.prenom,
           'raison_sociale',           c.raison_sociale,
           'type_personne',            c.type_personne,
           'email',                    c.email,
           'telephone',                c.telephone,
           'titre',                    c.titre,
           'date_naissance',           c.date_naissance,
           'lieu_naissance',           c.lieu_naissance,
           'nationalite',              c.nationalite,
           'adresse',                  c.adresse,
           'ville',                    c.ville,
           'pays',                     c.pays,
           'residence_fiscale',        c.residence_fiscale,
           'nif',                      c.nif,
           'proprietaire_locataire',   c.proprietaire_locataire,
           'situation_matrimoniale',   c.situation_matrimoniale,
           'regime_matrimonial',       c.regime_matrimonial,
           'nombre_enfants',           c.nombre_enfants,
           'enfants_details',          c.enfants_details,
           'profession',               c.profession,
           'statut_professionnel',     c.statut_professionnel,
           'employeur',                c.employeur,
           'date_debut_emploi',        c.date_debut_emploi,
           'revenus_pro_net',          c.revenus_pro_net,
           'revenus_fonciers',         c.revenus_fonciers,
           'autres_revenus',           c.autres_revenus,
           'total_revenus_annuel',     c.total_revenus_annuel,
           'impot_revenu_n',           c.impot_revenu_n,
           'impot_revenu_n1',          c.impot_revenu_n1,
           'impot_revenu_n2',          c.impot_revenu_n2,
           'patrimoine_immobilier',    c.patrimoine_immobilier,
           'produits_financiers',      c.produits_financiers,
           'patrimoine_divers',        c.patrimoine_divers,
           'emprunts',                 c.emprunts,
           'objectifs_client',         c.objectifs_client,
           'kyc_signed_at',            c.kyc_signed_at,
           'kyc_signer_name',          c.kyc_signer_name,
           'kyc_incomplete_signed',    c.kyc_incomplete_signed,
           'kyc_completion_rate',      c.kyc_completion_rate,
           'kyc_missing_fields',       c.kyc_missing_fields
         ) INTO row_json
  FROM   clients c
  WHERE  c.kyc_token = p_token
  LIMIT  1;

  RETURN row_json;
END;
$$;

REVOKE ALL ON FUNCTION public.kyc_client_by_token(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.kyc_client_by_token(TEXT) TO anon, authenticated;

-- -------------------------------------------------------------------
-- 5. RPC : marquer la première ouverture du lien (PUBLIC)
--    Utilisé pour le statut "En cours" vs "Envoyé".
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kyc_mark_opened(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN;
  END IF;

  UPDATE clients
     SET kyc_opened_at = COALESCE(kyc_opened_at, NOW())
   WHERE kyc_token = p_token;
END;
$$;

REVOKE ALL ON FUNCTION public.kyc_mark_opened(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.kyc_mark_opened(TEXT) TO anon, authenticated;

-- -------------------------------------------------------------------
-- 6. RPC : signer un KYC via token (PUBLIC)
--    Équivalent de l'ancienne route /api/sign-kyc, mais côté client.
--    - Contrôle serveur : si completion_rate < 100, consent_incomplete
--      DOIT être true. Sinon refus.
--    - Enregistre IP, nom, horodatage, completion snapshot.
--    - Refuse de re-signer si déjà signé (idempotent-safe).
-- -------------------------------------------------------------------
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
  target_id UUID;
  already_signed TIMESTAMPTZ;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  IF p_signer_name IS NULL OR length(trim(p_signer_name)) < 2 THEN
    RAISE EXCEPTION 'Signer name required';
  END IF;

  IF p_consent_accuracy IS NOT TRUE THEN
    RAISE EXCEPTION 'Accuracy consent required';
  END IF;

  IF p_completion_rate < 100 AND p_consent_incomplete IS NOT TRUE THEN
    RAISE EXCEPTION 'Incomplete consent required for incomplete KYC';
  END IF;

  SELECT id, kyc_signed_at INTO target_id, already_signed
  FROM   clients
  WHERE  kyc_token = p_token
  LIMIT  1;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'Token not found';
  END IF;

  IF already_signed IS NOT NULL THEN
    RAISE EXCEPTION 'KYC already signed on %', already_signed;
  END IF;

  UPDATE clients
     SET kyc_signer_name         = trim(p_signer_name),
         kyc_signed_at           = NOW(),
         kyc_signer_ip           = p_signer_ip,
         kyc_completion_rate     = p_completion_rate,
         kyc_missing_fields      = p_missing_fields,
         kyc_incomplete_signed   = (p_completion_rate < 100),
         kyc_consent_incomplete  = COALESCE(p_consent_incomplete, FALSE),
         kyc_consent_accuracy    = p_consent_accuracy
   WHERE id = target_id;

  RETURN jsonb_build_object(
    'client_id',     target_id,
    'signed_at',     NOW(),
    'signer_name',   trim(p_signer_name),
    'completion',    p_completion_rate,
    'incomplete',    (p_completion_rate < 100)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kyc_sign_by_token(TEXT, TEXT, SMALLINT, JSONB, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.kyc_sign_by_token(TEXT, TEXT, SMALLINT, JSONB, BOOLEAN, BOOLEAN, TEXT) TO anon, authenticated;

COMMIT;
