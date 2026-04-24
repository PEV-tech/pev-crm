-- =====================================================================
-- FEATURE : Relances KYC automatiques paramétrables par consultant
-- Date    : 2026-04-24
-- Context : Étape 3 chantier 3 de l'audit KYC (2026-04-22). Permettre
--           au consultant de configurer lui-même dans Paramètres → Relances :
--             - enabled     : relances auto activées ou pas
--             - seuil_jours : délai après envoi avant la 1re relance
--             - intervalle_jours : délai entre 2 relances
--             - max_relances : plafond total
--             - email_auto  : envoi email auto ou simple entrée dans la
--                             section Relances (dépend du chantier 4/5
--                             pour le câblage SMTP effectif)
--
-- Scope :
--   1. Nouvelle table kyc_relance_settings (1 ligne par consultant, UNIQUE).
--   2. 2 colonnes compteurs sur clients : kyc_relances_count + kyc_last_relance_at.
--   3. Trigger updated_at auto sur kyc_relance_settings.
--   4. RLS : consultant voit/modifie les siennes, manager/back_office tout.
--   5. Index partiel UNIQUE sur relances pour empêcher les doublons de
--      relance auto active sur un même client.
--
-- Tout est idempotent (CREATE … IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- DROP POLICY IF EXISTS avant CREATE POLICY). Rerun sans casse.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table kyc_relance_settings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kyc_relance_settings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id     UUID        NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  enabled           BOOLEAN     NOT NULL DEFAULT TRUE,
  seuil_jours       INT         NOT NULL DEFAULT 7
                                  CHECK (seuil_jours BETWEEN 1 AND 90),
  intervalle_jours  INT         NOT NULL DEFAULT 7
                                  CHECK (intervalle_jours BETWEEN 1 AND 90),
  max_relances      INT         NOT NULL DEFAULT 3
                                  CHECK (max_relances BETWEEN 1 AND 10),
  email_auto        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (consultant_id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_relance_settings_consultant
  ON public.kyc_relance_settings(consultant_id);

COMMENT ON TABLE public.kyc_relance_settings IS
  'Configuration des relances KYC automatiques, 1 ligne par consultant. Utilisée par le cron /api/cron/kyc-relances qui insère des entrées dans `relances` quand un KYC reste non signé.';

-- ---------------------------------------------------------------------
-- 2. Trigger updated_at auto
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._kyc_relance_settings_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_relance_settings_updated_at ON public.kyc_relance_settings;
CREATE TRIGGER trg_kyc_relance_settings_updated_at
  BEFORE UPDATE ON public.kyc_relance_settings
  FOR EACH ROW
  EXECUTE FUNCTION public._kyc_relance_settings_touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. RLS — helpers _current_consultant_id() et _is_manager_or_bo()
--    existent déjà depuis add-consultant-email-templates.sql, on les
--    réutilise tels quels (pas de redéfinition ici).
-- ---------------------------------------------------------------------
ALTER TABLE public.kyc_relance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS krs_select ON public.kyc_relance_settings;
CREATE POLICY krs_select ON public.kyc_relance_settings
  FOR SELECT TO authenticated
  USING (
    consultant_id = public._current_consultant_id()
    OR public._is_manager_or_bo()
  );

DROP POLICY IF EXISTS krs_insert ON public.kyc_relance_settings;
CREATE POLICY krs_insert ON public.kyc_relance_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    consultant_id = public._current_consultant_id()
    OR public._is_manager_or_bo()
  );

DROP POLICY IF EXISTS krs_update ON public.kyc_relance_settings;
CREATE POLICY krs_update ON public.kyc_relance_settings
  FOR UPDATE TO authenticated
  USING (
    consultant_id = public._current_consultant_id()
    OR public._is_manager_or_bo()
  )
  WITH CHECK (
    consultant_id = public._current_consultant_id()
    OR public._is_manager_or_bo()
  );

-- DELETE : manager uniquement (le consultant ne doit pas pouvoir se
-- retirer sa ligne, sinon le cron reprendrait les valeurs par défaut).
DROP POLICY IF EXISTS krs_delete ON public.kyc_relance_settings;
CREATE POLICY krs_delete ON public.kyc_relance_settings
  FOR DELETE TO authenticated
  USING (
    public._is_manager_or_bo()
  );

-- ---------------------------------------------------------------------
-- 4. Compteurs per-client (sur clients)
--    - kyc_relances_count : combien de relances auto ont déjà été
--      envoyées pour le token KYC courant
--    - kyc_last_relance_at : horodatage de la dernière relance auto
--    Reset à 0/NULL à la régénération d'un token (RPC kyc_generate_token,
--    mise à jour dans un fichier séparé pour ne pas dupliquer la RPC ici).
-- ---------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS kyc_relances_count INT NOT NULL DEFAULT 0
    CHECK (kyc_relances_count >= 0);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS kyc_last_relance_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.clients.kyc_relances_count IS
  'Nombre de relances auto déjà envoyées pour le lien KYC courant. Reset à 0 quand kyc_generate_token émet un nouveau token.';
COMMENT ON COLUMN public.clients.kyc_last_relance_at IS
  'Horodatage de la dernière relance auto pour le lien KYC courant. NULL si aucune relance n''a encore été envoyée.';

-- ---------------------------------------------------------------------
-- 5. Index partiel UNIQUE sur relances pour idempotence du cron
--    Empêche 2 relances auto `kyc` actives (a_faire OU reporte) pour
--    le même client au même moment. Le cron réutilise/reactive une
--    entrée existante plutôt que d'en créer une nouvelle, et marque
--    anciennes comme 'fait' avant d'en ajouter une nouvelle si besoin.
-- ---------------------------------------------------------------------
-- La colonne `source` n'existait pas encore sur relances : on l'ajoute
-- (TEXT NULLABLE). Les relances manuelles historiques resteront NULL,
-- les relances auto portent 'auto_kyc_unsigned'.
ALTER TABLE public.relances
  ADD COLUMN IF NOT EXISTS source TEXT NULL;

COMMENT ON COLUMN public.relances.source IS
  'Origine de la relance. NULL = saisie manuelle par le consultant. `auto_kyc_unsigned` = cron de relances KYC auto (chantier 3 étape 3 audit KYC 2026-04-22).';

-- L'index exige (client_id, source) + filtre statut IN ('a_faire','reporte').
-- Nécessite client_id non-null : on filtre aussi IS NOT NULL dans le
-- prédicat partiel pour éviter les WARN.
DROP INDEX IF EXISTS uq_relances_auto_kyc_active;
CREATE UNIQUE INDEX uq_relances_auto_kyc_active
  ON public.relances(client_id)
  WHERE source = 'auto_kyc_unsigned'
    AND statut IN ('a_faire', 'reporte')
    AND client_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Smoke test (commenté — à exécuter à la main si besoin)
-- ---------------------------------------------------------------------
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name IN ('kyc_relance_settings','clients','relances')
--    AND column_name IN ('kyc_relances_count','kyc_last_relance_at','source')
--  ORDER BY table_name, column_name;
