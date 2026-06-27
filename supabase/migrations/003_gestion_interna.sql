-- ════════════════════════════════════════════════════════════
-- Migration 003 · Gestión Interna
-- Run manually in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════

-- 1. Add production_notes to projects (private, org-members only)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS production_notes text;

-- 2. session_crew: assigns a platform user OR external person to a role in a session
CREATE TABLE IF NOT EXISTS public.session_crew (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid        NOT NULL REFERENCES public.sessions(id)      ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_name       text        NOT NULL,
  -- Platform user (optional — leave NULL for external crew)
  user_id         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- External crew not on the platform
  external_name   text,
  external_email  text,
  agreed_rate     numeric(10,2),
  rate_currency   text        NOT NULL DEFAULT 'ARS',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crew_has_person CHECK (user_id IS NOT NULL OR external_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS session_crew_session_idx ON public.session_crew(session_id);
CREATE INDEX IF NOT EXISTS session_crew_org_idx     ON public.session_crew(organization_id);
CREATE INDEX IF NOT EXISTS session_crew_user_idx    ON public.session_crew(user_id);

-- 3. project_documents: private links / docs per project (org-members only)
CREATE TABLE IF NOT EXISTS public.project_documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES public.projects(id)      ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  url             text        NOT NULL,
  doc_type        text        NOT NULL DEFAULT 'other'
    CHECK (doc_type IN ('contract','budget','technical','rider','other')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_documents_project_idx ON public.project_documents(project_id);

-- 4. session_files: files shared with crew per session
--    Storage path: session-files/{organization_id}/{session_id}/{filename}
CREATE TABLE IF NOT EXISTS public.session_files (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid        NOT NULL REFERENCES public.sessions(id)      ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  storage_path    text        NOT NULL,  -- path inside the "session-files" bucket
  file_size       bigint,
  mime_type       text,
  uploaded_by     uuid        NOT NULL REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_files_session_idx ON public.session_files(session_id);

-- 5. staff_applications: public applicants to job offers (no platform account needed)
CREATE TABLE IF NOT EXISTS public.staff_applications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_offer_id    uuid        NOT NULL REFERENCES public.job_offers(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name       text        NOT NULL,
  email           text        NOT NULL,
  cover_note      text,
  proposed_rate   numeric(10,2),
  portfolio_url   text,
  status          text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','reviewing','accepted','rejected')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_applications_unique UNIQUE (job_offer_id, email)
);

CREATE INDEX IF NOT EXISTS staff_applications_offer_idx ON public.staff_applications(job_offer_id);
CREATE INDEX IF NOT EXISTS staff_applications_org_idx   ON public.staff_applications(organization_id);

-- ── RLS ────────────────────────────────────────────────────

ALTER TABLE public.session_crew       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_files      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_applications ENABLE ROW LEVEL SECURITY;

-- session_crew: org members manage; assigned users can read their own rows
CREATE POLICY "session_crew: org members manage"
  ON public.session_crew FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = session_crew.organization_id
        AND m.user_id         = auth.uid()
        AND m.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "session_crew: assigned user can read own rows"
  ON public.session_crew FOR SELECT
  USING (session_crew.user_id = auth.uid());

-- project_documents: org members only
CREATE POLICY "project_documents: org members manage"
  ON public.project_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = project_documents.organization_id
        AND m.user_id         = auth.uid()
        AND m.accepted_at IS NOT NULL
    )
  );

-- staff_applications: org members can read/update; anyone can insert (public form)
CREATE POLICY "staff_applications: org members manage"
  ON public.staff_applications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = staff_applications.organization_id
        AND m.user_id         = auth.uid()
        AND m.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "staff_applications: public insert"
  ON public.staff_applications FOR INSERT
  WITH CHECK (true);

-- session_files: org members manage; assigned crew can read
CREATE POLICY "session_files: org members manage"
  ON public.session_files FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = session_files.organization_id
        AND m.user_id         = auth.uid()
        AND m.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "session_files: crew members can read"
  ON public.session_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.session_crew c
      WHERE c.session_id = session_files.session_id
        AND c.user_id    = auth.uid()
    )
  );

-- ── Storage bucket instructions ─────────────────────────────
-- After running this SQL, create the storage bucket manually:
--   Supabase Dashboard → Storage → New bucket
--   Name: session-files
--   Public: NO (private)
-- Then add these storage policies in Dashboard → Storage → session-files → Policies:
--
-- Policy 1 (INSERT): org members can upload
--   ((storage.foldername(name))[1] IN (
--     SELECT organization_id::text FROM organization_members
--     WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
--   ))
--
-- Policy 2 (SELECT): org members + assigned crew can download
--   ((storage.foldername(name))[1] IN (
--     SELECT organization_id::text FROM organization_members
--     WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
--   ))
--   OR
--   ((storage.foldername(name))[2] IN (
--     SELECT session_id::text FROM session_crew WHERE user_id = auth.uid()
--   ))
