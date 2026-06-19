import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground/30">404</p>
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        El enlace que seguiste no existe o ya no está disponible.
      </p>
      <Link
        href="/"
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
