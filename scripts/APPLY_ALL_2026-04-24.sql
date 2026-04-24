-- =========================================================================
-- Chantier corrections 2026-04-24 — script consolidé
-- Toutes les migrations des étapes 1→5 dans l'ordre, idempotent.
-- À coller en UNE SEULE FOIS dans Supabase SQL editor.
-- =========================================================================
-- Contenu :
--   Bloc A — Étape 1.6 : patrimoine professionnel
--   Bloc B — Étape 2.3 : statut_client (actif / non_abouti)
--   Bloc C — Étape 3.2 : consultant fictif POOL + v_dossiers_remunerations
--   Bloc D — Étape 4.1 : backfill date_entree_en_relation sur dossiers
--   Bloc E — Étape 4.4 : whitelist + apply RPC pour nom_jeune_fille
--                         et patrimoine_professionnel
--   Bloc F — Étape 5.5 + 5.6 : frais_entree/frais_encours + seed
--   Bloc G — Étape 5.1 : trigger commissions + backfill
--   Bloc H — Checkpoint : COUNTS de contrôle (à lire en fin d'exécution)
--
-- NON INCLUS (à jouer séparément, interactif) :
--   · scripts/diagnose-3-couples-2026-04-24.sql  (Étape 3.3, lecture seule)
--   · scripts/dissociate-3-couples-2026-04-24.sql (Étape 3.3, 1 couple à la fois)
--
-- Durée d'exécution estimée : < 10 s (même avec backfill sur ~200 dossiers).
-- =========================================================================

BEGIN;

-- =========================================================================
-- BLOC A — Étape 1.6 : patrimoine professionnel
-- =========================================================================
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS patrimoine_professionnel JSONB;

COMMENT ON COLUMN clients.patrimoine_professionnel IS
  'Patrimoine professionnel du client (JSONB array). Catégories : immo_pro / financier_pro. Sous-catégories : locaux, bfr, tresorerie, outils_machines, vehicule, autre. Ajouté 2026-04-24 (point 1.6).';

-- =========================================================================
-- BLOC B — Étape 2.3 : statut_client
-- =========================================================================
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS statut_client TEXT
  DEFAULT 'actif';

-- CHECK séparé pour être idempotent si la contrainte existe déjà.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_statut_client_chk'
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_statut_client_chk
      CHECK (statut_client IN ('actif', 'non_abouti'));
  END IF;
END $$;

COMMENT ON COLUMN clients.statut_client IS
  'Statut client : actif (défaut) ou non_abouti. Ajouté 2026-04-24 (point 2.3).';

UPDATE clients SET statut_client = 'actif' WHERE statut_client IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_statut_non_abouti
  ON clients (id)
  WHERE statut_client = 'non_abouti';

-- =========================================================================
-- BLOC C — Étape 3.2 : consultant fictif POOL
-- =========================================================================
-- Note : on n'utilise pas un UUID fixe "0…pl" (Postgres le tolère mais pas
-- toutes les libs clients). On insère via ON CONFLICT (email) DO NOTHING
-- pour être ré-entrant, et on retrouve l'id par prenom='POOL'.
INSERT INTO consultants (prenom, nom, email, role, taux_remuneration, zone, actif)
VALUES (
  'POOL', 'POOL', 'pool@private-equity-valley.com',
  'consultant', 0, NULL, true
)
ON CONFLICT (email) DO NOTHING;

-- Rattacher clients orphelins au POOL
UPDATE clients
SET    consultant_id = (SELECT id FROM consultants WHERE prenom = 'POOL' AND nom = 'POOL' LIMIT 1)
WHERE  consultant_id IS NULL
  AND  EXISTS (SELECT 1 FROM consultants WHERE prenom = 'POOL' AND nom = 'POOL');

