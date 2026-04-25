-- =====================================================================
-- Migration : workflow KYC bidirectionnel (propositions client →
--             validation consultant → application).
-- Date        : 2026-04-22
-- Chantier    : #4 du CDC Maxine 2026-04-21.
-- Contexte    : aujourd'hui /kyc/[token] est en LECTURE SEULE + bouton
--               Signer. Objectif : que le client puisse modifier TOUT le
--               KYC (même les champs pré-remplis par le consultant),
--               signer, et que les modifications atterrissent dans une
--               table `kyc_propositions` en `pending` — le consultant
--               accepte/refuse champ par champ avant application dans
--               `clients`.
-- Prérequis   : add-kyc-link-flow.sql déjà appliqué (colonne kyc_token).
-- Idempotent  : OUI.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table kyc_propositions
-- ---------------------------------------------------------------------
-- Stocke la soumission complète du client (jsonb) + le snapshot de l'état
-- CRM au moment de la soumission (pour le diff côté consultant). La RLS
-- s'appuie sur l'accès au client parent : un consultant qui peut lire
-- clients.id peut lire/écrire les propositions liées.
--
-- Choix JSONB (et non colonnes-par-colonne) :
--   - réduit le nombre d'ALTER TABLE quand de nouveaux champs KYC
--     apparaissent (le KYC évolue régulièrement)
--   - permet de stocker aussi les champs JSONB complexes
--     (patrimoine_immobilier, emprunts, …) sans sérialisation
--   - le jour où on veut un audit fin, `original_snapshot` + `proposed_data`
--     suffisent à reconstituer le diff
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kyc_propositions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_used         TEXT        NOT NULL,

  -- snapshot de clients.* au moment où le client a cliqué "Soumettre"
  -- (permet de détecter un diff CRM ↔ proposition indépendamment de
  -- mutations ultérieures côté consultant).
  original_snapshot  JSONB       NOT NULL,

  -- données proposées par le client (même forme que original_snapshot).
  proposed_data      JSONB       NOT NULL,

  -- décisions par champ : { "nom": "accept", "telephone": "reject", ... }
  -- Peuplé progressivement par le consultant. Absent de la row à la
  -- soumission.
  field_decisions    JSONB       NOT NULL DEFAULT '{}'::jsonb,

  status             TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending',
                                                   'partially_applied',
                                                   'fully_applied',
                                                   'rejected')),

  -- signature par le client à la soumission (obligatoire avant submit).
  signer_name        TEXT,
  signer_ip          TEXT,
  signed_at          TIMESTAMPTZ,
  completion_rate    SMALLINT    CHECK (completion_rate IS NULL
                                        OR (completion_rate >= 0
                                            AND completion_rate <= 100)),
  missing_fields     JSONB,
  consent_accuracy   BOOLEAN     NOT NULL DEFAULT FALSE,
  consent_incomplete BOOLEAN     NOT NULL DEFAULT FALSE,

  -- review consultant.
  reviewed_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,

  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Une seule proposition `pending` par client à la fois (question #2 de
-- l'arbitrage Maxine 2026-04-22). Index partiel unique = contrainte
-- propre sans empêcher plusieurs propositions historiques close sur le
-- même client.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_propositions_one_pending_per_client
  ON kyc_propositions (client_id)
  WHERE status = 'pending';

-- Index pour le dashboard consultant "propositions à traiter".
CREATE INDEX IF NOT EXISTS idx_kyc_propositions_pending_submitted
  ON kyc_propositions (submitted_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_kyc_propositions_client
  ON kyc_propositions (client_id, submitted_at DESC);

-- ---------------------------------------------------------------------
-- 2. RLS : un consultant voit les propositions des clients qu'il peut
--    déjà lire. On réutilise la logique RLS de clients via EXISTS.
--    Les RPC SECURITY DEFINER ci-dessous bypass ces policies.
-- ---------------------------------------------------------------------
ALTER TABLE kyc_propositions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kyc_propositions_select_via_client
  ON kyc_propositions;
CREATE POLICY kyc_propositions_select_via_client
  ON kyc_propositions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = kyc_propositions.client_id
  ));

-- Pas de policy INSERT/UPDATE/DELETE côté authenticated : toutes les
-- mutations passent par les RPC SECURITY DEFINER pour garantir
-- l'audit + les invariants (signature, field whitelist, etc.).

