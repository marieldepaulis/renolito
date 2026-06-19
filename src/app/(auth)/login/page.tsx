import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bienvenido de vuelta
        </h1>
        <p className="text-sm text-muted-foreground">
          Accede a tu panel de producción
        </p>
      </div>

      <LoginForm />

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{' '}
        <Link
          href="/register"
          className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
        >
          Regístrate gratis
        </Link>
      </p>
    </div>
  )
}
