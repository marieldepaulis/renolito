'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface ProjectType {
  id:   string
  name: string
  slug: string
}

const Schema = z.object({
  title:           z.string().min(2, 'Título requerido').max(200),
  project_type_id: z.string().uuid('Selecciona un tipo de proyecto'),
  description:     z.string().max(1000).optional(),
  start_date:      z.string().optional(),
  end_date:        z.string().optional(),
  max_participants: z.coerce.number().int().min(1).max(10000).optional(),
  location:        z.string().max(200).optional(),
  is_public:       z.boolean().default(true),
  requires_session_selection: z.boolean().default(false),
})

type FormData = z.infer<typeof Schema>

interface Props {
  projectTypes:   ProjectType[]
  organizationId: string
}

export function NewProjectForm({ projectTypes, organizationId }: Props) {
  const router   = useRouter()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema) as Resolver<FormData>,
    defaultValues: { is_public: true, requires_session_selection: false },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)

    const res = await fetch('/api/projects', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        organization_id:            organizationId,
        project_type_id:            data.project_type_id,
        title:                      data.title,
        description:                data.description || null,
        start_date:                 data.start_date   || null,
        end_date:                   data.end_date     || null,
        max_participants:           data.max_participants ?? null,
        location:                   data.location     || null,
        is_public:                  data.is_public,
        requires_session_selection: data.requires_session_selection,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      toast.error(result.error ?? 'Error al crear el proyecto')
      setLoading(false)
      return
    }

    toast.success('Proyecto creado')
    router.push(`/projects/${result.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Title */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="title" className="text-sm font-medium">
            Título del proyecto <span className="text-destructive">*</span>
          </label>
          <input
            id="title"
            type="text"
            placeholder="Ej: Álbum Debut 2026"
            {...register('title')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        {/* Project type */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="project_type_id" className="text-sm font-medium">
            Tipo de proyecto <span className="text-destructive">*</span>
          </label>
          <select
            id="project_type_id"
            {...register('project_type_id')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Selecciona un tipo…</option>
            {projectTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {errors.project_type_id && (
            <p className="text-xs text-destructive">{errors.project_type_id.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            Descripción
          </label>
          <textarea
            id="description"
            rows={3}
            placeholder="Breve descripción pública del proyecto…"
            {...register('description')}
            className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
        </div>

        {/* Dates */}
        <div className="space-y-1.5">
          <label htmlFor="start_date" className="text-sm font-medium">Fecha de inicio</label>
          <input
            id="start_date"
            type="date"
            {...register('start_date')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="end_date" className="text-sm font-medium">Fecha de cierre</label>
          <input
            id="end_date"
            type="date"
            {...register('end_date')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <label htmlFor="location" className="text-sm font-medium">Ubicación</label>
          <input
            id="location"
            type="text"
            placeholder="Ej: Barcelona, Estudio Rec 22"
            {...register('location')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Max participants */}
        <div className="space-y-1.5">
          <label htmlFor="max_participants" className="text-sm font-medium">
            Máx. participantes
          </label>
          <input
            id="max_participants"
            type="number"
            min={1}
            placeholder="Sin límite"
            {...register('max_participants')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Toggles */}
        <div className="sm:col-span-2 flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('is_public')}
              className="size-4 rounded border"
            />
            <div>
              <p className="text-sm font-medium">Formulario público visible</p>
              <p className="text-xs text-muted-foreground">
                El formulario de inscripción estará accesible con el enlace sin necesidad de login
              </p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('requires_session_selection')}
              className="size-4 rounded border"
            />
            <div>
              <p className="text-sm font-medium">El postulante elige su sesión</p>
              <p className="text-xs text-muted-foreground">
                El formulario mostrará un selector de sesiones disponibles
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
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
          Crear proyecto
        </button>
      </div>
    </form>
  )
}
