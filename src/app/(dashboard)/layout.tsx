import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardSidebar } from '@/components/dashboard/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch organization membership for the sidebar
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organizations(id, name, slug, logo_url)')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, avatar_url')
    .eq('id', user.id)
    .single()

  const org = membership?.organizations as unknown as {
    id: string; name: string; slug: string; logo_url: string | null
  } | null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar
        user={profile ?? { full_name: '', email: user.email ?? '', avatar_url: null }}
        organization={org}
        role={(membership?.role as import('@/types/database').OrgMemberRole) ?? null}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