-- Idem sur dossiers orphelins
UPDATE dossiers
SET    consultant_id = (SELECT id FROM consultants WHERE prenom = 'POOL' AND nom = 'POOL' LIMIT 1)
WHERE  consultant_id IS NULL
  AND  EXISTS (SELECT 1 FROM consultants WHERE prenom = 'POOL' AND nom = 'POOL');

-- Recréer v_dossiers_remunerations avec masking étendu à 'POOL'.
DROP VIEW IF EXISTS v_dossiers_remunerations;
CREATE VIEW v_dossiers_remunerations AS
SELECT
  id, client_id, statut, montant, financement, commentaire, date_operation,
  date_entree_en_relation, date_signature, mode_detention, apporteur_label,
  referent, has_apporteur_ext, apporteur_ext_nom, taux_apporteur_ext,
  apporteur_id, co_titulaire_id, co_titulaire_nom, co_titulaire_prenom,
  client_nom, client_prenom, client_pays, client_ville, client_email,
  client_telephone, statut_kyc, der, pi, preco, lm, rm,
  CASE
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs','POOL']::text[])) AND NOT is_manager()
    THEN 'Pool'::varchar ELSE consultant_nom
  END AS consultant_nom,
  CASE
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs','POOL']::text[])) AND NOT is_manager()
    THEN 'Pool'::varchar ELSE consultant_prenom
  END AS consultant_prenom,
  consultant_zone, taux_remuneration, produit_nom, produit_categorie,
  compagnie_nom, taux_commission, taux_gestion, commission_brute,
  CASE
    WHEN (consultant_prenom::text = ANY (ARRAY['Maxine','Thelo','Thélo','Théloïs','POOL']::text[])) AND NOT is_manager()
    THEN NULL::numeric ELSE rem_apporteur
  END AS rem_apporteur,
  rem_apporteur_ext, rem_support, part_cabinet, pct_cabinet,
  facturee, payee, date_facture
FROM v_dossiers_complets d;
ALTER VIEW v_dossiers_remunerations SET (security_invoker = true);

-- =========================================================================
-- BLOC D — Étape 4.1 : backfill date_entree_en_relation sur dossiers
-- =========================================================================
UPDATE dossiers d
SET date_entree_en_relation = c.date_entree_relation
FROM clients c
WHERE d.client_id = c.id
  AND d.date_entree_en_relation IS NULL
  AND c.date_entree_relation IS NOT NULL;

-- =========================================================================
-- BLOC F — Étapes 5.5 + 5.6 : frais_entree / frais_encours
-- (fait avant BLOC E car BLOC E référence frais_entree dans la RPC)
-- =========================================================================
ALTER TABLE taux_produit_compagnie
  ADD COLUMN IF NOT EXISTS frais_entree  NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS frais_encours NUMERIC NULL;

-- Override Cedrus (avant le seed générique)
UPDATE taux_produit_compagnie tpc
SET    frais_encours = 0.01
FROM   compagnies c, produits p
WHERE  tpc.compagnie_id = c.id
  AND  tpc.produit_id   = p.id
  AND  c.nom ILIKE '%cedrus%'
  AND  (p.nom ILIKE '%PE%' OR p.categorie ILIKE '%PE%' OR p.categorie ILIKE '%private equity%')
  AND  tpc.frais_encours IS NULL;

-- Seed générique par catégorie
UPDATE taux_produit_compagnie tpc
SET    frais_encours = CASE
  WHEN p.categorie ILIKE 'PE' OR p.categorie ILIKE '%private equity%' THEN 0.007
  WHEN p.categorie ILIKE '%CAV%' OR p.categorie ILIKE '%CAPI%'        THEN 0.01
  ELSE NULL
END
FROM   produits p
WHERE  tpc.produit_id = p.id
  AND  tpc.frais_encours IS NULL
  AND  (
        p.categorie ILIKE 'PE' OR p.categorie ILIKE '%private equity%'
     OR p.categorie ILIKE '%CAV%' OR p.categorie ILIKE '%CAPI%'
  );

