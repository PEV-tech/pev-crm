-- PEV CRM — Rate-limit stateful via Supabase
--
-- Pourquoi cette approche plutôt que du in-memory côté Next.js :
--   Les Vercel serverless functions sont éphémères et scale-out ; un
--   Map/LRU in-memory ne se partage pas entre instances, donc un attaquant
--   qui tombe sur une instance fraîche bypasse les limites. Avec Supabase
--   comme backend stateful, tous les appels convergent sur la même
--   fenêtre comptable et le limit tient réellement.
--
-- Stratégie :
--   Une table append-only `rate_limit_hits` (bucket, identifier, hit_at)
--   avec RLS FORCE et aucune policy → personne n'y touche en direct.
--   Deux fonctions SECURITY DEFINER exposées :
--     · `check_rate_limit(bucket, identifier, max_hits, window_seconds)`
--       → nettoie les hits hors fenêtre, compte, et si OK INSERT. Retourne
--         JSONB { allowed, count, limit, reset_at }.
--     · `purge_rate_limit_hits(older_than_seconds)` → nettoyage global,
--       à câbler sur pg_cron / Supabase cron plus tard.
--
-- Script idempotent : peut être rejoué sans casse.

BEGIN;

-- ───────────────────────────────────────────────────────────────────
-- 1) Table + indexes
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id          BIGSERIAL PRIMARY KEY,
  bucket      TEXT        NOT NULL,
  identifier  TEXT        NOT NULL,
  hit_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rate_limit_hits IS
  'Rate-limit stateful pour les endpoints /api/kyc/* et /api/parse-kyc. '
  'Écriture via la fonction SECURITY DEFINER check_rate_limit uniquement ; '
  'purge via purge_rate_limit_hits (cron).';

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_bucket_id_time
  ON public.rate_limit_hits (bucket, identifier, hit_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_hit_at
  ON public.rate_limit_hits (hit_at);

-- ───────────────────────────────────────────────────────────────────
-- 2) RLS verrouillée : aucune policy, FORCE activé
--    → Le seul moyen de lire/écrire est via les fonctions SECURITY
--      DEFINER plus bas (owner postgres, contourne RLS).
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_hits FORCE  ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────────
-- 3) Fonction check_rate_limit
--    Atomique "best-effort" : un DELETE + COUNT + INSERT consécutifs
--    dans la même fonction. Ça suffit largement pour le trafic PEV
--    (< 10 users actifs). Si on devait serrer au token-bucket
--    nanoseconde-précis on passerait à Redis, hors scope V1.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket          TEXT,
  p_identifier      TEXT,
  p_max_hits        INT,
  p_window_seconds  INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count     INT;
  v_allowed   BOOLEAN;
  v_oldest    TIMESTAMPTZ;
  v_reset_at  TIMESTAMPTZ;
BEGIN
  -- Validation params
  IF p_bucket IS NULL OR p_identifier IS NULL THEN
    RAISE EXCEPTION 'bucket et identifier sont requis';
  END IF;
  IF p_max_hits IS NULL OR p_max_hits < 1 THEN
    RAISE EXCEPTION 'max_hits doit être >= 1';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'window_seconds doit être >= 1';
  END IF;

  -- 1) Nettoyage paresseux — supprimer les hits hors fenêtre pour
  --    ce (bucket, identifier). Ne touche pas au reste de la table.
  DELETE FROM public.rate_limit_hits
   WHERE bucket = p_bucket
     AND identifier = p_identifier
     AND hit_at < now() - make_interval(secs => p_window_seconds);

  -- 2) Compter les hits restants dans la fenêtre
  SELECT COUNT(*) INTO v_count
    FROM public.rate_limit_hits
   WHERE bucket = p_bucket
     AND identifier = p_identifier;

  v_allowed := v_count < p_max_hits;

  -- 3) Si autorisé, logger le nouveau hit
  IF v_allowed THEN
    INSERT INTO public.rate_limit_hits (bucket, identifier)
    VALUES (p_bucket, p_identifier);
    v_count := v_count + 1;
  END IF;

  -- 4) Calcul du reset : quand le hit le plus ancien sortira de la fenêtre
  SELECT MIN(hit_at) INTO v_oldest
    FROM public.rate_limit_hits
   WHERE bucket = p_bucket
     AND identifier = p_identifier;

  IF v_oldest IS NOT NULL THEN
    v_reset_at := v_oldest + make_interval(secs => p_window_seconds);
  ELSE
    v_reset_at := now() + make_interval(secs => p_window_seconds);
  END IF;

  RETURN jsonb_build_object(
    'allowed',   v_allowed,
    'count',     v_count,
    'limit',     p_max_hits,
    'reset_at',  v_reset_at
  );
END;
$$;

COMMENT ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT) IS
  'Rate-limit sliding window pour endpoints /api. Appelée par '
  'src/lib/rate-limit.ts::enforceRateLimit. SECURITY DEFINER.';

-- ───────────────────────────────────────────────────────────────────
-- 4) Purge globale (à câbler pg_cron / Supabase cron)
--    Default : supprime les hits > 1 h. On peut appeler plus souvent
--    avec une fenêtre plus large sans risque (idempotent).
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purge_rate_limit_hits(
  p_older_than_seconds INT DEFAULT 3600
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM public.rate_limit_hits
   WHERE hit_at < now() - make_interval(secs => p_older_than_seconds);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.purge_rate_limit_hits(INT) IS
  'Nettoyage global de rate_limit_hits. À câbler sur pg_cron.';

-- ───────────────────────────────────────────────────────────────────
-- 5) Grants
--    check_rate_limit : ouvert à anon + authenticated (endpoints
--       publics + authentifiés en ont besoin).
--    purge_rate_limit_hits : réservé service_role (admin / cron).
-- ───────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.purge_rate_limit_hits(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_rate_limit_hits(INT) TO service_role;

COMMIT;

-- ───────────────────────────────────────────────────────────────────
-- Smoke tests (à exécuter après application)
-- ───────────────────────────────────────────────────────────────────
--
-- 1. Table créée + RLS FORCE :
--    SELECT relname, relrowsecurity, relforcerowsecurity
--      FROM pg_class WHERE relname = 'rate_limit_hits';
--    -- attendu : (t, t)
--
-- 2. Pas de policies :
--    SELECT COUNT(*) FROM pg_policies
--     WHERE tablename = 'rate_limit_hits';
--    -- attendu : 0
--
-- 3. Appel simple (dans la session actuelle, rejeu immédiat) :
--    SELECT public.check_rate_limit('test', '1.2.3.4', 2, 60);
--    SELECT public.check_rate_limit('test', '1.2.3.4', 2, 60);
--    SELECT public.check_rate_limit('test', '1.2.3.4', 2, 60);
--    -- attendu : allowed=true, true, false
--
-- 4. Nettoyage :
--    DELETE FROM public.rate_limit_hits WHERE bucket = 'test';
