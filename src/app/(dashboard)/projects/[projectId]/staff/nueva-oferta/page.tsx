import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NewJobOfferForm } from '@/components/job-offers/new-job-offer-form'

export const metadata: Metadata = { title: 'Nueva oferta de trabajo' }

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function NuevaOfertaProyectoPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('id, title, organization_id')
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  // Verify membership
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', (project as unknown as { organization_id: string }).organization_id)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!membership) redirect('/dashboard')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/projects/${projectId}`} className="hover:text-foreground">
            {project.title}
          </Link>
          <span>/</span>
          <Link href={`/projects/${projectId}/staff`} className="hover:text-foreground">
            Staff técnico
          </Link>
          <span>/</span>
          <span>Nueva oferta</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva oferta de trabajo</h1>
        <p className="text-sm text-muted-foreground">
          Publica una oferta de trabajo técnico para este proyecto
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <NewJobOfferForm
          projects={[{ id: project.id, title: project.title }]}
          defaultProjectId={project.id}
          backHref={`/projects/${projectId}/staff`}
        />
      </div>
    </div>
  )
}
