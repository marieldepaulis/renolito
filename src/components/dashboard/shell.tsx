'use client'

import { useState, useEffect } from 'react'
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

  // Close drawer on navigation
  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={[
        'fixed inset-y-0 left-0 z-40 transition-transform duration-200',
        'lg:static lg:z-auto lg:translate-x-0 lg:transition-none',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>
        <DashboardSidebar
          user={user}
          organization={organization}
          role={role}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 hover:bg-accent"
            aria-label="Abrir menú"
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
