import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Plus } from 'lucide-react'
import { JobOfferCard } from '@/components/projects/job-offer-card'
import { ApplicationCard } from '@/components/staff/application-card'

export const metadata: Metadata = { title: 'Staff técnico' }

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function StaffPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('id, title')
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  const { data: offers } = await supabase
    .from('job_offers')
    .select(`
      id, title, speciality, is_paid, is_barter,
      estimated_rate, rate_currency, rate_unit, status,
      required_date, description, barter_description, max_applicants,
      technician_applications(id, status, agreed_rate,
        technician_profiles(user_id,
          profiles(full_name, email)
        )
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  // Fetch public staff applications for all offers in this project
  const admin = createAdminClient()
  let staffApplications: Array<{
    id: string; full_name: string; email: string; cover_note: string | null
    proposed_rate: number | null; portfolio_url: string | null; cv_url: string | null
    status: string; created_at: string; job_offer_id: string
  }> = []

  try {
    const offerIds = (offers ?? []).map(o => o.id)
    if (offerIds.length > 0) {
      const { data } = await admin
        .from('staff_applications')
        .select('id, full_name, email, cover_note, proposed_rate, portfolio_url, cv_url, status, created_at, job_offer_id')
        .in('job_offer_id', offerIds)
        .order('created_at', { ascending: false })
      staffApplications = (data ?? []) as typeof staffApplications
    }
  } catch { /* table may not exist pre-migration 003 */ }

  // Group applications by offer
  const appsByOffer = staffApplications.reduce<Record<string, typeof staffApplications>>((acc, a) => {
    if (!acc[a.job_offer_id]) acc[a.job_offer_id] = []
    acc[a.job_offer_id].push(a)
    return acc
  }, {})

  const totalApplications = staffApplications.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">
              {project.title}
            </Link>
            <span>/</span>
            <span>Staff técnico</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Bolsa de trabajo del proyecto</h1>
          <p className="text-sm text-muted-foreground">
            {offers?.length ?? 0} ofertas · {totalApplications} postulación{totalApplications !== 1 ? 'es' : ''} recibida{totalApplications !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/staff/nueva-oferta`}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Nueva oferta
        </Link>
      </div>

      {!offers || offers.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">No hay ofertas de trabajo publicadas para este proyecto.</p>
          <Link href={`/projects/${projectId}/staff/nueva-oferta`} className="text-sm font-medium underline underline-offset-4">
            Publicar la primera oferta
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {offers.map((offer) => {
            const apps = appsByOffer[offer.id] ?? []
            return (
              <div key={offer.id} className="space-y-3">
                <JobOfferCard offer={offer as Parameters<typeof JobOfferCard>[0]['offer']} />

                {/* Postulaciones recibidas para esta oferta */}
                {apps.length > 0 && (
                  <div className="ml-2 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {apps.length} postulación{apps.length !== 1 ? 'es' : ''} recibida{apps.length !== 1 ? 's' : ''} · clic para expandir
                    </p>
                    <div className="space-y-2">
                      {apps.map(app => <ApplicationCard key={app.id} app={app} />)}
                    </div>
                  </div>
                )}

                {apps.length === 0 && offer.status === 'open' && (
                  <p className="ml-2 text-xs text-muted-foreground italic">Sin postulaciones todavía.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
