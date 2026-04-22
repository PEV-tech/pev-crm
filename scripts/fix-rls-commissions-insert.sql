-- =====================================================
-- P0 FIX: commissions RLS — INSERT + DELETE policies
-- Date: 2026-04-22
-- Author: Maxine (via Claude)
--
-- Context:
--   Le panneau "Modifier les taux de commission" (dossier-detail-wrapper.tsx)
--   effectue un upsert sur `commissions` :
--     1. SELECT  commissions WHERE dossier_id = :id
--     2a. si trouvé  -> UPDATE commissions
--     2b. sinon      -> INSERT commissions
--
--   Avant ce patch, les seules policies présentes sur `commissions`
--   étaient `commissions_select` et `commissions_update`. Quand aucun
--   row n'existait pour le dossier (trigger non déclenché ou row
--   supprimé manuellement), l'UI tombait sur le chemin INSERT et
--   PostgREST renvoyait `403 Forbidden` — affiché côté front comme
--   "Erreur lors de la sauvegarde des taux".
--
-- Validation (2026-04-22) :
--   * Sauvegarde sans apporteur sur dossier 75d45bb6-…         OK
--   * Sauvegarde avec apporteur Yoann Pouliquen, taux 25 %      OK
-- =====================================================

-- INSERT : manager / back_office / consultant propriétaire du dossier
DROP POLICY IF EXISTS commissions_insert ON commissions;
CREATE POLICY commissions_insert ON commissions
  FOR INSERT TO public
  WITH CHECK (
    is_manager()
    OR is_back_office()
    OR EXISTS (
      SELECT 1 FROM dossiers d
      WHERE d.id = commissions.dossier_id
        AND d.consultant_id = get_current_consultant_id()
    )
  );

-- DELETE : réservé aux managers / back_office
-- (nettoyage / rattrapage admin — pas de delete consultant)
DROP POLICY IF EXISTS commissions_delete ON commissions;
CREATE POLICY commissions_delete ON commissions
  FOR DELETE TO public
  USING (is_manager() OR is_back_office());

-- Sanity check : lister les 4 policies attendues
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'commissions'
-- ORDER BY cmd, policyname;
-- Attendu : commissions_delete (DELETE), commissions_insert (INSERT),
--           commissions_select (SELECT), commissions_update (UPDATE)
