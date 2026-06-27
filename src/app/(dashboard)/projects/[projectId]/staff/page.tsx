import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Plus, FileText, ExternalLink, Download } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { JobOfferCard } from '@/components/projects/job-offer-card'

export const metadata: Metadata = { title: 'Staff técnico' }

interface Props {
  params: Promise<{ projectId: string }>
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-zinc-100 text-zinc-600',
  reviewing: 'bg-blue-100 text-blue-700',
  accepted:  'bg-emerald-100 text-emerald-700',
  rejected:  'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  pending:   'Pendiente',
  reviewing: 'En revisión',
  accepted:  'Aceptado',
  rejected:  'Rechazado',
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
                      {apps.length} postulación{apps.length !== 1 ? 'es' : ''} recibida{apps.length !== 1 ? 's' : ''}
                    </p>
                    <div className="space-y-2">
                      {apps.map(app => (
                        <div key={app.id} className="rounded-lg border bg-card p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="font-medium text-sm">{app.full_name}</p>
                              <a href={`mailto:${app.email}`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                                {app.email}
                              </a>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[app.status] ?? STATUS_BADGE.pending}`}>
                                {STATUS_LABEL[app.status] ?? 'Pendiente'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(app.created_at, { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                          </div>

                          {app.proposed_rate && (
                            <p className="text-xs text-muted-foreground">
                              Tarifa propuesta: <span className="font-medium text-foreground">{formatCurrency(app.proposed_rate, 'ARS')}</span>
                            </p>
                          )}

                          {app.cover_note && (
                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-wrap">
                              {app.cover_note}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 pt-1">
                            {app.portfolio_url && (
                              <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors">
                                <ExternalLink className="size-3" /> Portfolio
                              </a>
                            )}
                            {app.cv_url && (
                              <a href={app.cv_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors">
                                <Download className="size-3" /> Descargar CV
                              </a>
                            )}
                            <ApplicationStatusChanger appId={app.id} currentStatus={app.status} />
                          </div>
                        </div>
                      ))}
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

// Inline server-safe status badge — change status via API
function ApplicationStatusChanger({ appId, currentStatus }: { appId: string; currentStatus: string }) {
  // Rendered as a client island via a small form — using native form for simplicity
  const nextStatuses = [
    { value: 'reviewing', label: 'Marcar en revisión' },
    { value: 'accepted',  label: 'Aceptar' },
    { value: 'rejected',  label: 'Rechazar' },
  ].filter(s => s.value !== currentStatus)

  if (nextStatuses.length === 0) return null

  return (
    <form action={`/api/staff/applications/${appId}`} method="POST" className="flex flex-wrap gap-1">
      {nextStatuses.map(s => (
        <button key={s.value} type="submit" name="status" value={s.value}
          formMethod="POST"
          className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-colors hover:bg-accent ${
            s.value === 'accepted' ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' :
            s.value === 'rejected' ? 'border-red-200 text-red-600 hover:bg-red-50' : ''
          }`}>
          {s.label}
        </button>
      ))}
    </form>
  )
}
