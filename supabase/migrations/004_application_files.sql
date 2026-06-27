-- ════════════════════════════════════════════════════════════
-- Migration 004 · Application file uploads
-- Run manually in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════

-- CV / dossier URL for technical staff applications
ALTER TABLE public.staff_applications
  ADD COLUMN IF NOT EXISTS cv_url text;

-- Presskit / dossier PDF URL for artist applications
ALTER TABLE public.artist_applications
  ADD COLUMN IF NOT EXISTS presskit_url text;

-- Extra artist metadata (band info) stored as structured columns
-- for easy querying in the dashboard
ALTER TABLE public.artist_applications
  ADD COLUMN IF NOT EXISTS band_name      text,
  ADD COLUMN IF NOT EXISTS musical_genre  text,
  ADD COLUMN IF NOT EXISTS member_count   integer,
  ADD COLUMN IF NOT EXISTS music_links    text;  -- comma-separated or single URL

-- ── Storage bucket instructions ─────────────────────────────
-- Create a PUBLIC bucket named "applications-cvs" in Supabase Dashboard:
--   Dashboard → Storage → New bucket
--   Name: applications-cvs
--   Public: YES (applicants share these files intentionally)
-- No additional policies needed for a public bucket.
-- Files are namespaced by type: cv/{uuid}.pdf  presskit/{uuid}.pdf
