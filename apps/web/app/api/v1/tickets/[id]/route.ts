import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import {
  requireAuth,
  isAuthContext,
  requirePermission,
  parseBody,
  ok,
  notFound,
  badRequest,
  withErrorHandler,
} from '@/lib/api-helpers'
import { updateTicketSchema } from '@/lib/validations/ticket'
import { logActivity, recordStatusChange } from '@/lib/audit'
import { notifyTicketAssigned, notifyStatusChanged } from '@/lib/notifications'
import { isValidTicketTransition } from '@/lib/transitions'

type Params = { params: Promise<{ id: string }> }

export const GET = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'tickets:read')
  if (permErr) return permErr

  const ticket = await db.ticket.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(auth.role === 'DEVELOPER' ? { assignedToId: auth.userId } : {}),
    },
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
          attachments: true,
        },
      },
      attachments: true,
    },
  })

  if (!ticket) return notFound('Ticket not found')
  return ok(ticket)
})

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'tickets:write')
  if (permErr) return permErr

  const ticket = await db.ticket.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(auth.role === 'DEVELOPER' ? { assignedToId: auth.userId } : {}),
    },
  })
  if (!ticket) return notFound('Ticket not found')

  const body = await parseBody(req, updateTicketSchema)
  if (body instanceof NextResponse) return body
  const data = body

  // Check assign permission
  if (data.assignedToId !== undefined) {
    const assignErr = requirePermission(auth, 'tickets:assign')
    if (assignErr) return assignErr
  }

  // Guard status transitions — reject invalid moves before touching the DB
  if (data.status && data.status !== ticket.status) {
    if (!isValidTicketTransition(ticket.status, data.status)) {
      return badRequest(
        `Invalid status transition: ${ticket.status} → ${data.status}`
      )
    }
  }

  const oldStatus = ticket.status
  const oldAssignee = ticket.assignedToId
  const { statusReason, ...updateData } = data

  const updated = await db.ticket.update({
    where: { id },
    data: {
      ...(updateData.title !== undefined && { title: updateData.title }),
      ...(updateData.description !== undefined && { description: updateData.description }),
      ...(updateData.status !== undefined && { status: updateData.status }),
      ...(updateData.priority !== undefined && { priority: updateData.priority }),
      ...(updateData.type !== undefined && { type: updateData.type }),
      ...(updateData.assignedToId !== undefined && { assignedToId: updateData.assignedToId }),
      ...(updateData.labels !== undefined && { labels: updateData.labels }),
      ...(updateData.dueDate !== undefined && {
        dueDate: updateData.dueDate ? new Date(updateData.dueDate) : null,
      }),
      ...(updateData.estimatedHours !== undefined && { estimatedHours: updateData.estimatedHours }),
      ...(updateData.isExtraWork !== undefined && { isExtraWork: updateData.isExtraWork }),
    },
  })

  const tasks: Promise<unknown>[] = [
    logActivity({
      entityType: 'ticket',
      entityId: id,
      userId: auth.userId,
      action: 'updated',
      metadata: { changes: updateData },
      req,
    }),
  ]

  if (data.status && data.status !== oldStatus) {
    tasks.push(
      recordStatusChange({
        entityType: 'ticket',
        entityId: id,
        fromStatus: oldStatus,
        toStatus: data.status,
        changedById: auth.userId,
        reason: statusReason,
      }),
      notifyStatusChanged('ticket', id, updated.title, data.status, auth.userId)
    )
  }

  if (
    data.assignedToId !== undefined &&
    data.assignedToId !== oldAssignee &&
    data.assignedToId
  ) {
    tasks.push(notifyTicketAssigned(id, updated.title, data.assignedToId))
  }

  await Promise.all(tasks)
  return ok(updated)
})

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'tickets:delete')
  if (permErr) return permErr

  const ticket = await db.ticket.findFirst({ where: { id, deletedAt: null } })
  if (!ticket) return notFound('Ticket not found')

  await db.ticket.update({ where: { id }, data: { deletedAt: new Date() } })

  await logActivity({
    entityType: 'ticket',
    entityId: id,
    userId: auth.userId,
    action: 'deleted',
    req,
  })

  return ok({ message: 'Ticket deleted' })
})