-- ---------------------------------------------------------------------
-- 3. Liste blanche des champs du client que la proposition peut modifier.
--    Sécurité : même si le JSONB `proposed_data` contient des clés en
--    dehors de cette liste (attaque ou bug client), `kyc_apply_proposition`
--    les ignore silencieusement.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._kyc_editable_fields()
RETURNS TEXT[]
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT ARRAY[
    -- identité
    'nom', 'prenom', 'raison_sociale', 'type_personne',
    'email', 'telephone', 'titre',
    'date_naissance', 'lieu_naissance', 'nationalite',
    -- adresse / fiscal
    'adresse', 'ville', 'pays',
    'residence_fiscale', 'nif', 'proprietaire_locataire',
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
    'patrimoine_immobilier', 'produits_financiers',
    'patrimoine_divers', 'emprunts',
    -- objectifs
    'objectifs_client'
  ]::TEXT[];
$$;

REVOKE ALL ON FUNCTION public._kyc_editable_fields() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._kyc_editable_fields() TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC : soumettre une proposition (PUBLIC, via token)
--    Combine la soumission + la signature : le client ne peut pas
--    soumettre sans signer (question #1 de l'arbitrage Maxine).
--    Refuse si une proposition `pending` existe déjà (question #2).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kyc_submit_proposition_by_token(
  p_token              TEXT,
  p_proposed_data      JSONB,
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
  target_client_id UUID;
  snapshot JSONB;
  new_id UUID;
  existing_pending UUID;
BEGIN
  -- --- validations de base ---
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
  IF p_proposed_data IS NULL OR jsonb_typeof(p_proposed_data) <> 'object' THEN
    RAISE EXCEPTION 'proposed_data must be a JSON object';
  END IF;

  -- --- résolution du client via le token ---
  SELECT id INTO target_client_id
  FROM   clients
  WHERE  kyc_token = p_token
  LIMIT  1;

  IF target_client_id IS NULL THEN
    RAISE EXCEPTION 'Token not found';
  END IF;

  -- --- invariant : max 1 proposition pending par client ---
  SELECT id INTO existing_pending
  FROM   kyc_propositions
  WHERE  client_id = target_client_id
    AND  status = 'pending'
  LIMIT  1;

  IF existing_pending IS NOT NULL THEN
    RAISE EXCEPTION 'A pending proposition already exists for this client (id=%)', existing_pending;
  END IF;

  -- --- snapshot de l'état CRM actuel ---
  -- On ne capture que les champs éditables, pour limiter la taille et
  -- faciliter le diff côté UI.
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'nom', c.nom,
           'prenom', c.prenom,
           'raison_sociale', c.raison_sociale,
           'type_personne', c.type_personne,
           'email', c.email,
           'telephone', c.telephone,
           'titre', c.titre,
           'date_naissance', c.date_naissance,
           'lieu_naissance', c.lieu_naissance,
           'nationalite', c.nationalite,
           'adresse', c.adresse,
           'ville', c.ville,
           'pays', c.pays,
           'residence_fiscale', c.residence_fiscale,
           'nif', c.nif,
           'proprietaire_locataire', c.proprietaire_locataire,
           'situation_matrimoniale', c.situation_matrimoniale,
           'regime_matrimonial', c.regime_matrimonial,
           'nombre_enfants', c.nombre_enfants,
           'enfants_details', c.enfants_details,
           'profession', c.profession,
           'statut_professionnel', c.statut_professionnel,
           'employeur', c.employeur,
           'date_debut_emploi', c.date_debut_emploi,
           'revenus_pro_net', c.revenus_pro_net,
           'revenus_fonciers', c.revenus_fonciers,
           'autres_revenus', c.autres_revenus,
           'total_revenus_annuel', c.total_revenus_annuel,
           'impot_revenu_n', c.impot_revenu_n,
           'impot_revenu_n1', c.impot_revenu_n1,
           'impot_revenu_n2', c.impot_revenu_n2,
           'patrimoine_immobilier', c.patrimoine_immobilier,
           'produits_financiers', c.produits_financiers,
           'patrimoine_divers', c.patrimoine_divers,
           'emprunts', c.emprunts,
           'objectifs_client', c.objectifs_client
         )) INTO snapshot
  FROM   clients c
  WHERE  c.id = target_client_id;

  -- --- insertion ---
  INSERT INTO kyc_propositions (
    client_id, token_used, original_snapshot, proposed_data,
    signer_name, signer_ip, signed_at,
    completion_rate, missing_fields,
    consent_accuracy, consent_incomplete,
    status, submitted_at, updated_at
  ) VALUES (
    target_client_id,
    p_token,
    snapshot,
    p_proposed_data,
    trim(p_signer_name),
    p_signer_ip,
    NOW(),
    p_completion_rate,
    p_missing_fields,
    COALESCE(p_consent_accuracy, FALSE),
    COALESCE(p_consent_incomplete, FALSE),
    'pending',
    NOW(),
    NOW()
  )
  RETURNING id INTO new_id;

  -- Marquer l'ouverture comme confirmée (idempotent).
  UPDATE clients
     SET kyc_opened_at = COALESCE(kyc_opened_at, NOW())
   WHERE id = target_client_id;

  RETURN jsonb_build_object(
    'proposition_id', new_id,
    'client_id',      target_client_id,
    'submitted_at',   NOW()
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.kyc_submit_proposition_by_token(
  TEXT, JSONB, TEXT, SMALLINT, JSONB, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kyc_submit_proposition_by_token(
  TEXT, JSONB, TEXT, SMALLINT, JSONB, BOOLEAN, BOOLEAN, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC : lire les propositions pending (consultant authentifié)
--    Retourne la liste des propositions en attente pour tout client
--    accessible (la RLS sur clients fait le filtre implicite via
--    l'EXISTS de la policy).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kyc_list_pending_propositions(
  p_client_id UUID DEFAULT NULL
)
RETURNS SETOF kyc_propositions
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
    SELECT kp.*
    FROM   kyc_propositions kp
    WHERE  kp.status = 'pending'
      AND  (p_client_id IS NULL OR kp.client_id = p_client_id)
    ORDER  BY kp.submitted_at DESC;
END;
$$;

REVOKE ALL  ON FUNCTION public.kyc_list_pending_propositions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kyc_list_pending_propositions(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. RPC : appliquer une proposition (consultant authentifié)
--    - field_decisions : { "nom": "accept", "telephone": "reject", ... }
--    - applique uniquement les champs marqués 'accept' ET présents dans
--      la liste blanche `_kyc_editable_fields`.
--    - statut final :
--        - fully_applied    : tous les champs proposés sont 'accept'
--        - partially_applied: au moins un 'reject'
--        - rejected         : tous les champs 'reject' (aucun merge)
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
  prop          RECORD;
  target_client UUID;
  editable      TEXT[] := public._kyc_editable_fields();
  accepted_keys TEXT[] := ARRAY[]::TEXT[];
  rejected_keys TEXT[] := ARRAY[]::TEXT[];
  proposed_keys TEXT[];
  k             TEXT;
  decision      TEXT;
  final_status  TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_field_decisions IS NULL OR jsonb_typeof(p_field_decisions) <> 'object' THEN
    RAISE EXCEPTION 'field_decisions must be a JSON object';
  END IF;

  SELECT * INTO prop FROM kyc_propositions WHERE id = p_proposition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposition not found';
  END IF;
  IF prop.status <> 'pending' THEN
    RAISE EXCEPTION 'Proposition is not pending (status=%)', prop.status;
  END IF;

  target_client := prop.client_id;

  -- Contrôle d'accès : la fonction est SECURITY DEFINER (elle doit pouvoir
  -- écrire dans `clients` sans subir RLS). On se repose donc sur :
  --   1. GRANT EXECUTE TO authenticated (exclut les anonymes),
  --   2. auth.uid() IS NOT NULL vérifié plus haut,
  --   3. le fait que tous les consultants PEV actuels partagent l'accès
  --      à tous les clients (RLS lecture = EXISTS FROM clients).
  -- Si plus tard on introduit une RLS clients par portefeuille (p.ex.
  -- consultant_id FK), cette RPC devra vérifier explicitement
  -- l'appartenance via une jointure clients/user_profiles.
  PERFORM 1 FROM clients WHERE id = target_client;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  -- Itérer sur les clés proposées pour partitionner accept/reject.
  proposed_keys := ARRAY(SELECT jsonb_object_keys(prop.proposed_data));
  FOREACH k IN ARRAY proposed_keys LOOP
    IF NOT (k = ANY (editable)) THEN
      CONTINUE; -- clé non whitelistée : ignorée silencieusement
    END IF;
    decision := p_field_decisions ->> k;
    IF decision = 'accept' THEN
      accepted_keys := array_append(accepted_keys, k);
    ELSIF decision = 'reject' THEN
      rejected_keys := array_append(rejected_keys, k);
    ELSE
      -- pas de décision sur ce champ : on refuse d'appliquer partiellement,
      -- le consultant doit se prononcer sur chaque champ modifié.
      RAISE EXCEPTION 'Missing decision for field %', k;
    END IF;
  END LOOP;

  -- Appliquer les accept. On utilise un UPDATE explicite par colonne pour
  -- rester strict sur le typage (les champs numériques doivent être castés
  -- depuis JSONB, les champs JSONB restent JSONB, etc.).
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
      -- 2026-04-25 : la colonne `enfants_details` est désormais JSONB
      -- (sous-fiches enfants structurées — migration
      -- migrate-enfants-details-to-jsonb.sql). On revient à `->` (JSONB)
      -- côté droit du CASE pour conserver la cohérence des types. Le fix
      -- TEXT du 2026-04-21 (fix-apply-proposition-enfants-details.sql) est
      -- caduc à partir de cette migration.
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

  -- Statut final.
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

  -- Après application, on reporte la signature client sur clients
  -- UNIQUEMENT si la proposition est fully_applied : sinon le KYC stocké
  -- dans clients ne correspond pas exactement au document signé.
  IF final_status = 'fully_applied' THEN
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
      AND  c.kyc_signed_at IS NULL; -- n'écrase jamais une signature pré-existante
  END IF;

  RETURN jsonb_build_object(
    'proposition_id', p_proposition_id,
    'status',         final_status,
    'applied',        COALESCE(array_length(accepted_keys, 1), 0),
    'rejected',       COALESCE(array_length(rejected_keys, 1), 0)
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.kyc_apply_proposition(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kyc_apply_proposition(UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. RPC : lire la proposition pending depuis le token (PUBLIC)
--    Permet à la page /kyc/[token] d'afficher "soumission reçue, en
--    attente de validation par votre consultant" quand une proposition
--    pending existe déjà (question #2 de l'arbitrage Maxine).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kyc_pending_proposition_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
           'id',           kp.id,
           'status',       kp.status,
           'submitted_at', kp.submitted_at,
           'signer_name',  kp.signer_name,
           'signed_at',    kp.signed_at
         ) INTO result
  FROM   kyc_propositions kp
  JOIN   clients c ON c.id = kp.client_id
  WHERE  c.kyc_token = p_token
    AND  kp.status = 'pending'
  ORDER  BY kp.submitted_at DESC
  LIMIT  1;

  RETURN result;
END;
$$;

REVOKE ALL  ON FUNCTION public.kyc_pending_proposition_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kyc_pending_proposition_by_token(TEXT) TO anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------
-- Smoke tests (à lancer à la main après migration) :
--
-- -- 1. Structure
-- \d kyc_propositions
--
-- -- 2. Liste blanche
-- SELECT unnest(public._kyc_editable_fields());
--
-- -- 3. Un client de test, on simule une submission
-- SELECT public.kyc_submit_proposition_by_token(
--   (SELECT kyc_token FROM clients WHERE kyc_token IS NOT NULL LIMIT 1),
--   '{"email": "test@example.com", "telephone": "+33 6 12 34 56 78"}'::jsonb,
--   'Jean Dupont', 80, '["profession"]'::jsonb, true, true, '127.0.0.1'
-- );
--
-- -- 4. Doublon bloqué
-- SELECT public.kyc_submit_proposition_by_token( ... même token ... );
-- -- doit raise 'A pending proposition already exists'
--
-- -- 5. Validation partielle
-- SELECT public.kyc_apply_proposition(
--   '<uuid de la proposition>',
--   '{"email": "accept", "telephone": "reject"}'::jsonb
-- );
--
-- -- 6. Cleanup
-- DELETE FROM kyc_propositions WHERE signer_name = 'Jean Dupont';
-- ---------------------------------------------------------------------
