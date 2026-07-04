import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: Promise<{ projectId: string; sessionId: string; expenseId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { projectId, sessionId, expenseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const col = UUID_RE.test(projectId) ? 'id' : 'slug'
  const { data: project } = await supabase.from('projects').select('id').eq(col, projectId).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('session_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('session_id', sessionId)
    .eq('project_id', project.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId, sessionId, expenseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const col = UUID_RE.test(projectId) ? 'id' : 'slug'
  const { data: project } = await supabase.from('projects').select('id').eq(col, projectId).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('session_expenses')
    .update({
      category:     body.category,
      description:  body.description?.trim(),
      amount:       body.amount != null ? Number(body.amount) : undefined,
      currency:     body.currency,
      expense_date: body.expense_date || null,
    })
    .eq('id', expenseId)
    .eq('session_id', sessionId)
    .eq('project_id', project.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
