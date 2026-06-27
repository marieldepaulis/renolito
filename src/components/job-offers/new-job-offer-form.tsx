'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface Project {
  id:    string
  title: string
}

const Schema = z.object({
  project_id:         z.string().uuid('Selecciona un proyecto'),
  title:              z.string().min(2, 'Título requerido').max(200),
  description:        z.string().min(2, 'Descripción requerida').max(2000),
  speciality:         z.string().min(1, 'Especialidad requerida').max(100),
  is_paid:            z.boolean().default(true),
  is_barter:          z.boolean().default(false),
  estimated_rate:     z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().positive().optional(),
  ),
  rate_unit:          z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.enum(['hour', 'day', 'project', 'session']).optional(),
  ),
  rate_currency:      z.string().length(3).default('EUR'),
  barter_description: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().max(500).optional(),
  ),
  max_applicants:     z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().int().positive().optional(),
  ),
  required_date:      z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().optional(),
  ),
  location:           z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().max(200).optional(),
  ),
})

type FormData = z.infer<typeof Schema>

const SPECIALITIES = [
  'Dirección de fotografía',
  'Cámara / Operador',
  'Sonido directo',
  'Dirección de arte',
  'Maquillaje y peluquería',
  'Vestuario',
  'Montaje / Edición',
  'Colorización',
  'Mezcla de sonido',
  'Producción musical',
  'Ingeniero de grabación',
  'Técnico de luces',
  'Técnico de grúa / Drone',
  'Asistente de cámara',
  'Asistente de dirección',
  'Script / Continuista',
  'Productor de campo',
  'Postproducción VFX',
  'Diseño gráfico / Motion',
  'Otro',
]

interface FormProps {
  projects:         Project[]
  defaultProjectId?: string
  backHref?:         string
}

