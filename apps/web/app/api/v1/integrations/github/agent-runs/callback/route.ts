/**
 * POST /api/v1/integrations/github/agent-runs/callback
 *
 * Webhook endpoint called by the external automation layer (n8n / worker)
 * to report agent run status updates.
 *
 * Security:
 *  - HMAC-SHA256 signature validated via X-Agent-Signature header
 *  - Body must be consumed as raw text for signature validation
 *  - No authentication cookie required (machine-to-machine)
 *  - Rate-limited at the infra level (e.g. Cloudflare / nginx)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import db from '@/lib/db'
import { ok, badRequest, serverError } from '@/lib/api-helpers'
import { validateCallbackSignature } from '@/lib/agent-callback-auth'
import { createTimelineEntry } from '@/lib/timeline'
import { logActivity } from '@/lib/audit'
import { logger } from '@/lib/logger'

const CallbackSchema = z.object({
  runId:         z.string().min(1),
  status:        z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']),
  externalRunId: z.string().optional(),
  outputSummary: z.string().max(2000).optional(),
  outputData:    z.record(z.unknown()).optional(),
  errorMessage:  z.string().max(2000).optional(),
  events:        z.array(z.object({
    type:     z.enum(['info', 'warning', 'error', 'progress']),
    message:  z.string().max(2000),
    metadata: z.record(z.unknown()).optional(),
  })).max(50).optional(),
})

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  // Read raw body first — needed for signature validation before parsing.
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return badRequest('Failed to read request body')
  }

  // Validate HMAC signature.
  const signature = req.headers.get('x-agent-signature')
  const valid = await validateCallbackSignature(rawBody, signature)
  if (!valid) {
    logger.warn('Agent callback rejected: invalid or missing signature', {
      signature: signature ? signature.substring(0, 20) + '…' : null,
    })
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof CallbackSchema>
  try {
    const parsed = CallbackSchema.safeParse(JSON.parse(rawBody))
    if (!parsed.success) {
      return badRequest('Invalid callback payload')
    }
    body = parsed.data
  } catch {
    return badRequest('Invalid JSON')
  }

  const run = await db.agentRun.findUnique({
    where: { id: body.runId },
    include: {
      repositoryLink: {
        include: { githubConnection: { select: { owner: true, repo: true } } },
      },
    },
  })

  if (!run) {
    logger.warn('Agent callback for unknown run', { runId: body.runId })
    // Return 200 to prevent retries for permanently missing runs.
    return ok({ message: 'Run not found, ignoring' })
  }

  // Idempotency: ignore callbacks for already-terminal runs.
  const terminalStatuses = ['SUCCEEDED', 'FAILED', 'CANCELLED']
  if (terminalStatuses.includes(run.status)) {
    return ok({ message: 'Run already in terminal state, ignoring' })
  }

  const isTerminal = terminalStatuses.includes(body.status)

  try {
    await db.$transaction(async (tx) => {
      await tx.agentRun.update({
        where: { id: run.id },
        data: {
          status: body.status,
          ...(body.externalRunId  && { externalRunId: body.externalRunId }),
          ...(body.outputSummary  && { outputSummary: body.outputSummary }),
          ...(body.outputData     && { outputData: body.outputData as any }),
          ...(body.errorMessage   && { errorMessage: body.errorMessage }),
          ...(isTerminal          && { completedAt: new Date() }),
        },
      })

      if (body.events?.length) {
        await tx.agentRunEvent.createMany({
          data: body.events.map((e) => ({
            agentRunId: run.id,
            type: e.type,
            message: e.message,
            metadata: (e.metadata as any) ?? undefined,
          })),
        })
      }
    })

    // Timeline event only on terminal status.
    if (isTerminal) {
      await Promise.all([
        createTimelineEntry({
          ticketId: run.ticketId,
          type: 'AGENT_RUN_COMPLETED',
          metadata: {
            agentRunId: run.id,
            runType: run.runType,
            status: body.status,
            outputSummary: body.outputSummary ?? null,
            owner: run.repositoryLink.githubConnection.owner,
            repo: run.repositoryLink.githubConnection.repo,
          },
        }),
        logActivity({
          entityType: 'ticket',
          entityId: run.ticketId,
          action: `agent_run_${body.status.toLowerCase()}`,
          metadata: {
            agentRunId: run.id,
            runType: run.runType,
            externalRunId: body.externalRunId,
          },
        }),
      ])
    }

    logger.info('Agent callback processed', {
      runId: run.id,
      status: body.status,
      isTerminal,
    })

    return ok({ message: 'Callback processed' })
  } catch (err) {
    logger.error('Agent callback processing failed', {
      error: err instanceof Error ? err.message : String(err),
      runId: run.id,
    })
    return serverError()
  }
}
