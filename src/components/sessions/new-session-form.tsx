'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface Props {
  projectId: string
  backHref:  string
}

export function NewSessionForm({ projectId, backHref }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [title,           setTitle]           = useState('')
  const [scheduledDate,   setScheduledDate]   = useState('')
  const [startTime,       setStartTime]       = useState('')
  const [endTime,         setEndTime]         = useState('')
  const [location,        setLocation]        = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [internalNotes,   setInternalNotes]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !scheduledDate) {
      toast.error('El título y la fecha son obligatorios')
      return
    }

    setLoading(true)
    const res = await fetch(`/api/projects/${projectId}/sessions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        title:            title.trim(),
        scheduled_date:   scheduledDate,
        start_time:       startTime  || null,
        end_time:         endTime    || null,
        location:         location.trim()        || null,
        location_address: locationAddress.trim() || null,
        internal_notes:   internalNotes.trim()   || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Error al crear la sesión')
      setLoading(false)
      return
    }

    toast.success('Sesión creada')
    router.push(backHref)
    router.refresh()
  }

  const baseInput = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">

        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="title" className="text-sm font-medium">
            Nombre de la sesión <span className="text-destructive">*</span>
          </label>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Grabación cuerdas — Estudio A"
            className={baseInput}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="scheduled_date" className="text-sm font-medium">
            Fecha <span className="text-destructive">*</span>
          </label>
          <input
            id="scheduled_date"
            type="date"
            required
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className={baseInput}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="start_time" className="text-sm font-medium">Hora inicio</label>
            <input
              id="start_time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={baseInput}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="end_time" className="text-sm font-medium">Hora fin</label>
            <input
              id="end_time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={baseInput}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="location" className="text-sm font-medium">Lugar</label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ej: Estudio Rec 22, Barcelona"
            className={baseInput}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="location_address" className="text-sm font-medium">Dirección</label>
          <input
            id="location_address"
            type="text"
            value={locationAddress}
            onChange={(e) => setLocationAddress(e.target.value)}
            placeholder="Ej: Carrer de… nº…"
            className={baseInput}
          />
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="internal_notes" className="text-sm font-medium">
            Notas internas
          </label>
          <textarea
            id="internal_notes"
            rows={3}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Información para el equipo: parking, acceso, requisitos técnicos…"
            className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>

      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-accent"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? 'Creando…' : 'Crear sesión'}
        </button>
      </div>
    </form>
  )
}
