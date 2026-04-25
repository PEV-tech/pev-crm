-- ============================================================================
-- Migration : clients.enfants_details TEXT → JSONB array (2026-04-25)
-- ============================================================================
-- Contexte : avant cette migration, `enfants_details` était un champ texte
-- libre (placeholder UI : "p.ex. 11 ans, 15 ans"). On passe à un tableau JSONB
-- structuré pour permettre une sous-fiche par enfant côté CRM et portail KYC.
--
-- Schéma cible par enfant :
--   {
--     "nom": "string",
--     "prenom": "string",
--     "sexe": "homme" | "femme" | "autre",
--     "date_naissance": "YYYY-MM-DD",
--     "a_charge": true | false,
--     "legacy_notes": "string (optionnel — uniquement après backfill)"
--   }
--
-- Backfill : les valeurs TEXT existantes sont converties en
-- `[{"legacy_notes": "<ancien texte>"}]` pour ne pas perdre la saisie. Les
-- consultants pourront ensuite ré-éditer pour structurer.
--
-- Effets de bord :
--  - La RPC `kyc_apply_proposition` doit repasser de `->>` à `->` pour
--    `enfants_details` (sinon "CASE types text and jsonb cannot be matched").
--    Voir ci-dessous : le CREATE OR REPLACE FUNCTION est inclus dans le même
--    fichier pour atomicité (transaction unique).
--  - Les propositions `kyc_propositions.status='pending'` actuelles dont
--    `proposed_data->>enfants_details` est un texte (et non un array) seront
--    cassées : il faut les ré-appliquer après UPDATE manuel ou les annuler.
--    À vérifier avant exécution :
--      SELECT id, client_id, proposed_data->'enfants_details'
--      FROM kyc_propositions
--      WHERE status='pending'
--        AND jsonb_typeof(proposed_data->'enfants_details') NOT IN ('array', 'null');
--    (zéro ligne attendu en prod si on lance pendant un creux)
-- ============================================================================

BEGIN;

-- 1. Conversion de la colonne TEXT → JSONB (avec backfill)
--    Le USING clause est évalué row-by-row. Empty string → NULL.
ALTER TABLE clients
  ALTER COLUMN enfants_details TYPE JSONB
  USING CASE
    WHEN enfants_details IS NULL OR enfants_details = '' THEN NULL
    -- Si déjà un JSONB array sérialisé en texte (cas peu probable mais safe)
    WHEN enfants_details ~ '^\s*\[' THEN enfants_details::JSONB
    -- Texte libre legacy → array d'un objet avec legacy_notes
    ELSE jsonb_build_array(jsonb_build_object('legacy_notes', enfants_details))
  END;

