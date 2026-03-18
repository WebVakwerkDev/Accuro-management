/**
 * PATCH  /api/v1/github/connections/[id]  — update connection (token / branch)
 * DELETE /api/v1/github/connections/[id]  — deactivate connection
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import db from '@/lib/db'
import {
  ok, badRequest, notFound,
  requireAuth, isAuthContext, requirePermission, parseBody, withErrorHandler,
} from '@/lib/api-helpers'
import { logActivity } from '@/lib/audit'
import { encryptToken, validateGitHubToken } from '@/lib/github-token'

type Params = { params: Promise<{ id: string }> }

const UpdateConnectionSchema = z.object({
  defaultBranch: z.string().min(1).max(255).optional(),
  token:         z.string().min(1).max(500).optional(),
  clearToken:    z.boolean().optional(),
})

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'github:manage')
  if (permErr) return permErr

  const conn = await db.gitHubConnection.findFirst({ where: { id, isActive: true } })
  if (!conn) return notFound('GitHub connection not found')

  const body = await parseBody(req, UpdateConnectionSchema)
  if (body instanceof Response) return body

  let encToken: string | undefined = undefined
  let tokenSetAt: Date | null | undefined = undefined

  if (body.clearToken) {
    encToken = ''   // empty string = clear
    tokenSetAt = null
  } else if (body.token) {
    try {
      await validateGitHubToken(body.token, conn.owner, conn.repo)
      encToken = encryptToken(body.token)
      tokenSetAt = new Date()
    } catch (err: unknown) {
      return badRequest(err instanceof Error ? err.message : 'Token validation failed')
    }
  }

  const updated = await db.gitHubConnection.update({
    where: { id },
    data: {
      ...(body.defaultBranch !== undefined && { defaultBranch: body.defaultBranch }),
      ...(encToken !== undefined && { encryptedToken: encToken || null, tokenSetAt }),
    },
    select: {
      id: true, owner: true, repo: true, defaultBranch: true,
      installationId: true, tokenSetAt: true, createdAt: true, updatedAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  })

  await logActivity({
    entityType: 'github_connection',
    entityId: id,
    userId: auth.userId,
    action: 'updated',
    metadata: {
      updatedBranch: body.defaultBranch,
      tokenUpdated: !!body.token,
      tokenCleared: !!body.clearToken,
    },
    req,
  })

  return ok(updated)
})

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'github:manage')
  if (permErr) return permErr

  const conn = await db.gitHubConnection.findFirst({ where: { id, isActive: true } })
  if (!conn) return notFound('GitHub connection not found')

  // Check for active repo links before deactivating
  const activeLinks = await db.ticketRepositoryLink.count({
    where: { githubConnectionId: id },
  })
  if (activeLinks > 0) {
    return badRequest(
      `Cannot remove — ${activeLinks} ticket(s) still linked to this repository`
    )
  }

  await db.gitHubConnection.update({
    where: { id },
    data: { isActive: false, encryptedToken: null, tokenSetAt: null },
  })

  await logActivity({
    entityType: 'github_connection',
    entityId: id,
    userId: auth.userId,
    action: 'deleted',
    metadata: { owner: conn.owner, repo: conn.repo },
    req,
  })

  return ok({ message: 'Connection removed' })
})
