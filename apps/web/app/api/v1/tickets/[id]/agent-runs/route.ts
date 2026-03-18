/**
 * GET  /api/v1/tickets/:id/agent-runs  — list agent runs for a ticket
 * POST /api/v1/tickets/:id/agent-runs  — trigger a new agent run
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import db from '@/lib/db'
import {
  ok, created, notFound, badRequest, conflict,
  requireAuth, isAuthContext, requirePermission, parseBody, withErrorHandler,
  parsePagination, paginationMeta,
} from '@/lib/api-helpers'
import { logActivity } from '@/lib/audit'
import { createTimelineEntry } from '@/lib/timeline'
import { buildAgentContext, type AgentContextOptions } from '@/lib/agent-context'
import { dispatchAgentRun } from '@/lib/agent-dispatch'

// Run types that only require agent:run permission (safe, read-oriented or low-risk writes)
const STANDARD_RUN_TYPES = ['PLAN', 'CREATE_ISSUE', 'UPDATE_ISSUE', 'PREPARE_CHANGES', 'OPEN_PR_DRAFT'] as const

// Run types that require the elevated agent:code permission
const CODE_AGENT_RUN_TYPES = ['RUN_CODE_AGENT'] as const

const ALL_RUN_TYPES = [...STANDARD_RUN_TYPES, ...CODE_AGENT_RUN_TYPES] as const

const CreateAgentRunSchema = z.object({
  repositoryLinkId:       z.string().min(1),
  runType:                z.enum(ALL_RUN_TYPES),
  instructions:           z.string().max(2000).optional(),
  includeTimeline:        z.boolean().default(true),
  includeCommunications:  z.boolean().default(true),
  includeReferences:      z.boolean().default(true),
  includeWikiLinks:       z.boolean().default(true),
})

type Params = { params: Promise<{ id: string }> }

export const GET = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id: ticketId } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'agent:read')
  if (permErr) return permErr

  const ticket = await db.ticket.findFirst({ where: { id: ticketId, deletedAt: null } })
  if (!ticket) return notFound('Ticket not found')

  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams)

  const [total, runs] = await Promise.all([
    db.agentRun.count({ where: { ticketId } }),
    db.agentRun.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        startedBy: { select: { id: true, name: true } },
        repositoryLink: {
          include: {
            githubConnection: { select: { owner: true, repo: true } },
          },
        },
        events: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, type: true, message: true, createdAt: true },
        },
      },
    }),
  ])

  // Never expose inputSnapshot in the list view — it can contain large payloads.
  const safeRuns = runs.map(({ inputSnapshot: _snap, outputData, ...rest }) => ({
    ...rest,
    hasOutputData: outputData !== null,
  }))

  return ok(safeRuns, paginationMeta(total, page, limit))
})

export const POST = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id: ticketId } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const body = await parseBody(req, CreateAgentRunSchema)
  if (body instanceof Response) return body

  // Permission check depends on run type.
  const isCodeAgent = (CODE_AGENT_RUN_TYPES as readonly string[]).includes(body.runType)
  const requiredPerm = isCodeAgent ? 'agent:code' : 'agent:run'
  const permErr = requirePermission(auth, requiredPerm)
  if (permErr) return permErr

  const ticket = await db.ticket.findFirst({ where: { id: ticketId, deletedAt: null } })
  if (!ticket) return notFound('Ticket not found')

  // Verify the repo link belongs to this ticket.
  const repoLink = await db.ticketRepositoryLink.findUnique({
    where: { id: body.repositoryLinkId },
    include: { githubConnection: true },
  })
  if (!repoLink || repoLink.ticketId !== ticketId) return notFound('Repository link not found on this ticket')

  // Prevent duplicate concurrent runs of RUN_CODE_AGENT on the same ticket+repo.
  if (isCodeAgent) {
    const activeCodeRun = await db.agentRun.findFirst({
      where: {
        ticketId,
        repositoryLinkId: body.repositoryLinkId,
        runType: 'RUN_CODE_AGENT',
        status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
      },
    })
    if (activeCodeRun) {
      return conflict('A code agent run is already active for this ticket and repository. Cancel it first.')
    }
  }

  // Build sanitized context snapshot — this is stored with the run for auditability.
  const contextOptions: AgentContextOptions = {
    includeTimeline:       body.includeTimeline,
    includeCommunications: body.includeCommunications,
    includeReferences:     body.includeReferences,
    includeWikiLinks:      body.includeWikiLinks,
    instructions:          body.instructions ?? '',
  }
  const context = await buildAgentContext(ticketId, body.repositoryLinkId, contextOptions)

  // Create the run record in PENDING state.
  const run = await db.agentRun.create({
    data: {
      ticketId,
      repositoryLinkId: body.repositoryLinkId,
      runType: body.runType,
      status: 'PENDING',
      startedById: auth.userId,
      inputSnapshot: context as any,
    },
    include: {
      startedBy: { select: { id: true, name: true } },
      repositoryLink: {
        include: { githubConnection: { select: { owner: true, repo: true } } },
      },
    },
  })

  // Timeline + audit (fire-and-forget alongside dispatch).
  const sideEffects: Promise<unknown>[] = [
    logActivity({
      entityType: 'ticket',
      entityId: ticketId,
      userId: auth.userId,
      action: 'agent_run_started',
      metadata: {
        agentRunId: run.id,
        runType: body.runType,
        repo: `${repoLink.githubConnection.owner}/${repoLink.githubConnection.repo}`,
      },
      req,
    }),
    createTimelineEntry({
      ticketId,
      type: 'AGENT_RUN_STARTED',
      authorId: auth.userId,
      metadata: {
        agentRunId: run.id,
        runType: body.runType,
        owner: repoLink.githubConnection.owner,
        repo: repoLink.githubConnection.repo,
      },
    }),
  ]

  // Dispatch to external automation layer.
  let externalRunId: string | null = null
  let dispatchError: string | null = null
  try {
    externalRunId = await dispatchAgentRun(run.id, body.runType, context)
  } catch (err) {
    dispatchError = err instanceof Error ? err.message : String(err)
  }

  // Update run status based on dispatch outcome.
  const newStatus = dispatchError ? 'FAILED' : externalRunId ? 'QUEUED' : 'QUEUED'
  const updatedRun = await db.agentRun.update({
    where: { id: run.id },
    data: {
      status: dispatchError ? 'FAILED' : 'QUEUED',
      ...(externalRunId && { externalRunId }),
      ...(dispatchError && { errorMessage: `Dispatch failed: ${dispatchError}` }),
      ...(dispatchError && { completedAt: new Date() }),
    },
  })

  // Record dispatch event.
  sideEffects.push(
    db.agentRunEvent.create({
      data: {
        agentRunId: run.id,
        type: dispatchError ? 'error' : 'info',
        message: dispatchError
          ? `Dispatch failed: ${dispatchError}`
          : `Run dispatched${externalRunId ? ` (external id: ${externalRunId})` : ''}`,
      },
    })
  )

  await Promise.all(sideEffects)

  return created({ ...run, status: updatedRun.status, externalRunId: updatedRun.externalRunId })
})
