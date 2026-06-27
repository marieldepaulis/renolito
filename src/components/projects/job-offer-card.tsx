'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, XCircle, Users, Pencil, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

type OfferStatus = 'open' | 'filled' | 'closed'

interface Application {
  id: string
  status: string
  agreed_rate: number | null
  technician_profiles: {
    profiles: { full_name: string; email: string } | null
  } | null
}

interface Offer {
  id: string
  title: string
  speciality: string
  is_paid: boolean
  is_barter: boolean
  estimated_rate: number | null
  rate_currency: string
  rate_unit: string | null
  status: OfferStatus
  required_date: string | null
  barter_description: string | null
  description: string | null
  max_applicants: number | null
  technician_applications: unknown
}

const STATUS_LABEL: Record<string, string> = {
  open:      'Abierta',
  filled:    'Cubierta',
  closed:    'Cerrada',
  pending:   'Pendiente',
  confirmed: 'Confirmado',
  rejected:  'Rechazado',
  cancelled: 'Cancelado',
}

const STATUS_CLASS: Record<string, string> = {
  open:      'bg-emerald-100 text-emerald-700',
  filled:    'bg-blue-100 text-blue-700',
  closed:    'bg-zinc-100 text-zinc-500',
  pending:   'bg-zinc-100 text-zinc-600',
  confirmed: 'bg-emerald-100 text-emerald-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-400',
}

const inputCls = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function JobOfferCard({ offer }: { offer: Offer }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [status, setStatus]             = useState<OfferStatus>(offer.status)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [editOpen, setEditOpen]         = useState(false)
  const [saving, setSaving]             = useState(false)

  // Edit state
  const [title,             setTitle]             = useState(offer.title)
  const [speciality,        setSpeciality]        = useState(offer.speciality)
  const [description,       setDescription]       = useState(offer.description ?? '')
  const [barterDescription, setBarterDescription] = useState(offer.barter_description ?? '')
  const [requiredDate,      setRequiredDate]      = useState(offer.required_date ?? '')
  const [maxApplicants,     setMaxApplicants]     = useState(String(offer.max_applicants ?? ''))

  const apps = (offer.technician_applications as Application[]) ?? []

  async function changeStatus(next: OfferStatus) {
    setLoadingAction(next)
    const res = await fetch(`/api/job-offers/${offer.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al actualizar') }
    else { setStatus(next); toast.success(`Oferta marcada como "${STATUS_LABEL[next]}"`); startTransition(() => router.refresh()) }
    setLoadingAction(null)
  }

  async function handleSave() {
    if (!title.trim() || !speciality.trim()) { toast.error('Nombre y especialidad son obligatorios'); return }
    setSaving(true)
    const res = await fetch(`/api/job-offers/${offer.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:               title.trim(),
        speciality:          speciality.trim(),
        description:         description || null,
        barter_description:  barterDescription || null,
        required_date:       requiredDate || null,
        max_applicants:      maxApplicants ? Number(maxApplicants) : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSaving(false); return }
    toast.success('Oferta actualizada')
    setEditOpen(false)
    setSaving(false)
    startTransition(() => router.refresh())
  }

  return (
    <>
      <div className="rounded-lg border bg-card">
        {/* Header */}
        <div className="flex items-start justify-between p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium">{offer.title}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                offer.is_barter ? 'bg-purple-100 text-purple-700'
                  : offer.is_paid ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-zinc-100 text-zinc-600'
              }`}>
                {offer.is_barter ? 'Intercambio' : offer.is_paid ? 'Remunerado' : 'Colaborativo'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {offer.speciality}
              {offer.estimated_rate ? ` · ${formatCurrency(offer.estimated_rate, offer.rate_currency)}/${offer.rate_unit}` : ''}
              {offer.required_date ? ` · ${formatDate(offer.required_date, { day: '2-digit', month: 'short' })}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}>
              {STATUS_LABEL[status]}
            </span>

            <button type="button" onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent">
              <Pencil className="size-3.5" /> Editar
            </button>

            {status === 'open' && (
              <>
                <button type="button" onClick={() => changeStatus('filled')} disabled={!!loadingAction}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50">
                  {loadingAction === 'filled' ? <Loader2 className="size-3.5 animate-spin" /> : <Users className="size-3.5" />}
                  Cubrir
                </button>
                <button type="button" onClick={() => changeStatus('closed')} disabled={!!loadingAction}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50">
                  {loadingAction === 'closed' ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                  Cerrar
                </button>
              </>
            )}

            {(status === 'filled' || status === 'closed') && (
              <button type="button" onClick={() => changeStatus('open')} disabled={!!loadingAction}
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50">
                {loadingAction === 'open' ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Reabrir
              </button>
            )}
          </div>
        </div>

        {/* Applications */}
        {apps.length > 0 ? (
          <div className="border-t">
            <p className="px-5 py-2 text-xs font-medium text-muted-foreground">
              {apps.length} postulación{apps.length !== 1 ? 'es' : ''}
            </p>
            <div className="divide-y">
              {apps.map((app) => {
                const profile = app.technician_profiles?.profiles
                return (
                  <div key={app.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{profile?.full_name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{profile?.email ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {app.agreed_rate && (
                        <span className="text-sm font-medium">{formatCurrency(app.agreed_rate, offer.rate_currency)}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[app.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {STATUS_LABEL[app.status] ?? app.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="border-t px-5 py-3">
            <p className="text-xs text-muted-foreground">Sin postulaciones todavía</p>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Editar oferta</h2>
              <button type="button" onClick={() => setEditOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre del puesto *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Especialidad *</label>
                <input type="text" value={speciality} onChange={e => setSpeciality(e.target.value)} placeholder="Cámara, sonido, iluminación…" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descripción</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                  className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
              </div>
              {offer.is_barter && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Descripción del intercambio</label>
                  <input type="text" value={barterDescription} onChange={e => setBarterDescription(e.target.value)} className={inputCls} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Fecha requerida</label>
                  <input type="date" value={requiredDate} onChange={e => setRequiredDate(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Máx. postulantes</label>
                  <input type="number" min={1} value={maxApplicants} onChange={e => setMaxApplicants(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-5 py-4">
              <button type="button" onClick={() => setEditOpen(false)}
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent">
                Cancelar
              </button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saving && <Loader2 className="size-4 animate-spin" />} Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
