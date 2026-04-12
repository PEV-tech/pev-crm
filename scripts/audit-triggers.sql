-- =====================================================
-- AUDIT TRIGGERS
-- Automatically populate audit_logs table on data changes
-- Date: 2026-04-12
-- =====================================================

-- =====================================================
-- Generic audit log trigger function
-- Handles INSERT, UPDATE, and DELETE operations
-- =====================================================
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_nom TEXT;
  v_action TEXT;
  v_record_id UUID;
  v_details JSONB;
  v_changed_fields JSONB;
BEGIN
  -- Get current user ID from auth context
  v_user_id := auth.uid();

  -- Look up consultant nom from consultants table
  IF v_user_id IS NOT NULL THEN
    SELECT nom INTO v_user_nom FROM consultants WHERE id = v_user_id;
  END IF;

  -- Determine action type and set record_id
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

  -- Insert audit log entry
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

  -- Return appropriate row for INSERT/UPDATE, NULL for DELETE
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Dossiers table triggers
-- =====================================================
DROP TRIGGER IF EXISTS trg_audit_dossiers_insert ON dossiers;
CREATE TRIGGER trg_audit_dossiers_insert
AFTER INSERT ON dossiers
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_dossiers_update ON dossiers;
CREATE TRIGGER trg_audit_dossiers_update
AFTER UPDATE ON dossiers
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_dossiers_delete ON dossiers;
CREATE TRIGGER trg_audit_dossiers_delete
AFTER DELETE ON dossiers
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();

-- =====================================================
-- Commissions table triggers
-- =====================================================
DROP TRIGGER IF EXISTS trg_audit_commissions_insert ON commissions;
CREATE TRIGGER trg_audit_commissions_insert
AFTER INSERT ON commissions
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_commissions_update ON commissions;
CREATE TRIGGER trg_audit_commissions_update
AFTER UPDATE ON commissions
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_commissions_delete ON commissions;
CREATE TRIGGER trg_audit_commissions_delete
AFTER DELETE ON commissions
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();

-- =====================================================
-- Factures table triggers
-- =====================================================
DROP TRIGGER IF EXISTS trg_audit_factures_insert ON factures;
CREATE TRIGGER trg_audit_factures_insert
AFTER INSERT ON factures
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_factures_update ON factures;
CREATE TRIGGER trg_audit_factures_update
AFTER UPDATE ON factures
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_factures_delete ON factures;
CREATE TRIGGER trg_audit_factures_delete
AFTER DELETE ON factures
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();

-- =====================================================
-- Clients table triggers
-- =====================================================
DROP TRIGGER IF EXISTS trg_audit_clients_insert ON clients;
CREATE TRIGGER trg_audit_clients_insert
AFTER INSERT ON clients
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_clients_update ON clients;
CREATE TRIGGER trg_audit_clients_update
AFTER UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_clients_delete ON clients;
CREATE TRIGGER trg_audit_clients_delete
AFTER DELETE ON clients
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log();
