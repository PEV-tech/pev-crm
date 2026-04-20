-- =====================================================
-- FIX: fn_audit_log référence audit_log (singulier) au lieu de audit_logs
-- Date: 2026-04-20
-- Context: découvert en prod quand la correction des silent catches
--          dans clients/[id]/page.tsx a exposé l'erreur:
--          "Erreur sauvegarde contact : relation 'audit_log' does not exist"
-- =====================================================
-- Tous les UPDATE/INSERT/DELETE sur clients, dossiers, commissions, factures
-- échouent en prod à cause d'un trigger fn_audit_log() qui insère dans une
-- table inexistante (audit_log singulier). La vraie table est audit_logs.
--
-- Ce script recrée proprement la fonction. Les triggers en place l'utilisent
-- déjà et ne nécessitent pas de recréation (CREATE OR REPLACE FUNCTION
-- remplace la fonction en place sans toucher aux triggers).
--
-- À exécuter une fois dans le SQL editor Supabase:
-- https://supabase.com/dashboard/project/upupmfwwlwtznffodfmt/sql/new
-- =====================================================

-- Diagnostic rapide avant (optionnel) :
-- Regarder la définition actuelle de fn_audit_log pour confirmer qu'elle
-- référence bien audit_log (singulier):
--   SELECT routine_definition FROM information_schema.routines
--   WHERE routine_name = 'fn_audit_log';

CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_nom TEXT;
  v_action TEXT;
  v_record_id UUID;
  v_details JSONB;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT nom INTO v_user_nom FROM consultants WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_record_id := NEW.id;
    v_details := row_to_json(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_record_id := NEW.id;
    v_details := jsonb_build_object(
      'old', row_to_json(OLD)::jsonb,
      'new', row_to_json(NEW)::jsonb
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_record_id := OLD.id;
    v_details := row_to_json(OLD);
  END IF;

  -- Fix: audit_logs (pluriel), pas audit_log (singulier)
  INSERT INTO audit_logs (
    user_id,
    user_nom,
    action,
    table_name,
    record_id,
    details,
    created_at
  ) VALUES (
    v_user_id,
    v_user_nom,
    v_action,
    TG_TABLE_NAME,
    v_record_id,
    v_details,
    now()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test post-fix (optionnel) :
-- UPDATE clients SET email = email WHERE id = '<un-id-quelconque>' LIMIT 1;
-- Doit réussir. Puis vérifier qu'une row a été ajoutée dans audit_logs.
