import { notFound } from 'next/navigation'
import Link from 'next/link'
import db from '@/lib/db'
import { formatDate, formatDateTime } from '@/lib/utils'
import DevelopmentTab from './development-tab'

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

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ticket = await db.ticket.findFirst({
    where: { id, deletedAt: null },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          packageType: true,
          client: { select: { id: true, name: true } },
        },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true } },
        },
      },
      attachments: true,
    },
  })

  if (!ticket) notFound()

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/tickets" className="hover:text-gray-700">Tickets</Link>
        {ticket.project && (
          <>
            <span>/</span>
            <Link href={`/projects/${ticket.project.id}`} className="hover:text-gray-700">
              {ticket.project.title}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="truncate max-w-xs">{ticket.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${priorityColor(ticket.priority)}`}>
              {ticket.priority}
            </span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{ticket.type}</span>
            {ticket.isExtraWork && (
              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Extra Work</span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{ticket.title}</h2>
        </div>
        <span className="flex-shrink-0 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
          {statusLabel(ticket.status)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          {ticket.description && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{ticket.description}</p>
            </div>
          )}

          {/* Labels */}
          {ticket.labels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {ticket.labels.map((label) => (
                <span key={label} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Comments */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                Comments <span className="text-gray-400 font-normal">({ticket.comments.length})</span>
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {ticket.comments.length === 0 ? (
                <p className="text-sm text-gray-400 px-5 py-4">No comments yet</p>
              ) : (
                ticket.comments.map((comment) => (
                  <div key={comment.id} className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-semibold text-blue-700">
                          {comment.author.name.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{comment.author.name}</span>
                      <span className="text-xs text-gray-400">{formatDateTime(comment.createdAt)}</span>
                      {comment.isInternal && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Internal</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line pl-9">{comment.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Details</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Project</dt>
                <dd className="font-medium mt-0.5">
                  {ticket.project ? (
                    <Link href={`/projects/${ticket.project.id}`} className="text-blue-600 hover:underline">
                      {ticket.project.title}
                    </Link>
                  ) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Assigned to</dt>
                <dd className="font-medium mt-0.5">{ticket.assignedTo?.name ?? 'Unassigned'}</dd>
              </div>
              {ticket.dueDate && (
                <div>
                  <dt className="text-gray-500">Due Date</dt>
                  <dd className={`font-medium mt-0.5 ${ticket.dueDate < new Date() ? 'text-red-600' : ''}`}>
                    {formatDate(ticket.dueDate)}
                  </dd>
                </div>
              )}
              {ticket.estimatedHours && (
                <div>
                  <dt className="text-gray-500">Estimated Hours</dt>
                  <dd className="font-medium mt-0.5">{Number(ticket.estimatedHours)}h</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd className="font-medium mt-0.5">{formatDate(ticket.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Updated</dt>
                <dd className="font-medium mt-0.5">{formatDate(ticket.updatedAt)}</dd>
              </div>
            </dl>
          </div>

        </div>
      </div>

      {/* Development tab */}
      <div className="max-w-4xl">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Development
        </h3>
        <DevelopmentTab ticketId={ticket!.id} />
      </div>
    </div>
  )
}
