import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrgSettingsForm } from '@/components/settings/org-settings-form'

export const metadata: Metadata = { title: 'Configuración' }

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organization_id, organizations(id, name, slug, bio, logo_url, website_url, instagram_url, city)')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const org = membership.organizations as unknown as {
    id: string; name: string; slug: string; bio: string | null
    logo_url: string | null; website_url: string | null
    instagram_url: string | null; city: string | null
  } | null

  const canEdit = ['owner', 'admin'].includes(membership.role)

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Personalizá el perfil de tu productora
        </p>
      </div>

      <OrgSettingsForm org={org} canEdit={canEdit} />
    </div>
  )
}
