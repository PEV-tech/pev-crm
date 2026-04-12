-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES consultants(id),
  user_nom TEXT,
  action TEXT NOT NULL, -- 'create', 'update', 'delete'
  table_name TEXT NOT NULL,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: only managers and back_office can read
CREATE POLICY IF NOT EXISTS audit_logs_select ON audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM consultants
    WHERE id = auth.uid()
    AND role IN ('manager', 'back_office')
  )
);

-- RLS Policy: anyone can insert (for logging from client-side)
CREATE POLICY IF NOT EXISTS audit_logs_insert ON audit_logs
FOR INSERT
WITH CHECK (true);
