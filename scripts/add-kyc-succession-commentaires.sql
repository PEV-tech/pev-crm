-- ============================================================================
-- Chantier KYC succession + commentaires + "Autre" (2026-04-25)
-- ============================================================================
-- Ajoute :
--   1. clients.commentaires_kyc          JSONB     {section_key: "texte libre", ...}
--   2. clients.union_precedente          BOOLEAN
--      clients.union_precedente_details  TEXT
--   3. clients.donations_recues          JSONB array
--      [{donateur, montant, date_donation, nature, commentaire}, ...]
--   4. clients.loi_applicable_pays       TEXT      (code pays / nom)
--      clients.loi_applicable_details    TEXT      (libre)
--   5. clients.a_testament               BOOLEAN
--      clients.testament_details         TEXT
--   6. clients.a_donation_entre_epoux    BOOLEAN
--      clients.donation_entre_epoux_details TEXT
--
-- Note : `enfants_details` étant déjà JSONB (migration 2026-04-25), le flag
-- `issu_precedente_union: bool` ajouté à chaque sous-fiche enfant ne
-- nécessite pas de DDL — il est porté par les types TS uniquement.
--
-- Mise à jour conséquente :
--   - `_kyc_editable_fields()`  : ajout des nouvelles clés à la whitelist
--   - `kyc_apply_proposition()` : ajout des CASE pour propager les nouvelles
--     colonnes lors de l'application consultant. Les types `JSONB` utilisent
--     `->`, les TEXT utilisent `->>`, les BOOL un cast `(... ->> ...)::BOOLEAN`.
--
-- Idempotent : OUI (IF NOT EXISTS + CREATE OR REPLACE).
-- ============================================================================

BEGIN;

-- 1. Colonnes scalaires + JSONB
ALTER TABLE clients ADD COLUMN IF NOT EXISTS commentaires_kyc JSONB DEFAULT '{}'::jsonb;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS union_precedente BOOLEAN;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS union_precedente_details TEXT;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS donations_recues JSONB DEFAULT '[]'::jsonb;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS loi_applicable_pays TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS loi_applicable_details TEXT;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS a_testament BOOLEAN;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS testament_details TEXT;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS a_donation_entre_epoux BOOLEAN;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS donation_entre_epoux_details TEXT;

-- 2. Whitelist des champs éditables via la RPC apply-proposition
CREATE OR REPLACE FUNCTION public._kyc_editable_fields()
RETURNS TEXT[]
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT ARRAY[
    -- identité
    'nom', 'prenom', 'nom_jeune_fille', 'raison_sociale', 'type_personne',
    'email', 'telephone', 'titre',
    'date_naissance', 'lieu_naissance', 'nationalite',
    -- adresse / fiscal
    'adresse', 'ville', 'pays', 'code_postal',
    'residence_fiscale', 'nif', 'proprietaire_locataire',
    'montant_loyer', 'charges_residence_principale',
    -- famille
    'situation_matrimoniale', 'regime_matrimonial',
    'nombre_enfants', 'enfants_details',
    -- 2026-04-25 : histoire familiale & succession
    'union_precedente', 'union_precedente_details',
    'donations_recues',
    'loi_applicable_pays', 'loi_applicable_details',
    'a_testament', 'testament_details',
    'a_donation_entre_epoux', 'donation_entre_epoux_details',
    -- pro
    'profession', 'statut_professionnel',
    'employeur', 'date_debut_emploi',
    -- revenus
    'revenus_pro_net', 'revenus_fonciers', 'autres_revenus',
    'total_revenus_annuel',
    -- impôts
    'impot_revenu_n', 'impot_revenu_n1', 'impot_revenu_n2',
    -- patrimoine (jsonb)
    'patrimoine_immobilier', 'produits_financiers',
    'patrimoine_divers', 'emprunts',
    -- objectifs
    'objectifs_client',
    -- 2026-04-25 : commentaires libres par section
    'commentaires_kyc'
  ]::TEXT[];
$$;

