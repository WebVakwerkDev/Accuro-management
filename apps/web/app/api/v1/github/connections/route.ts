/**
 * GET  /api/v1/github/connections  — list active GitHub connections (for linking UI)
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

const CreateConnectionSchema = z.object({
  owner: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid GitHub owner'),
  repo:  z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid GitHub repo'),
  defaultBranch:  z.string().min(1).max(255).default('main'),
  installationId: z.string().max(100).optional(),
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
      createdAt: true,
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

  // Prevent duplicate owner/repo combinations.
  const existing = await db.gitHubConnection.findUnique({
    where: { owner_repo: { owner: body.owner, repo: body.repo } },
  })
  if (existing) {
    if (existing.isActive) return conflict(`Connection ${body.owner}/${body.repo} already exists`)
    // Reactivate a previously deactivated connection.
    const reactivated = await db.gitHubConnection.update({
      where: { id: existing.id },
      data: { isActive: true, defaultBranch: body.defaultBranch, installationId: body.installationId ?? null },
    })
    return ok(reactivated)
  }

  const connection = await db.gitHubConnection.create({
    data: {
      owner: body.owner,
      repo: body.repo,
      defaultBranch: body.defaultBranch,
      installationId: body.installationId ?? null,
      createdById: auth.userId,
    },
    select: {
      id: true, owner: true, repo: true, defaultBranch: true,
      installationId: true, createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  })

  await logActivity({
    entityType: 'github_connection',
    entityId: connection.id,
    userId: auth.userId,
    action: 'created',
    metadata: { owner: body.owner, repo: body.repo },
    req,
  })

  return created(connection)
})
