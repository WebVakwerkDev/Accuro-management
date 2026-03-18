/**
 * GET /api/v1/agent-runs/:id  — get full details of a single agent run
 */

import { NextRequest } from 'next/server'
import db from '@/lib/db'
import {
  ok, notFound,
  requireAuth, isAuthContext, requirePermission, withErrorHandler,
} from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export const GET = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'agent:read')
  if (permErr) return permErr

  const run = await db.agentRun.findUnique({
    where: { id },
    include: {
      startedBy: { select: { id: true, name: true } },
      repositoryLink: {
        include: {
          githubConnection: { select: { owner: true, repo: true, defaultBranch: true } },
        },
      },
      events: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!run) return notFound('Agent run not found')

  // Strip inputSnapshot from response (large, internal-only).
  // outputData is safe to expose — it's agent-generated structured output.
  const { inputSnapshot: _snap, ...safeRun } = run

  return ok(safeRun)
})
