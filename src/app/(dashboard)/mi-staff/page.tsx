import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { StaffRoster } from '@/components/staff/staff-roster'

export const metadata: Metadata = { title: 'Mi Staff' }

export default async function MiStaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const admin = createAdminClient()
  let staffMembers: Array<{
    id: string
    full_name: string
    email: string
    speciality: string | null
    phone: string | null
    source: string
    status: string
    joined_at: string
  }> = []

  try {
    const { data } = await admin
      .from('production_staff')
      .select('id, full_name, email, speciality, phone, source, status, joined_at')
      .eq('organization_id', membership.organization_id)
      .order('joined_at', { ascending: false })
    staffMembers = (data ?? []) as typeof staffMembers
  } catch {
    // Migration 004 not yet applied
  }

  return <StaffRoster initial={staffMembers} />
}
