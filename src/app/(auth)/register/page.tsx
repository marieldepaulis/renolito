import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Crear cuenta
        </h1>
        <p className="text-sm text-muted-foreground">
          Configura tu workspace de producción en menos de un minuto
        </p>
      </div>

      <RegisterForm />

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  )
}
