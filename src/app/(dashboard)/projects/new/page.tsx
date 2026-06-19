import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewProjectForm } from '@/components/projects/new-project-form'

export const metadata: Metadata = { title: 'Nuevo proyecto' }

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { data: projectTypes } = await supabase
    .from('project_types')
    .select('id, name, slug, icon, is_system')
    .or(`organization_id.is.null,organization_id.eq.${membership.organization_id}`)
    .order('display_order')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo proyecto</h1>
        <p className="text-sm text-muted-foreground">
          Define el tipo y nombre del proyecto para generar su link de inscripción.
        </p>
      </div>
      <NewProjectForm
        organizationId={membership.organization_id}
        projectTypes={projectTypes ?? []}
      />
    </div>
  )
}
