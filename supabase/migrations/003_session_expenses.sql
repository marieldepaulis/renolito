-- Migration 003: Session expenses
CREATE TABLE IF NOT EXISTS session_expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category    text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  amount      numeric(10,2) NOT NULL CHECK (amount >= 0),
  currency    text NOT NULL DEFAULT 'EUR',
  expense_date date,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_expenses_session_id_idx ON session_expenses(session_id);
CREATE INDEX IF NOT EXISTS session_expenses_project_id_idx ON session_expenses(project_id);

ALTER TABLE session_expenses ENABLE ROW LEVEL SECURITY;

-- Only org members can view/manage expenses for their projects
CREATE POLICY "org members can manage session expenses"
  ON session_expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = session_expenses.project_id
        AND om.user_id = auth.uid()
        AND om.accepted_at IS NOT NULL
    )
  );
