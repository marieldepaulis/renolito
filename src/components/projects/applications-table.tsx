'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { ApplicationStatus } from '@/types/database'

interface Application {
  id:             string
  guest_name:     string
  guest_email:    string
  status:         ApplicationStatus
  submitted_at:   string
  sessions:       unknown
  producer_notes: string | null
}

interface Props {
  applications: Application[]
  sessions:     { id: string; title: string; scheduled_date: string }[]
  projectId:    string
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending:       'Pendiente',
  pre_approved:  'Pre-aprobado',
  contract_sent: 'Contrato enviado',
  confirmed:     'Confirmado',
  rejected:      'Rechazado',
  waitlisted:    'Lista de espera',
  cancelled:     'Cancelado',
}

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  pending:       'bg-zinc-100 text-zinc-700',
  pre_approved:  'bg-yellow-100 text-yellow-700',
  contract_sent: 'bg-blue-100 text-blue-700',
  confirmed:     'bg-emerald-100 text-emerald-700',
  rejected:      'bg-red-100 text-red-700',
  waitlisted:    'bg-orange-100 text-orange-700',
  cancelled:     'bg-zinc-100 text-zinc-400',
}

const NEXT_STATUSES: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  pending:      ['pre_approved', 'rejected', 'waitlisted'],
  pre_approved: ['contract_sent', 'rejected', 'waitlisted'],
  contract_sent:['confirmed', 'rejected'],
  waitlisted:   ['pre_approved', 'rejected', 'cancelled'],
}

export function ApplicationsTable({ applications: initial, projectId }: Props) {
  const supabase  = createClient()
  const [apps, setApps]         = useState(initial)
  const [updating, setUpdating] = useState<string | null>(null)

  async function updateStatus(appId: string, newStatus: ApplicationStatus) {
    setUpdating(appId)
    const { error } = await supabase
      .from('artist_applications')
      .update({ status: newStatus, status_updated_at: new Date().toISOString() })
      .eq('id', appId)

    if (error) {
      toast.error(error.message)
    } else {
      setApps((prev) =>
        prev.map((a) => a.id === appId ? { ...a, status: newStatus } : a),
      )
      toast.success(`Estado actualizado a "${STATUS_LABELS[newStatus]}"`)
    }
    setUpdating(null)
  }

  if (apps.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          Aún no hay inscripciones para este proyecto.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sesión</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {apps.map((app) => {
            const nextStatuses = NEXT_STATUSES[app.status] ?? []
            return (
              <tr key={app.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{app.guest_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{app.guest_email}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {(app.sessions as { title: string } | null)?.title ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[app.status]}`}>
                    {STATUS_LABELS[app.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(app.submitted_at)}
                </td>
                <td className="px-4 py-3">
                  {nextStatuses.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {nextStatuses.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={updating === app.id}
                          onClick={() => updateStatus(app.id, s)}
                          className="rounded border px-2 py-0.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
