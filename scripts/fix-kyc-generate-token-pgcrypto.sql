-- =====================================================================
-- Hotfix : kyc_generate_token — resolve gen_random_bytes via extensions
-- Date   : 2026-04-21
-- Raison : en prod (Supabase), pgcrypto est installé dans le schéma
--          `extensions`. La RPC a `SET search_path = public`, donc
--          `gen_random_bytes(16)` n'est pas trouvé et lève
--          `function gen_random_bytes(integer) does not exist`.
--          On schéma-qualifie l'appel en `extensions.gen_random_bytes`.
-- Scope  : ne touche QUE la fonction `kyc_generate_token`. Les autres
--          RPC du fichier add-kyc-link-flow.sql n'utilisent pas pgcrypto.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.kyc_generate_token(p_client_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM 1 FROM clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  -- Schéma-qualifié : pgcrypto vit dans `extensions` sur Supabase.
  new_token := encode(extensions.gen_random_bytes(16), 'hex');

  UPDATE clients
     SET kyc_token            = new_token,
         kyc_token_created_at = NOW()
   WHERE id = p_client_id;

  RETURN new_token;
END;
$$;

REVOKE ALL ON FUNCTION public.kyc_generate_token(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.kyc_generate_token(UUID) TO authenticated;

COMMIT;
