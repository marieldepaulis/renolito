import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Briefcase, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { MyOfferCard } from '@/components/job-offers/my-offer-card'

export const metadata: Metadata = { title: 'Bolsa de trabajo' }

export default async function BolsaDeTrabajoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  // Try to fetch with slug (post-migration 002); fall back gracefully if column doesn't exist
  let jobOffers: unknown[] | null = null
  let hasSlug = true

  try {
    const { data, error } = await supabase
      .from('job_offers')
      .select(`
        id, title, description, speciality, is_paid, estimated_rate, rate_unit, rate_currency,
        is_barter, barter_description, status, required_date, created_at,
        projects(id, title, slug, registration_link_token, project_types(name))
      `)
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false })

    if (error?.message?.includes('slug')) {
      hasSlug = false
      throw error
    }
    jobOffers = data
  } catch {
    hasSlug = false
    const { data } = await supabase
      .from('job_offers')
      .select(`
        id, title, description, speciality, is_paid, estimated_rate, rate_unit, rate_currency,
        is_barter, barter_description, status, required_date, created_at,
        projects(id, title, registration_link_token, project_types(name))
      `)
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false })
    jobOffers = data
  }

  const { data: publicOffers } = await supabase
    .from('job_offers')
    .select(`
      id, title, description, speciality, is_paid, estimated_rate, rate_unit, rate_currency,
      is_barter, barter_description, status, required_date, created_at,
      organizations(name, city),
      projects(title, project_types(name))
    `)
    .eq('status', 'open')
    .neq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(50)

  type Project = { id: string; title: string; slug?: string | null; registration_link_token: string; project_types: { name: string } | null }
  type Offer = {
    id: string; title: string; description: string; speciality: string
    is_paid: boolean; estimated_rate: number | null; rate_unit: string | null; rate_currency: string
    is_barter: boolean; barter_description: string | null
    status: string; required_date: string | null; created_at: string
    projects: Project | null
  }

  const myOffers = (jobOffers ?? []) as Offer[]

  function staffLink(project: Project | null) {
    if (!project) return null
    const token = hasSlug && project.slug ? project.slug : project.registration_link_token
    return `/staff/${token}`
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bolsa de trabajo</h1>
          <p className="text-sm text-muted-foreground">
            Ofertas de trabajo técnico para producciones audiovisuales
          </p>
        </div>
        <Link
          href="/bolsa-de-trabajo/nueva"
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Nueva oferta
        </Link>
      </div>

      {/* My org's offers */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Mis ofertas publicadas</h2>
        {myOffers.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
            <Briefcase className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aún no publicaste ofertas de trabajo</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myOffers.map((offer) => (
              <MyOfferCard
                key={offer.id}
                offer={{
                  id:                 offer.id,
                  title:              offer.title,
                  description:        offer.description,
                  speciality:         offer.speciality,
                  is_paid:            offer.is_paid,
                  estimated_rate:     offer.estimated_rate,
                  rate_unit:          offer.rate_unit,
                  rate_currency:      offer.rate_currency,
                  is_barter:          offer.is_barter,
                  barter_description: offer.barter_description,
                  status:             offer.status,
                  required_date:      offer.required_date,
                  staffLink:          staffLink(offer.projects),
                  projectId:          (offer.projects as unknown as { slug?: string } | null)?.slug ?? offer.projects?.id ?? null,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Public board */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Ofertas disponibles en la comunidad</h2>
        {!publicOffers || publicOffers.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">No hay ofertas públicas disponibles en este momento</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(publicOffers as unknown as Array<{
              id: string; title: string; description: string; speciality: string
              is_paid: boolean; estimated_rate: number | null; rate_unit: string | null; rate_currency: string
              is_barter: boolean; barter_description: string | null
              status: string; required_date: string | null; created_at: string
              organizations: { name: string; city: string | null } | null
              projects: { title: string; project_types: { name: string } | null } | null
            }>).map((offer) => (
              <div key={offer.id} className="rounded-lg border bg-card p-4 space-y-2">
                <p className="font-medium text-sm">{offer.title}</p>
                <p className="text-xs text-muted-foreground">
                  {offer.organizations?.name}{offer.organizations?.city ? ` · ${offer.organizations.city}` : ''}
                </p>
                <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{offer.speciality}</span>
                {offer.description && <p className="text-xs text-muted-foreground line-clamp-2">{offer.description}</p>}
                <p className="text-xs text-muted-foreground">
                  {offer.is_barter
                    ? `Canje: ${offer.barter_description ?? 'Ver detalles'}`
                    : offer.is_paid && offer.estimated_rate
                      ? `${formatCurrency(offer.estimated_rate, offer.rate_currency ?? 'EUR')}${offer.rate_unit ? `/${offer.rate_unit}` : ''}`
                      : 'Sin remuneración'}
                </p>
                <p className="text-xs text-muted-foreground">Publicada: {formatDate(offer.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
