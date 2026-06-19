import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

export const metadata: Metadata = { title: 'Staff técnico' }

interface Props {
  params: Promise<{ projectId: string }>
}

const STATUS_LABEL: Record<string, string> = {
  pending:       'Pendiente',
  pre_approved:  'Preaprobado',
  contract_sent: 'Contrato enviado',
  confirmed:     'Confirmado',
  rejected:      'Rechazado',
  waitlisted:    'Lista de espera',
  cancelled:     'Cancelado',
}

const STATUS_CLASS: Record<string, string> = {
  pending:       'bg-zinc-100 text-zinc-600',
  pre_approved:  'bg-yellow-100 text-yellow-700',
  contract_sent: 'bg-blue-100 text-blue-700',
  confirmed:     'bg-emerald-100 text-emerald-700',
  rejected:      'bg-red-100 text-red-700',
  waitlisted:    'bg-orange-100 text-orange-700',
  cancelled:     'bg-zinc-100 text-zinc-400',
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
      required_date,
      technician_applications(id, status, agreed_rate,
        technician_profiles(user_id,
          profiles(full_name, email)
        )
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

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
          <h1 className="text-2xl font-semibold tracking-tight">
            Bolsa de trabajo del proyecto
          </h1>
          <p className="text-sm text-muted-foreground">
            {offers?.length ?? 0} ofertas publicadas
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
          <p className="text-sm text-muted-foreground">
            No hay ofertas de trabajo publicadas para este proyecto.
          </p>
          <Link
            href={`/projects/${projectId}/staff/nueva-oferta`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Publicar la primera oferta
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {offers.map((offer) => {
            const apps = (
              offer.technician_applications as unknown as Array<{
                id: string
                status: string
                agreed_rate: number | null
                technician_profiles: {
                  profiles: { full_name: string; email: string } | null
                } | null
              }>
            ) ?? []

            return (
              <div key={offer.id} className="rounded-lg border bg-card">
                <div className="flex items-start justify-between p-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{offer.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          offer.is_barter
                            ? 'bg-purple-100 text-purple-700'
                            : offer.is_paid
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {offer.is_barter
                          ? 'Intercambio'
                          : offer.is_paid
                          ? 'Remunerado'
                          : 'Colaborativo'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {offer.speciality}
                      {offer.estimated_rate
                        ? ` · ${formatCurrency(offer.estimated_rate, offer.rate_currency)}/${offer.rate_unit}`
                        : ''}
                      {offer.required_date
                        ? ` · ${formatDate(offer.required_date, { day: '2-digit', month: 'short' })}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[offer.status]}`}
                  >
                    {STATUS_LABEL[offer.status] ?? offer.status}
                  </span>
                </div>

                {apps.length > 0 && (
                  <div className="border-t">
                    <p className="px-5 py-2 text-xs font-medium text-muted-foreground">
                      {apps.length} postulación{apps.length !== 1 ? 'es' : ''}
                    </p>
                    <div className="divide-y">
                      {apps.map((app) => {
                        const profile = app.technician_profiles?.profiles
                        return (
                          <div
                            key={app.id}
                            className="flex items-center justify-between px-5 py-3"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {profile?.full_name ?? '—'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {profile?.email ?? '—'}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              {app.agreed_rate && (
                                <span className="text-sm font-medium">
                                  {formatCurrency(app.agreed_rate, offer.rate_currency)}
                                </span>
                              )}
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[app.status]}`}
                              >
                                {STATUS_LABEL[app.status] ?? app.status}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
