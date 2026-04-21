-- Fix 2026-04-21 v2 (retour Maxine) — bug SQL "CASE types text and jsonb
-- cannot be matched" lors de l'appel à `kyc_apply_proposition`.
--
-- CAUSE RACINE
-- ------------
-- Le script original `scripts/add-kyc-propositions.sql` traite
-- `enfants_details` comme JSONB dans le UPDATE CASE :
--     enfants_details = CASE WHEN 'enfants_details' = ANY(accepted_keys)
--                       THEN prop.proposed_data->'enfants_details'  -- → JSONB
--                       ELSE c.enfants_details                       -- TEXT
--                       END
-- Or la colonne `clients.enfants_details` est déclarée TEXT
-- (cf. `scripts/add-kyc-fields.sql:21` :
--   ALTER TABLE clients ADD COLUMN IF NOT EXISTS enfants_details TEXT;)
-- et tout le code TS la type `string | null` (database.ts, kyc-pdf.ts,
-- parse-kyc, kyc-section). PostgreSQL refuse un CASE dont les branches
-- n'ont pas le même type.
--
-- Le bug était latent : tant que le portail public n'envoyait pas
-- explicitement `enfants_details` dans `accepted_keys`, le CASE allait
-- sur la branche ELSE et le mismatch de type ne faisait jamais crash
-- (le CASE est typé à l'exécution, seul le JSONB->'x' forçait la
-- vérification). En rendant le diff-viewer plus permissif
-- (commit 483b852 : accept implicite pour tous les champs proposés,
-- même inchangés), on a systématiquement mis `enfants_details` dans
-- `accepted_keys` → bug permanent "CASE types text and jsonb cannot
-- be matched".
--
-- FIX
-- ---
-- On remplace `prop.proposed_data->'enfants_details'` (JSONB) par
-- `prop.proposed_data->>'enfants_details'` (TEXT) dans la branche THEN.
-- Tout le reste du CREATE OR REPLACE FUNCTION est strictement identique
-- à `scripts/add-kyc-propositions.sql`, sauf cette unique ligne, pour
-- qu'on puisse refaire tourner ce script idempotent sans régression.
--
-- Après application de ce patch, le source of truth `add-kyc-propositions.sql`
-- devrait aussi être mis à jour pour que les prochaines recréations
-- DB (nouveau projet, reset) partent d'une version correcte — c'est
-- fait dans le même commit côté repo.

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
  -- Check d'authentification (la SECURITY DEFINER by-passe la RLS, on
  -- se repose donc sur auth.uid() pour exclure les appels anonymes).
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  -- Chargement de la proposition + verrouillage anti-double-apply.
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

  -- Contrôle d'accès (cf. commentaire original add-kyc-propositions.sql).
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
      nom                    = CASE WHEN 'nom'                    = ANY(accepted_keys) THEN prop.proposed_data->>'nom'                    ELSE c.nom                    END,
      prenom                 = CASE WHEN 'prenom'                 = ANY(accepted_keys) THEN prop.proposed_data->>'prenom'                 ELSE c.prenom                 END,
      raison_sociale         = CASE WHEN 'raison_sociale'         = ANY(accepted_keys) THEN prop.proposed_data->>'raison_sociale'         ELSE c.raison_sociale         END,
      type_personne          = CASE WHEN 'type_personne'          = ANY(accepted_keys) THEN prop.proposed_data->>'type_personne'          ELSE c.type_personne          END,
      email                  = CASE WHEN 'email'                  = ANY(accepted_keys) THEN prop.proposed_data->>'email'                  ELSE c.email                  END,
      telephone              = CASE WHEN 'telephone'              = ANY(accepted_keys) THEN prop.proposed_data->>'telephone'              ELSE c.telephone              END,
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
      -- >>> FIX : colonne enfants_details est TEXT → on extrait en TEXT
      enfants_details        = CASE WHEN 'enfants_details'        = ANY(accepted_keys) THEN prop.proposed_data->>'enfants_details'        ELSE c.enfants_details        END,
      profession             = CASE WHEN 'profession'             = ANY(accepted_keys) THEN prop.proposed_data->>'profession'             ELSE c.profession             END,
      statut_professionnel   = CASE WHEN 'statut_professionnel'   = ANY(accepted_keys) THEN prop.proposed_data->>'statut_professionnel'   ELSE c.statut_professionnel   END,
      employeur              = CASE WHEN 'employeur'              = ANY(accepted_keys) THEN prop.proposed_data->>'employeur'              ELSE c.employeur              END,
      date_debut_emploi      = CASE WHEN 'date_debut_emploi'      = ANY(accepted_keys) THEN prop.proposed_data->>'date_debut_emploi'      ELSE c.date_debut_emploi     END,
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

  RETURN jsonb_build_object(
    'proposition_id', p_proposition_id,
    'status',         final_status,
    'applied',        COALESCE(array_length(accepted_keys, 1), 0),
    'rejected',       COALESCE(array_length(rejected_keys, 1), 0)
  );
END;
$$;

-- Note : aucun GRANT nécessaire (déjà accordé par le script initial).
--
-- Contrôle post-fix (à lancer côté admin pour valider) :
--   SELECT proname, pg_get_function_identity_arguments(oid)
--   FROM pg_proc WHERE proname = 'kyc_apply_proposition';
-- Doit renvoyer une seule ligne.
--
-- Pour repérer rapidement la version appliquée :
--   SELECT prosrc
--   FROM pg_proc
--   WHERE proname = 'kyc_apply_proposition'
--   AND prosrc LIKE '%>>''enfants_details''%';
-- Doit matcher (le nouveau code utilise ->>).
