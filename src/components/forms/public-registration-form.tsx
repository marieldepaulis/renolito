'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface FormField {
  field_key:     string
  label:         string
  field_type:    string
  placeholder:   string | null
  helper_text:   string | null
  is_required:   boolean
  options:       Array<{ value: string; label: string }> | null
  display_order: number
}

interface Session {
  id:             string
  title:          string
  scheduled_date: string
  start_time:     string | null
}

interface Props {
  token:    string
  fields:   FormField[]
  sessions: Session[]
}

type FormValues = Record<string, unknown>

export function PublicRegistrationForm({ token, fields, sessions }: Props) {
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [statusUrl, setStatusUrl] = useState<string | null>(null)

  // Build a Zod schema dynamically based on the field definitions
  const schemaShape: Record<string, z.ZodTypeAny> = {
    full_name:          z.string().min(2, 'Nombre requerido').max(200),
    email:              z.string().email('Email inválido'),
    phone:              z.string().min(6, 'Teléfono requerido').max(30),
    city:               z.string().min(2, 'Ciudad requerida').max(100),
    preferred_session_id: sessions.length > 0
      ? z.string().uuid('Selecciona una sesión')
      : z.string().optional(),
  }

  for (const field of fields) {
    if (field.field_type === 'checkbox_group' || field.field_type === 'multiselect') {
      schemaShape[field.field_key] = field.is_required
        ? z.array(z.string()).min(1, `${field.label} es requerido`)
        : z.array(z.string()).optional()
    } else if (field.field_type === 'number') {
      schemaShape[field.field_key] = field.is_required
        ? z.coerce.number({ invalid_type_error: `${field.label} debe ser un número` })
        : z.coerce.number().optional()
    } else {
      schemaShape[field.field_key] = field.is_required
        ? z.string().min(1, `${field.label} es requerido`)
        : z.string().optional()
    }
  }

  const schema = z.object(schemaShape)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)

    // Separate core fields from dynamic answers
    const answers: Record<string, unknown> = {}
    for (const field of fields) {
      if (values[field.field_key] !== undefined) {
        answers[field.field_key] = values[field.field_key]
      }
    }

    const res = await fetch(`/api/inscripcion/${token}/apply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name:            values.full_name,
        email:                values.email,
        phone:                values.phone,
        city:                 values.city,
        preferred_session_id: (values.preferred_session_id as string) || null,
        answers,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Error al enviar la inscripción')
      setLoading(false)
      return
    }

    setStatusUrl(`${window.location.origin}/estado/${data.access_token}`)
    setSuccess(true)
    setLoading(false)
  }

  if (success && statusUrl) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 className="text-xl font-semibold">¡Inscripción enviada!</h2>
        <p className="text-sm text-muted-foreground">
          Te enviamos un email con los detalles. Puedes seguir el estado de tu
          inscripción en el siguiente enlace:
        </p>
        <a
          href={statusUrl}
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Ver estado de mi inscripción
        </a>
        <p className="text-xs text-muted-foreground">
          Guarda este enlace — no necesitas crear una cuenta.
        </p>
      </div>
    )
  }

  function renderField(field: FormField) {
    const error = (errors[field.field_key] as { message?: string } | undefined)?.message

    const baseInput = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

    switch (field.field_type) {
      case 'textarea':
        return (
          <div key={field.field_key} className="space-y-1.5">
            <label className="text-sm font-medium">
              {field.label}{field.is_required && <span className="ml-0.5 text-destructive">*</span>}
            </label>
            {field.helper_text && (
              <p className="text-xs text-muted-foreground">{field.helper_text}</p>
            )}
            <textarea
              rows={3}
              placeholder={field.placeholder ?? undefined}
              {...register(field.field_key)}
              className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case 'select':
        return (
          <div key={field.field_key} className="space-y-1.5">
            <label className="text-sm font-medium">
              {field.label}{field.is_required && <span className="ml-0.5 text-destructive">*</span>}
            </label>
            {field.helper_text && (
              <p className="text-xs text-muted-foreground">{field.helper_text}</p>
            )}
            <select
              {...register(field.field_key)}
              className={baseInput}
            >
              <option value="">Selecciona una opción…</option>
              {field.options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case 'multiselect':
      case 'checkbox_group':
        return (
          <div key={field.field_key} className="space-y-1.5">
            <label className="text-sm font-medium">
              {field.label}{field.is_required && <span className="ml-0.5 text-destructive">*</span>}
            </label>
            {field.helper_text && (
              <p className="text-xs text-muted-foreground">{field.helper_text}</p>
            )}
            <div className="space-y-2">
              {field.options?.map((o) => (
                <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    value={o.value}
                    {...register(field.field_key)}
                    className="size-4 rounded border"
                  />
                  <span className="text-sm">{o.label}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case 'radio':
        return (
          <div key={field.field_key} className="space-y-1.5">
            <label className="text-sm font-medium">
              {field.label}{field.is_required && <span className="ml-0.5 text-destructive">*</span>}
            </label>
            {field.helper_text && (
              <p className="text-xs text-muted-foreground">{field.helper_text}</p>
            )}
            <div className="space-y-2">
              {field.options?.map((o) => (
                <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={o.value}
                    {...register(field.field_key)}
                    className="size-4"
                  />
                  <span className="text-sm">{o.label}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case 'number':
        return (
          <div key={field.field_key} className="space-y-1.5">
            <label className="text-sm font-medium">
              {field.label}{field.is_required && <span className="ml-0.5 text-destructive">*</span>}
            </label>
            {field.helper_text && (
              <p className="text-xs text-muted-foreground">{field.helper_text}</p>
            )}
            <input
              type="number"
              placeholder={field.placeholder ?? undefined}
              {...register(field.field_key)}
              className={baseInput}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case 'url':
        return (
          <div key={field.field_key} className="space-y-1.5">
            <label className="text-sm font-medium">
              {field.label}{field.is_required && <span className="ml-0.5 text-destructive">*</span>}
            </label>
            {field.helper_text && (
              <p className="text-xs text-muted-foreground">{field.helper_text}</p>
            )}
            <input
              type="url"
              placeholder={field.placeholder ?? 'https://'}
              {...register(field.field_key)}
              className={baseInput}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      default:
        return (
          <div key={field.field_key} className="space-y-1.5">
            <label className="text-sm font-medium">
              {field.label}{field.is_required && <span className="ml-0.5 text-destructive">*</span>}
            </label>
            {field.helper_text && (
              <p className="text-xs text-muted-foreground">{field.helper_text}</p>
            )}
            <input
              type={field.field_type === 'email' ? 'email' : 'text'}
              placeholder={field.placeholder ?? undefined}
              {...register(field.field_key)}
              className={baseInput}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Datos personales
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Core fields */}
        <div className="space-y-1.5">
          <label htmlFor="full_name" className="text-sm font-medium">
            Nombre completo <span className="text-destructive">*</span>
          </label>
          <input
            id="full_name"
            type="text"
            autoComplete="name"
            placeholder="María González"
            {...register('full_name')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {(errors.full_name as { message?: string })?.message && (
            <p className="text-xs text-destructive">{(errors.full_name as { message?: string }).message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email <span className="text-destructive">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            {...register('email')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {(errors.email as { message?: string })?.message && (
            <p className="text-xs text-destructive">{(errors.email as { message?: string }).message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-sm font-medium">
            Teléfono <span className="text-destructive">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+54 9 11 1234 5678"
            {...register('phone')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {(errors.phone as { message?: string })?.message && (
            <p className="text-xs text-destructive">{(errors.phone as { message?: string }).message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="city" className="text-sm font-medium">
            Ciudad <span className="text-destructive">*</span>
          </label>
          <input
            id="city"
            type="text"
            placeholder="Buenos Aires"
            {...register('city')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {(errors.city as { message?: string })?.message && (
            <p className="text-xs text-destructive">{(errors.city as { message?: string }).message}</p>
          )}
        </div>
      </div>

      {/* Session selection */}
      {sessions.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="preferred_session_id" className="text-sm font-medium">
            Sesión preferida <span className="text-destructive">*</span>
          </label>
          <select
            id="preferred_session_id"
            {...register('preferred_session_id')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Selecciona una sesión…</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} —{' '}
                {new Date(s.scheduled_date).toLocaleDateString('es-AR', {
                  weekday: 'short', day: '2-digit', month: 'short',
                })}
                {s.start_time ? ` ${s.start_time.slice(0, 5)}` : ''}
              </option>
            ))}
          </select>
          {(errors.preferred_session_id as { message?: string })?.message && (
            <p className="text-xs text-destructive">
              {(errors.preferred_session_id as { message?: string }).message}
            </p>
          )}
        </div>
      )}

      {/* Dynamic fields */}
      {fields.length > 0 && (
        <>
          <div className="border-t pt-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Información adicional
            </p>
          </div>
          {[...fields]
            .sort((a, b) => a.display_order - b.display_order)
            .map(renderField)}
        </>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Enviar inscripción
      </button>
    </form>
  )
}
