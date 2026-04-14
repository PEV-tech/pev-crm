-- =====================================================
-- P4 ENCAISSEMENTS AUTO: Auto-create encaissement +
-- rémunération ventilation when facture is marked payée
-- Date: 2026-04-14
-- =====================================================

-- =====================================================
-- #1 — Table encaissements: stores full ventilation
-- =====================================================
CREATE TABLE IF NOT EXISTS encaissements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL UNIQUE REFERENCES dossiers(id) ON DELETE CASCADE,
  date_encaissement DATE NOT NULL DEFAULT CURRENT_DATE,
  mois TEXT NOT NULL, -- 'JANVIER', 'FEVRIER', etc.
  annee INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),

  -- Identification
  label TEXT, -- "Prénom Nom — Produit"
  client_nom TEXT,
  client_prenom TEXT,
  client_pays TEXT,
  produit_nom TEXT,
  compagnie_nom TEXT,
  montant_dossier NUMERIC(15,2) DEFAULT 0,

  -- Consultant
  consultant_id UUID REFERENCES consultants(id),
  consultant_nom TEXT,
  consultant_prenom TEXT,

  -- Apporteur externe
  apporteur_ext_nom TEXT,
  apporteur_id UUID,
  taux_apporteur_ext NUMERIC(10,5) DEFAULT 0,

  -- Ventilation des commissions
  commission_brute NUMERIC(15,2) DEFAULT 0,         -- Montant total commission
  rem_apporteur_ext NUMERIC(15,2) DEFAULT 0,        -- Part apporteur externe
  commission_nette NUMERIC(15,2) DEFAULT 0,          -- commission_brute - rem_apporteur_ext
  rem_consultant NUMERIC(15,2) DEFAULT 0,            -- Part consultant (rem_apporteur)
  part_cabinet NUMERIC(15,2) DEFAULT 0,              -- Part cabinet

  -- Ventilation pool (commission_nette - rem_consultant - part_cabinet)
  pool_total NUMERIC(15,2) DEFAULT 0,
  part_maxine NUMERIC(15,2) DEFAULT 0,               -- 1/3 du pool
  part_thelo NUMERIC(15,2) DEFAULT 0,                -- 1/3 du pool
  part_pool_plus NUMERIC(15,2) DEFAULT 0,            -- 1/3 du pool

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_encaissements_dossier ON encaissements(dossier_id);
CREATE INDEX IF NOT EXISTS idx_encaissements_mois ON encaissements(annee, mois);
CREATE INDEX IF NOT EXISTS idx_encaissements_consultant ON encaissements(consultant_id);

-- =====================================================
-- #2 — Trigger function: auto-create encaissement
-- Fires when factures.payee changes to 'oui'
-- =====================================================
CREATE OR REPLACE FUNCTION fn_create_encaissement()
RETURNS TRIGGER AS $$
DECLARE
  v_dossier RECORD;
  v_commission RECORD;
  v_client RECORD;
  v_consultant RECORD;
  v_produit RECORD;
  v_compagnie RECORD;
  v_month_names TEXT[] := ARRAY['JANVIER','FEVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOUT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DECEMBRE'];
  v_mois TEXT;
  v_annee INTEGER;
  v_label TEXT;
  v_comm_brute NUMERIC;
  v_rem_apporteur_ext NUMERIC;
  v_comm_nette NUMERIC;
  v_rem_consultant NUMERIC;
  v_part_cabinet NUMERIC;
  v_pool_total NUMERIC;
  v_pool_third NUMERIC;
