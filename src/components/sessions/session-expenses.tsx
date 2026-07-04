'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Receipt } from 'lucide-react'
import { toast } from 'sonner'

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'studio',    label: 'Estudio / local' },
  { value: 'equipment', label: 'Equipamiento' },
  { value: 'crew',      label: 'Crew / personal' },
  { value: 'transport', label: 'Transporte' },
  { value: 'catering',  label: 'Catering' },
  { value: 'other',     label: 'Otro' },
]

const CURRENCIES = ['EUR', 'USD', 'GBP']

export interface Expense {
  id:           string
  category:     string
  description:  string
  amount:       number
  currency:     string
  expense_date: string | null
  created_at:   string
}

interface Props {
  projectId: string
  sessionId: string
  initial:   Expense[]
}

const fmt = (amount: number, currency: string) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount)

const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label ?? v

export function SessionExpenses({ projectId, sessionId, initial }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [expenses, setExpenses] = useState<Expense[]>(initial)
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // New expense form state
  const [category,    setCategory]    = useState('other')
  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState('')
  const [currency,    setCurrency]    = useState('EUR')
  const [expenseDate, setExpenseDate] = useState('')

  const apiBase = `/api/projects/${projectId}/sessions/${sessionId}/expenses`

  const total = expenses.reduce((acc, e) => acc + Number(e.amount), 0)
  const hasCurrencies = new Set(expenses.map(e => e.currency)).size > 1

  const inputCls = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  async function handleAdd() {
    if (!description.trim() || !amount) { toast.error('Descripción y monto son obligatorios'); return }
    setSaving(true)
    const res = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, description, amount: parseFloat(amount), currency, expense_date: expenseDate || null }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSaving(false); return }
    setExpenses(prev => [data, ...prev])
    setDescription('')
    setAmount('')
    setExpenseDate('')
    setCategory('other')
    setCurrency('EUR')
    setAdding(false)
    setSaving(false)
    toast.success('Gasto registrado')
    startTransition(() => router.refresh())
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const res = await fetch(`${apiBase}/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al eliminar'); setDeleting(null); return }
    setExpenses(prev => prev.filter(e => e.id !== id))
    setDeleting(null)
    toast.success('Gasto eliminado')
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Gastos de la sesión</h2>
          {expenses.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {expenses.length}
            </span>
          )}
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Plus className="size-3.5" /> Añadir gasto
          </button>
        )}
      </div>

      {/* Add expense form */}
      {adding && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nuevo gasto</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium">Descripción *</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ej. Alquiler estudio, micrófono, taxi…"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Fecha</label>
              <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Monto *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Moneda</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAdding(false)}
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">
              Cancelar
            </button>
            <button type="button" onClick={handleAdd} disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving && <Loader2 className="size-3 animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Expense list */}
      {expenses.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center">
          <p className="text-sm text-muted-foreground">No hay gastos registrados para esta sesión.</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border divide-y overflow-hidden">
            {expenses.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{catLabel(e.category)}</span>
                    {e.expense_date && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.expense_date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span className="shrink-0 font-semibold text-sm">{fmt(e.amount, e.currency)}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(e.id)}
                  disabled={deleting === e.id}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  {deleting === e.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <span className="text-sm font-medium">
              Total sesión{hasCurrencies ? ' (monedas mixtas)' : ''}
            </span>
            {hasCurrencies ? (
              <div className="text-right text-xs text-muted-foreground space-y-0.5">
                {Array.from(new Set(expenses.map(e => e.currency))).map(cur => {
                  const subtotal = expenses.filter(e => e.currency === cur).reduce((s, e) => s + Number(e.amount), 0)
                  return <p key={cur}>{fmt(subtotal, cur)}</p>
                })}
              </div>
            ) : (
              <span className="text-base font-bold">
                {fmt(total, expenses[0]?.currency ?? 'EUR')}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
