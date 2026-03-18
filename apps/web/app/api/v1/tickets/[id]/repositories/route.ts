/**
 * GET  /api/v1/tickets/:id/repositories  — list repo links for a ticket
 * POST /api/v1/tickets/:id/repositories  — link a GitHub repo to a ticket
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import db from '@/lib/db'
import {
  ok, created, notFound, badRequest, conflict,
  requireAuth, isAuthContext, requirePermission, parseBody, withErrorHandler,
} from '@/lib/api-helpers'
import { logActivity } from '@/lib/audit'
import { createTimelineEntry } from '@/lib/timeline'
import { isOrgLevel, resolveRepoName } from '@/lib/github-token'

const LinkRepoSchema = z.object({
  githubConnectionId:      z.string().min(1),
  // required when the connection is org-level (repo = "*")
  repoName:                z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  linkedBranch:            z.string().max(255).optional(),
  linkedIssueNumber:       z.number().int().positive().optional(),
  linkedPullRequestNumber: z.number().int().positive().optional(),
  environmentUrl:          z.string().url().optional(),
})

type Params = { params: Promise<{ id: string }> }

export const GET = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id: ticketId } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'github:read')
  if (permErr) return permErr

  const ticket = await db.ticket.findFirst({ where: { id: ticketId, deletedAt: null } })
  if (!ticket) return notFound('Ticket not found')

  const links = await db.ticketRepositoryLink.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    include: {
      githubConnection: {
        select: { id: true, owner: true, repo: true, defaultBranch: true },
      },
      createdBy: { select: { id: true, name: true } },
      agentRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, runType: true, status: true, createdAt: true },
      },
    },
  })

  return ok(links)
})

export const POST = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id: ticketId } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'github:link')
  if (permErr) return permErr

  const ticket = await db.ticket.findFirst({ where: { id: ticketId, deletedAt: null } })
  if (!ticket) return notFound('Ticket not found')

  const body = await parseBody(req, LinkRepoSchema)
  if (body instanceof Response) return body

  const connection = await db.gitHubConnection.findUnique({
    where: { id: body.githubConnectionId, isActive: true },
  })
  if (!connection) return notFound('GitHub connection not found or inactive')

  // Org-level connections require repoName to know which repo this link is for.
  if (isOrgLevel(connection.repo) && !body.repoName) {
    return badRequest('repoName is required when using an org-level connection')
  }

  const effectiveRepo = resolveRepoName(connection.repo, body.repoName)

  const existing = await db.ticketRepositoryLink.findUnique({
    where: {
      ticketId_githubConnectionId: { ticketId, githubConnectionId: body.githubConnectionId },
    },
  })
  if (existing) {
    return conflict(`${connection.owner}/${effectiveRepo} is already linked to this ticket`)
  }

  const link = await db.ticketRepositoryLink.create({
    data: {
      ticketId,
      githubConnectionId: body.githubConnectionId,
      repoName:                body.repoName ?? null,
      linkedBranch:            body.linkedBranch ?? null,
      linkedIssueNumber:       body.linkedIssueNumber ?? null,
      linkedPullRequestNumber: body.linkedPullRequestNumber ?? null,
      environmentUrl:          body.environmentUrl ?? null,
      createdById: auth.userId,
    },
    include: {
      githubConnection: { select: { id: true, owner: true, repo: true, defaultBranch: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  await Promise.all([
    logActivity({
      entityType: 'ticket',
      entityId: ticketId,
      userId: auth.userId,
      action: 'github_repo_linked',
      metadata: { owner: connection.owner, repo: effectiveRepo, repoLinkId: link.id },
      req,
    }),
    createTimelineEntry({
      ticketId,
      type: 'GITHUB_LINKED',
      authorId: auth.userId,
      metadata: {
        repoLinkId: link.id,
        owner: connection.owner,
        repo: effectiveRepo,
        linkedBranch: body.linkedBranch ?? null,
        linkedIssueNumber: body.linkedIssueNumber ?? null,
        linkedPullRequestNumber: body.linkedPullRequestNumber ?? null,
      },
    }),
  ])

  return created(link)
})
