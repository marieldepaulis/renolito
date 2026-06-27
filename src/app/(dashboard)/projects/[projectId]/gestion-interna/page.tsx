import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { InternalHub } from '@/components/projects/internal-hub'

export const metadata: Metadata = { title: 'Gestión Interna' }

interface Props { params: Promise<{ projectId: string }> }

export default async function GestionInternaPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch project (includes production_notes which is private)
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, organization_id')
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  // Strict membership check via admin client (bypasses RLS to avoid false negatives)
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', (project as unknown as { organization_id: string }).organization_id)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  // Render 403-style block instead of notFound so the URL doesn't leak info
  if (!membership) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <Lock className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Acceso restringido</h1>
        <p className="text-sm text-muted-foreground">
          No tenés permisos para ver la gestión interna de este proyecto.
        </p>
      </div>
    )
  }

  // Fetch sessions for crew assignment
  const { data: sessions } = await admin
    .from('sessions')
    .select('id, title, scheduled_date')
    .eq('project_id', projectId)
    .order('scheduled_date')

  // Fetch production_notes separately — column added in migration 003 (may not exist yet)
  let productionNotes: string | null = null
  try {
    const { data: pn } = await admin
      .from('projects')
      .select('production_notes')
      .eq('id', projectId)
      .single()
    productionNotes = (pn as unknown as { production_notes: string | null } | null)?.production_notes ?? null
  } catch { /* migration not yet applied */ }

  const p = project as unknown as { id: string; title: string }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/projects/${projectId}`} className="hover:text-foreground">{p.title}</Link>
          <span>/</span>
          <span className="flex items-center gap-1">
            <Lock className="size-3.5" /> Gestión Interna
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Gestión Interna</h1>
        <p className="text-sm text-muted-foreground">
          Información confidencial visible solo para miembros de tu organización.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <InternalHub
          projectId={projectId}
          sessions={sessions ?? []}
          initialNotes={productionNotes}
        />
      </div>
    </div>
  )
}
