'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

const Schema = z.object({
  name:    z.string().min(2, 'Nombre requerido').max(150),
  country: z.string().length(2, 'Selecciona un país'),
  city:    z.string().min(2, 'Ciudad requerida').max(100),
})
type FormData = z.infer<typeof Schema>

const COUNTRIES = [
  { code: 'ES', name: 'España' },
  { code: 'AR', name: 'Argentina' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BR', name: 'Brasil' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'FR', name: 'Francia' },
  { code: 'GB', name: 'Reino Unido' },
  { code: 'IT', name: 'Italia' },
  { code: 'MX', name: 'México' },
  { code: 'PE', name: 'Perú' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VE', name: 'Venezuela' },
]

export function OnboardingForm({ userId }: { userId: string }) {
  const t      = useTranslations('Onboarding')
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { country: 'ES' },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)

    const res = await fetch('/api/onboarding', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    })

    const result = await res.json()

    if (!res.ok) {
      toast.error(result.error ?? 'Error al crear la organización')
      setLoading(false)
      return
    }

    toast.success('¡Organización creada!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          {t('nameField')} <span className="text-destructive">*</span>
        </label>
        <input
          id="name"
          type="text"
          placeholder={t('namePlaceholder')}
          {...register('name')}
          className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="country" className="text-sm font-medium">País</label>
          <select
            id="country"
            {...register('country')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="city" className="text-sm font-medium">
            {t('cityField')} <span className="text-destructive">*</span>
          </label>
          <input
            id="city"
            type="text"
            placeholder={t('cityPlaceholder')}
            {...register('city')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {loading ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}
