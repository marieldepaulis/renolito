'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Pencil, Trash2, X, CheckCircle2 } from 'lucide-react'

type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

interface Session {
  id: string
  title: string
  scheduled_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  location_address: string | null
  internal_notes: string | null
  status: SessionStatus
}

interface Props {
  projectId: string
  session:   Session
  backHref:  string
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  scheduled:   'Programada',
  in_progress: 'En curso',
  completed:   'Completada',
  cancelled:   'Cancelada',
}
const STATUS_COLORS: Record<SessionStatus, string> = {
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed:   'bg-emerald-100 text-emerald-700',
  cancelled:   'bg-red-100 text-red-600',
}
const STATUS_NEXT: Partial<Record<SessionStatus, SessionStatus>> = {
  scheduled:   'in_progress',
  in_progress: 'completed',
}

export function SessionDetail({ projectId, session, backHref }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [status,       setStatus]       = useState<SessionStatus>(session.status)
  const [editOpen,     setEditOpen]     = useState(false)
  const [deleteOpen,   setDeleteOpen]   = useState(false)
  const [deleteInput,  setDeleteInput]  = useState('')
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)

  // Edit form state
  const [title,           setTitle]           = useState(session.title)
  const [scheduledDate,   setScheduledDate]   = useState(session.scheduled_date)
  const [startTime,       setStartTime]       = useState(session.start_time ?? '')
  const [endTime,         setEndTime]         = useState(session.end_time ?? '')
  const [location,        setLocation]        = useState(session.location ?? '')
  const [locationAddress, setLocationAddress] = useState(session.location_address ?? '')
  const [internalNotes,   setInternalNotes]   = useState(session.internal_notes ?? '')

  const apiBase = `/api/projects/${projectId}/sessions/${session.id}`
  const base    = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  async function handleSave() {
    if (!title.trim() || !scheduledDate) { toast.error('Título y fecha son obligatorios'); return }
    setSaving(true)
    const res = await fetch(apiBase, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), scheduled_date: scheduledDate, start_time: startTime || null, end_time: endTime || null, location: location || null, location_address: locationAddress || null, internal_notes: internalNotes || null }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSaving(false); return }
    toast.success('Sesión actualizada')
    setEditOpen(false)
    setSaving(false)
    startTransition(() => router.refresh())
  }

  async function handleStatusChange(next: SessionStatus) {
    setStatusLoading(true)
    const res = await fetch(apiBase, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al actualizar estado') }
    else { setStatus(next); toast.success(`Sesión marcada como "${STATUS_LABEL[next]}"`) }
    setStatusLoading(false)
  }

  async function handleDelete() {
    if (deleteInput !== session.title) return
    setDeleting(true)
    const res = await fetch(apiBase, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al eliminar'); setDeleting(false); return }
    toast.success('Sesión eliminada')
    router.push(backHref)
  }

  const nextStatus = STATUS_NEXT[status]

  return (
    <>
      {/* Info + actions */}
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {nextStatus && (
              <button type="button" onClick={() => handleStatusChange(nextStatus)} disabled={statusLoading}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50">
                {statusLoading ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                {nextStatus === 'in_progress' ? 'Iniciar' : 'Completar'}
              </button>
            )}
            <button type="button" onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              <Pencil className="size-3.5" /> Editar
            </button>
            <button type="button" onClick={() => { setDeleteInput(''); setDeleteOpen(true) }}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">
              <Trash2 className="size-3.5" /> Eliminar
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted-foreground">Fecha</dt><dd className="font-medium mt-0.5">{new Date(session.scheduled_date + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
          {(session.start_time || session.end_time) && (
            <div><dt className="text-muted-foreground">Horario</dt><dd className="font-medium mt-0.5">{session.start_time?.slice(0,5)}{session.end_time ? ` – ${session.end_time.slice(0,5)}` : ''}</dd></div>
          )}
          {session.location && (
            <div><dt className="text-muted-foreground">Lugar</dt><dd className="font-medium mt-0.5">{session.location}</dd></div>
          )}
          {session.location_address && (
            <div><dt className="text-muted-foreground">Dirección</dt><dd className="font-medium mt-0.5">{session.location_address}</dd></div>
          )}
          {session.internal_notes && (
            <div className="col-span-2"><dt className="text-muted-foreground">Notas internas</dt><dd className="mt-0.5 whitespace-pre-line text-muted-foreground">{session.internal_notes}</dd></div>
          )}
        </dl>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Editar sesión</h2>
              <button type="button" onClick={() => setEditOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={base} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Fecha *</label>
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className={base} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Inicio</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={base} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Fin</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={base} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Lugar</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Estudio, sala, etc." className={base} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Dirección</label>
                <input type="text" value={locationAddress} onChange={e => setLocationAddress(e.target.value)} placeholder="Calle, número…" className={base} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notas internas</label>
                <textarea rows={3} value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
                  className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-5 py-4">
              <button type="button" onClick={() => setEditOpen(false)} className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saving && <Loader2 className="size-4 animate-spin" />} Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold text-destructive">Eliminar sesión</h2>
              <button type="button" onClick={() => setDeleteOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">Esta acción es irreversible. Escribe <strong className="text-foreground">"{session.title}"</strong> para confirmar.</p>
              <input type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder={session.title}
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="flex justify-end gap-3 border-t px-5 py-4">
              <button type="button" onClick={() => setDeleteOpen(false)} className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent">Cancelar</button>
              <button type="button" onClick={handleDelete} disabled={deleting || deleteInput !== session.title}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
                {deleting && <Loader2 className="size-4 animate-spin" />} Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
