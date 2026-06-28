import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Music } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // If user already has an active session, send them straight to dashboard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left panel — branding */}
      <div className="hidden flex-col justify-between bg-zinc-900 p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Music className="size-5" />
          Plataforma Producción
        </Link>
        <blockquote className="space-y-2">
          <p className="text-lg">
            &ldquo;La diferencia entre un proyecto y una producción
            es la organización.&rdquo;
          </p>
          <footer className="text-sm text-zinc-400">
            Gestión profesional para productores independientes
          </footer>
        </blockquote>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link
            href="/"
            className="mb-8 flex items-center gap-2 font-semibold lg:hidden"
          >
            <Music className="size-5" />
            Plataforma Producción
          </Link>
          {children}
        </div>
      </div>
    </div>
  )
}
