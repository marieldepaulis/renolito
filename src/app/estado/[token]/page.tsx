import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CheckCircle2, Clock, XCircle, AlertCircle, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Estado de inscripción' }

interface Props {
  params: Promise<{ token: string }>
}

interface StatusData {
  applicant_name:   string
  project_title:    string
  project_type:     string
  status:           string
  status_label:     string
  submitted_at:     string
  assigned_session: {
    title:          string
    scheduled_date: string
  } | null
}

const STATUS_CONFIG: Record<string, {
  icon:  React.ElementType
  color: string
  bg:    string
}> = {
  pending: {
    icon:  Clock,
    color: 'text-zinc-600',
    bg:    'bg-zinc-50 border-zinc-200',
  },
  pre_approved: {
    icon:  CheckCircle2,
    color: 'text-yellow-600',
    bg:    'bg-yellow-50 border-yellow-200',
  },
  contract_sent: {
    icon:  AlertCircle,
    color: 'text-blue-600',
    bg:    'bg-blue-50 border-blue-200',
  },
  confirmed: {
    icon:  CheckCircle2,
    color: 'text-emerald-600',
    bg:    'bg-emerald-50 border-emerald-200',
  },
  rejected: {
    icon:  XCircle,
    color: 'text-red-500',
    bg:    'bg-red-50 border-red-200',
  },
  waitlisted: {
    icon:  Clock,
    color: 'text-orange-500',
    bg:    'bg-orange-50 border-orange-200',
  },
  cancelled: {
    icon:  XCircle,
    color: 'text-zinc-400',
    bg:    'bg-zinc-50 border-zinc-200',
  },
}

async function getStatus(token: string): Promise<StatusData | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `http://localhost:${process.env.PORT ?? 3000}`

  const res = await fetch(`${baseUrl}/api/estado/${token}`, {
    // No cache — status must always be real-time
    cache: 'no-store',
  })

  if (!res.ok) return null
  return res.json()
}

export default async function EstadoPage({ params }: Props) {
  const { token } = await params
  const data = await getStatus(token)

  if (!data) notFound()

  const config = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.pending
  const Icon = config.icon

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {data.project_type}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {data.project_title}
          </h1>
        </div>

        {/* Status card */}
        <div className={`rounded-xl border p-6 ${config.bg}`}>
          <div className="flex items-center gap-4">
            <Icon className={`size-8 shrink-0 ${config.color}`} />
            <div>
              <p className="font-semibold text-foreground">
                {data.status_label}
              </p>
              <p className="text-sm text-muted-foreground">
                Inscripción de {data.applicant_name}
              </p>
            </div>
          </div>
        </div>

        {/* Assigned session */}
        {data.assigned_session && (
          <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <Calendar className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">{data.assigned_session.title}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(data.assigned_session.scheduled_date, {
                  weekday: 'long',
                  day:     '2-digit',
                  month:   'long',
                  year:    'numeric',
                })}
              </p>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Inscripción enviada:{' '}
            <span className="font-medium text-foreground">
              {formatDate(data.submitted_at, {
                day:    '2-digit',
                month:  'long',
                year:   'numeric',
                hour:   '2-digit',
                minute: '2-digit',
              })}
            </span>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Guarda esta página o el email que recibiste para consultar tu estado
          en cualquier momento. No necesitas crear una cuenta.
        </p>
      </div>
    </div>
  )
}
