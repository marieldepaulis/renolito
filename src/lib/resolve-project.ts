import type { SupabaseClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolves a project by slug or UUID.
 * Always returns the project's real UUID as `id` so all DB queries work.
 */
export async function resolveProject(
  supabase: SupabaseClient,
  param: string,
  select = 'id, title, slug',
) {
  if (UUID_RE.test(param)) {
    const { data } = await supabase.from('projects').select(select).eq('id', param).single()
    return data as (Record<string, unknown> & { id: string; slug?: string | null }) | null
  }
  const { data } = await supabase.from('projects').select(select).eq('slug', param).single()
  return data as (Record<string, unknown> & { id: string; slug?: string | null }) | null
}
