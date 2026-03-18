'use client'

import { useState, useEffect } from 'react'
import { formatDate } from '@/lib/utils'

interface GitHubConnection {
  id: string
  owner: string
  repo: string
  defaultBranch: string
  tokenSetAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string }
}

export default function GitHubSettingsPage() {
  const [connections, setConnections] = useState<GitHubConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // New connection form
  const [owner, setOwner] = useState('')
  const [repo, setRepo] = useState('')
  const [orgLevel, setOrgLevel] = useState(false)
  const [branch, setBranch] = useState('main')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)

  // Edit form
  const [editBranch, setEditBranch] = useState('')
  const [editToken, setEditToken] = useState('')
  const [editShowToken, setEditShowToken] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => { fetchConnections() }, [])

  async function fetchConnections() {
    try {
      const res = await fetch('/api/v1/github/connections')
      if (res.ok) {
        const data = await res.json()
        setConnections(data.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/github/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo: orgLevel ? '*' : repo,
          defaultBranch: branch,
          token: token || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create connection')
        return
      }
      setOwner(''); setRepo(''); setBranch('main'); setToken(''); setOrgLevel(false)
      setShowForm(false)
      fetchConnections()
    } finally {
      setSaving(false)
    }
  }

  function startEdit(conn: GitHubConnection) {
    setEditingId(conn.id)
    setEditBranch(conn.defaultBranch)
    setEditToken('')
    setEditError(null)
    setEditShowToken(false)
  }

  async function handleUpdate(e: React.FormEvent, id: string) {
    e.preventDefault()
    setEditSaving(true)
    setEditError(null)
    try {
      const body: Record<string, unknown> = { defaultBranch: editBranch }
      if (editToken) body.token = editToken
      const res = await fetch(`/api/v1/github/connections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error ?? 'Failed to update connection')
        return
      }
      setEditingId(null)
      fetchConnections()
    } finally {
      setEditSaving(false)
    }
  }

  async function handleClearToken(id: string) {
    if (!confirm('Remove the stored token for this connection?')) return
    const res = await fetch(`/api/v1/github/connections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearToken: true }),
    })
    if (res.ok) fetchConnections()
  }

  async function handleDelete(conn: GitHubConnection) {
    if (!confirm(`Remove ${conn.owner}/${conn.repo}? This cannot be undone.`)) return
    const res = await fetch(`/api/v1/github/connections/${conn.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error ?? 'Failed to remove connection')
      return
    }
    setConnections((prev) => prev.filter((c) => c.id !== conn.id))
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">GitHub Connections</h2>
          <p className="text-sm text-gray-500 mt-1">
            Link GitHub repositories to use with tickets and the agent runner
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(null) }}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Repository
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Add GitHub Repository</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Org-level toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setOrgLevel(!orgLevel)}
                className={`relative w-10 h-5 rounded-full transition-colors ${orgLevel ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${orgLevel ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Alle repositories in de organisatie
              </span>
            </label>
            {orgLevel && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                Één token voor alle repos. Maak een fine-grained PAT aan met <strong>Resource owner: je organisatie</strong> en <strong>Repository access: All repositories</strong>.
              </div>
            )}

            <div className={`grid gap-4 ${orgLevel ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {orgLevel ? 'Organisatie (GitHub username/org)' : 'Owner'}
                </label>
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  required
                  placeholder="e.g. myorg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {!orgLevel && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Repository</label>
                  <input
                    type="text"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    required
                    placeholder="e.g. my-project"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                required
                placeholder="main"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Personal Access Token
                <span className="ml-1 text-gray-400 font-normal">(optional — required for agent runs)</span>
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_... or github_pat_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Needs <code className="bg-gray-100 px-1 rounded">repo</code> scope (or fine-grained: Contents, Pull requests, Issues read/write).
                Token is validated against GitHub and stored encrypted.
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Validating & saving...' : 'Add Repository'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null) }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Connections list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : connections.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No repositories connected yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {connections.map((conn) => (
              <div key={conn.id} className="p-5">
                {editingId === conn.id ? (
                  <form onSubmit={(e) => handleUpdate(e, conn.id)} className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                      </svg>
                      <span className="font-semibold text-gray-900">{conn.owner}/{conn.repo}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Default Branch</label>
                        <input
                          type="text"
                          value={editBranch}
                          onChange={(e) => setEditBranch(e.target.value)}
                          required
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          New Token
                          <span className="ml-1 text-gray-400 font-normal">(leave empty to keep existing)</span>
                        </label>
                        <div className="relative">
                          <input
                            type={editShowToken ? 'text' : 'password'}
                            value={editToken}
                            onChange={(e) => setEditToken(e.target.value)}
                            placeholder="ghp_..."
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-14"
                          />
                          <button
                            type="button"
                            onClick={() => setEditShowToken(!editShowToken)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                          >
                            {editShowToken ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </div>
                    </div>
                    {editError && (
                      <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{editError}</p>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={editSaving}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {editSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                        </svg>
                        <span className="font-semibold text-gray-900">
                          {conn.repo === '*' ? conn.owner : `${conn.owner}/${conn.repo}`}
                        </span>
                        {conn.repo === '*' ? (
                          <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                            alle repos
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                            {conn.defaultBranch}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        {conn.tokenSetAt ? (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            Token set {formatDate(conn.tokenSetAt)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                            No token — agent runs will fail
                          </span>
                        )}
                        <span>Added by {conn.createdBy.name}</span>
                        <span>{formatDate(conn.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {conn.tokenSetAt && (
                        <button
                          onClick={() => handleClearToken(conn.id)}
                          className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
                        >
                          Clear token
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(conn)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(conn)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">About GitHub tokens</p>
        <ul className="space-y-1 text-blue-700 text-xs">
          <li>• Use a <strong>fine-grained personal access token</strong> scoped to the specific repository</li>
          <li>• Required permissions: Contents (read/write), Pull requests (read/write), Issues (read/write)</li>
          <li>• Tokens are encrypted with AES-256-GCM before being stored in the database</li>
          <li>• Tokens are never returned by the API — only the date they were set</li>
        </ul>
      </div>
    </div>
  )
}
