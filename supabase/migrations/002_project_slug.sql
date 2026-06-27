-- ============================================================
-- MIGRATION 002 — Add slug to projects
-- ============================================================
-- Adds a human-readable slug to each project used for the
-- public registration URL: /inscripcion/{slug}
-- The existing registration_link_token is kept for security
-- fallback; the slug is the primary public identifier.
-- ============================================================

-- 1. Add column (nullable initially so backfill can run first)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS slug text;

-- 2. Helper: return a slug not yet taken by any project
CREATE OR REPLACE FUNCTION public.unique_project_slug(base_slug text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  candidate text;
  counter   int := 0;
BEGIN
  candidate := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.projects WHERE slug = candidate) LOOP
    counter   := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 3. Backfill existing rows
UPDATE public.projects
SET slug = public.unique_project_slug(public.generate_slug(title))
WHERE slug IS NULL;

-- 4. Now enforce NOT NULL + UNIQUE
ALTER TABLE public.projects
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON public.projects (slug);

-- 5. Auto-set slug on INSERT when not supplied
CREATE OR REPLACE FUNCTION public.handle_project_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    NEW.slug := public.unique_project_slug(public.generate_slug(NEW.title));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_before_insert ON public.projects;
CREATE TRIGGER trg_project_before_insert
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_project_before_insert();

-- 6. Update comment
COMMENT ON COLUMN public.projects.slug IS
  'URL-safe slug for public registration page: /inscripcion/{slug}. '
  'Auto-generated from title on INSERT; never auto-updated on title change '
  '(would break existing shared links). Can be edited manually.';
