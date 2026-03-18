'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Client { id: string; name: string; companyName: string | null }
interface User { id: string; name: string }

const LEAD_STATUSES = [
  { value: 'NEW_REQUEST', label: 'New Request' },
  { value: 'INTAKE_IN_PROGRESS', label: 'Intake In Progress' },
  { value: 'INTAKE_COMPLETE', label: 'Intake Complete' },
  { value: 'DEMO_SCHEDULED', label: 'Demo Scheduled' },
  { value: 'DEMO_IN_PROGRESS', label: 'Demo In Progress' },
  { value: 'DEMO_50_READY', label: 'Demo 50% Ready' },
  { value: 'WAITING_FOR_RESPONSE', label: 'Waiting For Response' },
  { value: 'APPROVAL_RECEIVED', label: 'Approval Received' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WAITING_FOR_PAYMENT', label: 'Waiting For Payment' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CONVERTED_TO_PROJECT', label: 'Converted To Project' },
]

export default function NewLeadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/clients?limit=100').then((r) => r.json()),
      fetch('/api/v1/users').then((r) => r.json()),
    ]).then(([c, u]) => {
      setClients(c.data ?? [])
      setUsers(u.data ?? [])
    })
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const estimatedValue = form.get('estimatedValue') as string

    const body: Record<string, unknown> = {
      title: form.get('title'),
      clientId: form.get('clientId') || undefined,
      contactName: form.get('contactName') || undefined,
      contactEmail: form.get('contactEmail') || undefined,
      contactPhone: form.get('contactPhone') || undefined,
      companyName: form.get('companyName') || undefined,
      description: form.get('description') || undefined,
      source: form.get('source') || undefined,
      estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      notes: form.get('notes') || undefined,
      assignedToId: form.get('assignedToId') || undefined,
      status: form.get('status') || undefined,
    }

    try {
      const res = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create lead')
        return
      }

      router.push(`/leads/${data.data.id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/leads" className="hover:text-gray-800">Leads</Link>
        <span>/</span>
        <span>New</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">New lead</h1>
        <p className="mt-1 text-sm text-gray-500">Register a new sales lead.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              minLength={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="New website for Acme BV"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                defaultValue="NEW_REQUEST"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated value (€)</label>
              <input
                name="estimatedValue"
                type="number"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="3500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select
                name="clientId"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— No client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName ?? c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned to</label>
              <select
                name="assignedToId"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact name</label>
              <input
                name="contactName"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jan de Vries"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
              <input
                name="companyName"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Acme BV"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact email</label>
              <input
                name="contactEmail"
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="jan@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact phone</label>
              <input
                name="contactPhone"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+31 6 00000000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <input
              name="source"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Referral, Google Ads, LinkedIn..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What is the client looking for?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal notes</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Notes visible only to the team..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/leads" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
            >
              {loading ? 'Saving...' : 'Create lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
