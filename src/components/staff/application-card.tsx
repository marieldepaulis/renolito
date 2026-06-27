'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, Download, ExternalLink, ChevronDown, ChevronUp, Loader2, Mail, FileText, Link2 } from 'lucide-react'

interface Application {
  id: string
  full_name: string
  email: string
  cover_note: string | null
  proposed_rate: number | null
  portfolio_url: string | null
  cv_url: string | null
  status: string
  created_at: string
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-zinc-100 text-zinc-600',
  reviewing: 'bg-blue-100 text-blue-700',
  accepted:  'bg-emerald-100 text-emerald-700',
  rejected:  'bg-red-100 text-red-600',
}
const STATUS_LABEL: Record<string, string> = {
  pending:   'Pendiente',
  reviewing: 'En revisión',
  accepted:  'Aceptado',
  rejected:  'Rechazado',
}

export function ApplicationCard({ app }: { app: Application }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [expanded,  setExpanded]  = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [updating,  setUpdating]  = useState(false)

  async function changeStatus(status: string) {
    setUpdating(true)
    const res = await fetch(`/api/staff/applications/${app.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    if (!res.ok) {
      toast.error('Error al actualizar el estado')
    } else {
      toast.success(`Estado actualizado: ${STATUS_LABEL[status]}`)
      startTransition(() => router.refresh())
    }
    setUpdating(false)
  }

  const date = new Date(app.created_at).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Header — always visible */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-accent/40 transition-colors select-none"
          onClick={() => setExpanded(v => !v)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
              {app.full_name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight truncate">{app.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{app.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {app.cv_url && <FileText className="size-3.5 text-muted-foreground" />}
            {app.portfolio_url && <Link2 className="size-3.5 text-muted-foreground" />}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[app.status] ?? STATUS_BADGE.pending}`}>
              {STATUS_LABEL[app.status] ?? 'Pendiente'}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block">{date}</span>
            {expanded
              ? <ChevronUp  className="size-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            }
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t px-4 py-4 space-y-4">
            {/* Contact + rate */}
            <div className="flex flex-wrap gap-4 text-sm">
              <a href={`mailto:${app.email}`}
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
                onClick={e => e.stopPropagation()}>
                <Mail className="size-3.5" /> {app.email}
              </a>
              {app.proposed_rate && (
                <span className="text-muted-foreground">
                  Tarifa propuesta: <strong className="text-foreground">${app.proposed_rate.toLocaleString('es-AR')}</strong>
                </span>
              )}
            </div>

            {/* Cover note */}
            {app.cover_note ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Presentación</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{app.cover_note}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sin carta de presentación.</p>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-2">
              {app.portfolio_url && (
                <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                  <ExternalLink className="size-3.5" /> Ver portfolio
                </a>
              )}
              {app.cv_url && (
                <a href={app.cv_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                  <Download className="size-3.5" /> Descargar CV
                </a>
              )}
            </div>

            {/* Status actions */}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <p className="text-xs text-muted-foreground mr-1">Cambiar estado:</p>
              {(['pending','reviewing','accepted','rejected'] as const)
                .filter(s => s !== app.status)
                .map(s => (
                  <button key={s} type="button" disabled={updating} onClick={() => changeStatus(s)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors disabled:opacity-50 ${
                      s === 'accepted' ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' :
                      s === 'rejected' ? 'border-red-200 text-red-600 hover:bg-red-50' :
                      'hover:bg-accent'
                    }`}>
                    {updating && <Loader2 className="size-3 animate-spin" />}
                    {STATUS_LABEL[s]}
                  </button>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* Full modal (optional click on name) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-lg rounded-xl border bg-background shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-semibold">{app.full_name}</h2>
                <p className="text-xs text-muted-foreground">{app.email} · {date}</p>
              </div>
              <button onClick={() => setModalOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4 p-5 max-h-[60vh] overflow-y-auto">
              {app.cover_note && <p className="text-sm leading-relaxed whitespace-pre-wrap">{app.cover_note}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
