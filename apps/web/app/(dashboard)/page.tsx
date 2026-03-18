import { headers } from 'next/headers'
import Link from 'next/link'
import db from '@/lib/db'
import { formatDate, formatRelativeTime } from '@/lib/utils'

async function getDashboardData(userId: string, role: string) {
  const isDeveloper = role === 'DEVELOPER'
  const projectFilter = isDeveloper ? { assignedToId: userId } : {}

  const [
    openLeads,
    activeProjects,
    openTickets,
    waitingForClient,
    urgentTickets,
    overdueTickets,
    recentActivity,
    activeProjectsList,
    recentLeads,
  ] = await Promise.all([
    isDeveloper
      ? Promise.resolve(0)
      : db.lead.count({
          where: { deletedAt: null, status: { notIn: ['CONVERTED_TO_PROJECT', 'REJECTED'] } },
        }),
    db.project.count({
      where: { deletedAt: null, ...projectFilter, status: { notIn: ['COMPLETED', 'CANCELLED', 'HANDED_OVER'] } },
    }),
    db.ticket.count({
      where: {
        deletedAt: null,
        ...(isDeveloper ? { assignedToId: userId } : {}),
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
    }),
    db.ticket.count({
      where: {
        deletedAt: null,
        ...(isDeveloper ? { assignedToId: userId } : {}),
        status: 'WAITING_FOR_CLIENT',
      },
    }),
    db.ticket.count({
      where: {
        deletedAt: null,
        ...(isDeveloper ? { assignedToId: userId } : {}),
        priority: 'URGENT',
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
    }),
    db.ticket.count({
      where: {
        deletedAt: null,
        ...(isDeveloper ? { assignedToId: userId } : {}),
        status: { notIn: ['DONE', 'CANCELLED'] },
        dueDate: { lt: new Date() },
      },
    }),
    db.activityLog.findMany({
      where: isDeveloper ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { user: { select: { id: true, name: true } } },
    }),
    db.project.findMany({
      where: { deletedAt: null, ...projectFilter, status: { notIn: ['COMPLETED', 'CANCELLED', 'HANDED_OVER'] } },
      take: 6,
      orderBy: { updatedAt: 'desc' },
      include: {
        client: { select: { name: true } },
        _count: {
          select: { tickets: { where: { deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] } } } },
        },
      },
    }),
    isDeveloper
      ? Promise.resolve([])
      : db.lead.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, title: true, status: true, companyName: true, estimatedValue: true, createdAt: true },
        }),
  ])

  return {
    stats: { openLeads, activeProjects, openTickets, waitingForClient, urgentTickets, overdueTickets },
    recentActivity,
    activeProjectsList,
    recentLeads,
  }
}

export default async function DashboardPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') ?? ''
  const role = headersList.get('x-user-role') ?? 'DEVELOPER'

  const { stats, recentActivity, activeProjectsList, recentLeads } =
    await getDashboardData(userId, role)

  const isDeveloper = role === 'DEVELOPER'
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Overview of agency operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {!isDeveloper && (
          <StatCard
            label="Open Leads"
            value={stats.openLeads}
            href="/leads"
            color="blue"
          />
        )}
        <StatCard label="Active Projects" value={stats.activeProjects} href="/projects" color="indigo" />
        <StatCard label="Open Tickets" value={stats.openTickets} href="/tickets" color="violet" />
        <StatCard label="Waiting Client" value={stats.waitingForClient} href="/tickets?status=WAITING_FOR_CLIENT" color="yellow" />
        <StatCard label="Urgent" value={stats.urgentTickets} href="/tickets?priority=URGENT" color="red" />
        <StatCard label="Overdue" value={stats.overdueTickets} href="/tickets" color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Active Projects</h3>
            <Link href="/projects" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {activeProjectsList.length === 0 ? (
              <p className="text-sm text-gray-400 px-5 py-6 text-center">No active projects</p>
            ) : (
              activeProjectsList.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{project.title}</p>
                    <p className="text-xs text-gray-500">{project.client.name}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-xs text-gray-500">{project._count.tickets} open tickets</span>
                    <StatusBadge status={project.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 px-5 py-6 text-center">No recent activity</p>
            ) : (
              recentActivity.map((log) => (
                <div key={log.id} className="px-5 py-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700">
                        <span className="font-medium">{log.user?.name ?? 'System'}</span>{' '}
                        <span className="text-gray-500">{log.action}</span>{' '}
                        <span className="text-gray-600">{log.entityType}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatRelativeTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      {!isDeveloper && recentLeads.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Leads</h3>
            <Link href="/leads" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Lead</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-blue-600 hover:underline">
                        {lead.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{lead.companyName ?? '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  href,
  color,
}: {
  label: string
  value: number
  href: string
  color: 'blue' | 'indigo' | 'violet' | 'yellow' | 'red' | 'orange' | 'green'
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    violet: 'bg-violet-50 text-violet-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
    green: 'bg-green-50 text-green-700',
  }

  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
    >
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const label = statusLabel(status)

  const colorMap: Record<string, string> = {
    KICKOFF: 'bg-slate-100 text-slate-700',
    IN_DEVELOPMENT: 'bg-blue-100 text-blue-700',
    WAITING_FOR_INPUT: 'bg-yellow-100 text-yellow-700',
    FEEDBACK_RECEIVED: 'bg-purple-100 text-purple-700',
    LIVE: 'bg-green-100 text-green-700',
    COMPLETED: 'bg-green-100 text-green-700',
    ON_HOLD: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-700',
    NEW_REQUEST: 'bg-blue-100 text-blue-700',
    APPROVAL_RECEIVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    CONVERTED_TO_PROJECT: 'bg-indigo-100 text-indigo-700',
  }

  const colorClass = colorMap[status] ?? 'bg-gray-100 text-gray-600'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  )
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
