import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NewJobOfferForm } from '@/components/job-offers/new-job-offer-form'

export const metadata: Metadata = { title: 'Nueva oferta de trabajo' }

export default async function NuevaOfertaPage() {
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

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title')
    .eq('organization_id', membership.organization_id)
    .in('status', ['draft', 'active'])
    .order('title')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/bolsa-de-trabajo" className="hover:text-foreground">
            Bolsa de trabajo
          </Link>
          <span>/</span>
          <span>Nueva oferta</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva oferta de trabajo</h1>
        <p className="text-sm text-muted-foreground">
          Publica una oferta para encontrar técnicos para tu proyecto
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <NewJobOfferForm projects={projects ?? []} />
      </div>
    </div>
  )
}