BEGIN
  -- Only trigger when payee changes to 'oui'
  IF NEW.payee <> 'oui' THEN
    RETURN NEW;
  END IF;

  -- If old value was already 'oui', skip (idempotent)
  IF OLD IS NOT NULL AND OLD.payee = 'oui' THEN
    RETURN NEW;
  END IF;

  -- Fetch dossier data
  SELECT * INTO v_dossier FROM dossiers WHERE id = NEW.dossier_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Fetch commission data
  SELECT * INTO v_commission FROM commissions WHERE dossier_id = NEW.dossier_id;

  -- Fetch client
  SELECT * INTO v_client FROM clients WHERE id = v_dossier.client_id;

  -- Fetch consultant
  SELECT * INTO v_consultant FROM consultants WHERE id = v_dossier.consultant_id;

  -- Fetch produit
  SELECT nom INTO v_produit FROM produits WHERE id = v_dossier.produit_id;

  -- Fetch compagnie
  SELECT nom INTO v_compagnie FROM compagnies WHERE id = v_dossier.compagnie_id;

  -- Compute month from payment date
  v_mois := v_month_names[EXTRACT(MONTH FROM COALESCE(NEW.date_paiement, CURRENT_DATE))::INTEGER];
  v_annee := EXTRACT(YEAR FROM COALESCE(NEW.date_paiement, CURRENT_DATE))::INTEGER;

  -- Build label
  v_label := COALESCE(v_client.prenom, '') || ' ' || COALESCE(v_client.nom, '');
  v_label := TRIM(v_label);
  IF v_produit.nom IS NOT NULL THEN
    v_label := v_label || ' — ' || v_produit.nom;
  END IF;

  -- Compute ventilation
  v_comm_brute := COALESCE(v_commission.commission_brute, 0);
  v_rem_apporteur_ext := COALESCE(v_commission.rem_apporteur_ext, 0);
  v_comm_nette := v_comm_brute - v_rem_apporteur_ext;
  v_rem_consultant := COALESCE(v_commission.rem_apporteur, 0);
  v_part_cabinet := COALESCE(v_commission.part_cabinet, 0);

  -- Pool = what remains after consultant + cabinet from net commission
  v_pool_total := GREATEST(0, v_comm_nette - v_rem_consultant - v_part_cabinet);
  v_pool_third := ROUND(v_pool_total / 3, 2);

  -- Upsert encaissement (in case re-triggered)
  INSERT INTO encaissements (
    dossier_id, date_encaissement, mois, annee,
    label, client_nom, client_prenom, client_pays,
    produit_nom, compagnie_nom, montant_dossier,
    consultant_id, consultant_nom, consultant_prenom,
    apporteur_ext_nom, apporteur_id, taux_apporteur_ext,
    commission_brute, rem_apporteur_ext, commission_nette,
    rem_consultant, part_cabinet,
    pool_total, part_maxine, part_thelo, part_pool_plus
  ) VALUES (
    NEW.dossier_id,
    COALESCE(NEW.date_paiement, CURRENT_DATE),
    v_mois, v_annee,
    v_label,
    v_client.nom, v_client.prenom, v_client.pays,
    v_produit.nom, v_compagnie.nom,
    COALESCE(v_dossier.montant, 0),
    v_dossier.consultant_id,
    v_consultant.nom, v_consultant.prenom,
    v_dossier.apporteur_ext_nom,
    v_dossier.apporteur_id,
    COALESCE(v_dossier.taux_apporteur_ext, 0),
    v_comm_brute, v_rem_apporteur_ext, v_comm_nette,
    v_rem_consultant, v_part_cabinet,
    v_pool_total, v_pool_third, v_pool_third, v_pool_third
  )
  ON CONFLICT (dossier_id) DO UPDATE SET
    date_encaissement = EXCLUDED.date_encaissement,
    mois = EXCLUDED.mois,
    annee = EXCLUDED.annee,
    label = EXCLUDED.label,
    commission_brute = EXCLUDED.commission_brute,
    rem_apporteur_ext = EXCLUDED.rem_apporteur_ext,
    commission_nette = EXCLUDED.commission_nette,
    rem_consultant = EXCLUDED.rem_consultant,
    part_cabinet = EXCLUDED.part_cabinet,
    pool_total = EXCLUDED.pool_total,
    part_maxine = EXCLUDED.part_maxine,
    part_thelo = EXCLUDED.part_thelo,
    part_pool_plus = EXCLUDED.part_pool_plus;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- #3 — Attach trigger to factures table
-- =====================================================
DROP TRIGGER IF EXISTS trg_create_encaissement ON factures;

CREATE TRIGGER trg_create_encaissement
  AFTER INSERT OR UPDATE OF payee ON factures
  FOR EACH ROW
  WHEN (NEW.payee = 'oui')
  EXECUTE FUNCTION fn_create_encaissement();

-- =====================================================
-- #4 — RLS policies on encaissements table
-- =====================================================
ALTER TABLE encaissements ENABLE ROW LEVEL SECURITY;

-- Managers and back_office can see all encaissements
CREATE POLICY encaissements_manager_select ON encaissements
  FOR SELECT
  TO authenticated
  USING (is_manager() OR is_back_office());

-- Consultants can only see their own encaissements
CREATE POLICY encaissements_consultant_select ON encaissements
  FOR SELECT
  TO authenticated
  USING (
    consultant_id = (
      SELECT id FROM consultants
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
  );

-- Only the trigger function (SECURITY DEFINER) can insert/update
-- No direct INSERT/UPDATE/DELETE for regular users
CREATE POLICY encaissements_no_direct_write ON encaissements
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- =====================================================
-- #5 — Backfill: create encaissements for already-paid factures
-- =====================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT f.dossier_id, f.date_paiement
    FROM factures f
    WHERE f.payee = 'oui'
    AND NOT EXISTS (SELECT 1 FROM encaissements e WHERE e.dossier_id = f.dossier_id)
  LOOP
    -- Simulate trigger by updating facture to re-trigger
    UPDATE factures SET payee = 'oui' WHERE dossier_id = r.dossier_id;
  END LOOP;
END $$;

-- =====================================================
-- #6 — View for encaissements with role-based masking
-- =====================================================
CREATE OR REPLACE VIEW v_encaissements AS
SELECT
  e.*,
  CASE
    WHEN is_manager() THEN e.part_maxine
    ELSE NULL
  END AS visible_part_maxine,
  CASE
    WHEN is_manager() THEN e.part_thelo
    ELSE NULL
  END AS visible_part_thelo,
  CASE
    WHEN is_manager() THEN e.part_pool_plus
    ELSE NULL
  END AS visible_part_pool_plus,
  CASE
    WHEN is_manager() THEN e.pool_total
    WHEN NOT is_manager() AND e.consultant_id = (SELECT id FROM consultants WHERE user_id = auth.uid() LIMIT 1)
      THEN e.rem_consultant
    ELSE NULL
  END AS ma_part
FROM encaissements e;

ALTER VIEW v_encaissements SET (security_invoker = true);
