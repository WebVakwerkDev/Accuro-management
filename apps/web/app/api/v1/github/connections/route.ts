/**
 * GET  /api/v1/github/connections  — list active GitHub connections
 * POST /api/v1/github/connections  — register a new GitHub repo connection
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import db from '@/lib/db'
import {
  ok, created, badRequest, conflict,
  requireAuth, isAuthContext, requirePermission, parseBody, withErrorHandler,
} from '@/lib/api-helpers'
import { logActivity } from '@/lib/audit'
import { encryptToken, validateGitHubToken } from '@/lib/github-token'

const CreateConnectionSchema = z.object({
  owner:         z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid GitHub owner'),
  repo:          z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid GitHub repo'),
  defaultBranch: z.string().min(1).max(255).default('main'),
  token:         z.string().min(1).max(500).optional(),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'github:read')
  if (permErr) return permErr

  const connections = await db.gitHubConnection.findMany({
    where: { isActive: true },
    orderBy: [{ owner: 'asc' }, { repo: 'asc' }],
    select: {
      id: true,
      owner: true,
      repo: true,
      defaultBranch: true,
      installationId: true,
      tokenSetAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  })

  return ok(connections)
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'github:manage')
  if (permErr) return permErr

  const body = await parseBody(req, CreateConnectionSchema)
  if (body instanceof Response) return body

  // Validate token against GitHub API if provided
  let encToken: string | null = null
  let resolvedBranch = body.defaultBranch
  if (body.token) {
    try {
      const info = await validateGitHubToken(body.token, body.owner, body.repo)
      encToken = encryptToken(body.token)
      // Use the branch from GitHub if caller left default
      if (body.defaultBranch === 'main') resolvedBranch = info.defaultBranch
    } catch (err: unknown) {
      return badRequest(err instanceof Error ? err.message : 'Token validation failed')
    }
  }

  const existing = await db.gitHubConnection.findUnique({
    where: { owner_repo: { owner: body.owner, repo: body.repo } },
  })

  if (existing) {
    if (existing.isActive) return conflict(`Connection ${body.owner}/${body.repo} already exists`)
    // Reactivate
    const reactivated = await db.gitHubConnection.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        defaultBranch: resolvedBranch,
        ...(encToken !== null && { encryptedToken: encToken, tokenSetAt: new Date() }),
      },
      select: {
        id: true, owner: true, repo: true, defaultBranch: true,
        installationId: true, tokenSetAt: true, createdAt: true, updatedAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    })
    return ok(reactivated)
  }

  const connection = await db.gitHubConnection.create({
    data: {
      owner: body.owner,
      repo: body.repo,
      defaultBranch: resolvedBranch,
      encryptedToken: encToken,
      tokenSetAt: encToken ? new Date() : null,
      createdById: auth.userId,
    },
    select: {
      id: true, owner: true, repo: true, defaultBranch: true,
      installationId: true, tokenSetAt: true, createdAt: true, updatedAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  })

  await logActivity({
    entityType: 'github_connection',
    entityId: connection.id,
    userId: auth.userId,
    action: 'created',
    metadata: { owner: body.owner, repo: body.repo, hasToken: !!encToken },
    req,
  })

  return created(connection)
})
