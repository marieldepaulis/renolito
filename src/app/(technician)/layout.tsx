import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardSidebar } from '@/components/dashboard/sidebar'

export default async function TechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single()

  const { data: membership } = await supabase
    .from('org_members')
    .select('role, organizations(id, name, slug, logo_url)')
    .eq('user_id', user.id)
    .maybeSingle()

  const org = membership?.organizations as unknown as {
    id: string; name: string; slug: string; logo_url: string | null
  } | null

  return (
    <div className="flex h-screen overflow-hidden">
      <DashboardSidebar
        user={{
          full_name:  profile?.full_name ?? '',
          email:      user.email ?? '',
          avatar_url: profile?.avatar_url ?? null,
        }}
        organization={org}
        role={membership?.role ?? null}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
