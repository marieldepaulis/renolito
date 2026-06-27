'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

const Schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormData = z.infer<typeof Schema>

export function LoginForm() {
  const t        = useTranslations('Auth.login')
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email:    data.email,
      password: data.password,
    })
    if (error) {
      toast.error(error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : error.message)
      setLoading(false)
      return
    }
    // Hard redirect so the browser sends fresh cookies to the server on the
    // next request — soft router.push sometimes races against cookie writes.
    window.location.href = '/dashboard'
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} method="post" className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">{t('email')}</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          {...register('email')}
          className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">{t('password')}</label>
          <Link href="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            {t('forgotPassword')}
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {loading ? t('submitting') : t('submit')}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t('register')}
        </Link>
      </p>
    </form>
  )
}