-- 2. Mise à jour de la RPC apply-proposition (revient à `->`)
CREATE OR REPLACE FUNCTION kyc_apply_proposition(
  p_proposition_id  UUID,
  p_field_decisions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  prop           kyc_propositions%ROWTYPE;
  target_client  UUID;
  field_key      TEXT;
  decision       TEXT;
  accepted_keys  TEXT[] := ARRAY[]::TEXT[];
  rejected_keys  TEXT[] := ARRAY[]::TEXT[];
  final_status   TEXT;
BEGIN
  SELECT * INTO prop
  FROM kyc_propositions
  WHERE id = p_proposition_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposition not found: %', p_proposition_id;
  END IF;

  IF prop.status NOT IN ('pending', 'partially_applied') THEN
    RAISE EXCEPTION 'Proposition % is not pending (status=%)', p_proposition_id, prop.status;
  END IF;

  target_client := prop.client_id;

  -- Itère sur chaque clé proposée et exige une décision explicite.
  FOR field_key IN SELECT jsonb_object_keys(prop.proposed_data) LOOP
    decision := p_field_decisions->>field_key;
    IF decision IS NULL THEN
      RAISE EXCEPTION 'Missing decision for field %', field_key;
    END IF;
    IF decision = 'accept' THEN
      accepted_keys := array_append(accepted_keys, field_key);
    ELSIF decision = 'reject' THEN
      rejected_keys := array_append(rejected_keys, field_key);
    ELSE
      RAISE EXCEPTION 'Invalid decision % for field %', decision, field_key;
    END IF;
  END LOOP;

  IF array_length(accepted_keys, 1) > 0 THEN
    UPDATE clients c SET
      nom                    = CASE WHEN 'nom'                    = ANY(accepted_keys) THEN prop.proposed_data->>'nom'                    ELSE c.nom                    END,
      prenom                 = CASE WHEN 'prenom'                 = ANY(accepted_keys) THEN prop.proposed_data->>'prenom'                 ELSE c.prenom                 END,
      titre                  = CASE WHEN 'titre'                  = ANY(accepted_keys) THEN prop.proposed_data->>'titre'                  ELSE c.titre                  END,
      date_naissance         = CASE WHEN 'date_naissance'         = ANY(accepted_keys) THEN (prop.proposed_data->>'date_naissance')::DATE ELSE c.date_naissance         END,
      lieu_naissance         = CASE WHEN 'lieu_naissance'         = ANY(accepted_keys) THEN prop.proposed_data->>'lieu_naissance'         ELSE c.lieu_naissance         END,
      nationalite            = CASE WHEN 'nationalite'            = ANY(accepted_keys) THEN prop.proposed_data->>'nationalite'            ELSE c.nationalite            END,
      adresse                = CASE WHEN 'adresse'                = ANY(accepted_keys) THEN prop.proposed_data->>'adresse'                ELSE c.adresse                END,
      ville                  = CASE WHEN 'ville'                  = ANY(accepted_keys) THEN prop.proposed_data->>'ville'                  ELSE c.ville                  END,
      pays                   = CASE WHEN 'pays'                   = ANY(accepted_keys) THEN prop.proposed_data->>'pays'                   ELSE c.pays                   END,
      residence_fiscale      = CASE WHEN 'residence_fiscale'      = ANY(accepted_keys) THEN prop.proposed_data->>'residence_fiscale'      ELSE c.residence_fiscale      END,
      nif                    = CASE WHEN 'nif'                    = ANY(accepted_keys) THEN prop.proposed_data->>'nif'                    ELSE c.nif                    END,
      proprietaire_locataire = CASE WHEN 'proprietaire_locataire' = ANY(accepted_keys) THEN prop.proposed_data->>'proprietaire_locataire' ELSE c.proprietaire_locataire END,
      situation_matrimoniale = CASE WHEN 'situation_matrimoniale' = ANY(accepted_keys) THEN prop.proposed_data->>'situation_matrimoniale' ELSE c.situation_matrimoniale END,
      regime_matrimonial     = CASE WHEN 'regime_matrimonial'     = ANY(accepted_keys) THEN prop.proposed_data->>'regime_matrimonial'     ELSE c.regime_matrimonial     END,
      nombre_enfants         = CASE WHEN 'nombre_enfants'         = ANY(accepted_keys) THEN (prop.proposed_data->>'nombre_enfants')::INT  ELSE c.nombre_enfants         END,
      -- 2026-04-25 : enfants_details est désormais JSONB array (fini le `->>`).
      enfants_details        = CASE WHEN 'enfants_details'        = ANY(accepted_keys) THEN prop.proposed_data->'enfants_details'         ELSE c.enfants_details        END,
      profession             = CASE WHEN 'profession'             = ANY(accepted_keys) THEN prop.proposed_data->>'profession'             ELSE c.profession             END,
      statut_professionnel   = CASE WHEN 'statut_professionnel'   = ANY(accepted_keys) THEN prop.proposed_data->>'statut_professionnel'   ELSE c.statut_professionnel   END,
      employeur              = CASE WHEN 'employeur'              = ANY(accepted_keys) THEN prop.proposed_data->>'employeur'              ELSE c.employeur              END,
      date_debut_emploi      = CASE WHEN 'date_debut_emploi'      = ANY(accepted_keys) THEN (prop.proposed_data->>'date_debut_emploi')::DATE ELSE c.date_debut_emploi  END,
      revenus_pro_net        = CASE WHEN 'revenus_pro_net'        = ANY(accepted_keys) THEN (prop.proposed_data->>'revenus_pro_net')::NUMERIC ELSE c.revenus_pro_net     END,
      revenus_fonciers       = CASE WHEN 'revenus_fonciers'       = ANY(accepted_keys) THEN (prop.proposed_data->>'revenus_fonciers')::NUMERIC ELSE c.revenus_fonciers   END,
      autres_revenus         = CASE WHEN 'autres_revenus'         = ANY(accepted_keys) THEN (prop.proposed_data->>'autres_revenus')::NUMERIC ELSE c.autres_revenus       END,
      total_revenus_annuel   = CASE WHEN 'total_revenus_annuel'   = ANY(accepted_keys) THEN (prop.proposed_data->>'total_revenus_annuel')::NUMERIC ELSE c.total_revenus_annuel END,
      impot_revenu_n         = CASE WHEN 'impot_revenu_n'         = ANY(accepted_keys) THEN (prop.proposed_data->>'impot_revenu_n')::NUMERIC  ELSE c.impot_revenu_n      END,
      impot_revenu_n1        = CASE WHEN 'impot_revenu_n1'        = ANY(accepted_keys) THEN (prop.proposed_data->>'impot_revenu_n1')::NUMERIC ELSE c.impot_revenu_n1     END,
      impot_revenu_n2        = CASE WHEN 'impot_revenu_n2'        = ANY(accepted_keys) THEN (prop.proposed_data->>'impot_revenu_n2')::NUMERIC ELSE c.impot_revenu_n2     END,
      patrimoine_immobilier  = CASE WHEN 'patrimoine_immobilier'  = ANY(accepted_keys) THEN prop.proposed_data->'patrimoine_immobilier'   ELSE c.patrimoine_immobilier  END,
      produits_financiers    = CASE WHEN 'produits_financiers'    = ANY(accepted_keys) THEN prop.proposed_data->'produits_financiers'     ELSE c.produits_financiers    END,
      patrimoine_divers      = CASE WHEN 'patrimoine_divers'      = ANY(accepted_keys) THEN prop.proposed_data->'patrimoine_divers'       ELSE c.patrimoine_divers      END,
      emprunts               = CASE WHEN 'emprunts'               = ANY(accepted_keys) THEN prop.proposed_data->'emprunts'                ELSE c.emprunts               END,
      objectifs_client       = CASE WHEN 'objectifs_client'       = ANY(accepted_keys) THEN prop.proposed_data->>'objectifs_client'       ELSE c.objectifs_client       END
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

  IF final_status = 'fully_applied' THEN
    UPDATE clients c SET
      kyc_signer_name         = prop.signer_name,
      kyc_signer_email        = prop.signer_email,
      kyc_signed_at           = prop.signed_at,
      kyc_signature_image_url = prop.signature_image_url,
      kyc_token               = NULL,
      kyc_token_expires_at    = NULL,
      kyc_signe               = TRUE
    WHERE c.id = target_client;
  END IF;

  RETURN jsonb_build_object(
    'status',         final_status,
    'accepted_count', COALESCE(array_length(accepted_keys, 1), 0),
    'rejected_count', COALESCE(array_length(rejected_keys, 1), 0)
  );
END;
$$;

-- 3. Sanity check : la colonne est bien JSONB, la RPC ne contient plus de `->>'enfants_details'`
DO $$
DECLARE
  col_type TEXT;
  rpc_src  TEXT;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'clients'
    AND column_name = 'enfants_details';

  IF col_type <> 'jsonb' THEN
    RAISE EXCEPTION 'Migration KO : enfants_details type=% (attendu jsonb)', col_type;
  END IF;

  SELECT prosrc INTO rpc_src
  FROM pg_proc
  WHERE proname = 'kyc_apply_proposition'
    AND pronamespace = 'public'::regnamespace
  LIMIT 1;

  IF rpc_src LIKE '%>>''enfants_details''%' THEN
    RAISE EXCEPTION 'Migration KO : la RPC contient encore ->>''enfants_details''';
  END IF;

  RAISE NOTICE 'Migration OK : enfants_details=jsonb, RPC propre.';
END$$;

COMMIT;

-- Pour rollback (cas d'urgence — perdra la structure et ne gardera que legacy_notes) :
-- BEGIN;
-- ALTER TABLE clients
--   ALTER COLUMN enfants_details TYPE TEXT
--   USING CASE
--     WHEN enfants_details IS NULL THEN NULL
--     WHEN jsonb_typeof(enfants_details) = 'array'
--          AND jsonb_array_length(enfants_details) > 0
--          AND enfants_details->0 ? 'legacy_notes'
--          AND jsonb_array_length(enfants_details) = 1
--       THEN enfants_details->0->>'legacy_notes'
--     ELSE enfants_details::TEXT
--   END;
-- COMMIT;
