-- =====================================================
-- SECURITY AUDIT FIX: Complete RLS policies
-- Date: 2026-04-12
-- Completes the P0 fix by adding missing SELECT policy
-- =====================================================

-- 1. Add explicit SELECT policy on dossiers table
-- Without this, direct table queries (bypassing the view) are unprotected
DROP POLICY IF EXISTS dossiers_select ON dossiers;
CREATE POLICY dossiers_select ON dossiers
  FOR SELECT TO public
  USING (
    is_manager()
    OR is_back_office()
    OR (consultant_id = get_current_consultant_id())
  );

-- 2. Add DELETE policy (currently missing — only managers should delete)
DROP POLICY IF EXISTS dossiers_delete ON dossiers;
CREATE POLICY dossiers_delete ON dossiers
  FOR DELETE TO public
  USING (is_manager());

-- 3. Ensure RLS is actually enabled on dossiers
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossiers FORCE ROW LEVEL SECURITY;

-- 4. Protect google_tokens table (consultants should only see their own)
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_tokens_select ON google_tokens;
CREATE POLICY google_tokens_select ON google_tokens
  FOR SELECT TO public
  USING (consultant_id = get_current_consultant_id());

DROP POLICY IF EXISTS google_tokens_insert ON google_tokens;
CREATE POLICY google_tokens_insert ON google_tokens
  FOR INSERT TO public
  WITH CHECK (consultant_id = get_current_consultant_id() OR is_manager());

DROP POLICY IF EXISTS google_tokens_update ON google_tokens;
CREATE POLICY google_tokens_update ON google_tokens
  FOR UPDATE TO public
  USING (consultant_id = get_current_consultant_id() OR is_manager());

-- 5. Protect client_commentaires (consultants see only their clients' comments)
ALTER TABLE client_commentaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_commentaires FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_commentaires_select ON client_commentaires;
CREATE POLICY client_commentaires_select ON client_commentaires
  FOR SELECT TO public
  USING (
    is_manager()
    OR is_back_office()
    OR (auteur_id = get_current_consultant_id())
    OR EXISTS (
      SELECT 1 FROM dossiers d
      WHERE d.client_id = client_commentaires.client_id
        AND d.consultant_id = get_current_consultant_id()
    )
  );

DROP POLICY IF EXISTS client_commentaires_insert ON client_commentaires;
CREATE POLICY client_commentaires_insert ON client_commentaires
  FOR INSERT TO public
  WITH CHECK (
    is_manager()
    OR is_back_office()
    OR EXISTS (
      SELECT 1 FROM dossiers d
      WHERE d.client_id = client_commentaires.client_id
        AND d.consultant_id = get_current_consultant_id()
    )
  );

-- 6. Protect relances table
ALTER TABLE relances ENABLE ROW LEVEL SECURITY;
ALTER TABLE relances FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS relances_select ON relances;
CREATE POLICY relances_select ON relances
  FOR SELECT TO public
  USING (
    is_manager()
    OR is_back_office()
    OR EXISTS (
      SELECT 1 FROM dossiers d
      WHERE d.id = relances.dossier_id
        AND d.consultant_id = get_current_consultant_id()
    )
  );

DROP POLICY IF EXISTS relances_all ON relances;
CREATE POLICY relances_all ON relances
  FOR ALL TO public
  USING (
    is_manager()
    OR is_back_office()
    OR EXISTS (
      SELECT 1 FROM dossiers d
      WHERE d.id = relances.dossier_id
        AND d.consultant_id = get_current_consultant_id()
    )
  );
