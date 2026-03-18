import { notFound } from 'next/navigation'
import Link from 'next/link'
import db from '@/lib/db'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils'

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const lead = await db.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: true,
      createdBy: { select: { id: true, name: true, email: true } },
      convertedToProject: {
        select: { id: true, title: true, status: true },
      },
    },
  })

  if (!lead) notFound()

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/leads" className="hover:text-gray-700">Leads</Link>
            <span>/</span>
            <span>{lead.title}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{lead.title}</h2>
          <p className="text-sm text-gray-500 mt-1">Created {formatDateTime(lead.createdAt)} by {lead.createdBy.name}</p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
          {statusLabel(lead.status)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Lead Information</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Contact</dt>
                <dd className="font-medium text-gray-900">{lead.contactName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{lead.contactEmail ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">{lead.contactPhone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Company</dt>
                <dd className="font-medium text-gray-900">{lead.companyName ?? lead.client?.companyName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Source</dt>
                <dd className="font-medium text-gray-900">{lead.source ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Estimated Value</dt>
                <dd className="font-medium text-gray-900">
                  {lead.estimatedValue ? formatCurrency(Number(lead.estimatedValue)) : '—'}
                </dd>
              </div>
            </dl>
            {lead.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-900 whitespace-pre-line">{lead.description}</p>
              </div>
            )}
            {lead.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-900 whitespace-pre-line">{lead.notes}</p>
              </div>
            )}
          </div>

          {/* Converted project */}
          {lead.convertedToProject && (
            <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5">
              <h3 className="font-semibold text-indigo-900 mb-2">Converted to Project</h3>
              <Link
                href={`/projects/${lead.convertedToProject.id}`}
                className="text-indigo-700 hover:underline font-medium"
              >
                {lead.convertedToProject.title}
              </Link>
              <span className="ml-2 text-xs text-indigo-500">
                {statusLabel(lead.convertedToProject.status)}
              </span>
            </div>
          )}

        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Details</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium mt-0.5">{statusLabel(lead.status)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Client</dt>
                <dd className="font-medium mt-0.5">
                  {lead.client ? (
                    <Link href={`/clients/${lead.client.id}`} className="text-blue-600 hover:underline">
                      {lead.client.name}
                    </Link>
                  ) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd className="font-medium mt-0.5">{formatDate(lead.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Updated</dt>
                <dd className="font-medium mt-0.5">{formatDate(lead.updatedAt)}</dd>
              </div>
            </dl>
          </div>

        </div>
      </div>
    </div>
  )
}
