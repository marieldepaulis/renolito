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

const Schema = z.object({
  full_name:        z.string().min(2, 'Nombre demasiado corto').max(150),
  email:            z.string().email('Email inválido'),
  password:         z.string().min(8, 'Mínimo 8 caracteres'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Las contraseñas no coinciden',
  path:    ['confirm_password'],
})

type FormData = z.infer<typeof Schema>

export function RegisterForm() {
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email:    data.email,
      password: data.password,
      options: {
        data: { full_name: data.full_name },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-6">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="font-semibold">Revisa tu email</h3>
        <p className="text-sm text-muted-foreground">
          Te enviamos un enlace de confirmación. Haz clic en él para activar
          tu cuenta.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="full_name" className="text-sm font-medium">
          Nombre completo
        </label>
        <input
          id="full_name"
          type="text"
          autoComplete="name"
          placeholder="María González"
          {...register('full_name')}
          className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        {errors.full_name && (
          <p className="text-xs text-destructive">{errors.full_name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          {...register('email')}
          className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          {...register('password')}
          className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm_password" className="text-sm font-medium">
          Confirmar contraseña
        </label>
        <input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          {...register('confirm_password')}
          className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        {errors.confirm_password && (
          <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Crear cuenta gratis
      </button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  )
}
