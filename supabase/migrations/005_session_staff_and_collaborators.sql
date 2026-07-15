-- Session staff assignments
CREATE TABLE IF NOT EXISTS session_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  production_staff_id uuid REFERENCES production_staff(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  role text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE session_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can manage session staff" ON session_staff FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = session_staff.project_id
      AND om.user_id = auth.uid()
      AND om.accepted_at IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS session_staff_session_idx ON session_staff(session_id);
CREATE INDEX IF NOT EXISTS session_staff_project_idx ON session_staff(project_id);

-- Project collaborators
CREATE TABLE IF NOT EXISTS project_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'collaborator',
  is_internal boolean NOT NULL DEFAULT false,
  notes text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, email)
);
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can manage project collaborators" ON project_collaborators FOR ALL USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = project_collaborators.organization_id
      AND om.user_id = auth.uid()
      AND om.accepted_at IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS project_collaborators_project_idx ON project_collaborators(project_id);