export function NewJobOfferForm({ projects, defaultProjectId, backHref }: FormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema) as Resolver<FormData>,
    mode: 'all',
    defaultValues: {
      is_paid:      true,
      is_barter:    false,
      rate_currency:'EUR',
      project_id:   defaultProjectId ?? '',
    },
  })

  // Ensure react-hook-form internal store has the fixed project id.
  // A hidden <input> with a static value prop never fires onChange,
  // so we use setValue which writes directly to the form store.
  useEffect(() => {
    if (defaultProjectId) setValue('project_id', defaultProjectId)
  }, [defaultProjectId, setValue])

  const isPaid   = watch('is_paid')
  const isBarter = watch('is_barter')

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await fetch('/api/job-offers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...data,
          estimated_rate:     data.estimated_rate     ?? null,
          rate_unit:          data.rate_unit           ?? null,
          barter_description: data.barter_description ?? null,
          max_applicants:     data.max_applicants      ?? null,
          required_date:      data.required_date       || null,
          location:           data.location            || null,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error ?? 'Error al crear la oferta')
        return
      }
      toast.success('Oferta publicada')
      router.push(backHref ?? '/bolsa-de-trabajo')
      router.refresh()
    } catch (err) {
      toast.error('Error de red al enviar la oferta')
    } finally {
      setLoading(false)
    }
  }

  function onValidationError(errs: typeof errors) {
    toast.error('Revisá los campos marcados en rojo')
  }

  const baseInput = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <form onSubmit={handleSubmit(onSubmit, onValidationError)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">

        {/* Proyecto */}
        <div className="space-y-1.5">
          <label htmlFor="project_id" className="text-sm font-medium">
            Proyecto <span className="text-destructive">*</span>
          </label>
          {defaultProjectId ? (
            <div className={`${baseInput} bg-muted/50 text-muted-foreground`}>
              {projects[0]?.title ?? defaultProjectId}
            </div>
          ) : (
            <select id="project_id" {...register('project_id')} className={baseInput}>
              <option value="">Selecciona un proyecto…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          )}
          {errors.project_id && <p className="text-xs text-destructive">{errors.project_id.message}</p>}
        </div>

        {/* Especialidad */}
        <div className="space-y-1.5">
          <label htmlFor="speciality" className="text-sm font-medium">
            Especialidad <span className="text-destructive">*</span>
          </label>
          <select id="speciality" {...register('speciality')} className={baseInput}>
            <option value="">Selecciona especialidad…</option>
            {SPECIALITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.speciality && <p className="text-xs text-destructive">{errors.speciality.message}</p>}
        </div>

        {/* Título */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="title" className="text-sm font-medium">
            Título de la oferta <span className="text-destructive">*</span>
          </label>
          <input
            id="title"
            type="text"
            placeholder="Ej: Técnico de sonido directo — rodaje 3 días"
            {...register('title')}
            className={baseInput}
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        {/* Descripción */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            Descripción <span className="text-destructive">*</span>
          </label>
          <textarea
            id="description"
            rows={4}
            placeholder="Describe el trabajo, requisitos, contexto del proyecto…"
            {...register('description')}
            className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
        </div>

        {/* Compensación */}
        <div className="sm:col-span-2 space-y-3">
          <p className="text-sm font-medium">Compensación</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('is_paid')} className="size-4 rounded border" />
              <span className="text-sm">Remunerado</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('is_barter')} className="size-4 rounded border" />
              <span className="text-sm">Canje / colaboración</span>
            </label>
          </div>
        </div>

        {isPaid && (
          <>
            <div className="space-y-1.5">
              <label htmlFor="estimated_rate" className="text-sm font-medium">Tarifa estimada</label>
              <input
                id="estimated_rate"
                type="number"
                min={0}
                placeholder="Ej: 250"
                {...register('estimated_rate')}
                className={baseInput}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="rate_unit" className="text-sm font-medium">Unidad</label>
              <select id="rate_unit" {...register('rate_unit')} className={baseInput}>
                <option value="">Selecciona…</option>
                <option value="hour">Por hora</option>
                <option value="day">Por día</option>
                <option value="session">Por sesión</option>
                <option value="project">Por proyecto</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="rate_currency" className="text-sm font-medium">Moneda</label>
              <select id="rate_currency" {...register('rate_currency')} className={baseInput}>
                <option value="EUR">EUR — Euro</option>
                <option value="USD">USD — Dólar</option>
                <option value="GBP">GBP — Libra esterlina</option>
                <option value="CHF">CHF — Franco suizo</option>
                <option value="ARS">ARS — Peso argentino</option>
                <option value="MXN">MXN — Peso mexicano</option>
                <option value="COP">COP — Peso colombiano</option>
                <option value="CLP">CLP — Peso chileno</option>
                <option value="BRL">BRL — Real brasileño</option>
              </select>
            </div>
          </>
        )}

        {isBarter && (
          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="barter_description" className="text-sm font-medium">Descripción del canje</label>
            <input
              id="barter_description"
              type="text"
              placeholder="Ej: Material de archivo, crédito en producción, materiales…"
              {...register('barter_description')}
              className={baseInput}
            />
          </div>
        )}

        {/* Detalles adicionales */}
        <div className="space-y-1.5">
          <label htmlFor="required_date" className="text-sm font-medium">Fecha requerida</label>
          <input id="required_date" type="date" {...register('required_date')} className={baseInput} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="max_applicants" className="text-sm font-medium">Máx. postulantes</label>
          <input
            id="max_applicants"
            type="number"
            min={1}
            placeholder="Sin límite"
            {...register('max_applicants')}
            className={baseInput}
          />
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="location" className="text-sm font-medium">Ubicación</label>
          <input
            id="location"
            type="text"
            placeholder="Ej: Barcelona, Estudio Rec 22 / Remoto"
            {...register('location')}
            className={baseInput}
          />
        </div>

      </div>

      {Object.keys(errors).length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p className="font-medium mb-1">Corregí los siguientes campos:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {Object.entries(errors).map(([field, err]) => (
              <li key={field}>{err?.message as string}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(backHref ?? '/bolsa-de-trabajo')}
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-accent"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {loading ? 'Publicando…' : 'Publicar oferta'}
        </button>
      </div>
    </form>
  )
}
