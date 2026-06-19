import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Briefcase, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatCurrency } from '@/lib/utils'

export const metadata: Metadata = { title: 'Bolsa de trabajo' }

export default async function BolsaDeTrabajoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { data: jobOffers } = await supabase
    .from('job_offers')
    .select(`
      id, title, description, is_paid, compensation_amount, rate_currency,
      is_barter, barter_description, status, expires_at, created_at,
      projects(title, project_types(name)),
      specialties(name)
    `)
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })

  const { data: publicOffers } = await supabase
    .from('job_offers')
    .select(`
      id, title, description, is_paid, compensation_amount, rate_currency,
      is_barter, barter_description, status, expires_at, created_at,
      organizations(name, city),
      projects(title, project_types(name)),
      specialties(name)
    `)
    .eq('status', 'open')
    .neq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bolsa de trabajo</h1>
          <p className="text-sm text-muted-foreground">
            Ofertas de trabajo técnico para producciones audiovisuales
          </p>
        </div>
      </div>

      {/* My org's offers */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Mis ofertas publicadas</h2>
        {!jobOffers || jobOffers.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
            <Briefcase className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aún no publicaste ofertas de trabajo
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobOffers.map((offer) => {
              const project = offer.projects as unknown as { title: string; project_types: { name: string } | null } | null
              const specialty = offer.specialties as unknown as { name: string } | null
              return (
                <div key={offer.id} className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{offer.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {project?.title} · {project?.project_types?.name}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      offer.status === 'open'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {offer.status === 'open' ? 'Abierta' : 'Cerrada'}
                    </span>
                  </div>
                  {specialty && (
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      {specialty.name}
                    </span>
                  )}
                  {offer.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {offer.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {offer.is_barter
                      ? `Canje: ${offer.barter_description ?? 'Ver detalles'}`
                      : offer.is_paid && offer.compensation_amount
                        ? formatCurrency(offer.compensation_amount, offer.rate_currency ?? 'EUR')
                        : 'Sin remuneración'}
                  </p>
                  {offer.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      Vence: {formatDate(offer.expires_at)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Public board */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Ofertas disponibles en la comunidad</h2>
        {!publicOffers || publicOffers.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              No hay ofertas públicas disponibles en este momento
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicOffers.map((offer) => {
              const project    = offer.projects    as unknown as { title: string; project_types: { name: string } | null } | null
              const org        = offer.organizations as unknown as { name: string; city: string | null } | null
              const specialty  = offer.specialties  as unknown as { name: string } | null
              return (
                <div key={offer.id} className="rounded-lg border bg-card p-4 space-y-2">
                  <p className="font-medium text-sm">{offer.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {org?.name} · {org?.city}
                  </p>
                  {specialty && (
                    <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                      {specialty.name}
                    </span>
                  )}
                  {offer.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {offer.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {offer.is_barter
                      ? `Canje: ${offer.barter_description ?? 'Ver detalles'}`
                      : offer.is_paid && offer.compensation_amount
                        ? formatCurrency(offer.compensation_amount, offer.rate_currency ?? 'EUR')
                        : 'Sin remuneración'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Publicada: {formatDate(offer.created_at)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
