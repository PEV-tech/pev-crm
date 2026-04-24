-- =====================================================
-- FIX : RPC kyc_apply_proposition — ajout du champ
--       charges_residence_principale (propriétaires)
-- Date : 2026-04-24
--
-- Contexte
-- --------
-- Retour Maxine : le portail KYC collecte bien le montant de loyer si
-- le client est locataire, mais rien n'est demandé côté propriétaire.
-- On ajoute `charges_residence_principale` (champ miroir, numérique)
-- qui recouvre remboursement crédit + charges copropriété + taxe
-- foncière mensualisée. La propagation suit exactement le pattern de
-- `montant_loyer` : entrée dans la whitelist `_kyc_editable_fields()`
-- + branche CASE dans l'UPDATE clients avec cast ::NUMERIC.
--
-- Prérequis : migration `2026-04-24_charges_residence_principale.sql`
-- exécutée (ALTER TABLE clients ADD COLUMN charges_residence_principale).
--
-- Idempotent : CREATE OR REPLACE sur les deux fonctions.
-- =====================================================

-- ---------------------------------------------------------------------
-- 1. Whitelist étendue : charges_residence_principale
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._kyc_editable_fields()
RETURNS TEXT[]
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT ARRAY[
    -- identité
    'nom', 'nom_jeune_fille', 'prenom', 'raison_sociale', 'type_personne',
    'email', 'telephone', 'titre',
    'date_naissance', 'lieu_naissance', 'nationalite',
    -- adresse / fiscal
    'adresse', 'code_postal', 'ville', 'pays',
    'residence_fiscale', 'nif', 'proprietaire_locataire',
    'montant_loyer', 'charges_residence_principale',
    -- famille
    'situation_matrimoniale', 'regime_matrimonial',
    'nombre_enfants', 'enfants_details',
    -- pro
    'profession', 'statut_professionnel',
    'employeur', 'date_debut_emploi',
    -- revenus
    'revenus_pro_net', 'revenus_fonciers', 'autres_revenus',
    'total_revenus_annuel',
    -- impôts
    'impot_revenu_n', 'impot_revenu_n1', 'impot_revenu_n2',
    -- patrimoine (jsonb)
    'patrimoine_immobilier', 'patrimoine_professionnel',
    'produits_financiers', 'patrimoine_divers', 'emprunts',
    -- objectifs
    'objectifs_client'
  ]::TEXT[];
$$;

