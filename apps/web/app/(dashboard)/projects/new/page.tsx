'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Client { id: string; name: string; companyName: string | null }
interface User { id: string; name: string }

export default function NewProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [deliverables, setDeliverables] = useState<string[]>([''])

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/clients?limit=100').then((r) => r.json()),
      fetch('/api/v1/users').then((r) => r.json()),
    ]).then(([c, u]) => {
      setClients(c.data ?? [])
      setUsers(u.data ?? [])
    })
  }, [])

  function addDeliverable() {
    setDeliverables((prev) => [...prev, ''])
  }

  function updateDeliverable(index: number, value: string) {
    setDeliverables((prev) => prev.map((d, i) => (i === index ? value : d)))
  }

  function removeDeliverable(index: number) {
    setDeliverables((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const startDate = form.get('startDate') as string
    const targetDeadline = form.get('targetDeadline') as string

    const body: Record<string, unknown> = {
      title: form.get('title'),
      clientId: form.get('clientId'),
      packageType: form.get('packageType'),
      description: form.get('description') || undefined,
      assignedToId: form.get('assignedToId') || undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      targetDeadline: targetDeadline ? new Date(targetDeadline).toISOString() : undefined,
      deliverables: deliverables.filter((d) => d.trim() !== ''),
      notes: form.get('notes') || undefined,
    }

    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create project')
        return
      }

      router.push(`/projects/${data.data.id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/projects" className="hover:text-gray-800">Projects</Link>
        <span>/</span>
        <span>New</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">New project</h1>
        <p className="mt-1 text-sm text-gray-500">Start a new client project.</p>
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
              placeholder="Acme BV — Website redesign"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                name="clientId"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName ?? c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Package</label>
              <select
                name="packageType"
                defaultValue="BASIS"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="BASIS">Basis</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </div>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the project scope..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
              <input
                name="startDate"
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target deadline</label>
              <input
                name="targetDeadline"
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deliverables</label>
            <div className="space-y-2">
              {deliverables.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={d}
                    onChange={(e) => updateDeliverable(i, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Homepage, Contact page, CMS"
                  />
                  {deliverables.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDeliverable(i)}
                      className="px-2 py-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addDeliverable}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add deliverable
              </button>
            </div>
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
            <Link href="/projects" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
            >
              {loading ? 'Saving...' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
