'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, Loader2, X, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Offer {
  id: string
  title: string
  description: string
  speciality: string
  is_paid: boolean
  estimated_rate: number | null
  rate_unit: string | null
  rate_currency: string
  is_barter: boolean
  barter_description: string | null
  status: string
  required_date: string | null
  staffLink: string | null
}

const inputCls = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function MyOfferCard({ offer: initial }: { offer: Offer }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [deleted,    setDeleted]    = useState(false)
  const [editOpen,   setEditOpen]   = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  // Edit fields
  const [title,       setTitle]       = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [speciality,  setSpeciality]  = useState(initial.speciality)
  const [reqDate,     setReqDate]     = useState(initial.required_date ?? '')

  async function handleSave() {
    if (!title.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    const res = await fetch(`/api/job-offers/${initial.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), description: description.trim(), speciality: speciality.trim(), required_date: reqDate || null }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSaving(false); return }
    toast.success('Oferta actualizada')
    setSaving(false)
    setEditOpen(false)
    startTransition(() => router.refresh())
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/job-offers/${initial.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al eliminar'); setDeleting(false); return }
    toast.success('Oferta eliminada')
    setDeleted(true)
    startTransition(() => router.refresh())
  }

  if (deleted) return null

  return (
    <>
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{title}</p>
            <p className="text-xs text-muted-foreground">{initial.staffLink ? 'Ver ofertas ↓' : ''}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              initial.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
            }`}>
              {initial.status === 'open' ? 'Abierta' : initial.status === 'filled' ? 'Cubierta' : 'Cerrada'}
            </span>
            <button type="button" onClick={() => setEditOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Editar">
              <Pencil className="size-3.5" />
            </button>
            <button type="button" onClick={() => setDelConfirm(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Eliminar">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{speciality}</span>

        {initial.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{initial.description}</p>
        )}

        <p className="text-xs text-muted-foreground">
          {initial.is_barter
            ? `Canje: ${initial.barter_description ?? 'Ver detalles'}`
            : initial.is_paid && initial.estimated_rate
              ? `${formatCurrency(initial.estimated_rate, initial.rate_currency)}${initial.rate_unit ? `/${initial.rate_unit}` : ''}`
              : 'Sin remuneración'}
        </p>

        {initial.required_date && (
          <p className="text-xs text-muted-foreground">
            Fecha: {formatDate(initial.required_date, { day: '2-digit', month: 'short' })}
          </p>
        )}

        {initial.staffLink && initial.status === 'open' && (
          <div className="border-t pt-2">
            <Link href={initial.staffLink} target="_blank"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="size-3" /> Link para técnicos
            </Link>
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
                <input type="text" value={speciality} onChange={e => setSpeciality(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descripción</label>
                <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
                  className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fecha requerida</label>
                <input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-5 py-4">
              <button type="button" onClick={() => setEditOpen(false)}
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saving && <Loader2 className="size-4 animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold text-destructive">Eliminar oferta</h2>
              <button type="button" onClick={() => setDelConfirm(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground">
                ¿Estás seguro de eliminar <strong className="text-foreground">"{initial.title}"</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t px-5 py-4">
              <button type="button" onClick={() => setDelConfirm(false)}
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent">Cancelar</button>
              <button type="button" onClick={handleDelete} disabled={deleting}
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
