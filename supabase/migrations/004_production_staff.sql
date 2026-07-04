-- Migration 004: Official production staff roster
CREATE TABLE IF NOT EXISTS production_staff (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  full_name       text NOT NULL,
  email           text NOT NULL,
  speciality      text,
  phone           text,
  source          text NOT NULL DEFAULT 'manual',
  -- source values: 'staff_application' | 'technician_application' | 'manual'
  source_id       uuid,
  status          text NOT NULL DEFAULT 'active',
  -- status values: 'active' | 'inactive'
  joined_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email)
);

CREATE INDEX IF NOT EXISTS production_staff_org_idx    ON production_staff(organization_id);
CREATE INDEX IF NOT EXISTS production_staff_user_idx   ON production_staff(user_id);
CREATE INDEX IF NOT EXISTS production_staff_status_idx ON production_staff(organization_id, status);

ALTER TABLE production_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage production staff"
  ON production_staff
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = production_staff.organization_id
        AND om.user_id = auth.uid()
        AND om.accepted_at IS NOT NULL
    )
  );
