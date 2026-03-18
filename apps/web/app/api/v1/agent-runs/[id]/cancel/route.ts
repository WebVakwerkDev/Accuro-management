/**
 * POST /api/v1/agent-runs/:id/cancel  — cancel an in-progress agent run
 */

import { NextRequest } from 'next/server'
import db from '@/lib/db'
import {
  ok, notFound, badRequest,
  requireAuth, isAuthContext, requirePermission, withErrorHandler,
} from '@/lib/api-helpers'
import { logActivity } from '@/lib/audit'
import { createTimelineEntry } from '@/lib/timeline'

const CANCELLABLE_STATUSES = ['PENDING', 'QUEUED', 'RUNNING'] as const

type Params = { params: Promise<{ id: string }> }

export const POST = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'agent:cancel')
  if (permErr) return permErr

  const run = await db.agentRun.findUnique({
    where: { id },
    include: {
      repositoryLink: {
        include: { githubConnection: { select: { owner: true, repo: true } } },
      },
    },
  })
  if (!run) return notFound('Agent run not found')

  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(run.status)) {
    return badRequest(`Cannot cancel a run with status: ${run.status}`)
  }

  const cancelled = await db.agentRun.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      completedAt: new Date(),
      errorMessage: `Cancelled by user ${auth.userId}`,
    },
  })

  await db.agentRunEvent.create({
    data: {
      agentRunId: id,
      type: 'info',
      message: `Run cancelled by ${auth.userId}`,
    },
  })

  await Promise.all([
    logActivity({
      entityType: 'ticket',
      entityId: run.ticketId,
      userId: auth.userId,
      action: 'agent_run_cancelled',
      metadata: { agentRunId: id, runType: run.runType },
      req,
    }),
    createTimelineEntry({
      ticketId: run.ticketId,
      type: 'AGENT_RUN_COMPLETED',
      authorId: auth.userId,
      metadata: {
        agentRunId: id,
        runType: run.runType,
        status: 'CANCELLED',
        owner: run.repositoryLink.githubConnection.owner,
        repo: run.repositoryLink.githubConnection.repo,
      },
    }),
  ])

  return ok(cancelled)
})
