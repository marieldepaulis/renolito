import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const metadata: Metadata = { title: 'Recuperar contraseña' }

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recuperar contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Te enviaremos un enlace a tu email para restablecer tu contraseña
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
        >
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  )
}
