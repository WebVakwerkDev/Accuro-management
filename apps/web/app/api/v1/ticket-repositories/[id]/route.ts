/**
 * PATCH  /api/v1/ticket-repositories/:id  — update branch/issue/PR link
 * DELETE /api/v1/ticket-repositories/:id  — remove repo link from ticket
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import db from '@/lib/db'
import {
  ok, notFound,
  requireAuth, isAuthContext, requirePermission, parseBody, withErrorHandler,
} from '@/lib/api-helpers'
import { logActivity } from '@/lib/audit'

const UpdateRepoLinkSchema = z.object({
  linkedBranch:           z.string().max(255).nullable().optional(),
  linkedIssueNumber:      z.number().int().positive().nullable().optional(),
  linkedPullRequestNumber: z.number().int().positive().nullable().optional(),
  environmentUrl:         z.union([z.string().url(), z.literal('')]).nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' })

type Params = { params: Promise<{ id: string }> }

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'github:link')
  if (permErr) return permErr

  const link = await db.ticketRepositoryLink.findUnique({
    where: { id },
    include: { githubConnection: true },
  })
  if (!link) return notFound('Repository link not found')

  const body = await parseBody(req, UpdateRepoLinkSchema)
  if (body instanceof Response) return body

  const updated = await db.ticketRepositoryLink.update({
    where: { id },
    data: {
      ...(body.linkedBranch !== undefined            && { linkedBranch: body.linkedBranch }),
      ...(body.linkedIssueNumber !== undefined       && { linkedIssueNumber: body.linkedIssueNumber }),
      ...(body.linkedPullRequestNumber !== undefined && { linkedPullRequestNumber: body.linkedPullRequestNumber }),
      ...(body.environmentUrl !== undefined          && { environmentUrl: body.environmentUrl || null }),
    },
    include: {
      githubConnection: { select: { id: true, owner: true, repo: true, defaultBranch: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  await logActivity({
    entityType: 'ticket',
    entityId: link.ticketId,
    userId: auth.userId,
    action: 'github_repo_link_updated',
    metadata: { repoLinkId: id, changes: body },
    req,
  })

  return ok(updated)
})

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'github:unlink')
  if (permErr) return permErr

  const link = await db.ticketRepositoryLink.findUnique({
    where: { id },
    include: { githubConnection: true },
  })
  if (!link) return notFound('Repository link not found')

  // Block deletion if there is an active agent run on this link.
  const activeRun = await db.agentRun.findFirst({
    where: {
      repositoryLinkId: id,
      status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
    },
  })
  if (activeRun) {
    return notFound(
      'Cannot remove repo link while an agent run is active. Cancel the run first.'
    )
  }

  await db.ticketRepositoryLink.delete({ where: { id } })

  await logActivity({
    entityType: 'ticket',
    entityId: link.ticketId,
    userId: auth.userId,
    action: 'github_repo_unlinked',
    metadata: {
      repoLinkId: id,
      owner: link.githubConnection.owner,
      repo: link.githubConnection.repo,
    },
    req,
  })

  return ok({ message: 'Repository link removed' })
})
