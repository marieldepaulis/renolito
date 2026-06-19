'use client'

import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

interface Specialty {
  id:       string
  name:     string
  category: string
}

interface MySpecialty {
  specialty_id:     string
  years_experience: number | null
  is_primary:       boolean
}

interface TechnicianProfile {
  bio:            string | null
  hourly_rate:    number | null
  day_rate:       number | null
  currency:       string | null
  is_available:   boolean
  availability_notes: string | null
  website_url:    string | null
  instagram_url:  string | null
  linkedin_url:   string | null
  showreel_url:   string | null
  location:       string | null
}

interface Props {
  userId:          string
  existingProfile: TechnicianProfile | null
  specialties:     Specialty[]
  mySpecialties:   MySpecialty[]
}

const Schema = z.object({
  bio:                z.string().max(1000).optional(),
  hourly_rate:        z.coerce.number().min(0).optional(),
  day_rate:           z.coerce.number().min(0).optional(),
  currency:           z.string().max(3).optional(),
  is_available:       z.boolean().default(true),
  availability_notes: z.string().max(300).optional(),
  website_url:        z.string().url('URL inválida').optional().or(z.literal('')),
  instagram_url:      z.string().url('URL inválida').optional().or(z.literal('')),
  linkedin_url:       z.string().url('URL inválida').optional().or(z.literal('')),
  showreel_url:       z.string().url('URL inválida').optional().or(z.literal('')),
  location:           z.string().max(100).optional(),
})
type FormData = z.infer<typeof Schema>

export function TechnicianProfileForm({ userId, existingProfile, specialties, mySpecialties }: Props) {
  const t        = useTranslations('TechProfile')
  const supabase = createClient()
  const [loading, setLoading]       = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>(
    mySpecialties.map((s) => s.specialty_id),
  )

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema) as Resolver<FormData>,
    defaultValues: {
      bio:                existingProfile?.bio                ?? '',
      hourly_rate:        existingProfile?.hourly_rate        ?? undefined,
      day_rate:           existingProfile?.day_rate           ?? undefined,
      currency:           existingProfile?.currency           ?? 'EUR',
      is_available:       existingProfile?.is_available       ?? true,
      availability_notes: existingProfile?.availability_notes ?? '',
      website_url:        existingProfile?.website_url        ?? '',
      instagram_url:      existingProfile?.instagram_url      ?? '',
      linkedin_url:       existingProfile?.linkedin_url       ?? '',
      showreel_url:       existingProfile?.showreel_url       ?? '',
      location:           existingProfile?.location           ?? '',
    },
  })

  function toggleSpecialty(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  async function onSubmit(data: FormData) {
    setLoading(true)

    const profilePayload = {
      user_id:            userId,
      bio:                data.bio            || null,
      hourly_rate:        data.hourly_rate    ?? null,
      day_rate:           data.day_rate       ?? null,
      currency:           data.currency       || 'EUR',
      is_available:       data.is_available,
      availability_notes: data.availability_notes || null,
      website_url:        data.website_url    || null,
      instagram_url:      data.instagram_url  || null,
      linkedin_url:       data.linkedin_url   || null,
      showreel_url:       data.showreel_url   || null,
      location:           data.location       || null,
    }

    const { error: profileError } = await supabase
      .from('technician_profiles')
      .upsert(profilePayload, { onConflict: 'user_id' })

    if (profileError) {
      toast.error(profileError.message)
      setLoading(false)
      return
    }

    const prevIds  = mySpecialties.map((s) => s.specialty_id)
    const toDelete = prevIds.filter((id) => !selectedIds.includes(id))
    const toInsert = selectedIds.filter((id) => !prevIds.includes(id))

    if (toDelete.length > 0) {
      await supabase
        .from('technician_specialties')
        .delete()
        .eq('user_id', userId)
        .in('specialty_id', toDelete)
    }

    if (toInsert.length > 0) {
      await supabase
        .from('technician_specialties')
        .insert(toInsert.map((id) => ({
          user_id:      userId,
          specialty_id: id,
          is_primary:   false,
        })))
    }

    toast.success(t('successToast'))
    setLoading(false)
  }

  const grouped = specialties.reduce<Record<string, Specialty[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  const baseInput = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Availability toggle */}
      <div className="flex items-center gap-3">
        <input type="checkbox" id="is_available" {...register('is_available')} className="size-4 rounded border" />
        <label htmlFor="is_available" className="text-sm font-medium cursor-pointer">
          {t('availableNow')}
        </label>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="location" className="text-sm font-medium">{t('location')}</label>
        <input
          id="location"
          type="text"
          placeholder={t('locationPlaceholder')}
          {...register('location')}
          className={baseInput}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="bio" className="text-sm font-medium">{t('bioSection')}</label>
        <textarea
          id="bio"
          rows={4}
          placeholder={t('bioPlaceholder')}
          {...register('bio')}
          className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      {/* Rates */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="hourly_rate" className="text-sm font-medium">{t('hourlyRate')}</label>
          <input id="hourly_rate" type="number" min={0} placeholder={t('hourlyRatePlaceholder')} {...register('hourly_rate')} className={baseInput} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="day_rate" className="text-sm font-medium">{t('dayRate')}</label>
          <input id="day_rate" type="number" min={0} placeholder={t('dayRatePlaceholder')} {...register('day_rate')} className={baseInput} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="currency" className="text-sm font-medium">{t('currency')}</label>
          <select id="currency" {...register('currency')} className={baseInput}>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — Dólar</option>
            <option value="GBP">GBP — Libra esterlina</option>
            <option value="CHF">CHF — Franco suizo</option>
            <option value="ARS">ARS — Peso argentino</option>
            <option value="MXN">MXN — Peso mexicano</option>
            <option value="COP">COP — Peso colombiano</option>
            <option value="CLP">CLP — Peso chileno</option>
            <option value="BRL">BRL — Real brasileño</option>
            <option value="PEN">PEN — Sol peruano</option>
            <option value="JPY">JPY — Yen japonés</option>
            <option value="CNY">CNY — Yuan chino</option>
          </select>
        </div>
      </div>

      {/* Social links */}
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('linksSection')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ['website_url',   t('website'),   'https://mipagina.com'],
            ['showreel_url',  t('showreel'),  'https://vimeo.com/...'],
            ['instagram_url', t('instagram'), 'https://instagram.com/...'],
            ['linkedin_url',  t('linkedin'),  'https://linkedin.com/in/...'],
          ] as const).map(([key, label, placeholder]) => (
            <div key={key} className="space-y-1.5">
              <label htmlFor={key} className="text-sm font-medium">{label}</label>
              <input
                id={key}
                type="url"
                placeholder={placeholder}
                {...register(key)}
                className={baseInput}
              />
              {errors[key] && <p className="text-xs text-destructive">{errors[key]?.message}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Specialties */}
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('specialties')}</p>
        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noSpecialties')}</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSpecialty(s.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selectedIds.includes(s.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'border hover:bg-accent'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="availability_notes" className="text-sm font-medium">
          {t('availabilityNotes')}
        </label>
        <input
          id="availability_notes"
          type="text"
          placeholder={t('availabilityPlaceholder')}
          {...register('availability_notes')}
          className={baseInput}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {loading ? t('saving') : t('save')}
      </button>
    </form>
  )
}
