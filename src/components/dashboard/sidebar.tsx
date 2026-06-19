'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, Briefcase,
  Settings, LogOut, Music, User, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { OrgMemberRole } from '@/types/database'

interface SidebarProps {
  user: {
    full_name: string
    email:     string
    avatar_url: string | null
  }
  organization: {
    id:       string
    name:     string
    slug:     string
    logo_url: string | null
  } | null
  role: OrgMemberRole | null
}

const NAV_ITEMS = [
  { label: 'Dashboard',     href: '/dashboard',        icon: LayoutDashboard },
  { label: 'Proyectos',     href: '/projects',          icon: FolderOpen },
  { label: 'Bolsa trabajo', href: '/bolsa-de-trabajo',  icon: Briefcase },
]

const BOTTOM_ITEMS = [
  { label: 'Configuración', href: '/configuracion', icon: Settings },
]

export function DashboardSidebar({ user, organization, role }: SidebarProps) {
  const pathname   = usePathname()
  const router     = useRouter()
  const supabase   = createClient()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
      {/* Logo / Org name */}
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-foreground">
          <Music className="size-3.5 text-background" />
        </div>
        <span className="truncate text-sm font-semibold">
          {organization?.name ?? 'Plataforma Producción'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}

        <div className="my-2 border-t" />

        {/* Technician profile link (available to all users) */}
        <Link
          href="/mi-perfil-tecnico"
          className={cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith('/mi-perfil-tecnico')
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
          )}
        >
          <User className="size-4 shrink-0" />
          Mi perfil técnico
        </Link>
      </nav>

      {/* Bottom section */}
      <div className="border-t p-2">
        {BOTTOM_ITEMS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}

        {/* User menu */}
        <div className="relative mt-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
              {user.full_name.charAt(0) || user.email.charAt(0)}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-medium">{user.full_name || 'Usuario'}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
          </button>

          {open && (
            <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border bg-popover shadow-md">
              <Link
                href="/perfil"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <User className="size-4" />
                Mi perfil
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
