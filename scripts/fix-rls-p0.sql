-- =====================================================
-- P0 FIX: RLS policies + view security_invoker
-- Date: 2026-04-08
-- =====================================================

-- 1. Fix dossiers INSERT policy (add back_office, allow managers for any consultant)
DROP POLICY IF EXISTS dossiers_insert ON dossiers;
CREATE POLICY dossiers_insert ON dossiers
  FOR INSERT TO public
  WITH CHECK (is_manager() OR is_back_office() OR (consultant_id = get_current_consultant_id()));

-- 2. Fix dossiers UPDATE policy (add back_office)
DROP POLICY IF EXISTS dossiers_update ON dossiers;
CREATE POLICY dossiers_update ON dossiers
  FOR UPDATE TO public
  USING (is_manager() OR is_back_office() OR (consultant_id = get_current_consultant_id()));

-- 3. Fix v_dossiers_complets view: enable security_invoker so RLS is enforced
-- This is the ROOT CAUSE of P0 #2 (consultants see all dossiers)
-- Without security_invoker, the view runs as the view owner (postgres) which bypasses RLS
ALTER VIEW v_dossiers_complets SET (security_invoker = true);
