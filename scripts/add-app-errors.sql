-- PEV CRM — Error tracking (alternative maison à Sentry)
--
-- Pourquoi cette approche plutôt que Sentry :
--   Phase 0, ~5 utilisateurs actifs. Sentry (même gratuit) ajoute un SaaS
--   tiers à monitorer, une CSP à étendre (connect-src *.ingest.sentry.io),
--   un wizard qui mute plusieurs fichiers. On n'a pas le besoin métier.
--
--   Ici on pose une simple table Supabase + un endpoint /api/errors.
--   Toutes les exceptions client/server sont postées ici ; les managers les
--   consultent via une page admin (PR suivante).
--
-- Stratégie :
--   · Table `app_errors` append-only (horodatée, source, route, message,
--     stack, user_id éventuel, user_agent, extra jsonb).
--   · RLS activée : SELECT autorisé uniquement aux rôles manager/back_office
--     (via jointure consultants.auth_user_id). INSERT bloqué → seul le
--     service role (/api/errors) peut écrire (bypass RLS).
--   · Deux colonnes de résolution (resolved_at, resolved_by) pour la page
--     admin qui permettra de "marquer traité".
--
-- Script idempotent : peut être rejoué sans casse.

BEGIN;

-- ───────────────────────────────────────────────────────────────────
-- 1) Table + indexes
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_errors (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  source       TEXT        NOT NULL CHECK (source IN ('client', 'server', 'api')),
  route        TEXT,
  message      TEXT        NOT NULL,
  stack        TEXT,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_agent   TEXT,
  extra        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Si resolved_by est renseigné, resolved_at doit l'être aussi (cohérence).
  CONSTRAINT app_errors_resolution_coherent
    CHECK (
      (resolved_by IS NULL AND resolved_at IS NULL)
      OR resolved_at IS NOT NULL
    )
);

COMMENT ON TABLE public.app_errors IS
  'Erreurs applicatives client/server capturées par /api/errors. '
  'Écriture via service role uniquement (RLS bloque les autres). '
  'Lecture réservée aux rôles manager/back_office.';

CREATE INDEX IF NOT EXISTS idx_app_errors_occurred_at
  ON public.app_errors (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_errors_unresolved
  ON public.app_errors (occurred_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_errors_source
  ON public.app_errors (source, occurred_at DESC);

-- ───────────────────────────────────────────────────────────────────
-- 2) RLS : SELECT pour managers/back_office uniquement ; INSERT bloqué
--    (seul le service role peut écrire → bypass RLS côté endpoint)
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

-- Idempotence : on drop les policies avant de les recréer.
DROP POLICY IF EXISTS "managers_read_errors" ON public.app_errors;
DROP POLICY IF EXISTS "managers_update_errors" ON public.app_errors;

CREATE POLICY "managers_read_errors"
  ON public.app_errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.consultants
      WHERE consultants.auth_user_id = auth.uid()
        AND consultants.role IN ('manager', 'back_office')
    )
  );

-- UPDATE autorisé aux managers pour marquer une erreur "résolue" depuis
-- la page admin. On ne restreint pas les colonnes ici ; la page admin
-- n'envoie que { resolved_at, resolved_by } dans son payload.
CREATE POLICY "managers_update_errors"
  ON public.app_errors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.consultants
      WHERE consultants.auth_user_id = auth.uid()
        AND consultants.role IN ('manager', 'back_office')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.consultants
      WHERE consultants.auth_user_id = auth.uid()
        AND consultants.role IN ('manager', 'back_office')
    )
  );

-- Pas de policy INSERT → anon/authenticated bloqués. /api/errors utilise
-- le service role pour bypass.

-- Pas de policy DELETE → personne ne supprime, append-only.

COMMIT;

-- ───────────────────────────────────────────────────────────────────
-- Post-migration : régénérer les types TypeScript
-- ───────────────────────────────────────────────────────────────────
-- npx supabase gen types typescript --project-id <PROJECT_ID> \
--   > src/types/database.ts
--
-- Ou, si le CLI n'est pas installé, copier/coller depuis l'UI Supabase :
-- Settings → API → TypeScript types.