REVOKE ALL ON FUNCTION public._kyc_editable_fields() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._kyc_editable_fields() TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. RPC apply_proposition : UPDATE CASE étendu
--    (corps identique à fix-apply-proposition-restore-signature.sql,
--     avec une branche supplémentaire pour charges_residence_principale
--     placée immédiatement après montant_loyer pour lisibilité)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kyc_apply_proposition(
  p_proposition_id UUID,
  p_field_decisions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop              RECORD;
  editable          TEXT[];
  k                 TEXT;
  decision          TEXT;
  accepted_keys     TEXT[] := ARRAY[]::TEXT[];
  rejected_keys     TEXT[] := ARRAY[]::TEXT[];
  proposed_keys     TEXT[];
  final_status      TEXT;
  target_client     UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO prop
  FROM kyc_propositions
  WHERE id = p_proposition_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposition not found';
  END IF;
  IF prop.status <> 'pending' THEN
    RAISE EXCEPTION 'Proposition is not pending (status=%)', prop.status;
  END IF;

  target_client := prop.client_id;

  PERFORM 1 FROM clients WHERE id = target_client;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  editable := public._kyc_editable_fields();

  proposed_keys := ARRAY(SELECT jsonb_object_keys(prop.proposed_data));
  FOREACH k IN ARRAY proposed_keys LOOP
    IF NOT (k = ANY (editable)) THEN
      CONTINUE;
    END IF;
    decision := p_field_decisions ->> k;
    IF decision = 'accept' THEN
      accepted_keys := array_append(accepted_keys, k);
    ELSIF decision = 'reject' THEN
      rejected_keys := array_append(rejected_keys, k);
    ELSE
      RAISE EXCEPTION 'Missing decision for field %', k;
    END IF;
  END LOOP;

  IF array_length(accepted_keys, 1) > 0 THEN
    UPDATE clients c SET
      nom                           = CASE WHEN 'nom'                           = ANY(accepted_keys) THEN prop.proposed_data->>'nom'                           ELSE c.nom                           END,
      nom_jeune_fille               = CASE WHEN 'nom_jeune_fille'               = ANY(accepted_keys) THEN prop.proposed_data->>'nom_jeune_fille'               ELSE c.nom_jeune_fille               END,
      prenom                        = CASE WHEN 'prenom'                        = ANY(accepted_keys) THEN prop.proposed_data->>'prenom'                        ELSE c.prenom                        END,
      raison_sociale                = CASE WHEN 'raison_sociale'                = ANY(accepted_keys) THEN prop.proposed_data->>'raison_sociale'                ELSE c.raison_sociale                END,
      type_personne                 = CASE WHEN 'type_personne'                 = ANY(accepted_keys) THEN prop.proposed_data->>'type_personne'                 ELSE c.type_personne                 END,
      email                         = CASE WHEN 'email'                         = ANY(accepted_keys) THEN prop.proposed_data->>'email'                         ELSE c.email                         END,
      telephone                     = CASE WHEN 'telephone'                     = ANY(accepted_keys) THEN prop.proposed_data->>'telephone'                     ELSE c.telephone                     END,
      titre                         = CASE WHEN 'titre'                         = ANY(accepted_keys) THEN prop.proposed_data->>'titre'                         ELSE c.titre                         END,
      date_naissance                = CASE WHEN 'date_naissance'                = ANY(accepted_keys) THEN (prop.proposed_data->>'date_naissance')::DATE        ELSE c.date_naissance                END,
      lieu_naissance                = CASE WHEN 'lieu_naissance'                = ANY(accepted_keys) THEN prop.proposed_data->>'lieu_naissance'                ELSE c.lieu_naissance                END,
      nationalite                   = CASE WHEN 'nationalite'                   = ANY(accepted_keys) THEN prop.proposed_data->>'nationalite'                   ELSE c.nationalite                   END,
      adresse                       = CASE WHEN 'adresse'                       = ANY(accepted_keys) THEN prop.proposed_data->>'adresse'                       ELSE c.adresse                       END,
      code_postal                   = CASE WHEN 'code_postal'                   = ANY(accepted_keys) THEN prop.proposed_data->>'code_postal'                   ELSE c.code_postal                   END,
      ville                         = CASE WHEN 'ville'                         = ANY(accepted_keys) THEN prop.proposed_data->>'ville'                         ELSE c.ville                         END,
      pays                          = CASE WHEN 'pays'                          = ANY(accepted_keys) THEN prop.proposed_data->>'pays'                          ELSE c.pays                          END,
      residence_fiscale             = CASE WHEN 'residence_fiscale'             = ANY(accepted_keys) THEN prop.proposed_data->>'residence_fiscale'             ELSE c.residence_fiscale             END,
      nif                           = CASE WHEN 'nif'                           = ANY(accepted_keys) THEN prop.proposed_data->>'nif'                           ELSE c.nif                           END,
      proprietaire_locataire        = CASE WHEN 'proprietaire_locataire'        = ANY(accepted_keys) THEN prop.proposed_data->>'proprietaire_locataire'        ELSE c.proprietaire_locataire        END,
      montant_loyer                 = CASE WHEN 'montant_loyer'                 = ANY(accepted_keys) THEN (prop.proposed_data->>'montant_loyer')::NUMERIC      ELSE c.montant_loyer                 END,
      charges_residence_principale  = CASE WHEN 'charges_residence_principale'  = ANY(accepted_keys) THEN (prop.proposed_data->>'charges_residence_principale')::NUMERIC ELSE c.charges_residence_principale END,
      situation_matrimoniale        = CASE WHEN 'situation_matrimoniale'        = ANY(accepted_keys) THEN prop.proposed_data->>'situation_matrimoniale'        ELSE c.situation_matrimoniale        END,
      regime_matrimonial            = CASE WHEN 'regime_matrimonial'            = ANY(accepted_keys) THEN prop.proposed_data->>'regime_matrimonial'            ELSE c.regime_matrimonial            END,
      nombre_enfants                = CASE WHEN 'nombre_enfants'                = ANY(accepted_keys) THEN (prop.proposed_data->>'nombre_enfants')::INT         ELSE c.nombre_enfants                END,
      enfants_details               = CASE WHEN 'enfants_details'               = ANY(accepted_keys) THEN prop.proposed_data->>'enfants_details'               ELSE c.enfants_details               END,
      profession                    = CASE WHEN 'profession'                    = ANY(accepted_keys) THEN prop.proposed_data->>'profession'                    ELSE c.profession                    END,
      statut_professionnel          = CASE WHEN 'statut_professionnel'          = ANY(accepted_keys) THEN prop.proposed_data->>'statut_professionnel'          ELSE c.statut_professionnel          END,
      employeur                     = CASE WHEN 'employeur'                     = ANY(accepted_keys) THEN prop.proposed_data->>'employeur'                     ELSE c.employeur                     END,
      date_debut_emploi             = CASE WHEN 'date_debut_emploi'             = ANY(accepted_keys) THEN prop.proposed_data->>'date_debut_emploi'             ELSE c.date_debut_emploi             END,
      revenus_pro_net               = CASE WHEN 'revenus_pro_net'               = ANY(accepted_keys) THEN (prop.proposed_data->>'revenus_pro_net')::NUMERIC      ELSE c.revenus_pro_net               END,
      revenus_fonciers              = CASE WHEN 'revenus_fonciers'              = ANY(accepted_keys) THEN (prop.proposed_data->>'revenus_fonciers')::NUMERIC     ELSE c.revenus_fonciers              END,
      autres_revenus                = CASE WHEN 'autres_revenus'                = ANY(accepted_keys) THEN (prop.proposed_data->>'autres_revenus')::NUMERIC       ELSE c.autres_revenus                END,
      total_revenus_annuel          = CASE WHEN 'total_revenus_annuel'          = ANY(accepted_keys) THEN (prop.proposed_data->>'total_revenus_annuel')::NUMERIC ELSE c.total_revenus_annuel          END,
      impot_revenu_n                = CASE WHEN 'impot_revenu_n'                = ANY(accepted_keys) THEN (prop.proposed_data->>'impot_revenu_n')::NUMERIC       ELSE c.impot_revenu_n                END,
      impot_revenu_n1               = CASE WHEN 'impot_revenu_n1'               = ANY(accepted_keys) THEN (prop.proposed_data->>'impot_revenu_n1')::NUMERIC      ELSE c.impot_revenu_n1               END,
      impot_revenu_n2               = CASE WHEN 'impot_revenu_n2'               = ANY(accepted_keys) THEN (prop.proposed_data->>'impot_revenu_n2')::NUMERIC      ELSE c.impot_revenu_n2               END,
      patrimoine_immobilier         = CASE WHEN 'patrimoine_immobilier'         = ANY(accepted_keys) THEN prop.proposed_data->'patrimoine_immobilier'          ELSE c.patrimoine_immobilier         END,
      patrimoine_professionnel      = CASE WHEN 'patrimoine_professionnel'      = ANY(accepted_keys) THEN prop.proposed_data->'patrimoine_professionnel'       ELSE c.patrimoine_professionnel      END,
      produits_financiers           = CASE WHEN 'produits_financiers'           = ANY(accepted_keys) THEN prop.proposed_data->'produits_financiers'            ELSE c.produits_financiers           END,
      patrimoine_divers             = CASE WHEN 'patrimoine_divers'             = ANY(accepted_keys) THEN prop.proposed_data->'patrimoine_divers'              ELSE c.patrimoine_divers             END,
      emprunts                      = CASE WHEN 'emprunts'                      = ANY(accepted_keys) THEN prop.proposed_data->'emprunts'                       ELSE c.emprunts                      END,
      objectifs_client              = CASE WHEN 'objectifs_client'              = ANY(accepted_keys) THEN prop.proposed_data->>'objectifs_client'              ELSE c.objectifs_client              END
    WHERE c.id = target_client;
  END IF;

  IF array_length(accepted_keys, 1) IS NULL AND array_length(rejected_keys, 1) > 0 THEN
    final_status := 'rejected';
  ELSIF array_length(rejected_keys, 1) > 0 THEN
    final_status := 'partially_applied';
  ELSE
    final_status := 'fully_applied';
  END IF;

  UPDATE kyc_propositions
     SET field_decisions = p_field_decisions,
         status          = final_status,
         reviewed_by     = auth.uid(),
         reviewed_at     = NOW(),
         updated_at      = NOW()
   WHERE id = p_proposition_id;

  -- Propagation des champs signature (cf. fix-apply-proposition-restore-signature)
  IF final_status IN ('fully_applied', 'partially_applied') THEN
    UPDATE clients c SET
      kyc_signer_name         = prop.signer_name,
      kyc_signer_ip           = prop.signer_ip,
      kyc_signed_at           = prop.signed_at,
      kyc_completion_rate     = prop.completion_rate,
      kyc_missing_fields      = prop.missing_fields,
      kyc_incomplete_signed   = (prop.completion_rate < 100),
      kyc_consent_accuracy    = prop.consent_accuracy,
      kyc_consent_incomplete  = prop.consent_incomplete
    WHERE c.id = target_client
      AND  c.kyc_signed_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'proposition_id', p_proposition_id,
    'status',         final_status,
    'applied',        COALESCE(array_length(accepted_keys, 1), 0),
    'rejected',       COALESCE(array_length(rejected_keys, 1), 0)
  );
END;
$$;

-- =====================================================================
-- Smoke test (commenté)
-- =====================================================================
-- SELECT 'charges_residence_principale' = ANY(public._kyc_editable_fields()) AS in_whitelist;
-- SELECT prosrc LIKE '%charges_residence_principale%' AS has_charges_branch
-- FROM pg_proc WHERE proname = 'kyc_apply_proposition';
