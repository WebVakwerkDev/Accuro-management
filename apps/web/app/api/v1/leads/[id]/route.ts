import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import {
  requireAuth,
  isAuthContext,
  requirePermission,
  parseBody,
  ok,
  created,
  notFound,
  forbidden,
  withErrorHandler,
} from '@/lib/api-helpers'
import { updateLeadSchema, convertLeadSchema } from '@/lib/validations/lead'
import { logActivity, recordStatusChange } from '@/lib/audit'
import { notifyStatusChanged } from '@/lib/notifications'

type Params = { params: Promise<{ id: string }> }

export const GET = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'leads:read')
  if (permErr) return permErr

  const lead = await db.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  })

  if (!lead) return notFound('Lead not found')
  return ok(lead)
})

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'leads:write')
  if (permErr) return permErr

  const lead = await db.lead.findFirst({ where: { id, deletedAt: null } })
  if (!lead) return notFound('Lead not found')

  const body = await parseBody(req, updateLeadSchema)
  if (body instanceof NextResponse) return body
  const data = body

  const oldStatus = lead.status
  const updated = await db.lead.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.clientId !== undefined && { clientId: data.clientId }),
      ...(data.contactName !== undefined && { contactName: data.contactName }),
      ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail }),
      ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
      ...(data.companyName !== undefined && { companyName: data.companyName }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.source !== undefined && { source: data.source }),
      ...(data.estimatedValue !== undefined && { estimatedValue: data.estimatedValue }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
    },
  })

  const tasks: Promise<unknown>[] = [
    logActivity({
      entityType: 'lead',
      entityId: id,
      userId: auth.userId,
      action: 'updated',
      metadata: { changes: data },
      req,
    }),
  ]

  if (data.status && data.status !== oldStatus) {
    tasks.push(
      recordStatusChange({
        entityType: 'lead',
        entityId: id,
        fromStatus: oldStatus,
        toStatus: data.status,
        changedById: auth.userId,
      }),
      notifyStatusChanged('lead', id, updated.title, data.status, auth.userId)
    )
  }

  await Promise.all(tasks)
  return ok(updated)
})

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'leads:delete')
  if (permErr) return permErr

  const lead = await db.lead.findFirst({ where: { id, deletedAt: null } })
  if (!lead) return notFound('Lead not found')

  // Soft delete
  await db.lead.update({ where: { id }, data: { deletedAt: new Date() } })

  await logActivity({
    entityType: 'lead',
    entityId: id,
    userId: auth.userId,
    action: 'deleted',
    req,
  })

  return ok({ message: 'Lead deleted' })
})

// POST /api/v1/leads/[id]/convert — this is handled via a separate route file
// but we also support it here as an action
export const POST = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const url = req.nextUrl.pathname
  if (!url.endsWith('/convert')) {
    return notFound()
  }

  const permErr = requirePermission(auth, 'leads:convert')
  if (permErr) return permErr

  const lead = await db.lead.findFirst({
    where: { id, deletedAt: null },
    include: { client: true },
  })
  if (!lead) return notFound('Lead not found')
  if (lead.convertedToProjectId) {
    return forbidden('Lead already converted to project')
  }

  const body = await parseBody(req, convertLeadSchema)
  if (body instanceof NextResponse) return body
  const data = body

  const clientId = data.clientId ?? lead.clientId
  if (!clientId) {
    return forbidden('Lead must have a client to convert')
  }

  // Create project from lead in a transaction
  const project = await db.$transaction(async (tx) => {
    const proj = await tx.project.create({
      data: {
        title: data.title ?? lead.title,
        description: lead.description,
        clientId,
        packageType: data.packageType,
        createdById: auth.userId,
        assignedToId: data.assignedToId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        targetDeadline: data.targetDeadline ? new Date(data.targetDeadline) : undefined,
        notes: lead.notes,
      },
    })

    await tx.lead.update({
      where: { id },
      data: {
        status: 'CONVERTED_TO_PROJECT',
        convertedToProjectId: proj.id,
      },
    })

    return proj
  })

  await Promise.all([
    logActivity({
      entityType: 'lead',
      entityId: id,
      userId: auth.userId,
      action: 'converted_to_project',
      metadata: { projectId: project.id },
      req,
    }),
    logActivity({
      entityType: 'project',
      entityId: project.id,
      userId: auth.userId,
      action: 'created',
      metadata: { fromLeadId: id },
      req,
    }),
  ])

  return created(project)
})
