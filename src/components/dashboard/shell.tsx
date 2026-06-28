'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { DashboardSidebar } from './sidebar'
import type { OrgMemberRole } from '@/types/database'

interface ShellProps {
  user:         { full_name: string; email: string; avatar_url: string | null }
  organization: { id: string; name: string; slug: string; logo_url: string | null } | null
  role:         OrgMemberRole | null
  children:     React.ReactNode
}

export function DashboardShell({ user, organization, role, children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const closeSidebar = useCallback(() => setMobileOpen(false), [])

  // Close on navigation
  useEffect(() => { closeSidebar() }, [pathname, closeSidebar])

  // Prevent scroll behind drawer and close on Escape
  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = ''
      return
    }
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSidebar() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [mobileOpen, closeSidebar])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Backdrop — always present, hidden when closed */}
      <div
        aria-hidden="true"
        onClick={closeSidebar}
        className={[
          'fixed inset-0 z-30 bg-black/50 lg:hidden transition-opacity duration-200',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* Sidebar — slides in from left on mobile, static on desktop */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-in-out will-change-transform',
          'lg:static lg:z-auto lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <DashboardSidebar
          user={user}
          organization={organization}
          role={role}
          onClose={closeSidebar}
        />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 hover:bg-accent active:bg-accent"
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
          >
            <Menu className="size-5" />
          </button>
          <span className="truncate text-sm font-semibold">
            {organization?.name ?? 'Renolito Sessions'}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
