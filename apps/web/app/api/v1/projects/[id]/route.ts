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
  badRequest,
  withErrorHandler,
} from '@/lib/api-helpers'
import { updateProjectSchema, openFeedbackRoundSchema } from '@/lib/validations/project'
import { logActivity, recordStatusChange } from '@/lib/audit'
import { notifyStatusChanged, notifyFeedbackRoundExceeded } from '@/lib/notifications'

type Params = { params: Promise<{ id: string }> }

export const GET = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'projects:read')
  if (permErr) return permErr

  const project = await db.project.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(auth.role === 'DEVELOPER' ? { assignedToId: auth.userId } : {}),
    },
    include: {
      client: true,
      createdBy: { select: { id: true, name: true, email: true } },
      tickets: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, name: true } },
        },
      },
      feedbackRounds: { orderBy: { roundNumber: 'asc' } },
    },
  })

  if (!project) return notFound('Project not found')
  return ok(project)
})

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'projects:write')
  if (permErr) return permErr

  const project = await db.project.findFirst({ where: { id, deletedAt: null } })
  if (!project) return notFound('Project not found')

  const body = await parseBody(req, updateProjectSchema)
  if (body instanceof NextResponse) return body
  const data = body

  const oldStatus = project.status
  const { statusReason, ...updateData } = data

  const updated = await db.project.update({
    where: { id },
    data: {
      ...(updateData.title !== undefined && { title: updateData.title }),
      ...(updateData.description !== undefined && { description: updateData.description }),
      ...(updateData.status !== undefined && { status: updateData.status }),
      ...(updateData.packageType !== undefined && { packageType: updateData.packageType }),
      ...(updateData.assignedToId !== undefined && { assignedToId: updateData.assignedToId }),
      ...(updateData.approvalStatus !== undefined && { approvalStatus: updateData.approvalStatus }),
      ...(updateData.paymentStatus !== undefined && { paymentStatus: updateData.paymentStatus }),
      ...(updateData.startDate !== undefined && {
        startDate: updateData.startDate ? new Date(updateData.startDate) : null,
      }),
      ...(updateData.targetDeadline !== undefined && {
        targetDeadline: updateData.targetDeadline ? new Date(updateData.targetDeadline) : null,
      }),
      ...(updateData.goLiveDate !== undefined && {
        goLiveDate: updateData.goLiveDate ? new Date(updateData.goLiveDate) : null,
      }),
      ...(updateData.deliverables !== undefined && { deliverables: updateData.deliverables }),
      ...(updateData.notes !== undefined && { notes: updateData.notes }),
    },
  })

  const tasks: Promise<unknown>[] = [
    logActivity({
      entityType: 'project',
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
        entityType: 'project',
        entityId: id,
        fromStatus: oldStatus,
        toStatus: data.status,
        changedById: auth.userId,
        reason: statusReason,
      }),
      notifyStatusChanged('project', id, updated.title, data.status, auth.userId)
    )
  }

  await Promise.all(tasks)
  return ok(updated)
})

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'projects:delete')
  if (permErr) return permErr

  const project = await db.project.findFirst({ where: { id, deletedAt: null } })
  if (!project) return notFound('Project not found')

  await db.project.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })

  await logActivity({
    entityType: 'project',
    entityId: id,
    userId: auth.userId,
    action: 'deleted',
    req,
  })

  return ok({ message: 'Project deleted' })
})

// POST /api/v1/projects/[id] — handles /feedback-round action
export const POST = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const url = req.nextUrl.pathname
  if (!url.endsWith('/feedback-round')) {
    return notFound()
  }

  const permErr = requirePermission(auth, 'projects:manage')
  if (permErr) return permErr

  const project = await db.project.findFirst({
    where: { id, deletedAt: null },
  })
  if (!project) return notFound('Project not found')

  const body = await parseBody(req, openFeedbackRoundSchema)
  if (body instanceof NextResponse) return body
  const data = body

  const maxRounds = project.packageType === 'PREMIUM' ? 4 : 2
  const isExtraWork = project.feedbackRoundsUsed >= maxRounds
  const roundNumber = project.feedbackRoundsUsed + 1

  const [feedbackRound] = await db.$transaction([
    db.feedbackRound.create({
      data: {
        projectId: id,
        roundNumber,
        notes: data.notes,
        isExtraWork,
        status: isExtraWork ? 'EXTRA_WORK' : 'OPEN',
      },
    }),
    db.project.update({
      where: { id },
      data: { feedbackRoundsUsed: { increment: 1 } },
    }),
  ])

  const tasks: Promise<unknown>[] = [
    logActivity({
      entityType: 'project',
      entityId: id,
      userId: auth.userId,
      action: 'feedback_round_opened',
      metadata: { roundNumber, isExtraWork },
      req,
    }),
  ]

  if (isExtraWork) {
    tasks.push(notifyFeedbackRoundExceeded(id, project.title, roundNumber))
  }

  await Promise.all(tasks)
  return created(feedbackRound)
})
