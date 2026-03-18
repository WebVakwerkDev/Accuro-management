import { notFound } from 'next/navigation'
import Link from 'next/link'
import db from '@/lib/db'
import { formatDate, formatDateTime } from '@/lib/utils'

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function priorityColor(p: string) {
  const map: Record<string, string> = {
    URGENT: 'text-red-700 bg-red-100',
    HIGH: 'text-orange-700 bg-orange-100',
    MEDIUM: 'text-blue-700 bg-blue-100',
    LOW: 'text-gray-600 bg-gray-100',
  }
  return map[p] ?? 'text-gray-600 bg-gray-100'
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db.project.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: { select: { id: true, name: true, companyName: true } },
      createdBy: { select: { name: true } },
      tickets: {
        where: { deletedAt: null },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: { assignedTo: { select: { name: true } } },
      },
      feedbackRounds: { orderBy: { roundNumber: 'asc' } },
    },
  })

  if (!project) notFound()

  const maxFeedbackRounds = project.packageType === 'PREMIUM' ? 4 : 2
  const openTickets = project.tickets.filter((t) => !['DONE', 'CANCELLED'].includes(t.status))

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/projects" className="hover:text-gray-700">Projects</Link>
        <span>/</span>
        <span>{project.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{project.title}</h2>
          <div className="flex items-center gap-2 mt-2">
            <Link href={`/clients/${project.client.id}`} className="text-sm text-blue-600 hover:underline">
              {project.client.companyName ?? project.client.name}
            </Link>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">Created by {project.createdBy.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${
            project.packageType === 'PREMIUM' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {project.packageType}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
            {statusLabel(project.status)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          {project.description && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{project.description}</p>
            </div>
          )}

          {/* Feedback Rounds */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Feedback Rounds</h3>
              <span className="text-sm text-gray-500">
                {project.feedbackRoundsUsed} / {maxFeedbackRounds} included
              </span>
            </div>
            {project.feedbackRounds.length === 0 ? (
              <p className="text-sm text-gray-400">No feedback rounds yet</p>
            ) : (
              <div className="space-y-2">
                {project.feedbackRounds.map((round) => (
                  <div key={round.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      Round #{round.roundNumber}
                      {round.isExtraWork && (
                        <span className="ml-2 text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                          Extra Work
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2 text-gray-500">
                      <span>{statusLabel(round.status)}</span>
                      <span>{formatDate(round.openedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tickets */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                Tickets <span className="text-gray-400 font-normal text-sm">({openTickets.length} open)</span>
              </h3>
              <Link
                href={`/tickets?projectId=${project.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {project.tickets.slice(0, 10).map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ticket.title}</p>
                    {ticket.assignedTo && (
                      <p className="text-xs text-gray-400">{ticket.assignedTo.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${priorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                    <span className="text-xs text-gray-500">{statusLabel(ticket.status)}</span>
                  </div>
                </Link>
              ))}
              {project.tickets.length === 0 && (
                <p className="text-sm text-gray-400 px-5 py-4">No tickets yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Project Details</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium mt-0.5">{statusLabel(project.status)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Approval</dt>
                <dd className="font-medium mt-0.5">{statusLabel(project.approvalStatus)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Payment</dt>
                <dd className="font-medium mt-0.5">{statusLabel(project.paymentStatus)}</dd>
              </div>
              {project.startDate && (
                <div>
                  <dt className="text-gray-500">Start Date</dt>
                  <dd className="font-medium mt-0.5">{formatDate(project.startDate)}</dd>
                </div>
              )}
              {project.targetDeadline && (
                <div>
                  <dt className="text-gray-500">Deadline</dt>
                  <dd className="font-medium mt-0.5">{formatDate(project.targetDeadline)}</dd>
                </div>
              )}
              {project.goLiveDate && (
                <div>
                  <dt className="text-gray-500">Go-Live</dt>
                  <dd className="font-medium mt-0.5">{formatDate(project.goLiveDate)}</dd>
                </div>
              )}
            </dl>
          </div>

          {project.deliverables.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Deliverables</h3>
              <ul className="space-y-1">
                {project.deliverables.map((d, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