-- Copie défensive taux → frais_entree
UPDATE taux_produit_compagnie
SET    frais_entree = taux
WHERE  frais_entree IS NULL AND taux IS NOT NULL;

-- =========================================================================
-- BLOC E — Étape 4.4 : whitelist nom_jeune_fille + patrimoine_professionnel
-- =========================================================================
CREATE OR REPLACE FUNCTION public._kyc_editable_fields()
RETURNS TEXT[] LANGUAGE SQL IMMUTABLE AS $$
  SELECT ARRAY[
    'nom', 'nom_jeune_fille', 'prenom', 'raison_sociale', 'type_personne',
    'email', 'telephone', 'titre',
    'date_naissance', 'lieu_naissance', 'nationalite',
    'adresse', 'code_postal', 'ville', 'pays',
    'residence_fiscale', 'nif', 'proprietaire_locataire',
    'montant_loyer',
    'situation_matrimoniale', 'regime_matrimonial',
    'nombre_enfants', 'enfants_details',
    'profession', 'statut_professionnel',
    'employeur', 'date_debut_emploi',
    'revenus_pro_net', 'revenus_fonciers', 'autres_revenus',
    'total_revenus_annuel',
    'impot_revenu_n', 'impot_revenu_n1', 'impot_revenu_n2',
    'patrimoine_immobilier', 'patrimoine_professionnel',
    'produits_financiers', 'patrimoine_divers', 'emprunts',
    'objectifs_client'
  ]::TEXT[];
