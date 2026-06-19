'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const Schema = z.object({
  email: z.string().email('Email inválido'),
})
type FormData = z.infer<typeof Schema>

export function ForgotPasswordForm() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/perfil`,
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-6">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h3 className="font-semibold">Revisa tu email</h3>
        <p className="text-sm text-muted-foreground">
          Si tu email está registrado, recibirás un enlace para restablecer
          tu contraseña.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email de tu cuenta
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

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Enviar enlace de recuperación
      </button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  )
}
