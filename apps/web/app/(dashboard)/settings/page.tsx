import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const headersList = await headers()
  const role = headersList.get('x-user-role')

  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN'
  if (!isAdmin) redirect('/')

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      <div className="grid grid-cols-1 gap-4">
        <Link
          href="/settings/users"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
        >
          <h3 className="font-semibold text-gray-900 mb-1">Users</h3>
          <p className="text-sm text-gray-500">Manage team members, roles and access</p>
        </Link>

        <Link
          href="/settings/api-keys"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
        >
          <h3 className="font-semibold text-gray-900 mb-1">API Keys</h3>
          <p className="text-sm text-gray-500">Manage API keys for n8n and external integrations</p>
        </Link>

        <Link
          href="/settings/github"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
        >
          <h3 className="font-semibold text-gray-900 mb-1">GitHub Connections</h3>
          <p className="text-sm text-gray-500">Link GitHub repositories and manage access tokens</p>
        </Link>
      </div>
    </div>
  )
}