$$;
REVOKE ALL ON FUNCTION public._kyc_editable_fields() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._kyc_editable_fields() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kyc_apply_proposition(
  p_proposition_id UUID, p_field_decisions JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prop RECORD; editable TEXT[]; k TEXT; decision TEXT;
  accepted_keys TEXT[] := ARRAY[]::TEXT[];
  rejected_keys TEXT[] := ARRAY[]::TEXT[];
  proposed_keys TEXT[]; final_status TEXT; target_client UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO prop FROM kyc_propositions WHERE id = p_proposition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposition not found'; END IF;
  IF prop.status <> 'pending' THEN RAISE EXCEPTION 'Proposition is not pending (status=%)', prop.status; END IF;
  target_client := prop.client_id;
  PERFORM 1 FROM clients WHERE id = target_client;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found'; END IF;

  editable := public._kyc_editable_fields();
  proposed_keys := ARRAY(SELECT jsonb_object_keys(prop.proposed_data));
  FOREACH k IN ARRAY proposed_keys LOOP
    IF NOT (k = ANY (editable)) THEN CONTINUE; END IF;
    decision := p_field_decisions ->> k;
    IF decision = 'accept' THEN accepted_keys := array_append(accepted_keys, k);
    ELSIF decision = 'reject' THEN rejected_keys := array_append(rejected_keys, k);
    ELSE RAISE EXCEPTION 'Missing decision for field %', k; END IF;
  END LOOP;

  IF array_length(accepted_keys, 1) > 0 THEN
    UPDATE clients c SET
      nom                      = CASE WHEN 'nom'                      = ANY(accepted_keys) THEN prop.proposed_data->>'nom'                      ELSE c.nom                      END,
      nom_jeune_fille          = CASE WHEN 'nom_jeune_fille'          = ANY(accepted_keys) THEN prop.proposed_data->>'nom_jeune_fille'          ELSE c.nom_jeune_fille          END,
      prenom                   = CASE WHEN 'prenom'                   = ANY(accepted_keys) THEN prop.proposed_data->>'prenom'                   ELSE c.prenom                   END,
      raison_sociale           = CASE WHEN 'raison_sociale'           = ANY(accepted_keys) THEN prop.proposed_data->>'raison_sociale'           ELSE c.raison_sociale           END,
      type_personne            = CASE WHEN 'type_personne'            = ANY(accepted_keys) THEN prop.proposed_data->>'type_personne'            ELSE c.type_personne            END,
      email                    = CASE WHEN 'email'                    = ANY(accepted_keys) THEN prop.proposed_data->>'email'                    ELSE c.email                    END,
      telephone                = CASE WHEN 'telephone'                = ANY(accepted_keys) THEN prop.proposed_data->>'telephone'                ELSE c.telephone                END,
      titre                    = CASE WHEN 'titre'                    = ANY(accepted_keys) THEN prop.proposed_data->>'titre'                    ELSE c.titre                    END,
      date_naissance           = CASE WHEN 'date_naissance'           = ANY(accepted_keys) THEN (prop.proposed_data->>'date_naissance')::DATE   ELSE c.date_naissance           END,
      lieu_naissance           = CASE WHEN 'lieu_naissance'           = ANY(accepted_keys) THEN prop.proposed_data->>'lieu_naissance'           ELSE c.lieu_naissance           END,
      nationalite              = CASE WHEN 'nationalite'              = ANY(accepted_keys) THEN prop.proposed_data->>'nationalite'              ELSE c.nationalite              END,
      adresse                  = CASE WHEN 'adresse'                  = ANY(accepted_keys) THEN prop.proposed_data->>'adresse'                  ELSE c.adresse                  END,
      code_postal              = CASE WHEN 'code_postal'              = ANY(accepted_keys) THEN prop.proposed_data->>'code_postal'              ELSE c.code_postal              END,
      ville                    = CASE WHEN 'ville'                    = ANY(accepted_keys) THEN prop.proposed_data->>'ville'                    ELSE c.ville                    END,
      pays                     = CASE WHEN 'pays'                     = ANY(accepted_keys) THEN prop.proposed_data->>'pays'                     ELSE c.pays                     END,
      residence_fiscale        = CASE WHEN 'residence_fiscale'        = ANY(accepted_keys) THEN prop.proposed_data->>'residence_fiscale'        ELSE c.residence_fiscale        END,
      nif                      = CASE WHEN 'nif'                      = ANY(accepted_keys) THEN prop.proposed_data->>'nif'                      ELSE c.nif                      END,
      proprietaire_locataire   = CASE WHEN 'proprietaire_locataire'   = ANY(accepted_keys) THEN prop.proposed_data->>'proprietaire_locataire'   ELSE c.proprietaire_locataire   END,
      montant_loyer            = CASE WHEN 'montant_loyer'            = ANY(accepted_keys) THEN (prop.proposed_data->>'montant_loyer')::NUMERIC ELSE c.montant_loyer            END,
      situation_matrimoniale   = CASE WHEN 'situation_matrimoniale'   = ANY(accepted_keys) THEN prop.proposed_data->>'situation_matrimoniale'   ELSE c.situation_matrimoniale   END,
      regime_matrimonial       = CASE WHEN 'regime_matrimonial'       = ANY(accepted_keys) THEN prop.proposed_data->>'regime_matrimonial'       ELSE c.regime_matrimonial       END,
      nombre_enfants           = CASE WHEN 'nombre_enfants'           = ANY(accepted_keys) THEN (prop.proposed_data->>'nombre_enfants')::INT    ELSE c.nombre_enfants           END,
      enfants_details          = CASE WHEN 'enfants_details'          = ANY(accepted_keys) THEN prop.proposed_data->>'enfants_details'          ELSE c.enfants_details          END,
      profession               = CASE WHEN 'profession'               = ANY(accepted_keys) THEN prop.proposed_data->>'profession'               ELSE c.profession               END,
      statut_professionnel     = CASE WHEN 'statut_professionnel'     = ANY(accepted_keys) THEN prop.proposed_data->>'statut_professionnel'     ELSE c.statut_professionnel     END,
      employeur                = CASE WHEN 'employeur'                = ANY(accepted_keys) THEN prop.proposed_data->>'employeur'                ELSE c.employeur                END,
      date_debut_emploi        = CASE WHEN 'date_debut_emploi'        = ANY(accepted_keys) THEN prop.proposed_data->>'date_debut_emploi'        ELSE c.date_debut_emploi        END,
      revenus_pro_net          = CASE WHEN 'revenus_pro_net'          = ANY(accepted_keys) THEN (prop.proposed_data->>'revenus_pro_net')::NUMERIC      ELSE c.revenus_pro_net          END,
      revenus_fonciers         = CASE WHEN 'revenus_fonciers'         = ANY(accepted_keys) THEN (prop.proposed_data->>'revenus_fonciers')::NUMERIC     ELSE c.revenus_fonciers         END,
      autres_revenus           = CASE WHEN 'autres_revenus'           = ANY(accepted_keys) THEN (prop.proposed_data->>'autres_revenus')::NUMERIC       ELSE c.autres_revenus           END,
      total_revenus_annuel     = CASE WHEN 'total_revenus_annuel'     = ANY(accepted_keys) THEN (prop.proposed_data->>'total_revenus_annuel')::NUMERIC ELSE c.total_revenus_annuel     END,
      impot_revenu_n           = CASE WHEN 'impot_revenu_n'           = ANY(accepted_keys) THEN (prop.proposed_data->>'impot_revenu_n')::NUMERIC       ELSE c.impot_revenu_n           END,
      impot_revenu_n1          = CASE WHEN 'impot_revenu_n1'          = ANY(accepted_keys) THEN (prop.proposed_data->>'impot_revenu_n1')::NUMERIC      ELSE c.impot_revenu_n1          END,
      impot_revenu_n2          = CASE WHEN 'impot_revenu_n2'          = ANY(accepted_keys) THEN (prop.proposed_data->>'impot_revenu_n2')::NUMERIC      ELSE c.impot_revenu_n2          END,
      patrimoine_immobilier    = CASE WHEN 'patrimoine_immobilier'    = ANY(accepted_keys) THEN prop.proposed_data->'patrimoine_immobilier'     ELSE c.patrimoine_immobilier    END,
      patrimoine_professionnel = CASE WHEN 'patrimoine_professionnel' = ANY(accepted_keys) THEN prop.proposed_data->'patrimoine_professionnel'  ELSE c.patrimoine_professionnel END,
      produits_financiers      = CASE WHEN 'produits_financiers'      = ANY(accepted_keys) THEN prop.proposed_data->'produits_financiers'       ELSE c.produits_financiers      END,
      patrimoine_divers        = CASE WHEN 'patrimoine_divers'        = ANY(accepted_keys) THEN prop.proposed_data->'patrimoine_divers'         ELSE c.patrimoine_divers        END,
      emprunts                 = CASE WHEN 'emprunts'                 = ANY(accepted_keys) THEN prop.proposed_data->'emprunts'                  ELSE c.emprunts                 END,
      objectifs_client         = CASE WHEN 'objectifs_client'         = ANY(accepted_keys) THEN prop.proposed_data->>'objectifs_client'         ELSE c.objectifs_client         END
    WHERE c.id = target_client;
  END IF;

  IF array_length(accepted_keys, 1) IS NULL AND array_length(rejected_keys, 1) > 0 THEN final_status := 'rejected';
  ELSIF array_length(rejected_keys, 1) > 0 THEN final_status := 'partially_applied';
  ELSE final_status := 'fully_applied'; END IF;

  UPDATE kyc_propositions
     SET field_decisions = p_field_decisions, status = final_status,
         reviewed_by = auth.uid(), reviewed_at = NOW(), updated_at = NOW()
   WHERE id = p_proposition_id;

  RETURN jsonb_build_object(
    'proposition_id', p_proposition_id, 'status', final_status,
    'applied', COALESCE(array_length(accepted_keys, 1), 0),
    'rejected', COALESCE(array_length(rejected_keys, 1), 0)
  );
END;
$$;

-- =========================================================================
-- BLOC G — Étape 5.1 : trigger commissions auto + backfill
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fn_init_commissions_for_dossier()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_taux NUMERIC; v_categorie TEXT; v_brute NUMERIC; v_default NUMERIC;
BEGIN
  IF NEW.taux_produit_compagnie_id IS NOT NULL THEN
    SELECT COALESCE(tpc.frais_entree, tpc.taux) INTO v_taux
      FROM taux_produit_compagnie tpc
     WHERE tpc.id = NEW.taux_produit_compagnie_id
       AND COALESCE(tpc.actif, true) = true LIMIT 1;
  END IF;

  IF v_taux IS NULL AND NEW.produit_id IS NOT NULL AND NEW.compagnie_id IS NOT NULL THEN
    SELECT COALESCE(tpc.frais_entree, tpc.taux) INTO v_taux
      FROM taux_produit_compagnie tpc
     WHERE tpc.produit_id = NEW.produit_id
       AND tpc.compagnie_id = NEW.compagnie_id
       AND COALESCE(tpc.actif, true) = true
     ORDER BY tpc.taux DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_taux IS NULL AND NEW.produit_id IS NOT NULL THEN
    SELECT p.categorie INTO v_categorie FROM produits p WHERE p.id = NEW.produit_id LIMIT 1;
    v_default := CASE
      WHEN v_categorie ILIKE 'SCPI' THEN 0.06
      WHEN v_categorie ILIKE 'PE' OR v_categorie ILIKE '%private equity%' THEN 0.03
      WHEN v_categorie ILIKE '%CAV%' OR v_categorie ILIKE '%CAPI%' THEN 0.01
      ELSE NULL END;
    v_taux := v_default;
  END IF;

  v_brute := COALESCE(NEW.montant, 0) * COALESCE(v_taux, 0);

  INSERT INTO commissions (dossier_id, taux_commission, commission_brute, calculated_at)
  VALUES (NEW.id, v_taux, v_brute, NOW())
  ON CONFLICT (dossier_id) DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_init_commissions_for_dossier() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_init_commissions_for_dossier() TO authenticated;

DROP TRIGGER IF EXISTS trg_dossiers_init_commissions ON dossiers;
CREATE TRIGGER trg_dossiers_init_commissions
  AFTER INSERT ON dossiers FOR EACH ROW
  EXECUTE FUNCTION public.fn_init_commissions_for_dossier();

-- Backfill des dossiers historiques sans commissions
INSERT INTO commissions (dossier_id, taux_commission, commission_brute, calculated_at)
SELECT
  d.id,
  COALESCE(
    (SELECT COALESCE(tpc.frais_entree, tpc.taux) FROM taux_produit_compagnie tpc
     WHERE tpc.id = d.taux_produit_compagnie_id AND COALESCE(tpc.actif, true) = true LIMIT 1),
    (SELECT COALESCE(tpc.frais_entree, tpc.taux) FROM taux_produit_compagnie tpc
     WHERE tpc.produit_id = d.produit_id AND tpc.compagnie_id = d.compagnie_id
       AND COALESCE(tpc.actif, true) = true ORDER BY tpc.taux DESC NULLS LAST LIMIT 1),
    CASE
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE 'SCPI' THEN 0.06
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE 'PE' THEN 0.03
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE '%private equity%' THEN 0.03
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE '%CAV%' THEN 0.01
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE '%CAPI%' THEN 0.01
      ELSE NULL END
  ),
  COALESCE(d.montant, 0) * COALESCE(
    (SELECT COALESCE(tpc.frais_entree, tpc.taux) FROM taux_produit_compagnie tpc
     WHERE tpc.id = d.taux_produit_compagnie_id AND COALESCE(tpc.actif, true) = true LIMIT 1),
    (SELECT COALESCE(tpc.frais_entree, tpc.taux) FROM taux_produit_compagnie tpc
     WHERE tpc.produit_id = d.produit_id AND tpc.compagnie_id = d.compagnie_id
       AND COALESCE(tpc.actif, true) = true ORDER BY tpc.taux DESC NULLS LAST LIMIT 1),
    CASE
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE 'SCPI' THEN 0.06
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE 'PE' THEN 0.03
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE '%private equity%' THEN 0.03
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE '%CAV%' THEN 0.01
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE '%CAPI%' THEN 0.01
      ELSE 0 END
  ),
  NOW()
FROM dossiers d
LEFT JOIN commissions c ON c.dossier_id = d.id
WHERE c.dossier_id IS NULL;

COMMIT;

-- =========================================================================
-- BLOC H — Checkpoint final (read-only, lire les résultats)
-- =========================================================================
-- À scroller en bas du résultat pour validation.

SELECT 'Étape 1.6 — patrimoine_professionnel' AS check_name,
       COUNT(*) FILTER (WHERE column_name = 'patrimoine_professionnel') AS ok
FROM information_schema.columns WHERE table_name = 'clients'
UNION ALL
SELECT 'Étape 2.3 — statut_client',
       COUNT(*) FILTER (WHERE column_name = 'statut_client')
FROM information_schema.columns WHERE table_name = 'clients'
UNION ALL
SELECT 'Étape 3.2 — consultant POOL',
       (SELECT COUNT(*)::INT FROM consultants WHERE prenom = 'POOL')
UNION ALL
SELECT 'Étape 3.2 — clients orphelins restants (doit être 0)',
       (SELECT COUNT(*)::INT FROM clients WHERE consultant_id IS NULL)
UNION ALL
SELECT 'Étape 4.1 — dossiers sans date_entree_en_relation (peut être >0 si client NULL aussi)',
       (SELECT COUNT(*)::INT FROM dossiers d LEFT JOIN clients c ON c.id = d.client_id
        WHERE d.date_entree_en_relation IS NULL AND c.date_entree_relation IS NOT NULL)
UNION ALL
SELECT 'Étape 4.4 — nom_jeune_fille dans _kyc_editable_fields()',
       (SELECT COUNT(*)::INT FROM unnest(public._kyc_editable_fields()) AS k WHERE k = 'nom_jeune_fille')
UNION ALL
SELECT 'Étape 5.5 — couples PE/CAV/CAPI sans frais_encours (doit être 0)',
       (SELECT COUNT(*)::INT FROM taux_produit_compagnie tpc
        JOIN produits p ON p.id = tpc.produit_id
        WHERE COALESCE(tpc.actif, true) = true
          AND (p.categorie ILIKE 'PE' OR p.categorie ILIKE '%private equity%'
            OR p.categorie ILIKE '%CAV%' OR p.categorie ILIKE '%CAPI%')
          AND tpc.frais_encours IS NULL)
UNION ALL
SELECT 'Étape 5.1 — dossiers sans commissions (doit être 0)',
       (SELECT COUNT(*)::INT FROM dossiers d
        LEFT JOIN commissions c ON c.dossier_id = d.id
        WHERE c.dossier_id IS NULL)
UNION ALL
SELECT 'Étape 5.1 — trigger trg_dossiers_init_commissions installé',
       (SELECT COUNT(*)::INT FROM pg_trigger
        WHERE tgname = 'trg_dossiers_init_commissions');
-- Attendu : ok >= 1 pour toutes les lignes "installé" et ok = 0 pour les lignes
-- "restants" / "sans". Si une ligne est rouge, me pinger avec le nom du check.

-- =========================================================================
-- FIN.
-- =========================================================================
-- Prochaines étapes post-exécution :
--   1. Régénérer les types :
--      npx supabase gen types typescript --project-id <id> > src/types/database.ts
--   2. Commit + push le code (branche feat/corrections-2026-04-24).
--   3. Jouer scripts/diagnose-3-couples-2026-04-24.sql pour récupérer
--      les UUID, puis dissocier 1 couple à la fois via
--      scripts/dissociate-3-couples-2026-04-24.sql.
-- =========================================================================