REVOKE ALL ON FUNCTION public._kyc_editable_fields() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._kyc_editable_fields() TO anon, authenticated;

-- 3. RPC apply-proposition : ajout des nouvelles clés dans le UPDATE CASE.
--    On garde la même structure que la version 2026-04-25 (post-migration
--    enfants_details JSONB) — on ajoute simplement les colonnes après.
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
      objectifs_client       = CASE WHEN 'objectifs_client'       = ANY(accepted_keys) THEN prop.proposed_data->>'objectifs_client'       ELSE c.objectifs_client       END,
      -- 2026-04-25 : succession + commentaires
      union_precedente            = CASE WHEN 'union_precedente'            = ANY(accepted_keys) THEN (prop.proposed_data->>'union_precedente')::BOOLEAN     ELSE c.union_precedente            END,
      union_precedente_details    = CASE WHEN 'union_precedente_details'    = ANY(accepted_keys) THEN prop.proposed_data->>'union_precedente_details'        ELSE c.union_precedente_details    END,
      donations_recues            = CASE WHEN 'donations_recues'            = ANY(accepted_keys) THEN prop.proposed_data->'donations_recues'                  ELSE c.donations_recues            END,
      loi_applicable_pays         = CASE WHEN 'loi_applicable_pays'         = ANY(accepted_keys) THEN prop.proposed_data->>'loi_applicable_pays'              ELSE c.loi_applicable_pays         END,
      loi_applicable_details      = CASE WHEN 'loi_applicable_details'      = ANY(accepted_keys) THEN prop.proposed_data->>'loi_applicable_details'           ELSE c.loi_applicable_details      END,
      a_testament                 = CASE WHEN 'a_testament'                 = ANY(accepted_keys) THEN (prop.proposed_data->>'a_testament')::BOOLEAN           ELSE c.a_testament                 END,
      testament_details           = CASE WHEN 'testament_details'           = ANY(accepted_keys) THEN prop.proposed_data->>'testament_details'                ELSE c.testament_details           END,
      a_donation_entre_epoux      = CASE WHEN 'a_donation_entre_epoux'      = ANY(accepted_keys) THEN (prop.proposed_data->>'a_donation_entre_epoux')::BOOLEAN ELSE c.a_donation_entre_epoux      END,
      donation_entre_epoux_details = CASE WHEN 'donation_entre_epoux_details' = ANY(accepted_keys) THEN prop.proposed_data->>'donation_entre_epoux_details'   ELSE c.donation_entre_epoux_details END,
      commentaires_kyc            = CASE WHEN 'commentaires_kyc'            = ANY(accepted_keys) THEN prop.proposed_data->'commentaires_kyc'                  ELSE c.commentaires_kyc            END
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

-- 4. Sanity check
DO $$
DECLARE
  rpc_src TEXT;
  cols    INT;
BEGIN
  SELECT COUNT(*) INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='clients'
    AND column_name IN (
      'commentaires_kyc',
      'union_precedente','union_precedente_details',
      'donations_recues',
      'loi_applicable_pays','loi_applicable_details',
      'a_testament','testament_details',
      'a_donation_entre_epoux','donation_entre_epoux_details'
    );
  IF cols <> 10 THEN
    RAISE EXCEPTION 'Migration KO : colonnes succession manquantes (% / 10)', cols;
  END IF;

  SELECT prosrc INTO rpc_src
  FROM pg_proc
  WHERE proname='kyc_apply_proposition' AND pronamespace='public'::regnamespace
  LIMIT 1;
  IF rpc_src NOT LIKE '%donations_recues%' THEN
    RAISE EXCEPTION 'Migration KO : RPC ne référence pas donations_recues';
  END IF;
  IF rpc_src NOT LIKE '%commentaires_kyc%' THEN
    RAISE EXCEPTION 'Migration KO : RPC ne référence pas commentaires_kyc';
  END IF;

  RAISE NOTICE 'Migration OK : 10 colonnes ajoutées, RPC mise à jour.';
END$$;

COMMIT;
